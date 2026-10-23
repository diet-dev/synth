// Генераторы случайных звуков по категориям. Игровые повторяют генераторы
// sfxr (pickup/coin, laser, explosion, powerup, hit, jump, blip): те же
// случайные шкалы 0..1, переведённые формулами sfxr в естественные единицы.
import type { Classic, Preset, Voice } from "../src/index.ts";
import { CLASSIC_SCHEMA, PRESET_SCHEMA, TONAL_SCHEMA, type Block } from "./schema.ts";
import type { Group } from "./types.ts";

export const LIMITS: Record<Group, { maxMs: number; maxPeak: number }> = {
  game: { maxMs: 1500, maxPeak: 0.8 },
  own: { maxMs: 400, maxPeak: 0.7 },
  ui: { maxMs: 150, maxPeak: 0.5 },
};
export const DEFAULT_PERIOD = 216;

export type Category = { id: string; label: string; icon: string; group: Group; loop: boolean; make(rand: () => number): Preset };

const MIN_HZ = 30;
const MAX_HZ = 8000;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number, d = 2): number => Number(x.toFixed(d));

// ── Шкалы sfxr → естественные единицы (частота дискретизации 44 100, суперсэмплинг ×8)
const R = 44100;
const SUB = 8 * R;
/** p_base_freq / p_freq_limit → Гц: период 100 / (f² + 0,001) подсэмплов. */
const sfxHz = (f: number): number => (SUB * (f * f + 0.001)) / 100;
/** Длина стадии огибающей: p² · 100 000 сэмплов → мс. */
const sfxMs = (p: number): number => (p * p * 100000 * 1000) / R;
/** p_freq_ramp → окт/с: период × (1 − r³·0,01) каждый сэмпл. */
const sfxSlide = (r: number): number => -Math.log2(1 - r ** 3 * 0.01) * R;
/** p_arp_speed → мс до скачка, p_arp_mod → во сколько раз растёт частота. */
const sfxJump = (speed: number, mod: number): { ms: number; ratio: number } => ({
  ms: (((1 - speed) ** 2 * 20000 + 32) * 1000) / R,
  ratio: 1 / (mod >= 0 ? 1 - mod * mod * 0.9 : 1 + mod * mod * 10),
});
const sfxRepeat = (s: number): number => (((1 - s) ** 2 * 20000 + 32) * 1000) / R;
const sfxDuty = (d: number): number => 0.5 - d * 0.5;
const sfxDutySlide = (r: number): number => -r * 0.00005 * R;
const sfxHp = (f: number): number => (f * f * 0.1 * SUB) / (2 * Math.PI);
const sfxLp = (f: number): number => (f ** 3 * 0.1 * SUB) / (2 * Math.PI);
const sfxVib = (strength: number, speed: number): { hz: number; depth: number } => ({
  hz: (speed * speed * 0.01 * R) / (2 * Math.PI),
  depth: strength * strength * 0.5,
});
const sfxPhaser = (offset: number, ramp: number): { ms: number; slide: number } => ({
  ms: (Math.sign(offset) * offset * offset * 1020 * 1000) / SUB,
  slide: Math.sign(ramp) * ramp * ramp * 125,
});

/** Набор p_* sfxr; по умолчанию — как в ResetParams. */
type Sfx = {
  wave: number;
  base: number;
  limit: number;
  ramp: number;
  dramp: number;
  duty: number;
  dutyRamp: number;
  vibStrength: number;
  vibSpeed: number;
  attack: number;
  sustain: number;
  punch: number;
  decay: number;
  lpf: number;
  lpfRamp: number;
  lpfRes: number;
  hpf: number;
  hpfRamp: number;
  phaOffset: number;
  phaRamp: number;
  repeat: number;
  arpSpeed: number;
  arpMod: number;
};
const RESET: Sfx = {
  wave: 0, base: 0.3, limit: 0, ramp: 0, dramp: 0, duty: 0, dutyRamp: 0, vibStrength: 0, vibSpeed: 0, attack: 0, sustain: 0.3,
  punch: 0, decay: 0.4, lpf: 1, lpfRamp: 0, lpfRes: 0, hpf: 0, hpfRamp: 0, phaOffset: 0, phaRamp: 0, repeat: 0, arpSpeed: 0, arpMod: 0,
};
const WAVES = ["square", "saw", "sine", "noise"] as const;

