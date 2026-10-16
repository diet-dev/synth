// Модель того, как SfxPlayer звучит в игре: старт раз в period с, случайный
// вариант, пул на вариант; занятый экземпляр play() не перезапускает.
import { rng } from "../../src/index.ts";

export function inGame(variants: Float32Array[], period: number, pool: number, sec: number, rate = 44100): Float32Array {
  const n = Math.round(sec * rate);
  const out = new Float32Array(n);
  const pick = rng(99);
  const busy = variants.map(() => new Array<number>(pool).fill(-Infinity));
  const tick = variants.map(() => 0);
  for (let t = 0; t < sec; t += period) {
    const at = Math.round(t * rate);
    const v = Math.floor(pick() * variants.length);
    const i = tick[v];
    tick[v] = (i + 1) % pool;
    if (busy[v][i] + variants[v].length > at) continue;
    busy[v][i] = at;
    const s = variants[v];
    for (let k = 0; k < s.length && at + k < n; k++) out[at + k] += s[k];
  }
  return out;
}
