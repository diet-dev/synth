// Проигрывание через Web Audio: разовый звук обрывает предыдущий, цикл
// перезапускает клип по LoopScheduler с упреждением 0,2 с.
import { SAMPLE_RATE } from "../src/index.ts";
import { LoopScheduler } from "./loop.ts";

const LOOKAHEAD = 0.2;
const TIMER_MS = 50;
const FADE = 0.03;

export class Player {
  private ctx: AudioContext | null = null;
  private once: AudioBufferSourceNode | null = null;
  private buffers: AudioBuffer[] = [];
  private loopOut: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private scheduler = new LoopScheduler(Math.random);
  private timer = 0;

  get looping(): boolean {
    return this.timer !== 0;
  }

  playOnce(samples: Float32Array): void {
    const ctx = this.context();
    this.once?.stop();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(samples);
    src.connect(ctx.destination);
    src.onended = () => {
      if (this.once === src) this.once = null;
    };
    src.start();
    this.once = src;
  }

  startLoop(variants: Float32Array[], periodMs: number): void {
    const ctx = this.context();
    this.stopLoop();
    this.once?.stop();
    this.loopOut = ctx.createGain();
    this.loopOut.connect(ctx.destination);
    this.scheduler.setPeriod(periodMs);
    this.setLoopVariants(variants);
    this.scheduler.start(ctx.currentTime + 0.02);
    this.pump();
    this.timer = window.setInterval(() => this.pump(), TIMER_MS);
  }

  /** Новые клипы — со следующего перезапуска; звучащие доигрывают. */
  setLoopVariants(variants: Float32Array[]): void {
    this.buffers = variants.map((s) => this.buffer(s));
    this.scheduler.setLengths(this.buffers.map((b) => b.duration));
  }

  setLoopPeriod(ms: number): void {
    this.scheduler.setPeriod(ms);
  }

  stopLoop(): void {
    if (!this.timer || !this.ctx || !this.loopOut) return;
    clearInterval(this.timer);
    this.timer = 0;
    // Затухание вместо обрыва — без щелчка
    const out = this.loopOut;
    const now = this.ctx.currentTime;
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + FADE);
    const sources = [...this.sources];
    this.sources.clear();
    for (const s of sources) s.stop(now + FADE);
    setTimeout(() => out.disconnect(), FADE * 1000 + 50);
    this.loopOut = null;
  }

  private pump(): void {
    const ctx = this.ctx!;
    for (const { at, variant } of this.scheduler.plan(ctx.currentTime + LOOKAHEAD, ctx.currentTime - 0.03)) {
      const src = ctx.createBufferSource();
      src.buffer = this.buffers[variant];
      src.connect(this.loopOut!);
      src.onended = () => this.sources.delete(src);
      src.start(Math.max(at, ctx.currentTime));
      this.sources.add(src);
    }
  }

  private buffer(samples: Float32Array): AudioBuffer {
    const b = this.context().createBuffer(1, Math.max(1, samples.length), SAMPLE_RATE);
    b.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    return b;
  }

  // Контекст создаётся по первому действию пользователя — так требует политика автоплея
  private context(): AudioContext {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }
}
