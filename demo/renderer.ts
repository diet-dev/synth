// Очередь рендера: одновременно считается одна заявка, ждёт не больше одной —
// новая вытесняет ждущую. Ползунок шлёт заявки каждый кадр, считается только
// последняя, устаревшие не тормозят.
import { renderVariants, type Preset } from "../src/index.ts";

export type RenderJob = { preset: Preset; seeds: number[] };
export type Backend = (job: RenderJob) => Promise<Float32Array[]>;

export const directBackend: Backend = async (job) => renderVariants(job.preset, job.seeds);

/** Рендер в Web Worker: главный поток не ждёт длинных классических шумов. */
export function workerBackend(): Backend {
  const worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, { resolve(v: Float32Array[]): void; reject(e: Error): void }>();
  let id = 0;
  worker.onmessage = (e: MessageEvent<{ id: number; out?: Float32Array[]; error?: string }>) => {
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if (e.data.out) w.resolve(e.data.out);
    else w.reject(new Error(e.data.error));
  };
  return (job) =>
    new Promise((resolve, reject) => {
      waiting.set(++id, { resolve, reject });
      worker.postMessage({ id, job });
    });
}

type Pending = { job: RenderJob; resolve(v: Float32Array[] | null): void; reject(e: unknown): void };

export class Renderer {
  private backend: Backend;
  private busy = false;
  private pending: Pending | null = null;

  constructor(backend: Backend) {
    this.backend = backend;
  }

  request(job: RenderJob): Promise<Float32Array[] | null> {
    return new Promise((resolve, reject) => {
      const p = { job, resolve, reject };
      if (this.busy) {
        this.pending?.resolve(null);
        this.pending = p;
      } else this.run(p);
    });
  }

  private run(p: Pending): void {
    this.busy = true;
    this.backend(p.job)
      .then(p.resolve, p.reject)
      .finally(() => {
        this.busy = false;
        const next = this.pending;
        this.pending = null;
        if (next) this.run(next);
      });
  }
}
