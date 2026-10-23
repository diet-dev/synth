import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rng } from "../src/index.ts";
import { LoopScheduler, type Start } from "../demo/loop.ts";

const ats = (s: Start[]): number[] => s.map((x) => Number(x.at.toFixed(9)));

function make(seed = 5, pool?: number): LoopScheduler {
  const l = new LoopScheduler(rng(seed), pool);
  l.setPeriod(216);
  l.setLengths([0.257, 0.257, 0.257]);
  l.start(0);
  return l;
}

describe("LoopScheduler", () => {
  it("перезапуски ровно через период", () => {
    const s = make().plan(1);
    assert.deepEqual(ats(s), [0, 0.216, 0.432, 0.648, 0.864]);
    for (const x of s) assert.ok(x.variant >= 0 && x.variant <= 2);
  });

  it("выданное не повторяется, следующий — по сетке", () => {
    const l = make();
    l.plan(1);
    assert.deepEqual(l.plan(1), []);
    assert.deepEqual(ats(l.plan(1.2)), [1.08]);
  });

  it("один сид — одни перезапуски", () => {
    assert.deepEqual(make(5).plan(3), make(5).plan(3));
  });

  it("занятый экземпляр пула пропускает перезапуск, сетка не сдвигается", () => {
    const l = new LoopScheduler(rng(1), 1);
    l.setPeriod(216);
    l.setLengths([0.5]);
    l.start(0);
    assert.deepEqual(ats(l.plan(0.7)), [0, 0.648]);
  });

  it("смена периода и вариантов — со следующего перезапуска", () => {
    const l = make();
    const before = l.plan(0.5);
    assert.deepEqual(ats(before), [0, 0.216, 0.432]);
    l.setPeriod(100);
    l.setLengths([0.3]);
    const after = l.plan(0.8);
    assert.deepEqual(ats(after), [0.532, 0.632, 0.732]);
    for (const x of after) assert.equal(x.variant, 0);
  });
});

describe("LoopScheduler: защита", () => {
  it("неположительный период — без перезапусков и без зависания", () => {
    const l = new LoopScheduler(rng(1));
    l.setPeriod(0);
    l.setLengths([0.2]);
    l.start(0);
    assert.deepEqual(l.plan(1), []);
  });

  it("пропущенные перезапуски (вкладка спала) не играют пачкой", () => {
    const l = make();
    l.plan(0.1);
    const late = l.plan(5, 4.9);
    assert.ok(late.every((s) => s.at >= 4.9 - 1e-9), JSON.stringify(late));
    assert.ok(late.length <= 1);
  });
});
