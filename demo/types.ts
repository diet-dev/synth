import type { Preset } from "../src/index.ts";

export type Group = "game" | "own" | "ui";
/** name — имя константы в коде пресета (COIN, ENGINE…); loop — звук для перезапуска по кругу. */
export type Sound = { name: string; preset: Preset; loop: boolean };
export type DemoState = { sound: Sound; seed: number; period: number };