/** Набор sfxr → пресет с одним классическим голосом. */
function fromSfx(s: Sfx, peak: number): Preset {
  const v: Classic = {
    kind: "classic",
    wave: WAVES[s.wave],
    hz: round(clamp(sfxHz(s.base), MIN_HZ, MAX_HZ), 1),
    env: { a: round(sfxMs(s.attack)), h: round(sfxMs(s.sustain)), d: round(sfxMs(s.decay)) },
    gain: 0.25,
  };
  if (s.punch) v.env.punch = round(s.punch);
  if (s.ramp) v.slide = round(sfxSlide(s.ramp), 3);
  if (s.dramp) v.accel = round(-s.dramp * 100, 3);
  if (s.limit > 0) {
    v.minHz = round(sfxHz(s.limit), 1);
    v.stopAtMin = true;
  }
  if (s.vibStrength) v.vib = { hz: round(sfxVib(s.vibStrength, s.vibSpeed).hz), depth: round(sfxVib(s.vibStrength, s.vibSpeed).depth, 3) };
  if (s.arpMod) {
    const j = sfxJump(s.arpSpeed, s.arpMod);
    v.jump = { ms: round(j.ms), ratio: round(j.ratio, 3) };
  }
  if (s.repeat) v.repeat = round(sfxRepeat(s.repeat));
  if (s.wave === 0) {
    v.duty = round(sfxDuty(s.duty), 3);
    if (s.dutyRamp) v.dutySlide = round(sfxDutySlide(s.dutyRamp), 3);
  }
  if (s.lpf < 1) v.lp = { hz: round(sfxLp(s.lpf), 1), ...(s.lpfRamp ? { slide: round(s.lpfRamp * 10, 3) } : {}), ...(s.lpfRes ? { res: round(s.lpfRes) } : {}) };
  if (s.hpf > 0) v.hp = { hz: round(sfxHp(s.hpf), 1), ...(s.hpfRamp ? { slide: round(s.hpfRamp * 10, 3) } : {}) };
  if (s.phaOffset) v.phaser = { ms: round(sfxPhaser(s.phaOffset, s.phaRamp).ms, 3), slide: round(sfxPhaser(s.phaOffset, s.phaRamp).slide, 3) };
  const ms = Math.min(LIMITS.game.maxMs, Math.ceil(v.env.a + v.env.h + v.env.d) + 10);
  return { ms, peak, voices: [v] };
}

type Rand = () => number;
const tools = (rand: Rand) => ({
  frnd: (x: number): number => rand() * x,
  rnd: (n: number): number => Math.floor(rand() * (n + 1)),
  between: (lo: number, hi: number): number => lo + rand() * (hi - lo),
});

// ── Игровые: генераторы sfxr один в один, кроме громкости (peak вместо sound_vol)
function coin(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, base: 0.4 + frnd(0.5), attack: 0, sustain: frnd(0.1), decay: 0.1 + frnd(0.4), punch: 0.3 + frnd(0.3) };
  if (rnd(1)) Object.assign(s, { arpSpeed: 0.5 + frnd(0.2), arpMod: 0.2 + frnd(0.4) });
  return fromSfx(s, 0.5);
}

function laser(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, wave: rnd(2) };
  if (s.wave === 2 && rnd(1)) s.wave = rnd(1);
  s.base = 0.5 + frnd(0.5);
  s.limit = Math.max(0.2, s.base - 0.2 - frnd(0.6));
  s.ramp = -0.15 - frnd(0.2);
  if (rnd(2) === 0) Object.assign(s, { base: 0.3 + frnd(0.6), limit: frnd(0.1), ramp: -0.35 - frnd(0.3) });
  if (rnd(1)) Object.assign(s, { duty: frnd(0.5), dutyRamp: frnd(0.2) });
  else Object.assign(s, { duty: 0.4 + frnd(0.5), dutyRamp: -frnd(0.7) });
  Object.assign(s, { attack: 0, sustain: 0.1 + frnd(0.2), decay: frnd(0.4) });
  if (rnd(1)) s.punch = frnd(0.3);
  if (rnd(2) === 0) Object.assign(s, { phaOffset: frnd(0.2), phaRamp: -frnd(0.2) });
  if (rnd(1)) s.hpf = frnd(0.3);
  return fromSfx(s, 0.45);
}

