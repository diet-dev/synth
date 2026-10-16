import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { renderVariants, rng } from "../src/index.ts";
import { MOTOR_PRESET } from "./motor.preset.ts";
import { renderMotor } from "./reference/motor.ts";
import { inGame } from "./reference/game.ts";
import { distance, features, readWav } from "./reference/metric.ts";

const file = (name: string): string => fileURLToPath(new URL(`./reference/${name}`, import.meta.url));
const ref = features(readWav(file("motor.wav")));

describe("мотор", () => {
  it("синтез: непрерывный рендер пресета похож на эталон", () => {
    // Порог — шум самого эталона: он же с другими случайными числами
    let floor = 0;
    for (let k = 1; k <= 8; k++) floor += distance(features(renderMotor(rng(k))), ref) / 8;
    const [long] = renderVariants({ ...MOTOR_PRESET, ms: 2500, fade: { in: 50, out: 50 }, peak: 0.6 }, [1]);
    const d = distance(features(long), ref);
    assert.ok(d <= 2 * floor, `distance ${d.toFixed(4)} > 2 × ${floor.toFixed(4)}`);
  });

  it("в игре: не дальше от эталона, чем нарезанные клипы мотора", () => {
    // Перезапуск раз в 216 мс рвёт поезд толчков и у WAV — сравниваем равное с равным
    const wav = ["clip-1.wav", "clip-2.wav", "clip-3.wav"].map((n) => readWav(file(n)));
    const now = distance(features(inGame(wav, 13 / 60, 10, 2.5)), ref);
    const d = distance(features(inGame(renderVariants(MOTOR_PRESET, [1, 2, 3]), 13 / 60, 10, 2.5)), ref);
    assert.ok(d <= now, `distance ${d.toFixed(4)} > WAV ${now.toFixed(4)}`);
  });
});
