import type { Classic } from "./types.ts";

// Повторяет цикл sfxr (jsfxr) шаг в шаг: порядок операций и целочисленный
// период важны — иначе копия звука разойдётся с оригиналом на слух.
const WAVES: Record<Classic["wave"], number> = { square: 0, saw: 1, sine: 2, noise: 3 };

export function renderClassic(v: Classic, n: number, rate: number, rand: () => number): Float32Array {
  return runClassic(v, n, rate, rand).out;
}

/** Сэмпл, на котором sfxr обрывает звук (конец огибающей или нижний предел тона). */
export function classicEnd(v: Classic, rate: number, max: number): number {
  return runClassic(v, max, rate, () => 0.5).end;
}

function runClassic(v: Classic, n: number, rate: number, rand: () => number): { out: Float32Array; end: number } {
  const out = new Float32Array(n);
  const sub = 8 * rate;
  const wave = WAVES[v.wave];
  const ms = (x: number): number => (x * rate) / 1000;

  let h = 0, l = 0, z = 0, K = 0, m = 0, N = 0, L = 0, M = 0, A = 0;
  const reset = (): void => {
    h = sub / v.hz;
    l = v.minHz ? sub / v.minHz : 1e5;
    z = 2 ** (-(v.slide ?? 0) / rate);
    K = (-(v.accel ?? 0) * Math.LN2) / (rate * rate);
    if (wave === 0) {
      m = v.duty ?? 0.5;
      N = (v.dutySlide ?? 0) / rate;
    }
    L = v.jump ? 1 / v.jump.ratio : 1;
    M = 0;
    A = v.jump ? ms(v.jump.ms) : 0;
  };
  reset();

  const att = ms(v.env.a), hold = ms(v.env.h), dec = ms(v.env.d);
  const punch = v.env.punch ?? 0;
  const lp = !!v.lp;
  const filtered = lp || !!v.hp;
  let r = v.hp ? (v.hp.hz * 2 * Math.PI) / sub : 0;
  const Q = v.hp ? 2 ** ((v.hp.slide ?? 0) / rate) : 1;
  let lw = v.lp ? (v.lp.hz * 2 * Math.PI) / sub : 0;
  const X = v.lp ? 2 ** ((v.lp.slide ?? 0) / sub) : 1;
  const res = v.lp?.res ?? 0;
  const damp = 1 - Math.min(0.8, (5 / (1 + res * res * 20)) * (0.01 + lw));
  const phaser = !!v.phaser;
  let D = v.phaser ? (v.phaser.ms * sub) / 1000 : 0;
  const dD = v.phaser ? (v.phaser.slide ?? 0) / 125 : 0;
  const S = v.repeat ? Math.round(ms(v.repeat)) : 0;
  const T = v.vib ? v.vib.depth : 0;
  const ca = v.vib ? (2 * Math.PI * v.vib.hz) / rate : 0;
  const gain = v.gain ?? 1;

  let stop = false, stage = 0, ev = 0, F = att, w = 0, V = 0, I = 0;
  let p = 0, u = 0, t = 0, B = 0, H = 0, s = 0;
  const C = new Float64Array(1024);
  const y = new Float64Array(32);
  for (let k = 0; k < 32; k++) y[k] = 2 * rand() - 1;

  let k = 0;
  for (; k < n; k++) {
    if (stop) break;
    if (S && ++V >= S) {
      V = 0;
      reset();
    }
    if (A && ++M >= A) {
      A = 0;
      h *= L;
    }
    z += K;
    h *= z;
    if (h > l) {
      h = l;
      if (v.stopAtMin) stop = true;
    }
    let g = h;
    if (T > 0) {
      I += ca;
      g *= 1 + Math.sin(I) * T;
    }
    g |= 0;
    if (g < 8) g = 8;
    if (wave === 0) m = Math.min(0.5, Math.max(0, m + N));
    if (++ev > F) {
      ev = 0;
      stage++;
      F = stage === 1 ? hold : dec;
    }
    if (stage === 0) w = ev / att;
    // Нулевая стадия проходится за сэмпл — без деления 0/0
    else if (stage === 1) w = hold ? 1 + 2 * (1 - ev / hold) * punch : 1;
    else if (stage === 2) w = dec ? 1 - ev / dec : 0;
    else {
      w = 0;
      stop = true;
    }
    if (phaser) {
      D += dD;
      s = D | 0;
      if (s < 0) s = -s;
      if (s > 1023) s = 1023;
    }
    if (filtered && Q) r = Math.min(0.1, Math.max(1e-5, r * Q));

    let q = 0;
    for (let j = 0; j < 8; j++) {
      p++;
      if (p >= g) {
        p %= g;
        if (wave === 3) for (let x = 0; x < 32; x++) y[x] = 2 * rand() - 1;
      }
      let c: number;
      if (wave === 0) c = p / g < m ? 0.5 : -0.5;
      else if (wave === 1) c = 1 - (p / g) * 2;
      else if (wave === 2) {
        // Парабола вместо Math.sin — как в sfxr, у неё свой тембр
        c = p / g;
        c = 6.28318531 * (c > 0.5 ? c - 1 : c);
        c = 1.27323954 * c + 0.405284735 * c * c * (c < 0 ? 1 : -1);
        c = 0.225 * ((c < 0 ? -1 : 1) * c * c - c) + c;
      } else c = y[Math.abs(((32 * p) / g) | 0)];
      if (filtered) {
        const prev = u;
        lw = Math.min(0.1, Math.max(0, lw * X));
        if (lp) {
          t += (c - u) * lw;
          t *= damp;
        } else {
          u = c;
          t = 0;
        }
        u += t;
        B += u - prev;
        c = B *= 1 - r;
      }
      if (phaser) {
        C[H % 1024] = c;
        c += C[(H - s + 1024) % 1024];
        H++;
      }
      q += c;
    }
    out[k] = 0.125 * q * w * gain;
  }
  return { out, end: k };
}
