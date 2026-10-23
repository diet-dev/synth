// Состояние демки ↔ #hash: JSON → UTF-8 → base64url. Чужой или битый hash — null.
import type { DemoState } from "./types.ts";

const TONAL = ["sine", "saw", "square", "triangle", "noise"];
const CLASSIC = ["sine", "saw", "square", "noise"];

export function encodeState(s: DemoState): string {
  let bin = "";
  for (const b of new TextEncoder().encode(JSON.stringify(s))) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function decodeState(hash: string): DemoState | null {
  try {
    const bin = atob(hash.replace(/-/g, "+").replace(/_/g, "/"));
    const s: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!isObj(s) || !finite(s.seed) || !finite(s.period) || !isObj(s.sound)) return null;
    const { name, loop, preset } = s.sound;
    if (typeof name !== "string" || typeof loop !== "boolean" || !isObj(preset)) return null;
    if (!finite(preset.ms) || preset.ms <= 0 || !Array.isArray(preset.voices) || !preset.voices.length) return null;
    for (const v of preset.voices) {
      if (!isObj(v) || typeof v.wave !== "string") return null;
      if (!(v.kind === "classic" ? CLASSIC : TONAL).includes(v.wave)) return null;
    }
    return s as DemoState;
  } catch {
    return null;
  }
}
