import { highpass, lowpass } from "./filters.ts";
import { rng } from "./rng.ts";
import type { Env, Preset, Voice, Wave } from "./types.ts";
import { SAMPLE_RATE } from "./wav.ts";

function osc(wave: Wave, phase: number, duty: number, rand: () => number): number {
  const f = phase - Math.floor(phase);
  switch (wave) {
    case "sine":
      return Math.sin(2 * Math.PI * phase);
    case "saw":
      return 2 * f - 1;
    case "square":
      return f < duty ? 1 : -1;
    case "triangle":
      return 4 * Math.abs(f - 0.5) - 1;
    case "noise":
      return 2 * rand() - 1;
  }
}

function envAt(env: Env | undefined, t: number, total: number): number {
  if (!env) return 1;
  const a = env.a ?? 0;
  const d = env.d ?? 0;
  const h = env.h ?? Math.max(0, total - a - d);
  if (t < a) return t / a;
  if (t < a + h) return 1;
  if (t >= a + h + d) return 0;
  const k = (t - a - h) / d;
  return env.exp ? Math.exp(-5 * k) : 1 - k;
}

function renderVoice(v: Voice, n: number, rate: number, rand: () => number): Float32Array {
  const out = new Float32Array(n);
  const total = (n * 1000) / rate;
  const from = v.hz ?? 440;
  const to = v.toHz ?? from;
  const gain = v.gain ?? 1;
  const duty = v.duty ?? 0.5;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    let x = osc(v.wave, phase, duty, rand);
    if (v.noise) x += v.noise * (2 * rand() - 1);
    out[i] = gain * x * envAt(v.env, (i * 1000) / rate, total);
    phase += (from + ((to - from) * i) / n) / rate;
  }
  if (v.lp) lowpass(out, v.lp, rate);
  if (v.hp) highpass(out, v.hp, rate);
  return out;
}

/** Сырой рендер пресета, без нормализации. */
export function render(preset: Preset, seed: number, rate: number = SAMPLE_RATE): Float32Array {
  const n = Math.round((preset.ms * rate) / 1000);
  const rand = rng(seed);
  const sum = new Float32Array(n);
  for (const v of preset.voices) {
    const s = renderVoice(v, n, rate, rand);
    for (let i = 0; i < n; i++) sum[i] += s[i];
  }
  if (preset.lp) for (let p = 0; p < (preset.lpPasses ?? 1); p++) lowpass(sum, preset.lp, rate);
  if (preset.fade) {
    // Выход (n − i)/F: на стыке перезапуска вход следующего клипа и выход этого в сумме дают 1
    const fi = Math.round((preset.fade.in * rate) / 1000);
    const fo = Math.round((preset.fade.out * rate) / 1000);
    for (let i = 0; i < fi && i < n; i++) sum[i] *= i / fi;
    for (let i = Math.max(0, n - fo); i < n; i++) sum[i] *= (n - i) / fo;
  }
  return sum;
}

/** Варианты звука с общим коэффициентом: разброс громкости между ними сохраняется. */
export function renderVariants(preset: Preset, seeds: number[], rate: number = SAMPLE_RATE): Float32Array[] {
  const all = seeds.map((seed) => render(preset, seed, rate));
  let max = 0;
  for (const s of all) for (let i = 0; i < s.length; i++) max = Math.max(max, Math.abs(s[i]));
  const k = max > 0 ? (preset.peak ?? 0.6) / max : 1;
  for (const s of all) for (let i = 0; i < s.length; i++) s[i] *= k;
  return all;
}
