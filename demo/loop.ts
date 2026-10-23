// Планировщик режима цикла: перезапуск клипа раз в период, случайный вариант,
// пул экземпляров на вариант — как SfxPlayer в игре (см. test/reference/game.ts).
// Занятый экземпляр перезапуск пропускает, сетка перезапусков не сдвигается.

export type Start = { at: number; variant: number };

export class LoopScheduler {
  private period = 0.216;
  private lengths: number[] = [];
  private busy: number[][] = [];
  private tick: number[] = [];
  private first = 0;
  private last: number | null = null;

  private rand: () => number;
  private pool: number;

  constructor(rand: () => number, pool = 10) {
    this.rand = rand;
    this.pool = pool;
  }

  start(now: number): void {
    this.first = now;
    this.last = null;
    this.reset();
  }

  setPeriod(ms: number): void {
    this.period = ms / 1000;
  }

  setLengths(seconds: number[]): void {
    const resized = seconds.length !== this.lengths.length;
    this.lengths = seconds.slice();
    if (resized) this.reset();
  }

  /**
   * Перезапуски после последнего выданного и не позже until (секунды часов
   * AudioContext). Опоздавшие раньше notBefore (вкладка спала) пропускаются —
   * иначе сыграли бы все разом.
   */
  plan(until: number, notBefore = -Infinity): Start[] {
    const out: Start[] = [];
    const n = this.lengths.length;
    if (!n || !(this.period > 0)) return out;
    let t = this.last === null ? this.first : this.last + this.period;
    if (t < notBefore) t += Math.ceil((notBefore - t) / this.period - 1e-9) * this.period;
    for (; t <= until + 1e-9; t += this.period) {
      this.last = t;
      const v = Math.floor(this.rand() * n);
      const i = this.tick[v];
      this.tick[v] = (i + 1) % this.pool;
      if (this.busy[v][i] + this.lengths[v] > t + 1e-9) continue;
      this.busy[v][i] = t;
      out.push({ at: t, variant: v });
    }
    return out;
  }

  private reset(): void {
    this.busy = this.lengths.map(() => new Array<number>(this.pool).fill(-Infinity));
    this.tick = this.lengths.map(() => 0);
  }
}
