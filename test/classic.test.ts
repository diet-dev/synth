import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "../src/index.ts";
import { CLASSIC, fingerprint } from "./reference/classic.ts";

// Отпечатки принятых на слух рендеров (сид 1). Если звук изменился намеренно —
// пересчитайте их; если нет — это регрессия цикла sfxr.
const WANT: Record<string, { length: number; crossings: number; rms: number[] }> = {
  click: { length: 1731, crossings: 83, rms: [0.0351, 0.034, 0.0327, 0.0315, 0.0299, 0.0273, 0.0247, 0.0221, 0.0195, 0.0168, 0.0142, 0.0116, 0.009, 0.0064, 0.0038, 0.0014] },
  coin: { length: 10500, crossings: 503, rms: [0.0285, 0.0222, 0.0206, 0.0191, 0.0176, 0.016, 0.0145, 0.0129, 0.0114, 0.0099, 0.0084, 0.0068, 0.0053, 0.0038, 0.0023, 0.0009] },
  arpeggio: { length: 40500, crossings: 903, rms: [0.0807, 0.0695, 0.0597, 0.0506, 0.0436, 0.0398, 0.036, 0.0323, 0.0284, 0.0248, 0.0209, 0.017, 0.0134, 0.0096, 0.0058, 0.0022] },
  dive: { length: 5579, crossings: 93, rms: [0.0762, 0.0756, 0.0756, 0.0749, 0.0739, 0.0749, 0.0733, 0.0772, 0.0705, 0.0793, 0.0609, 0.0691, 0.0489, 0.0757, 0.0685, 0.0411] },
  sweep: { length: 18261, crossings: 735, rms: [0.3022, 0.3212, 0.3022, 0.2936, 0.2916, 0.2802, 0.239, 0.2106, 0.1833, 0.1687, 0.1468, 0.0922, 0.0656, 0.0402, 0.0216, 0.0063] },
  saw: { length: 14010, crossings: 705, rms: [0.0821, 0.2901, 0.2819, 0.2425, 0.21, 0.1694, 0.1512, 0.1371, 0.1201, 0.1037, 0.0896, 0.072, 0.0567, 0.0411, 0.0242, 0.0094] },
  burst: { length: 33678, crossings: 534, rms: [0.2027, 0.2001, 0.1805, 0.1631, 0.1367, 0.1174, 0.0989, 0.0797, 0.0861, 0.065, 0.0566, 0.0474, 0.0315, 0.0252, 0.0165, 0.0051] },
  power: { length: 50436, crossings: 2117, rms: [0.0122, 0.0254, 0.0359, 0.043, 0.0482, 0.0487, 0.0502, 0.0502, 0.0479, 0.0437, 0.0378, 0.0335, 0.0266, 0.013, 0.0061, 0.0021] },
};

describe("classic: отпечатки звуков", () => {
  for (const [key, preset] of Object.entries(CLASSIC)) {
    it(key, () => {
      const got = fingerprint(render(preset, 1));
      const want = WANT[key];
      assert.equal(got.length, want.length);
      assert.equal(got.crossings, want.crossings);
      got.rms.forEach((v, i) => assert.ok(Math.abs(v - want.rms[i]) < 5e-4, `отрезок ${i}: ${v} против ${want.rms[i]}`));
    });
  }

  it("один сид — один звук, другой сид — другой рисунок шума", () => {
    const p = CLASSIC.burst;
    assert.deepEqual(render(p, 1), render(p, 1));
    assert.notDeepEqual(render(p, 1), render(p, 2));
  });
});
