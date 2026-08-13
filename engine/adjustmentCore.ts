/**
 * Pure adjustment math (node-testable). Mirrored by the pixel worker so
 * adjustment previews can run off the main thread.
 */

export function applyLevels(data: Uint8ClampedArray, black: number, gamma: number, white: number) {
  const b = Math.max(0, Math.min(255, black));
  const w = Math.max(b + 1, Math.min(255, white));
  const range = w - b;
  const g = Math.max(0.05, Math.min(5, gamma));
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let n = (v - b) / range;
    n = Math.max(0, Math.min(1, n));
    n = Math.pow(n, 1 / g);
    lut[v] = Math.round(n * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

export function applyCurves(data: Uint8ClampedArray, pts: { x: number; y: number }[]) {
  const sorted = [...pts]
    .map((p) => ({ x: Math.max(0, Math.min(255, p.x)), y: Math.max(0, Math.min(255, p.y)) }))
    .sort((a, b) => a.x - b.x);
  if (sorted.length < 2) return;

  const lut = new Uint8Array(256);
  let seg = 0;
  for (let v = 0; v < 256; v++) {
    while (seg < sorted.length - 2 && sorted[seg + 1].x < v) seg++;
    const a = sorted[seg];
    const b = sorted[seg + 1];
    const span = Math.max(1, b.x - a.x);
    const t = (v - a.x) / span;
    lut[v] = Math.round(a.y + (b.y - a.y) * t);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

export function rgbToHsv(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return { h, s, v: mx };
}

export function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function applyHueSat(data: Uint8ClampedArray, hue: number, saturation: number, lightness: number) {
  const hShift = (Math.max(-180, Math.min(180, hue)) / 180) * 180;
  const sShift = 1 + Math.max(-100, Math.min(100, saturation)) / 100;
  const lShift = Math.max(-100, Math.min(100, lightness)) / 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const { h, s, v } = rgbToHsv(r, g, b);
    const out = hsvToRgb((h + hShift + 360) % 360, Math.max(0, Math.min(1, s * sShift)), v + lShift);
    data[i] = out.r;
    data[i + 1] = out.g;
    data[i + 2] = out.b;
  }
}
