export function warpImageData(
  data: ImageData,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  radius: number,
  strength: number
) {
  const { width, height } = data;
  const d = data.data;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  if (x1 <= x0 || y1 <= y0 || (dx === 0 && dy === 0)) return;

  const src = new Uint8ClampedArray(d);
  const r2 = radius * radius;

  const sample = (x: number, y: number) => {
    const px = Math.min(width - 1, Math.max(0, x));
    const py = Math.min(height - 1, Math.max(0, y));
    const i = (py * width + px) * 4;
    return [src[i], src[i + 1], src[i + 2], src[i + 3]];
  };

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ox = x - cx;
      const oy = y - cy;
      const dist2 = ox * ox + oy * oy;
      if (dist2 > r2) continue;

      const dist = Math.sqrt(dist2);
      const t = dist / radius;
      const falloff = (1 - t * t) * (1 - t * t);
      const amt = falloff * strength;

      const sx = x - dx * amt;
      const sy = y - dy * amt;

      const i = (y * width + x) * 4;
      const c = sample(sx, sy);
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = c[3];
    }
  }
}

export function warpCanvas(
  source: HTMLCanvasElement,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  radius: number,
  strength: number
) {
  const ctx = source.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, source.width, source.height);
  warpImageData(imgData, cx, cy, dx, dy, radius, strength);
  ctx.putImageData(imgData, 0, 0);
}