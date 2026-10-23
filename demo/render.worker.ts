// Воркер рендера: заявка { id, job } → { id, out } с передачей буферов без копии.
import { renderVariants } from "../src/index.ts";
import type { RenderJob } from "./renderer.ts";

type Scope = {
  onmessage: ((e: MessageEvent<{ id: number; job: RenderJob }>) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};
const scope = self as unknown as Scope;

scope.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const out = renderVariants(job.preset, job.seeds);
    scope.postMessage({ id, out }, out.map((s) => s.buffer));
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