function explosion(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, wave: 3 };
  if (rnd(1)) Object.assign(s, { base: 0.1 + frnd(0.4), ramp: -0.1 + frnd(0.4) });
  else Object.assign(s, { base: 0.2 + frnd(0.7), ramp: -0.2 - frnd(0.2) });
  s.base *= s.base;
  if (rnd(4) === 0) s.ramp = 0;
  if (rnd(2) === 0) s.repeat = 0.3 + frnd(0.5);
  Object.assign(s, { attack: 0, sustain: 0.1 + frnd(0.3), decay: frnd(0.5) });
  if (rnd(1) === 0) Object.assign(s, { phaOffset: -0.3 + frnd(0.9), phaRamp: -frnd(0.3) });
  s.punch = 0.2 + frnd(0.6);
  if (rnd(1)) Object.assign(s, { vibStrength: frnd(0.7), vibSpeed: frnd(0.6) });
  if (rnd(2) === 0) Object.assign(s, { arpSpeed: 0.6 + frnd(0.3), arpMod: 0.8 - frnd(1.6) });
  return fromSfx(s, 0.6);
}

function powerup(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET };
  if (rnd(1)) s.wave = 1;
  else s.duty = frnd(0.6);
  if (rnd(1)) Object.assign(s, { base: 0.2 + frnd(0.3), ramp: 0.1 + frnd(0.4), repeat: 0.4 + frnd(0.4) });
  else {
    Object.assign(s, { base: 0.2 + frnd(0.3), ramp: 0.05 + frnd(0.2) });
    if (rnd(1)) Object.assign(s, { vibStrength: frnd(0.7), vibSpeed: frnd(0.6) });
  }
  Object.assign(s, { attack: 0, sustain: frnd(0.4), decay: 0.1 + frnd(0.4) });
  return fromSfx(s, 0.45);
}

function hit(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, wave: rnd(2) };
  if (s.wave === 2) s.wave = 3;
  if (s.wave === 0) s.duty = frnd(0.6);
  Object.assign(s, { base: 0.2 + frnd(0.6), ramp: -0.3 - frnd(0.4), attack: 0, sustain: frnd(0.1), decay: 0.1 + frnd(0.2) });
  if (rnd(1)) s.hpf = frnd(0.3);
  return fromSfx(s, 0.55);
}

function jump(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, wave: 0, duty: frnd(0.6), base: 0.3 + frnd(0.3), ramp: 0.1 + frnd(0.2), attack: 0, sustain: 0.1 + frnd(0.3), decay: 0.1 + frnd(0.2) };
  if (rnd(1)) s.hpf = frnd(0.3);
  if (rnd(1)) s.lpf = 1 - frnd(0.6);
  return fromSfx(s, 0.45);
}

function blip(rand: Rand): Preset {
  const { frnd, rnd } = tools(rand);
  const s = { ...RESET, wave: rnd(1) };
  if (s.wave === 0) s.duty = frnd(0.6);
  Object.assign(s, { base: 0.2 + frnd(0.4), attack: 0, sustain: 0.1 + frnd(0.1), decay: frnd(0.2), hpf: 0.1 });
  return fromSfx(s, 0.4);
}

// ── Свои: клипы под перезапуск раз в DEFAULT_PERIOD, вход и выход — 40 мс
const loopClip = (rand: Rand, fade: number): { ms: number; fade: { in: number; out: number } } => ({
  ms: Math.round(DEFAULT_PERIOD + fade + tools(rand).between(0, 60)),
  fade: { in: fade, out: fade },
});

function motor(rand: Rand): Preset {
  const { between } = tools(rand);
  const hz = round(between(55, 110), 1);
  return {
    ...loopClip(rand, 40),
    lp: Math.round(between(400, 800)),
    lpPasses: 2,
    peak: 0.5,
    voices: [
      {
        wave: rand() < 0.7 ? "sine" : "triangle",
        hz,
        noise: round(between(0.15, 0.45)),
        pulses: { rate: round(between(16, 40), 1), jitter: round(between(0.03, 0.12)), ampJitter: round(between(0.1, 0.3)), decay: round(between(8, 24), 1) },
      },
      { wave: "sine", hz: round(Math.max(MIN_HZ, hz * between(0.85, 1)), 1), gain: round(between(0.15, 0.35)), am: { hz: round(between(1, 5), 1), depth: round(between(0.2, 0.4)) } },
    ],
  };
}

