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
  voices: (Voice | Classic)[];
  /** Линейные вход и выход всего звука, мс. */
  fade?: { in: number; out: number };
  /** ФНЧ на сумме голосов, Гц, и сколько раз его пройти. */
  lp?: number;
  lpPasses?: number;
  /** Пик самого громкого варианта после нормализации — общая громкость звука; не задан — уровень как есть. */
  peak?: number;
};

/**
 * Классический голос: цикл sfxr (суперсэмплинг ×8) в естественных единицах —
 * копирует звуки jsfxr. Длина звука задаёт огибающая, остаток — тишина.
 */
export type Classic = {
  kind: "classic";
  wave: Exclude<Wave, "triangle">;
  hz: number;
  /** Нижний предел тона; stopAtMin — звук обрывается, дойдя до него. */
  minHz?: number;
  stopAtMin?: boolean;
  /** Спад/подъём тона, октав в секунду (минус — вниз), и его ускорение, окт/с². */
  slide?: number;
  accel?: number;
  /** Вибрато: период тона × (1 + depth·sin). */
  vib?: Lfo;
  /** Скачок тона: через ms частота × ratio. */
  jump?: { ms: number; ratio: number };
  /** Повтор: каждые ms тон, скачок и скважность начинаются заново (огибающая — нет). */
  repeat?: number;
  /** Доля «верха» квадрата 0..0,5 и её сдвиг в секунду. */
  duty?: number;
  dutySlide?: number;
  /** Огибающая, мс; punch — подъём громкости в начале удержания. */
  env: { a: number; h: number; d: number; punch?: number };
  /** Резонансный ФНЧ: частота, сдвиг окт/с, резонанс 0..1. */
  lp?: { hz: number; slide?: number; res?: number };
  hp?: { hz: number; slide?: number };
  /** Фазер: задержка, мс (со знаком), и её сдвиг, мс/с. */
  phaser?: { ms: number; slide?: number };
  gain?: number;
};
