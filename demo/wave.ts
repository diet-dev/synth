// Волна звука: минимум и максимум на столбец пикселей, цвета — из CSS-переменных.

export function drawWave(canvas: HTMLCanvasElement, samples: Float32Array): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext("2d")!;
  const css = getComputedStyle(canvas);
  g.fillStyle = css.getPropertyValue("--wave-bg").trim() || "transparent";
  g.fillRect(0, 0, w, h);
  const mid = h / 2;
  g.fillStyle = css.getPropertyValue("--wave-axis").trim() || "#8884";
  g.fillRect(0, Math.floor(mid), w, Math.max(1, Math.round(dpr)));
  if (!samples.length) return;
  g.fillStyle = css.getPropertyValue("--wave").trim() || "#4a8";
  const per = samples.length / w;
  for (let x = 0; x < w; x++) {
    const from = Math.floor(x * per);
    const to = Math.max(from + 1, Math.floor((x + 1) * per));
    let lo = 0;
    let hi = 0;
    for (let i = from; i < to && i < samples.length; i++) {
      const s = samples[i];
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    const top = mid - Math.min(1, hi) * mid * 0.95;
    const bottom = mid - Math.max(-1, lo) * mid * 0.95;
    g.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}
