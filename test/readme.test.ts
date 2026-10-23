import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as synth from "../src/index.ts";
import { readmeRecipes } from "./reference/recipes.ts";

// Рецепты README исполняются как есть: пресет в README, сломавшийся от правки
// пакета, должен ронять тест, а не вводить читателя в заблуждение
describe("README: рецепты", () => {
  const all = readmeRecipes();

  it("в разделе есть рецепты", () => {
    assert.deepEqual(Object.keys(all).sort(), ["BOOM", "CLICK", "COIN", "ENGINE", "LASER", "SHOT"]);
  });

  for (const [name, preset] of Object.entries(all)) {
    it(`${name}: звучит, без NaN, в WAV`, () => {
      const [s] = synth.renderVariants(preset, [1]);
      let peak = 0;
      for (const v of s) {
        assert.ok(Number.isFinite(v), name);
        peak = Math.max(peak, Math.abs(v));
      }
      assert.ok(peak > 0.05 && peak <= 1, `${name}: пик ${peak}`);
      assert.ok(synth.toWav(s).startsWith("data:audio/wav;base64,"));
    });
  }
});
