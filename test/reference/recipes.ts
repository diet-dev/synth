// Рецепты раздела README «Рецепты» как объекты: README, тесты и демка
// должны видеть одни и те же пресеты.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Preset } from "../../src/index.ts";

function presetsOf(code: string): Record<string, Preset> {
  // Строка с рендером в рецепте мотора — пример использования, не пресет
  const js = code.replace(/^const urls[\s\S]*$/m, "").replace(/: Preset/g, "").replace(/^const (\w+) =/gm, "out.$1 =");
  const out: Record<string, Preset> = {};
  new Function("out", js)(out);
  return out;
}

export function readmeRecipes(): Record<string, Preset> {
  const readme = readFileSync(fileURLToPath(new URL("../../README.md", import.meta.url)), "utf8");
  const section = readme.slice(readme.indexOf("## Рецепты"), readme.indexOf("## Зацикленный"));
  const blocks = [...section.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]);
  return Object.assign({}, ...blocks.map(presetsOf));
}
