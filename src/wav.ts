export const SAMPLE_RATE = 44100;

// Кусками: String.fromCharCode(...огромный массив) переполняет стек вызова.
const CHUNK = 8192;

export function toWav(samples: Float32Array, rate: number = SAMPLE_RATE): string {
  const data = samples.length * 2;
  const bytes = new Uint8Array(44 + data);
  const v = new DataView(bytes.buffer);
  const ascii = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  ascii(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, data, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return "data:audio/wav;base64," + btoa(bin);
}
