import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderVariants, type Preset } from "../src/index.ts";
import { directBackend, Renderer, type RenderJob } from "../demo/renderer.ts";

const job = (ms: number): RenderJob => ({ preset: { ms, voices: [{ wave: "sine" }] }, seeds: [1] });

/** Бэкенд, который отвечает только по команде: видно, что и когда он рендерил. */
function manual() {
  const calls: { job: RenderJob; resolve(v: Float32Array[]): void; reject(e: Error): void }[] = [];
  const backend = (j: RenderJob): Promise<Float32Array[]> =>
    new Promise((resolve, reject) => calls.push({ job: j, resolve, reject }));
  return { calls, backend };
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("Renderer", () => {
  it("ждущую заявку вытесняет новая, вытесненная получает null", async () => {
    const m = manual();
    const r = new Renderer(m.backend);
    const a = r.request(job(1));
    const b = r.request(job(2));
    const c = r.request(job(3));
    assert.equal(m.calls.length, 1);
    m.calls[0].resolve([new Float32Array([1])]);
    assert.deepEqual(await a, [new Float32Array([1])]);
    assert.equal(await b, null);
    await tick();
    assert.equal(m.calls.length, 2);
    assert.equal(m.calls[1].job.preset.ms, 3);
    m.calls[1].resolve([new Float32Array([3])]);
    assert.deepEqual(await c, [new Float32Array([3])]);
  });

  it("ошибка рендера отклоняет свою заявку, очередь живёт дальше", async () => {
    const m = manual();
    const r = new Renderer(m.backend);
    const a = r.request(job(1));
    const c = r.request(job(3));
    m.calls[0].reject(new Error("сбой"));
    await assert.rejects(a, /сбой/);
    await tick();
    m.calls[1].resolve([new Float32Array([3])]);
    assert.deepEqual(await c, [new Float32Array([3])]);
  });

  it("directBackend — то же, что renderVariants", async () => {
    const coin: Preset = {
      ms: 230,
      voices: [{ kind: "classic", wave: "square", hz: 988, duty: 0.25, jump: { ms: 70, ratio: 1.335 }, env: { a: 0, h: 60, d: 160, punch: 0.4 }, gain: 0.3 }],
    };
    assert.deepEqual(await directBackend({ preset: coin, seeds: [1, 2] }), renderVariants(coin, [1, 2]));
  });
});
