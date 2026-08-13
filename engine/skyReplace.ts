/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer, readActivePixels, notifyNoLayer } from "@/engine/pixelOps";

type RGB = [number, number, number];

interface SkyPreset {
  top: RGB;
  bottom: RGB;
  glow?: boolean;
  stars?: boolean;
}

const SKY_PRESETS: Record<string, SkyPreset> = {
  Sunny: { top: [74, 144, 217], bottom: [168, 216, 240], glow: true },
  Sunset: { top: [255, 154, 86], bottom: [106, 63, 191] },
  Storm: { top: [75, 85, 99], bottom: [31, 41, 55] },
  Night: { top: [15, 23, 42], bottom: [51, 65, 85], stars: true },
  "Golden Hour": { top: [245, 158, 11], bottom: [253, 230, 138] },
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function variance5x5(lum: Float32Array, w: number, h: number): Float32Array {
  const n = w * h;
  const hsum = new Float32Array(n);
  const hsq = new Float32Array(n);
  const vsum = new Float32Array(n);
  const vsq = new Float32Array(n);
  const win = Math.min(5, w, h);
  const hw = (win - 1) / 2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let s = 0;
    let sq = 0;
    for (let x = -hw; x <= hw; x++) {
      const kx = x < 0 ? 0 : x >= w ? w - 1 : x;
      const v = lum[row + kx];
      s += v;
      sq += v * v;
    }
    for (let x = 0; x < w; x++) {
      hsum[row + x] = s;
      hsq[row + x] = sq;
      const inX = x + hw + 1 < w ? x + hw + 1 : w - 1;
      const outX = x - hw >= 0 ? x - hw : 0;
      const vi = lum[row + inX];
      const vo = lum[row + outX];
      s += vi - vo;
      sq += vi * vi - vo * vo;
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    let sq = 0;
    for (let y = -hw; y <= hw; y++) {
      const ky = y < 0 ? 0 : y >= h ? h - 1 : y;
      const i = ky * w + x;
      s += hsum[i];
      sq += hsq[i];
    }
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      vsum[i] = s;
      vsq[i] = sq;
      const inY = y + hw + 1 < h ? y + hw + 1 : h - 1;
      const outY = y - hw >= 0 ? y - hw : 0;
      const iIn = inY * w + x;
      const iOut = outY * w + x;
      s += hsum[iIn] - hsum[iOut];
      sq += hsq[iIn] - hsq[iOut];
    }
  }
  const count = win * win;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const mean = vsum[i] / count;
    const m2 = vsq[i] / count;
    out[i] = Math.max(0, m2 - mean * mean);
  }
  return out;
}

function detectSky(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    lum[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  const varF = variance5x5(lum, w, h);
  const mask = new Float32Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let x = 0; x < w; x++) {
    const i = x;
    if (varF[i] < 220 && lum[i] > 40) {
      mask[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const li = lum[i];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        const j = ny * w + nx;
        if (mask[j]) continue;
        if (varF[j] < 420 && Math.abs(lum[j] - li) < 50 && lum[j] > 30) {
          mask[j] = 1;
          queue[tail++] = j;
        }
      }
    }
  }
  return mask;
}

function box1D(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      if (horizontal) {
        for (let t = -r; t <= r; t++) {
          const kx = x + t < 0 ? 0 : x + t >= w ? w - 1 : x + t;
          s += src[y * w + kx];
          c++;
        }
      } else {
        for (let t = -r; t <= r; t++) {
          const ky = y + t < 0 ? 0 : y + t >= h ? h - 1 : y + t;
          s += src[ky * w + x];
          c++;
        }
      }
      dst[y * w + x] = s / c;
    }
  }
}

function featherMask(mask: Float32Array, w: number, h: number, softness: number) {
  const passes = Math.max(0, Math.min(25, Math.round(softness / 10)));
  if (passes === 0) return;
  const tmp = new Float32Array(mask.length);
  for (let p = 0; p < passes; p++) {
    box1D(mask, tmp, w, h, 2, true);
    box1D(tmp, mask, w, h, 2, false);
  }
}