function hum(rand: Rand): Preset {
  const { between } = tools(rand);
  const hz = round(between(50, 160), 1);
  const detune = between(1.003, 1.012);
  return {
    ...loopClip(rand, 40),
    lp: Math.round(between(800, 2000)),
    peak: 0.4,
    voices: [
      { wave: "saw", hz, gain: 0.6, am: { hz: round(between(0.5, 3), 1), depth: round(between(0.1, 0.3)) } },
      { wave: "saw", hz: round(hz * detune, 2), gain: 0.6, fm: { hz: round(between(0.3, 2), 1), depth: round(between(0.002, 0.01), 3) } },
      { wave: "sine", hz: round(Math.max(MIN_HZ, hz / 2), 1), gain: round(between(0.3, 0.6)) },
    ],
  };
}

function rattle(rand: Rand): Preset {
  const { between } = tools(rand);
  return {
    ...loopClip(rand, 30),
    peak: 0.45,
    voices: [
      {
        wave: "noise",
        hp: Math.round(between(1000, 3500)),
        pulses: { rate: round(between(20, 45), 1), jitter: round(between(0.08, 0.3)), ampJitter: round(between(0.2, 0.5)), decay: round(between(1.5, 5), 1) },
      },
      { wave: "square", hz: round(between(150, 400), 1), gain: round(between(0.15, 0.35)), lp: Math.round(between(1500, 3000)), pulses: { rate: round(between(20, 45), 1), jitter: 0.15, decay: round(between(2, 6), 1) } },
    ],
  };
}

// ── Интерфейс: короткие, мягкие, без хвостов
function click(rand: Rand): Preset {
  const { between } = tools(rand);
  const hz = Math.round(between(700, 2200));
  const ms = Math.round(between(25, 60));
  return { ms, peak: round(between(0.3, 0.4)), voices: [{ wave: rand() < 0.6 ? "sine" : "triangle", hz, toHz: Math.round(hz * between(0.4, 0.7)), env: { a: 1, d: ms - 1, exp: true } }] };
}

function hover(rand: Rand): Preset {
  const { between } = tools(rand);
  const ms = Math.round(between(30, 60));
  const hz = Math.round(between(1500, 3500));
  return { ms, peak: round(between(0.15, 0.25)), voices: [{ wave: "sine", hz, toHz: Math.round(hz * between(1, 1.15)), env: { a: 3, d: ms - 3, exp: true } }] };
}

function toggle(rand: Rand): Preset {
  const { between } = tools(rand);
  const gap = between(30, 50);
  return {
    ms: Math.round(gap * 2 + 20),
    peak: round(between(0.25, 0.35)),
    voices: [{ wave: rand() < 0.5 ? "triangle" : "sine", hz: Math.round(between(900, 2000)), pulses: { rate: round(1000 / gap, 1), decay: round(between(4, 8), 1) } }],
  };
}

function open(rand: Rand): Preset {
  const { between } = tools(rand);
  const ms = Math.round(between(90, 140));
  const hz = Math.round(between(300, 600));
  return { ms, peak: round(between(0.25, 0.35)), voices: [{ wave: "sine", hz, toHz: Math.round(hz * between(1.8, 2.6)), env: { a: 5, d: ms - 5, exp: rand() < 0.5 } }] };
}

function close(rand: Rand): Preset {
  const { between } = tools(rand);
  const ms = Math.round(between(80, 130));
  const hz = Math.round(between(700, 1100));
  return { ms, peak: round(between(0.25, 0.35)), voices: [{ wave: "sine", hz, toHz: Math.round(hz * between(0.4, 0.6)), env: { a: 3, d: ms - 3, exp: true } }] };
}

function confirm(rand: Rand): Preset {
  const { between } = tools(rand);
  const h = Math.round(between(40, 60));
  const d = Math.round(between(50, 70));
  return {
    ms: Math.min(150, h + d + 5),
    peak: round(between(0.3, 0.4)),
    voices: [
      { kind: "classic", wave: "sine", hz: Math.round(between(600, 1000)), jump: { ms: Math.round(h * between(0.4, 0.6)), ratio: round(between(1.25, 1.5), 3) }, env: { a: 0, h, d }, gain: 0.25 },
    ],
  };
}

