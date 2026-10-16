// Метрика «похоже на эталон» для подбора пресетов: спектр по третьоктавам,
// спектр огибающей (ритм толчков), громкость, доля энергии выше 60 Гц
// (ниже ноутбук/телефон почти не играет) и неровность толчков.
import { readFileSync } from "node:fs";

const R = 44100;
const BANDS: number[] = [];
for (let f = 30; f < 3000; f *= 2 ** (1 / 3)) BANDS.push(f);

export type Features = { sp: number[]; ms: number[]; rms: number; above60: number; cvAmp: number; cvGap: number };

export function readWav(path: string): Float32Array {
  const b = readFileSync(path);
  let o = 12;
  while (b.toString("ascii", o, o + 4) !== "data") o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
  return out;
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k), s = Math.sin(a * k), u = i + k, v = u + len / 2;
        const tr = re[v] * c - im[v] * s, ti = re[v] * s + im[v] * c;
        re[v] = re[u] - tr;
        im[v] = im[u] - ti;
        re[u] += tr;
        im[u] += ti;
      }
  }
}

const cv = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((p, v) => p + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((p, v) => p + (v - m) ** 2, 0) / xs.length) / (m || 1);
};

/** Края (0,3 с в начале, 0,2 с в конце) отбрасываются — там вход/выход. */
export function features(s: Float32Array): Features {
  const from = Math.round(R * 0.3), to = s.length - Math.round(R * 0.2);
  const N = 4096, spec = new Float64Array(BANDS.length);
  let frames = 0, low = 0, all = 0, e2 = 0;
  for (let o = from; o + N < to; o += N / 2) {
    frames++;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = s[o + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * R) / N, p = re[k] ** 2 + im[k] ** 2;
      all += p;
      if (f < 60) low += p;
      const b = BANDS.findIndex((x, j) => f >= x && f < (BANDS[j + 1] ?? x * 1.26));
      if (b >= 0) spec[b] += p;
    }
  }
  const db = Array.from(spec, (v) => 10 * Math.log10(v / frames + 1e-9));
  const mx = Math.max(...db);
  const sp = db.map((v) => Math.max(v - mx, -50) / 50);

  // Огибающая: |x| → ФНЧ 80 Гц → 1 кГц
  const a = 1 - Math.exp((-2 * Math.PI * 80) / R);
  let y = 0;
  const env: number[] = [];
  for (let i = from; i < to; i++) {
    y += a * (Math.abs(s[i]) - y);
    e2 += s[i] * s[i];
    if (i % 44 === 0) env.push(y);
  }
  const M = 2048, re = new Float64Array(M), im = new Float64Array(M);
  const mean = env.reduce((p, v) => p + v, 0) / env.length;
  for (let i = 0; i < Math.min(M, env.length); i++) re[i] = (env[i] - mean) / (mean || 1);
  fft(re, im);
  const ms: number[] = [];
  const fr = 1002 / M;
  for (let f = 4; f <= 60; f += 2) {
    let p = 0;
    for (let k = Math.round(f / fr); k < Math.round((f + 2) / fr); k++) p += re[k] ** 2 + im[k] ** 2;
    ms.push(Math.sqrt(p));
  }

  // Толчки — локальные максимумы огибающей в окне ±10 мс выше среднего
  const peaks: number[] = [];
  for (let i = 10; i < env.length - 10; i++) {
    let top = env[i] > mean;
    for (let k = 1; k <= 10 && top; k++) top = env[i] >= env[i - k] && env[i] >= env[i + k];
    if (top) peaks.push(i);
  }
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
  return {
    sp,
    ms,
    rms: Math.sqrt(e2 / (to - from)),
    above60: all ? 1 - low / all : 0,
    cvAmp: cv(peaks.map((p) => env[p])),
    cvGap: cv(gaps),
  };
}

/** Расстояние от f до эталона ref; ритм огибающей нормирован по эталону. */
export function distance(f: Features, ref: Features): number {
  let d = 0;
  f.sp.forEach((v, i) => (d += (v - ref.sp[i]) ** 2));
  const b = Math.max(...ref.ms, 1e-9);
  let m = 0;
  f.ms.forEach((v, i) => (m += (v / b - ref.ms[i] / b) ** 2));
  return (
    d +
    0.5 * m +
    Math.log(f.rms / ref.rms) ** 2 +
    (f.above60 - ref.above60) ** 2 +
    10 * ((f.cvAmp - ref.cvAmp) ** 2 + (f.cvGap - ref.cvGap) ** 2)
  );
}
