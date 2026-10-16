import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rng } from "../src/index.ts";

const take = (next: () => number, n: number): number[] => Array.from({ length: n }, next);

describe("rng", () => {
  it("один сид — одна последовательность", () => {
    assert.deepEqual(take(rng(7), 100), take(rng(7), 100));
  });

  it("разные сиды — разные последовательности", () => {
    assert.notDeepEqual(take(rng(1), 10), take(rng(2), 10));
  });

  it("значения в [0, 1)", () => {
    for (const v of take(rng(3), 10_000)) assert.ok(v >= 0 && v < 1, String(v));
  });
});
