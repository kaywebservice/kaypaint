/**
 * Heal brush pixel engine (pure, node-testable).
 *
 * Healing copies texture from a nearby "clean" offset but re-lights it to
 * match the tone of the area being healed (a soft lighten/blend), so a
 * blemish is replaced by surrounding texture without introducing a tone
 * patch. `findHealOffset` picks a low-variance source offset automatically.
 */

export function lumaOf(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function patchVariance(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number
): number {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  if (x1 <= x0 || y1 <= y0) return Infinity;
  let sum = 0;
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      sum += lumaOf(data[i], data[i + 1], data[i + 2]);
      count++;
    }
  }
  if (!count) return Infinity;
  const mean = sum / count;
  let v = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const d = lumaOf(data[i], data[i + 1], data[i + 2]) - mean;
      v += d * d;
    }
  }
  return v / count;
}

/**
 * Scan nearby patches and return the offset to the lowest-variance one.
 * Returns {dx, dy} — a source offset relative to the brush center.
 */
export function findHealOffset(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  brushR: number
): { dx: number; dy: number } {
  const radii = [Math.round(brushR * 1.6), Math.round(brushR * 2.4), Math.round(brushR * 3.2)];
  const dirs = 8;
  let best: { dx: number; dy: number } | null = null;
  let bestV = Infinity;
  for (let ri = 0; ri < radii.length; ri++) {
    const rr = Math.max(1, radii[ri]);
    for (let k = 0; k < dirs; k++) {
      const ang = (Math.PI * 2 * k) / dirs;
      const px = Math.round(cx + Math.cos(ang) * rr);
      const py = Math.round(cy + Math.sin(ang) * rr);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const v = patchVariance(data, w, h, px, py, Math.max(1, brushR * 0.5));
      if (v < bestV) {
        bestV = v;
        best = { dx: px - Math.round(cx), dy: py - Math.round(cy) };
      }
    }
  }
  return best ?? { dx: Math.round(brushR), dy: 0 };
}

/**
 * Heal one brush stamp into `img.data`. Tone target is the average luminance
 * of the ring around the brush; texture comes from the source offset and is
 * re-lit to match that tone, blended with a soft edge.
 */
export function healStamp(
  img: ImageData,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  dx: number,
  dy: number
): void {
  const data = img.data;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));

  let ringLum = 0;
  let ringN = 0;
  const ringMin = r;
  const ringMax = r * 1.5;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= ringMin || d > ringMax) continue;
      const i = (y * w + x) * 4;
      ringLum += lumaOf(data[i], data[i + 1], data[i + 2]);
      ringN++;
    }
  }
  const targetLum = ringN > 0 ? ringLum / ringN : lumaOf(data[(Math.round(cy) * w + Math.round(cx)) * 4], data[(Math.round(cy) * w + Math.round(cx)) * 4 + 1], data[(Math.round(cy) * w + Math.round(cx)) * 4 + 2]);

  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dxc = x - cx;
      const dyc = y - cy;
      const d2 = dxc * dxc + dyc * dyc;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / r;
      const a = f * f * (2 - f);

      const sx = clamp(x - dx, 0, w - 1);
      const sy = clamp(y - dy, 0, h - 1);
      const si = (sy * w + sx) * 4;
      const srcLum = lumaOf(data[si], data[si + 1], data[si + 2]);
      const k = clamp(targetLum / (srcLum || 1), 0.6, 1.6);

      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = clamp(data[si + ch] * k, 0, 255);
        data[i + ch] = data[i + ch] * (1 - a) + v * a;
      }
    }
  }
}
