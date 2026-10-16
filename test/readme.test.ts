import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import * as synth from "../src/index.ts";

// Рецепты README исполняются как есть: пресет в README, сломавшийся от правки
// пакета, должен ронять тест, а не вводить читателя в заблуждение
const readme = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");
const section = readme.slice(readme.indexOf("## Рецепты"), readme.indexOf("## Зацикленный"));
const blocks = [...section.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]);

function presetsOf(code: string): Record<string, synth.Preset> {
  // Строка с рендером в рецепте мотора — пример использования, не пресет
  const js = code.replace(/^const urls[\s\S]*$/m, "").replace(/: Preset/g, "").replace(/^const (\w+) =/gm, "out.$1 =");
  const out: Record<string, synth.Preset> = {};
  new Function("out", js)(out);
  return out;
}

describe("README: рецепты", () => {
  const all = Object.assign({}, ...blocks.map(presetsOf)) as Record<string, synth.Preset>;

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
