export type Wave = "sine" | "saw" | "square" | "triangle" | "noise";

/** Огибающая голоса, мс: атака, удержание (по умолчанию — до спада в конце звука), спад. */
export type Env = { a?: number; h?: number; d?: number; exp?: boolean };

/** Модуляция: частота, Гц, и глубина 0..1. */
export type Lfo = { hz: number; depth: number };

/** Поезд толчков: rate в секунду, разброс интервала и громкости (доли), спад толчка, мс. */
export type Pulses = { rate: number; jitter?: number; ampJitter?: number; decay: number; len?: number };

export type Voice = {
  wave: Wave;
  hz?: number;
  /** Частота к концу звука; тон меняется линейно. */
  toHz?: number;
  duty?: number;
  /** Добавка белого шума к тону (тон не ослабляется). */
  noise?: number;
  gain?: number;
  env?: Env;
  pulses?: Pulses;
  am?: Lfo;
  fm?: Lfo;
  lp?: number;
  hp?: number;
};

export type Preset = {
  ms: number;
  voices: Voice[];
  /** Линейные вход и выход всего звука, мс. */
  fade?: { in: number; out: number };
  /** ФНЧ на сумме голосов, Гц, и сколько раз его пройти. */
  lp?: number;
  lpPasses?: number;
  /** Пик самого громкого варианта после нормализации — общая громкость звука. */
  peak?: number;
};
