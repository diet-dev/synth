import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SfxPlayer } from "../src/index.ts";

// Audio в Node нет: подменяем на запись того, что и с какой громкостью играли
type Played = { src: string; volume: number };
function withAudio(run: (played: Played[]) => void): void {
  const played: Played[] = [];
  class FakeAudio {
    public src = "";
    public volume = 1;
    public play(): Promise<void> {
      played.push({ src: this.src, volume: this.volume });
      return Promise.resolve();
    }
  }
  const prev = (globalThis as { Audio?: unknown }).Audio;
  (globalThis as { Audio?: unknown }).Audio = FakeAudio;
  try {
    run(played);
  } finally {
    (globalThis as { Audio?: unknown }).Audio = prev;
  }
}

describe("SfxPlayer", () => {
  it("play() по неизвестному ключу не бросает", () => {
    new SfxPlayer().play("nope");
  });

  it("initSound наполняет пул, play() играет вариант по кругу", () =>
    withAudio((played) => {
      const p = new SfxPlayer();
      p.add("gun", 2, ["a"]);
      p.initSound("gun", 2, ["a"]);
      p.play("gun");
      p.play("gun");
      p.play("gun");
      assert.deepEqual(played.map((x) => x.src), ["a", "a", "a"]);
    }));

  it("isMuted глушит play()", () =>
    withAudio((played) => {
      const p = new SfxPlayer({ isMuted: () => true });
      p.add("gun", 1, ["a"]);
      p.initSound("gun", 1, ["a"]);
      p.play("gun");
      assert.equal(played.length, 0);
    }));

  it("volume применяется перед play() и зажимается в 0..1", () =>
    withAudio((played) => {
      let v = 0.4;
      const p = new SfxPlayer({ volume: () => v });
      p.add("gun", 1, ["a"]);
      p.initSound("gun", 1, ["a"]);
      p.play("gun");
      v = 7;
      p.play("gun");
      assert.deepEqual(played.map((x) => x.volume), [0.4, 1]);
    }));

  it("ключ с пустыми вариантами молчит, пока initSound не дольёт пул", () =>
    withAudio((played) => {
      const p = new SfxPlayer();
      p.add("motor", 1, []);
      p.play("motor");
      p.initSound("motor", 1, ["x"]);
      p.play("motor");
      assert.deepEqual(played.map((x) => x.src), ["x"]);
    }));
});
