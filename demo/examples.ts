// Готовые примеры: рецепты README (тест следит, чтобы не разошлись) и по
// звуку на каждую интерфейсную категорию.
import { rng } from "../src/index.ts";
import { CATEGORIES } from "./generators.ts";
import type { Group, Sound } from "./types.ts";

export type Example = { id: string; label: string; group: Group; sound: Sound };

const ui = (id: string, label: string, seed: number): Example => ({
  id,
  label,
  group: "ui",
  sound: { name: id.toUpperCase(), loop: false, preset: CATEGORIES.find((c) => c.id === id)!.make(rng(seed)) },
});

export const EXAMPLES: Example[] = [
  {
    id: "coin",
    label: "Монетка",
    group: "game",
    sound: {
      name: "COIN",
      loop: false,
      preset: {
        ms: 230,
        voices: [
          {
            kind: "classic",
            wave: "square",
            hz: 988,
            duty: 0.25,
            jump: { ms: 70, ratio: 1.335 },
            env: { a: 0, h: 60, d: 160, punch: 0.4 },
            gain: 0.3,
          },
        ],
      },
    },
  },
  {
    id: "laser",
    label: "«Пиу» лазера",
    group: "game",
    sound: {
      name: "LASER",
      loop: false,
      preset: {
        ms: 200,
        voices: [{ kind: "classic", wave: "square", hz: 1800, slide: -12, duty: 0.3, env: { a: 0, h: 40, d: 150, punch: 0.3 }, gain: 0.25 }],
      },
    },
  },
  {
    id: "boom",
    label: "Взрыв",
    group: "game",
    sound: {
      name: "BOOM",
      loop: false,
      preset: {
        ms: 900,
        peak: 0.8,
        lp: 900,
        lpPasses: 2,
        voices: [
          { wave: "noise", gain: 1, env: { a: 2, d: 898, exp: true } },
          { wave: "sine", hz: 90, toHz: 30, gain: 0.8, env: { a: 1, d: 250, exp: true } },
        ],
      },
    },
  },
  {
    id: "shot",
    label: "Выстрел",
    group: "game",
    sound: {
      name: "SHOT",
      loop: false,
      preset: {
        ms: 380,
        peak: 0.6,
        voices: [
          { wave: "noise", gain: 0.5, hp: 1500, env: { d: 25, exp: true } },
          { wave: "sine", hz: 120, toHz: 55, gain: 0.9, env: { a: 1, d: 130, exp: true } },
          { wave: "noise", gain: 0.7, lp: 900, hp: 250, env: { a: 1, d: 80, exp: true } },
          { wave: "noise", gain: 0.35, lp: 350, env: { a: 3, d: 350, exp: true } },
        ],
      },
    },
  },
  {
    id: "engine",
    label: "Поршневой мотор",
    group: "own",
    sound: {
      name: "ENGINE",
      loop: true,
      preset: {
        ms: 257,
        fade: { in: 40, out: 40 },
        lp: 500,
        lpPasses: 2,
        peak: 0.52,
        voices: [
          { wave: "sine", hz: 80, noise: 0.3, pulses: { rate: 28, jitter: 0.08, ampJitter: 0.2, decay: 16 } },
          { wave: "sine", hz: 75, gain: 0.25, am: { hz: 3, depth: 0.3 } },
        ],
      },
    },
  },
  {
    id: "click",
    label: "Щелчок интерфейса",
    group: "ui",
    sound: {
      name: "CLICK",
      loop: false,
      preset: { ms: 60, peak: 0.5, voices: [{ wave: "sine", hz: 900, toHz: 400, env: { a: 1, d: 59, exp: true } }] },
    },
  },
  ui("hover", "Наведение", 1),
  ui("switch", "Переключение", 1),
  ui("open", "Открыть", 1),
  ui("close", "Закрыть", 1),
  ui("confirm", "Подтверждение", 1),
  ui("error", "Ошибка", 1),
];
