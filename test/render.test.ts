import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render, renderVariants, type Preset } from "../src/index.ts";

const RATE = 44100;
const at = (ms: number): number => Math.round((ms * RATE) / 1000);
const peak = (s: Float32Array): number => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (s: Float32Array): number => Math.sqrt(s.reduce((m, v) => m + v * v, 0) / s.length);
const CONST: Preset = { ms: 257, voices: [{ wave: "square", duty: 1, hz: 1 }] };

describe("render", () => {
  it("длина — Math.round(ms × rate / 1000), одинаковая у вариантов", () => {
    const p: Preset = { ms: 257, voices: [{ wave: "noise" }] };
    for (const s of renderVariants(p, [1, 2, 3])) assert.equal(s.length, 11334);
    assert.equal(render(p, 1).length, 11334);
  });

  it("один сид — один звук, разные сиды — разные", () => {
    const p: Preset = { ms: 50, voices: [{ wave: "sine", hz: 100, noise: 0.5 }] };
    assert.deepEqual(render(p, 5), render(p, 5));
    assert.notDeepEqual(render(p, 5), render(p, 6));
  });

  it("частота синуса", () => {
    const s = render({ ms: 1000, voices: [{ wave: "sine", hz: 440 }] }, 1);
    let flips = 0;
    for (let i = 1; i < s.length; i++) if (Math.sign(s[i]) !== Math.sign(s[i - 1]) && s[i] !== 0) flips++;
    assert.ok(Math.abs(flips / 2 - 440) <= 2, String(flips / 2));
  });

  it("голос без env и пресет без fade звучат до конца", () => {
    const s = render({ ms: 200, voices: [{ wave: "sine", hz: 300 }] }, 1);
    assert.ok(peak(s.subarray(s.length - at(10))) > 0.9);
  });

  it("fade линейный: вход + выход на перекрытии дают 1", () => {
    const s = render({ ...CONST, fade: { in: 40, out: 40 } }, 1);
    const F = at(40);
    assert.ok(Math.abs(s[0]) < 1e-3);
    assert.ok(Math.abs(s[at(20)] - 0.5) < 0.01);
    assert.ok(Math.abs(s[F] - 1) < 1e-3);
    assert.ok(Math.abs(s[s.length - 1]) < 0.01);
    for (let k = 0; k < F; k++) assert.ok(Math.abs(s[s.length - F + k] + s[k] - 1) < 1e-3, String(k));
  });

  it("ФНЧ гасит верх", () => {
    const saw = (lp?: number): Preset => ({ ms: 300, voices: [{ wave: "saw", hz: 2000, lp }] });
    assert.ok(rms(render(saw(200), 1)) <= 0.2 * rms(render(saw(), 1)));
  });

  it("общая нормализация: пик громкого = peak, коэффициент один на всех", () => {
    const p: Preset = { ms: 100, peak: 0.6, voices: [{ wave: "noise" }] };
    const raw = [1, 2, 3].map((seed) => peak(render(p, seed)));
    const out = renderVariants(p, [1, 2, 3]).map(peak);
    assert.ok(Math.abs(Math.max(...out) - 0.6) < 1e-6);
    const k = out[0] / raw[0];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i] / raw[i] - k) < 1e-6);
  });
});
