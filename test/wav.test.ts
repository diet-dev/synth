import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toWav } from "../src/index.ts";

const PREFIX = "data:audio/wav;base64,";
const decode = (url: string): Buffer => Buffer.from(url.slice(PREFIX.length), "base64");

describe("toWav", () => {
  it("префикс и заголовок PCM 16 бит моно 44100", () => {
    const url = toWav(new Float32Array(10));
    assert.ok(url.startsWith(PREFIX));
    const b = decode(url);
    assert.equal(b.toString("ascii", 0, 4), "RIFF");
    assert.equal(b.toString("ascii", 8, 12), "WAVE");
    assert.equal(b.readUInt16LE(20), 1);
    assert.equal(b.readUInt16LE(22), 1);
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt16LE(34), 16);
    assert.equal(b.toString("ascii", 36, 40), "data");
    assert.equal(b.readUInt32LE(40), 20);
    assert.equal(b.length, 44 + 20);
  });

  it("значения за ±1 зажимаются, а не переполняют int16", () => {
    const b = decode(toWav(new Float32Array([1.5, -1.5, 0.5])));
    assert.deepEqual([b.readInt16LE(44), b.readInt16LE(46), b.readInt16LE(48)], [32767, -32767, 16384]);
  });
});
