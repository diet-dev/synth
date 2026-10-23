// Неизменяемые операции над пресетом для редактора. voice === null — сам пресет.
import type { Classic, Preset, Voice } from "../src/index.ts";
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "./schema.ts";

type Obj = Record<string, unknown>;
type Value = number | string | boolean | undefined;

const isClassic = (v: Voice | Classic): v is Classic => "kind" in v;
export const schemaOf = (p: Preset, voice: number | null): Block[] =>
  voice === null ? PRESET_SCHEMA : isClassic(p.voices[voice]) ? CLASSIC_SCHEMA : TONAL_SCHEMA;

const targetOf = (p: Preset, voice: number | null): Obj => (voice === null ? p : p.voices[voice]) as Obj;

/** Копия пресета с заменой цели (пресета или голоса) на результат fn. */
function update(p: Preset, voice: number | null, fn: (o: Obj) => Obj): Preset {
  if (voice === null) return fn({ ...p }) as Preset;
  const voices = p.voices.slice();
  voices[voice] = fn({ ...voices[voice] }) as Voice | Classic;
  return { ...p, voices };
}

export function getValue(p: Preset, voice: number | null, block: string, key: string): unknown {
  const o = targetOf(p, voice);
  return block ? (o[block] as Obj | undefined)?.[key] : o[key];
}

export function setValue(p: Preset, voice: number | null, block: string, key: string, value: Value): Preset {
  return update(p, voice, (o) => {
    const t = block ? { ...((o[block] as Obj | undefined) ?? {}) } : o;
    if (value === undefined) delete t[key];
    else t[key] = value;
    if (block) o[block] = t;
    return o;
  });
}

export function setBlock(p: Preset, voice: number | null, block: string, on: boolean): Preset {
  return update(p, voice, (o) => {
    if (!on) {
      delete o[block];
      return o;
    }
    const b = schemaOf(p, voice).find((x) => x.key === block)!;
    const t: Obj = {};
    for (const f of b.fields) if (f.kind === "num" && !f.optional) t[f.key] = f.def;
    o[block] = t;
    return o;
  });
}

export function addVoice(p: Preset, kind: "tonal" | "classic"): Preset {
  const v: Voice | Classic =
    kind === "tonal"
      ? { wave: "sine", hz: 440, env: { a: 2, d: 150, exp: true } }
      : { kind: "classic", wave: "square", hz: 440, env: { a: 0, h: 100, d: 200 }, gain: 0.25 };
  return { ...p, voices: [...p.voices, v] };
}

export function removeVoice(p: Preset, index: number): Preset {
  if (p.voices.length <= 1) return p;
  return { ...p, voices: p.voices.filter((_, i) => i !== index) };
}

export function duplicateVoice(p: Preset, index: number): Preset {
  const voices = p.voices.slice();
  voices.splice(index + 1, 0, structuredClone(p.voices[index]));
  return { ...p, voices };
}

/** Убирает необязательные поля со значением по умолчанию — звук не меняется. */
export function stripDefaults(p: Preset): Preset {
  const strip = (o: Obj, schema: Block[]): Obj => {
    const out: Obj = { ...o };
    for (const b of schema) {
      const t = b.key ? (out[b.key] as Obj | undefined) : out;
      if (!t) continue;
      const c: Obj = b.key ? { ...t } : t;
      for (const f of b.fields) if (f.kind !== "select" && !(f.kind === "num" && f.required) && c[f.key] === f.def) delete c[f.key];
      if (b.key) {
        if (Object.keys(c).length) out[b.key] = c;
        else delete out[b.key];
      }
    }
    return out;
  };
  const top = strip(p as Obj, PRESET_SCHEMA) as Preset;
  return { ...top, voices: p.voices.map((v) => strip(v as Obj, isClassic(v) ? CLASSIC_SCHEMA : TONAL_SCHEMA) as Voice | Classic) };
}
