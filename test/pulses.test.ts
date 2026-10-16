import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render, renderVariants, type Preset, type Pulses } from "../src/index.ts";
import { MOTOR_PRESET } from "./motor.preset.ts";

const RATE = 44100;
const rms = (s: Float32Array): number => Math.sqrt(s.reduce((m, v) => m + v * v, 0) / s.length);
// Постоянный тон внутри толчка: начало толчка — скачок через 0,5
const onsets = (p: Pulses): number[] => {
  const s = render({ ms: 1000, voices: [{ wave: "square", duty: 1, hz: 1, pulses: p }] }, 3);
  const at: number[] = [];
  for (let i = 1; i < s.length; i++) if (s[i] > 0.5 && s[i - 1] <= 0.5) at.push(i);
  if (s[0] > 0.5) at.unshift(0);
  return at;
};
const gaps = (at: number[]): number[] => at.slice(1).map((v, i) => v - at[i]);

describe("pulses", () => {
  it("частота толчков", () => {
    const n = onsets({ rate: 28, jitter: 0, ampJitter: 0, decay: 5 }).length;
    assert.ok(Math.abs(n - 28) <= 1, String(n));
  });

  it("без разброса — ровные интервалы", () => {
    const g = gaps(onsets({ rate: 28, jitter: 0, ampJitter: 0, decay: 5 }));
    for (const v of g) assert.ok(Math.abs(v - g[0]) <= 1, `${v} vs ${g[0]}`);
  });

  it("разброс интервала в границах", () => {
    const g = gaps(onsets({ rate: 28, jitter: 0.08, ampJitter: 0, decay: 5 }));
    const lo = (0.92 / 28) * RATE - 1, hi = (1.08 / 28) * RATE + 1;
    for (const v of g) assert.ok(v >= lo && v <= hi, String(v));
    assert.ok(Math.max(...g) - Math.min(...g) > 10, "разброс должен быть заметен");
  });

  it("am: громкость 1 − depth … 1", () => {
    const p: Preset = { ms: 1000, voices: [{ wave: "square", duty: 1, hz: 1, am: { hz: 3, depth: 0.3 } }] };
    const s = render(p, 1);
    assert.ok(Math.abs(Math.min(...s) - 0.4) < 0.01, String(Math.min(...s)));
    assert.ok(Math.abs(Math.max(...s) - 1) < 0.01, String(Math.max(...s)));
  });

  it("варианты мотора близки по громкости", () => {
    const r = renderVariants(MOTOR_PRESET, [1, 2, 3, 4, 5, 6]).map(rms);
    for (const v of r) assert.ok(v >= 0.5 * Math.max(...r), r.join(" "));
  });

  it("громкость мотора как у нарезанных клипов (RMS 0,152 ± 15%)", () => {
    const r = renderVariants(MOTOR_PRESET, [1, 2, 3]).map(rms);
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    assert.ok(Math.abs(mean - 0.152) <= 0.152 * 0.15, String(mean));
  });

  for (const rate of [0, -5]) {
    it(`rate ${rate} не вешает рендер — тишина`, () => {
      const s = render({ ms: 100, voices: [{ wave: "square", duty: 1, hz: 1, pulses: { rate, decay: 5 } }] }, 1);
      assert.equal(s.length, 4410);
      assert.ok(s.every((v) => v === 0));
    });
  }

});
