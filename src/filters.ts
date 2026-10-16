// Однополюсные фильтры на месте; крутизну набирают повтором прохода.
export function lowpass(s: Float32Array, hz: number, rate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / rate);
  let y = 0;
  for (let i = 0; i < s.length; i++) s[i] = y += a * (s[i] - y);
}

export function highpass(s: Float32Array, hz: number, rate: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / rate);
  let y = 0;
  for (let i = 0; i < s.length; i++) {
    y += a * (s[i] - y);
    s[i] -= y;
  }
}