function error(rand: Rand): Preset {
  const { between } = tools(rand);
  return {
    ms: Math.round(between(130, 150)),
    peak: round(between(0.3, 0.4)),
    voices: [
      {
        wave: rand() < 0.5 ? "square" : "saw",
        hz: Math.round(between(140, 240)),
        lp: Math.round(between(900, 1600)),
        pulses: { rate: round(between(13, 16), 1), decay: round(between(18, 28), 1), len: Math.round(between(45, 60)) },
      },
    ],
  };
}

export const CATEGORIES: Category[] = [
  { id: "coin", label: "Монетка", icon: "🪙", group: "game", loop: false, make: coin },
  { id: "laser", label: "Лазер", icon: "⚡", group: "game", loop: false, make: laser },
  { id: "explosion", label: "Взрыв", icon: "💥", group: "game", loop: false, make: explosion },
  { id: "powerup", label: "Бонус", icon: "⭐", group: "game", loop: false, make: powerup },
  { id: "hit", label: "Удар", icon: "👊", group: "game", loop: false, make: hit },
  { id: "jump", label: "Прыжок", icon: "🦘", group: "game", loop: false, make: jump },
  { id: "blip", label: "Блип", icon: "🔹", group: "game", loop: false, make: blip },
  { id: "motor", label: "Мотор", icon: "⚙️", group: "own", loop: true, make: motor },
  { id: "hum", label: "Гул", icon: "〰️", group: "own", loop: true, make: hum },
  { id: "rattle", label: "Трещотка", icon: "🪇", group: "own", loop: true, make: rattle },
  { id: "click", label: "Клик", icon: "🖱️", group: "ui", loop: false, make: click },
  { id: "hover", label: "Наведение", icon: "👆", group: "ui", loop: false, make: hover },
  { id: "switch", label: "Переключение", icon: "🔀", group: "ui", loop: false, make: toggle },
  { id: "open", label: "Открыть", icon: "📂", group: "ui", loop: false, make: open },
  { id: "close", label: "Закрыть", icon: "✖️", group: "ui", loop: false, make: close },
  { id: "confirm", label: "Подтверждение", icon: "✔️", group: "ui", loop: false, make: confirm },
  { id: "error", label: "Ошибка", icon: "⛔", group: "ui", loop: false, make: error },
];

// ── Мутация: каждое число чуть сдвигается (частоты — в октавах), в пределах схемы и группы
const FREQ = new Set(["hz", "toHz", "minHz", "lp", "hp"]);

function shake(o: Record<string, unknown>, schema: Block[], rand: Rand, amount: number): Record<string, unknown> {
  const out = structuredClone(o);
  for (const b of schema) {
    const t = (b.key ? out[b.key] : out) as Record<string, unknown> | undefined;
    if (!t) continue;
    for (const f of b.fields) {
      const x = t[f.key];
      if (f.kind !== "num" || typeof x !== "number" || f.key === "lpPasses") continue;
      const k = amount * (2 * rand() - 1);
      const y = FREQ.has(f.key) || (b.key && f.key === "hz") ? x * 2 ** k : x * (1 + k);
      t[f.key] = round(clamp(y, f.min, f.max), 4);
    }
  }
  return out;
}

export function mutate(p: Preset, group: Group, rand: Rand, amount = 0.1): Preset {
  const top = shake(p as Record<string, unknown>, PRESET_SCHEMA, rand, amount) as Preset;
  const voices = p.voices.map((v) => {
    const m = shake(v as Record<string, unknown>, "kind" in v ? CLASSIC_SCHEMA : TONAL_SCHEMA, rand, amount) as Voice | Classic;
    if ("kind" in m) m.hz = clamp(m.hz, MIN_HZ, MAX_HZ);
    else {
      if (m.hz !== undefined) m.hz = clamp(m.hz, MIN_HZ, MAX_HZ);
      if (m.toHz !== undefined) m.toHz = clamp(m.toHz, MIN_HZ, MAX_HZ);
    }
    return m;
  });
  const { maxMs, maxPeak } = LIMITS[group];
  let ms = Math.min(top.ms, maxMs);
  // Клип для цикла не короче перезапуска — иначе на стыке провал
  if (top.fade && group === "own") ms = Math.max(ms, Math.min(maxMs, DEFAULT_PERIOD + top.fade.out));
  return { ...top, ms, ...(top.peak !== undefined ? { peak: Math.min(top.peak, maxPeak) } : {}), voices };
}
