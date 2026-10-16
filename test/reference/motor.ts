// Эталон мотора: алгоритм, которым был сделан принятый на слух звук
// (из него нарезаны клипы clip-1..3.wav). motor.wav — тот самый рендер.
const R = 44100;

const lowpass = (s: Float64Array, fc: number): void => {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / R);
  let y = 0;
  for (let i = 0; i < s.length; i++) s[i] = y += a * (s[i] - y);
};

/** 2,5 с: толчки 28/с с разбросом, синус 80 Гц + шум внутри, гул 75 Гц, ФНЧ 500 Гц ×2, пик 0,6. */
export function renderMotor(random: () => number = Math.random): Float32Array {
  const dur = 2.5, fire = 28, body = 80, decay = 0.016, hum = 75, humMix = 0.25, noiseMix = 0.3, cutoff = 500, jitter = 0.08;
  const n = Math.round(dur * R);
  const s = new Float64Array(n);
  for (let t = 0; t < dur; t += (1 / fire) * (1 + jitter * (random() * 2 - 1))) {
    const at = Math.round(t * R);
    const amp = 0.8 + 0.4 * random();
    for (let i = 0; i < R * decay * 6 && at + i < n; i++) {
      const e = Math.exp(-i / (R * decay));
      s[at + i] += amp * e * (Math.sin((2 * Math.PI * body * i) / R) + noiseMix * (random() * 2 - 1));
    }
  }
  for (let i = 0; i < n; i++) s[i] += humMix * Math.sin((2 * Math.PI * hum * i) / R) * (0.7 + 0.3 * Math.sin((2 * Math.PI * 3 * i) / R));
  lowpass(s, cutoff);
  lowpass(s, cutoff);
  let peak = 0;
  for (const v of s) peak = Math.max(peak, Math.abs(v));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (s[i] / peak) * 0.6;
  const f = R * 0.05;
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[n - 1 - i] *= i / f;
  }
  return out;
}
