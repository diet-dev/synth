export type SfxOptions = {
  // Глушение и громкость — колбэками: пакет не знает про UI и хранилище игры
  isMuted?: () => boolean;
  /** Громкость 0..1, читается в момент проигрывания. */
  volume?: () => number;
  /** Логировать неизвестный ключ (обычно только в дев-сборке). */
  debug?: boolean;
};

type Variant = { tick: number; count: number; pool: HTMLAudioElement[] };

/** Пул Audio на ключ: по варианту-URL на звук, count экземпляров на вариант. */
export class SfxPlayer {
  public sounds: { [key: string]: Variant[] } = {};

  private options: SfxOptions;
  private queue: [string, number, string[]][] = [];

  constructor(options: SfxOptions = {}) {
    this.options = options;
  }

  public add(key: string, count: number, urls: string[]): void {
    this.sounds[key] = [];
    this.queue.push([key, count, urls]);
  }

  // Порциями: сотни Audio в одном кадре подвесили бы старт
  public init(): void {
    const next = (): void => {
      const item = this.queue.shift();
      if (!item) return;
      this.initSound(...item);
      if (this.queue.length) setTimeout(next, 50);
    };
    next();
  }

  /** Дописывает варианты к ключу: так звук можно дорендерить после init(). */
  public initSound(key: string, count: number, urls: string[]): void {
    const variants = this.sounds[key] || (this.sounds[key] = []);
    for (const url of urls) {
      const pool: HTMLAudioElement[] = [];
      for (let j = 0; j < count; j++) {
        const audio = new Audio();
        audio.src = url;
        pool.push(audio);
      }
      variants.push({ tick: 0, count, pool });
    }
  }

  public play(key: string): void {
    const variants = this.sounds[key];
    if (!variants) {
      if (this.options.debug) console.error(`Не найден звук "${key}"!`);
      return;
    }
    if (this.options.isMuted?.()) return;
    const v = variants.length > 1 ? variants[Math.floor(Math.random() * variants.length)] : variants[0];
    if (!v) return;
    const audio = v.pool[v.tick];
    const vol = this.options.volume?.() ?? 1;
    audio.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1;
    // Отказ автоплея до жеста пользователя — не ошибка игры
    audio.play().catch(() => {});
    v.tick = v.tick < v.count - 1 ? v.tick + 1 : 0;
  }
}