function renderSky(
  w: number,
  h: number,
  key: string,
  mult: number
): Uint8ClampedArray {
  const p = SKY_PRESETS[key] ?? SKY_PRESETS.Sunny;
  const [tr, tg, tb] = p.top;
  const [br, bg, bb] = p.bottom;
  const n = w * h;
  const out = new Uint8ClampedArray(n * 4);
  const glowCx = w * 0.5;
  const glowCy = h * 0.66;
  const glowR = Math.max(1, h * 0.5);
  for (let y = 0; y < h; y++) {
    const t = h > 1 ? y / (h - 1) : 0;
    const r = (tr + (br - tr) * t) * mult;
    const g = (tg + (bg - tg) * t) * mult;
    const b = (tb + (bb - tb) * t) * mult;
    for (let x = 0; x < w; x++) {
      let R = r;
      let G = g;
      let B = b;
      if (p.glow) {
        const dx = x - glowCx;
        const dy = y - glowCy;
        const d = Math.sqrt(dx * dx + dy * dy) / glowR;
        const add = Math.exp(-d * d * 2.5) * 80;
        R += add;
        G += add * 0.92;
        B += add * 0.68;
      }
      const o = (y * w + x) * 4;
      out[o] = clamp(R, 0, 255);
      out[o + 1] = clamp(G, 0, 255);
      out[o + 2] = clamp(B, 0, 255);
      out[o + 3] = 255;
    }
  }
  if (p.stars) {
    const rnd = mulberry32(987654321);
    const count = Math.max(40, Math.round(n / 3500));
    for (let s = 0; s < count; s++) {
      const sx = rnd() * w;
      const sy = rnd() * h * 0.72;
      const rad = rnd() * 1.4 + 0.4;
      const alpha = rnd() * 0.65 + 0.35;
      const cx = Math.floor(sx);
      const cy = Math.floor(sy);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > rad) continue;
          const o = (y * w + x) * 4;
          const a = (rad - d) * alpha * 160;
          out[o] = clamp(out[o] + a, 0, 255);
          out[o + 1] = clamp(out[o + 1] + a, 0, 255);
          out[o + 2] = clamp(out[o + 2] + a * 1.1, 0, 255);
        }
      }
    }
  }
  return out;
}

export async function skyReplacement(canvas: any): Promise<boolean> {
  if (!readActivePixels(canvas)) {
    notifyNoLayer();
    return false;
  }
  const res = await showOptions({
    title: "Sky Replacement",
    fields: [
      {
        key: "sky",
        label: "Sky",
        type: "select",
        value: "Sunny",
        options: ["Sunny", "Sunset", "Storm", "Night", "Golden Hour"].map((o) => ({ value: o, label: o })),
      },
      { key: "brightness", label: "Brightness", type: "slider", value: 0, min: -50, max: 50, suffix: "" },
      { key: "softness", label: "Horizon Softness", type: "slider", value: 50, min: 0, max: 100, suffix: "" },
    ],
  });
  if (!res) return false;
  const key = String(res.sky ?? "Sunny");
  const brightness = Number(res.brightness ?? 0);
  const softness = Number(res.softness ?? 50);
  const mult = Math.max(0.3, Math.min(2.2, 1 + brightness / 100));
  return applyPixelsToActiveLayer(canvas, (data, w, h) => {
    const mask = detectSky(data, w, h);
    featherMask(mask, w, h, softness);
    const sky = renderSky(w, h, key, mult);
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const m = mask[i];
      data[o] = sky[o] * m + data[o] * (1 - m);
      data[o + 1] = sky[o + 1] * m + data[o + 1] * (1 - m);
      data[o + 2] = sky[o + 2] * m + data[o + 2] * (1 - m);
    }
  });
}
