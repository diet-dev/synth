import type { Preset } from "../src/index.ts";

// Пик 0,52, а не 0,6: клипы мотора вырезаны из рендера 2,5 с, нормированного
// к 0,6 целиком, и сами тише (пики 0,43–0,52). Мотор не должен стать громче.
export const MOTOR_PRESET: Preset = {
  ms: 257,
  fade: { in: 40, out: 40 },
  lp: 500,
  lpPasses: 2,
  peak: 0.52,
  voices: [
    { wave: "sine", hz: 80, noise: 0.3, pulses: { rate: 28, jitter: 0.08, ampJitter: 0.2, decay: 16 } },
    { wave: "sine", hz: 75, gain: 0.25, am: { hz: 3, depth: 0.3 } },
  ],
};
