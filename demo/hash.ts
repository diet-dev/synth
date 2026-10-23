// Состояние демки ↔ #hash: JSON → UTF-8 → base64url. Адрес может быть чужим,
// старым или испорченным: всё проверяется по схеме, числа зажимаются в пределы
// ползунков, без обязательных полей — null.
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "./schema.ts";
import type { DemoState } from "./types.ts";

type Obj = Record<string, unknown>;
const PERIOD = { min: 50, max: 1000 };

export function encodeState(s: DemoState): string {
  let bin = "";
  for (const b of new TextEncoder().encode(JSON.stringify(s))) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Копия объекта только с полями схемы; null — поле не того типа или нет обязательного. */
function clean(o: Obj, schema: Block[]): Obj | null {
  const out: Obj = {};
  for (const b of schema) {
    const src = b.key ? o[b.key] : o;
    if (src === undefined && b.key && b.optional) continue;
    if (!isObj(src)) return null;
    const dst: Obj = b.key ? {} : out;
    for (const f of b.fields) {
      const x = src[f.key];
      if (x === undefined) {
        if (f.kind === "num" && f.required) return null;
        if (f.kind === "select") return null;
        continue;
      }
      if (f.kind === "num") {
        if (!finite(x)) return null;
        dst[f.key] = clamp(x, f.min, f.max);
      } else if (f.kind === "select") {
        if (typeof x !== "string" || !f.options.includes(x)) return null;
        dst[f.key] = x;
      } else {
        if (typeof x !== "boolean") return null;
        dst[f.key] = x;
      }
    }
    if (b.key) out[b.key] = dst;
  }
  return out;
}

export function decodeState(hash: string): DemoState | null {
  try {
    const bin = atob(hash.replace(/-/g, "+").replace(/_/g, "/"));
    const s: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!isObj(s) || !finite(s.seed) || !finite(s.period) || !isObj(s.sound)) return null;
    const { name, loop, preset } = s.sound;
    // Имя станет именем константы в коде пресета и файла WAV
    if (typeof name !== "string" || !/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) || typeof loop !== "boolean" || !isObj(preset)) return null;
    if (!Array.isArray(preset.voices) || !preset.voices.length) return null;
    const top = clean(preset, PRESET_SCHEMA);
    if (!top) return null;
    const voices: Obj[] = [];
    for (const v of preset.voices) {
      if (!isObj(v)) return null;
      const classic = v.kind === "classic";
      const c = clean(v, classic ? CLASSIC_SCHEMA : TONAL_SCHEMA);
      if (!c) return null;
      voices.push(classic ? { kind: "classic", ...c } : c);
    }
    return {
      sound: { name, loop, preset: { ...top, voices } as unknown as DemoState["sound"]["preset"] },
      seed: Math.max(1, Math.round(s.seed)),
      period: Math.round(clamp(s.period, PERIOD.min, PERIOD.max)),
    };
  } catch {
    return null;
  }
}
