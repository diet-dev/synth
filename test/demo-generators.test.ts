import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderVariants, rng, type Classic, type Preset, type Voice } from "../src/index.ts";
import { EXAMPLES } from "../demo/examples.ts";
import { CATEGORIES, DEFAULT_PERIOD, LIMITS, mutate, sfxVib } from "../demo/generators.ts";
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "../demo/schema.ts";
import type { Group } from "../demo/types.ts";
import { readmeRecipes } from "./reference/recipes.ts";

const hzOf = (v: Voice | Classic): number[] =>
  "kind" in v ? [v.hz] : [v.hz, v.toHz].filter((x): x is number => x !== undefined);

/** Звук в пределах группы: не длиннее, не громче, без писка и инфразвука, не тишина. */
function withinLimits(p: Preset, group: Group, label: string): void {
  assert.ok(p.voices.length >= 1, label);
  assert.ok(p.peak !== undefined && p.peak <= LIMITS[group].maxPeak, `${label}: peak ${p.peak}`);
  assert.ok(p.ms > 0 && p.ms <= LIMITS[group].maxMs, `${label}: ms ${p.ms}`);
  for (const v of p.voices) for (const hz of hzOf(v)) assert.ok(hz >= 30 && hz <= 8000, `${label}: hz ${hz}`);
  const [s] = renderVariants(p, [1]);
  let max = 0;
  for (const x of s) {
    assert.ok(Number.isFinite(x), label);
    max = Math.max(max, Math.abs(x));
  }
  assert.ok(max <= p.peak! + 1e-6 && max > 0.01, `${label}: пик рендера ${max}`);
}

describe("генераторы", () => {
  it("категории: уникальные id, три группы", () => {
    assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
    const ids = (g: Group): string[] => CATEGORIES.filter((c) => c.group === g).map((c) => c.id);
    assert.deepEqual(ids("game"), ["coin", "laser", "explosion", "powerup", "hit", "jump", "blip"]);
    assert.deepEqual(ids("own"), ["motor", "hum", "rattle"]);
    assert.deepEqual(ids("ui"), ["click", "hover", "switch", "open", "close", "confirm", "error"]);
    for (const c of CATEGORIES) assert.equal(c.loop, c.group === "own", c.id);
  });

  for (const c of CATEGORIES)
    it(`${c.id}: 100 сидов в пределах группы, воспроизводимо`, () => {
      for (let seed = 1; seed <= 100; seed++) {
        const p = c.make(rng(seed));
        assert.deepEqual(c.make(rng(seed)), p);
        withinLimits(p, c.group, `${c.id}#${seed}`);
        if (c.loop) assert.ok(p.fade && p.ms >= DEFAULT_PERIOD + p.fade.out, `${c.id}#${seed}: клип короче перезапуска`);
      }
    });
});

describe("мутация", () => {
  for (const c of CATEGORIES)
    it(`${c.id}: воспроизводимо, меняет числа, не структуру, в пределах`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const p = c.make(rng(seed));
        const m = mutate(p, c.group, rng(7));
        assert.deepEqual(mutate(p, c.group, rng(7)), m);
        assert.notDeepEqual(m, p);
        assert.deepEqual(Object.keys(m).sort(), Object.keys(p).sort());
        assert.equal(m.voices.length, p.voices.length);
        m.voices.forEach((v, i) => assert.deepEqual(Object.keys(v).sort(), Object.keys(p.voices[i]).sort()));
        withinLimits(m, c.group, `${c.id}#${seed} мутация`);
      }
    });
});

describe("примеры", () => {
  it("рецепты README — те же пресеты, ENGINE в цикле", () => {
    const readme = readmeRecipes();
    for (const name of Object.keys(readme)) {
      const ex = EXAMPLES.find((e) => e.sound.name === name);
      assert.ok(ex, name);
      assert.deepEqual(ex.sound.preset, readme[name]);
      assert.equal(ex.sound.loop, name === "ENGINE");
    }
  });

  it("первый пример — монетка", () => {
    assert.equal(EXAMPLES[0].sound.name, "COIN");
  });

  it("интерфейсные примеры — по одному на категорию, в пределах ui", () => {
    const names = EXAMPLES.filter((e) => e.group === "ui" && e.sound.name !== "CLICK").map((e) => e.sound.name);
    assert.deepEqual(names, ["HOVER", "SWITCH", "OPEN", "CLOSE", "CONFIRM", "ERROR"]);
    for (const e of EXAMPLES.filter((x) => x.group === "ui")) withinLimits(e.sound.preset, "ui", e.id);
  });
});

describe("генераторы и схема", () => {
  it("вибрато sfxr: глубина линейна по силе, как vib_amp = strength · 0,5", () => {
    assert.equal(sfxVib(0.3, 0.5).depth, 0.15);
  });

  it("все числа сгенерированных пресетов — в пределах ползунков редактора", () => {
    const check = (o: Record<string, unknown>, schema: Block[], label: string): void => {
      for (const b of schema) {
        const t = (b.key ? o[b.key] : o) as Record<string, unknown> | undefined;
        if (!t) continue;
        for (const f of b.fields) {
          const x = t[f.key];
          if (f.kind === "num" && typeof x === "number") assert.ok(x >= f.min && x <= f.max, `${label}: ${b.key}.${f.key} = ${x} вне ${f.min}…${f.max}`);
        }
      }
    };
    for (const c of CATEGORIES)
      for (let seed = 1; seed <= 500; seed++) {
        const p = c.make(rng(seed));
        check(p as Record<string, unknown>, PRESET_SCHEMA, `${c.id}#${seed}`);
        for (const v of p.voices) check(v as Record<string, unknown>, "kind" in v ? CLASSIC_SCHEMA : TONAL_SCHEMA, `${c.id}#${seed}`);
      }
  });
});
