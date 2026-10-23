import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render, renderVariants, type Preset } from "../src/index.ts";
import { addVoice, duplicateVoice, getValue, removeVoice, setBlock, setValue, stripDefaults } from "../demo/ops.ts";
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "../demo/schema.ts";

const keys = (schema: Block[]): string[] =>
  schema.flatMap((b) => b.fields.map((f) => (b.key ? `${b.key}.${f.key}` : f.key))).sort();

const BASE: Preset = { ms: 200, voices: [{ wave: "sine", hz: 440, env: { a: 1, d: 100 } }] };

describe("схема: все поля типов", () => {
  it("пресет", () => {
    assert.deepEqual(keys(PRESET_SCHEMA), ["fade.in", "fade.out", "lp", "lpPasses", "ms", "peak"]);
  });

  it("тональный голос", () => {
    assert.deepEqual(
      keys(TONAL_SCHEMA),
      [
        "am.depth", "am.hz", "duty", "env.a", "env.d", "env.exp", "env.h", "fm.depth", "fm.hz", "gain", "hp", "hz", "lp",
        "noise", "pulses.ampJitter", "pulses.decay", "pulses.jitter", "pulses.len", "pulses.rate", "toHz", "wave",
      ].sort(),
    );
  });

  it("классический голос", () => {
    assert.deepEqual(
      keys(CLASSIC_SCHEMA),
      [
        "accel", "duty", "dutySlide", "env.a", "env.d", "env.h", "env.punch", "gain", "hp.hz", "hp.slide", "hz", "jump.ms",
        "jump.ratio", "lp.hz", "lp.res", "lp.slide", "minHz", "phaser.ms", "phaser.slide", "repeat", "slide", "stopAtMin",
        "vib.depth", "vib.hz", "wave",
      ].sort(),
    );
  });
});

describe("операции над пресетом", () => {
  it("setValue не мутирует вход и меняет одно поле", () => {
    const copy = structuredClone(BASE);
    const p = setValue(BASE, 0, "", "hz", 880);
    assert.deepEqual(BASE, copy);
    assert.equal(getValue(p, 0, "", "hz"), 880);
    assert.deepEqual({ ...p, voices: [{ ...p.voices[0], hz: 440 }] }, BASE);
  });

  it("setValue в блоке и на уровне пресета", () => {
    assert.equal(getValue(setValue(BASE, 0, "env", "d", 50), 0, "env", "d"), 50);
    assert.equal(getValue(setValue(BASE, null, "", "peak", 0.5), null, "", "peak"), 0.5);
  });

  it("setValue undefined убирает поле", () => {
    assert.ok(!("hz" in setValue(BASE, 0, "", "hz", undefined).voices[0]));
  });

  it("setBlock включает блок со значениями по умолчанию и выключает его", () => {
    const on = setBlock(BASE, 0, "pulses", true);
    const pulses = TONAL_SCHEMA.find((b) => b.key === "pulses")!;
    for (const f of pulses.fields) if (f.kind === "num" && !f.optional) assert.equal(getValue(on, 0, "pulses", f.key), f.def);
    assert.ok(!("pulses" in setBlock(on, 0, "pulses", false).voices[0]));
  });

  it("removeVoice не удаляет последний голос", () => {
    assert.deepEqual(removeVoice(BASE, 0), BASE);
    const two = addVoice(BASE, "classic");
    assert.equal(two.voices.length, 2);
    assert.deepEqual(removeVoice(two, 1), BASE);
  });

  it("addVoice classic — голос kind: classic", () => {
    const v = addVoice(BASE, "classic").voices[1];
    assert.ok("kind" in v && v.kind === "classic");
  });

  it("duplicateVoice ставит копию следом", () => {
    const p = duplicateVoice(BASE, 0);
    assert.deepEqual(p.voices[1], p.voices[0]);
    assert.notEqual(p.voices[1], p.voices[0]);
  });

  it("stripDefaults убирает поля со значением по умолчанию, звук тот же", () => {
    const p: Preset = { ms: 100, voices: [{ wave: "sine", hz: 440, gain: 1, duty: 0.5 }] };
    assert.deepEqual(stripDefaults(p), { ms: 100, voices: [{ wave: "sine" }] });
    assert.deepEqual(render(stripDefaults(p), 1), render(p, 1));
  });
});

// Все блоки включены, все числа на краю шкалы: рендер не падает и не даёт NaN
function extreme(kind: "tonal" | "classic", edge: "min" | "max", ms: number): Preset {
  let p = addVoice({ ms, voices: [] }, kind);
  const schema = kind === "tonal" ? TONAL_SCHEMA : CLASSIC_SCHEMA;
  for (const b of schema) {
    if (b.optional) p = setBlock(p, 0, b.key, true);
    for (const f of b.fields) {
      if (f.kind === "num") p = setValue(p, 0, b.key, f.key, f[edge]);
      if (f.kind === "bool") p = setValue(p, 0, b.key, f.key, true);
    }
  }
  return p;
}

const finite = (p: Preset): void => {
  for (const s of renderVariants(p, [1])) for (const x of s) assert.ok(Number.isFinite(x), JSON.stringify(p));
};

describe("крайние значения", () => {
  for (const kind of ["tonal", "classic"] as const)
    for (const edge of ["min", "max"] as const)
      for (const ms of [10, 2000])
        it(`${kind}, ${edge}, ${ms} мс`, () => finite({ ...extreme(kind, edge, ms), peak: 0.8 }));

  it("толчки с нулевой частотой и нулевая огибающая", () => {
    finite({ ms: 200, peak: 0.5, voices: [{ wave: "sine", pulses: { rate: 0, decay: 10 }, env: { a: 0, h: 0, d: 0 } }] });
  });
});
