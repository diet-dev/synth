import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render, type Preset } from "../src/index.ts";
import { presetCode } from "../demo/code.ts";
import { decodeState, encodeState } from "../demo/hash.ts";
import type { DemoState, Sound } from "../demo/types.ts";

// Исполняем код из правой колонки так же, как его исполнит игра
function run(code: string): Preset {
  const js = code.replace(/^const urls[\s\S]*$/m, "").replace(/: Preset/g, "").replace(/^const (\w+) =/gm, "out.$1 =");
  const out: Record<string, Preset> = {};
  new Function("out", js)(out);
  return Object.values(out)[0];
}

const COIN: Preset = {
  ms: 230,
  voices: [{ kind: "classic", wave: "square", hz: 988, duty: 0.25, jump: { ms: 70, ratio: 1.335 }, env: { a: 0, h: 60, d: 160, punch: 0.4 }, gain: 0.3 }],
};
const sound = (preset: Preset, loop = false, name = "COIN"): Sound => ({ name, preset, loop });

describe("код пресета", () => {
  it("исполняется и даёт тот же звук", () => {
    assert.deepEqual(render(run(presetCode(sound(COIN), 216)), 1), render(COIN, 1));
  });

  it("начинается с объявления константы", () => {
    assert.match(presetCode(sound(COIN), 216), /^const COIN: Preset = \{/);
  });

  it("тональные числа округлены, классические — как есть", () => {
    const p: Preset = {
      ms: 100,
      voices: [{ wave: "sine", hz: 440.123456 }, { kind: "classic", wave: "square", hz: 440, slide: -0.3257481647558761, env: { a: 0, h: 50, d: 50 } }],
    };
    const code = presetCode(sound(p), 216);
    assert.match(code, /hz: 440\.1\b/);
    assert.ok(!code.includes("440.12"));
    assert.ok(code.includes("slide: -0.3257481647558761"));
  });

  it("поля со значением по умолчанию не выводятся", () => {
    const code = presetCode(sound({ ms: 100, voices: [{ wave: "sine", hz: 440, gain: 1, duty: 0.5 }] }), 216);
    assert.ok(!/hz|gain|duty/.test(code), code);
  });

  it("звук для цикла — строка рендера вариантов и период", () => {
    const code = presetCode(sound({ ms: 257, voices: [{ wave: "sine", hz: 80 }] }, true, "ENGINE"), 216);
    assert.ok(code.includes("renderVariants(ENGINE, [1, 2, 3])"), code);
    assert.ok(code.includes("216 мс"), code);
  });

  it("экспоненциальные и отрицательные числа — валидный код и тот же звук", () => {
    const p: Preset = {
      ms: 300,
      voices: [
        {
          kind: "classic",
          wave: "noise",
          hz: 994.5432000000001,
          slide: -0.000027278292683861643,
          phaser: { ms: 1.1564625850340137e-7, slide: 0.04618210207500001 },
          env: { a: 10, h: 100, d: 150 },
        },
      ],
    };
    assert.deepEqual(render(run(presetCode(sound(p), 216)), 1), render(p, 1));
  });
});

describe("состояние в адресе", () => {
  const state: DemoState = { sound: sound(COIN, false, "МОНЕТКА"), seed: 3, period: 216 };

  it("encode → decode — то же состояние", () => {
    assert.deepEqual(decodeState(encodeState(state)), state);
  });

  it("битый hash — null", () => {
    const b64 = (s: string): string => Buffer.from(s).toString("base64url");
    const bad = [
      "",
      "%%%",
      b64("{"),
      b64(JSON.stringify({ sound: { name: "X", loop: false, preset: { ms: 100, voices: [] } }, seed: 1, period: 216 })),
      b64(JSON.stringify({ sound: { name: "X", loop: false, preset: { ms: "100", voices: [{ wave: "sine" }] } }, seed: 1, period: 216 })),
      b64(JSON.stringify({ sound: { name: "X", loop: false, preset: { ms: 100, voices: [{ wave: "pink" }] } }, seed: 1, period: 216 })),
      b64(JSON.stringify({ sound: { name: "X", loop: false, preset: { ms: 100, voices: [{ wave: "sine" }] } }, seed: "1", period: 216 })),
    ];
    for (const h of bad) assert.equal(decodeState(h), null, h);
  });
});
