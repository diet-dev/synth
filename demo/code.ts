// Пресет → TypeScript-код для вставки в игру, в стиле рецептов README.
import { stripDefaults } from "./ops.ts";
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "./schema.ts";
import type { Sound } from "./types.ts";

type Obj = Record<string, unknown>;
const WIDTH = 80;

/** Порядок ключей — как в схеме: поля, затем блоки; kind и voices — на своих местах. */
function order(o: Obj, schema: Block[], first: string[], last: string[]): string[] {
  const known = [...first, ...schema.flatMap((b) => (b.key ? [b.key] : b.fields.map((f) => f.key))), ...last];
  return [...known.filter((k) => k in o), ...Object.keys(o).filter((k) => !known.includes(k))];
}

// Классические голоса не округляем: период тона sfxr целочисленный, округление сдвигает звук
const num = (x: number, exact: boolean): string => String(exact ? x : Number(x.toPrecision(4)));

function value(v: unknown, indent: string, exact: boolean, keys?: string[]): string {
  if (typeof v === "number") return num(v, exact);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v !== "object" || v === null) return String(v);
  const o = v as Obj;
  const ks = keys ?? Object.keys(o);
  const inner = indent + "  ";
  const parts = ks.map((k) => `${k}: ${value(o[k], inner, exact)}`);
  const line = `{ ${parts.join(", ")} }`;
  if (!line.includes("\n") && indent.length + line.length <= WIDTH) return line;
  return `{\n${parts.map((p) => `${inner}${p},`).join("\n")}\n${indent}}`;
}

export function presetCode(sound: Sound, period: number): string {
  const p = stripDefaults(sound.preset);
  const voices = p.voices.map((v) => {
    const classic = "kind" in v;
    const keys = order(v as Obj, classic ? CLASSIC_SCHEMA : TONAL_SCHEMA, ["kind"], []);
    return value(v, "    ", classic, keys);
  });
  const top = order(p as Obj, PRESET_SCHEMA, [], ["voices"]).filter((k) => k !== "voices");
  const lines = top.map((k) => `  ${k}: ${value((p as Obj)[k], "  ", false)},`);
  lines.push(`  voices: [\n${voices.map((v) => `    ${v},`).join("\n")}\n  ],`);
  let code = `const ${sound.name}: Preset = {\n${lines.join("\n")}\n};`;
  if (sound.loop)
    code += `\n// Перезапуск раз в ${period} мс, три варианта\nconst urls = renderVariants(${sound.name}, [1, 2, 3]).map((s) => toWav(s));`;
  return code;
}

