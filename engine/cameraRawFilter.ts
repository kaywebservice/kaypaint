/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

const lumOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

const PRESETS: Record<string, Record<string, number> | "auto"> = {
  Auto: "auto",
  Portrait: { contrast: 12, temperature: 5, clarity: 10, vibrance: 8 },
  Landscape: { saturation: 12, contrast: 12, clarity: 20, vibrance: 20, temperature: 4 },
  Vivid: { saturation: 25, contrast: 15, clarity: 12, vibrance: 30 },
};

interface RawParams {
  preset: string;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  clarity: number;
  vibrance: number;
  saturation: number;
  temperature: number;
  tint: number;
  vignette: number;
  grain: number;
}

function box3(src: Float32Array, dst: Float32Array, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          s += src[ky * w + kx];
        }
      }
      dst[y * w + x] = s / 9;
    }
  }
}

function applyRaw(data: Uint8ClampedArray, w: number, h: number, P: RawParams) {
  const n = w * h;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    r[i] = data[o];
    g[i] = data[o + 1];
    b[i] = data[o + 2];
  }

  let ev = P.exposure;
  if (P.preset === "Auto") {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += lumOf(r[i], g[i], b[i]);
    ev = clamp((118 - sum / n) / 32, -4, 4);
  }
  const exMul = Math.pow(2, ev);
  if (exMul !== 1) {
    for (let i = 0; i < n; i++) {
      r[i] *= exMul;
      g[i] *= exMul;
      b[i] *= exMul;
    }
  }

  const rW = (1 + P.temperature * 0.0025) * (1 - P.tint * 0.0012);
  const gW = 1 + P.tint * 0.0018;
  const bW = (1 - P.temperature * 0.0025) * (1 - P.tint * 0.0012);
  if (rW !== 1) for (let i = 0; i < n; i++) r[i] *= rW;
  if (gW !== 1) for (let i = 0; i < n; i++) g[i] *= gW;
  if (bW !== 1) for (let i = 0; i < n; i++) b[i] *= bW;

  const H = P.highlights;
  const S = P.shadows;
  const W = P.whites;
  const BK = P.blacks;
  if (H !== 0 || S !== 0 || W !== 0 || BK !== 0) {
    for (let i = 0; i < n; i++) {
      const l = lumOf(r[i], g[i], b[i]);
      const l01 = l / 255;
      const hi = smoothstep(0.4, 1.0, l01);
      const sh = 1 - smoothstep(0, 0.6, l01);
      const wh = smoothstep(0.55, 1.0, l01);
      const bl = 1 - smoothstep(0, 0.3, l01);
      if (H !== 0) {
        const k = (H / 100) * hi * 0.85;
        r[i] -= k * (255 - r[i]);
        g[i] -= k * (255 - g[i]);
        b[i] -= k * (255 - b[i]);
      }
      if (S !== 0) {
        const k = (S / 100) * sh * 0.9;
        r[i] += k * (128 - r[i]);
        g[i] += k * (128 - g[i]);
        b[i] += k * (128 - b[i]);
      }
      if (W !== 0) {
        const k = (W / 100) * wh * 0.7;
        r[i] += k * (255 - r[i]);
        g[i] += k * (255 - g[i]);
        b[i] += k * (255 - b[i]);
      }
      if (BK !== 0) {
        const k = (BK / 100) * bl * 0.8;
        r[i] -= k * r[i];
        g[i] -= k * g[i];
        b[i] -= k * b[i];
      }
    }
  }

  if (P.contrast !== 0) {
    const c = 1 + (P.contrast / 100) * 0.9;
    for (let i = 0; i < n; i++) {
      r[i] = 128 + (r[i] - 128) * c;
      g[i] = 128 + (g[i] - 128) * c;
      b[i] = 128 + (b[i] - 128) * c;
    }
  }

  if (P.clarity !== 0) {
    const amt = (P.clarity / 100) * 1.4;
    const rB = new Float32Array(n);
    const gB = new Float32Array(n);
    const bB = new Float32Array(n);
    box3(r, rB, w, h);
    box3(g, gB, w, h);
    box3(b, bB, w, h);
    for (let i = 0; i < n; i++) {
      r[i] += (r[i] - rB[i]) * amt;
      g[i] += (g[i] - gB[i]) * amt;
      b[i] += (b[i] - bB[i]) * amt;
    }
  }

  const sat = 1 + P.saturation / 100;
  const vib = P.vibrance / 100;
  if (sat !== 1 || vib !== 0) {
    for (let i = 0; i < n; i++) {
      const l = lumOf(r[i], g[i], b[i]);
      const mx = Math.max(r[i], g[i], b[i]);
      const mn = Math.min(r[i], g[i], b[i]);
      const satN = mx - mn <= 0.001 ? 0 : (mx - mn) / 255;
      const boost = sat + vib * (1 - satN);
      r[i] = l + (r[i] - l) * boost;
      g[i] = l + (g[i] - l) * boost;
      b[i] = l + (b[i] - l) * boost;
    }
  }

  if (P.vignette !== 0) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const maxR = Math.hypot(cx, cy) || 1;
    const f = P.vignette / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const rn = Math.hypot(x - cx, y - cy) / maxR;
        const mul = 1 - f * rn * rn;
        const i = y * w + x;
        r[i] *= mul;
        g[i] *= mul;
        b[i] *= mul;
      }
    }
  }

  if (P.grain > 0) {
    const amt = P.grain / 100;
    for (let i = 0; i < n; i++) {
      const l = lumOf(r[i], g[i], b[i]) / 255;
      const s = (Math.random() * 2 - 1) * amt * (4 + 22 * l);
      r[i] += s;
      g[i] += s;
      b[i] += s * 0.7;
    }
  }

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    data[o] = clamp(r[i], 0, 255);
    data[o + 1] = clamp(g[i], 0, 255);
    data[o + 2] = clamp(b[i], 0, 255);
  }
}

export async function cameraRawFilter(canvas: any): Promise<boolean> {
  const res = await showOptions({
    title: "Camera Raw Filter",
    fields: [
      {
        key: "preset",
        label: "Preset",
        type: "select",
        value: "Auto",
        options: ["Auto", "Portrait", "Landscape", "Vivid"].map((o) => ({ value: o, label: o })),
      },
      { key: "exposure", label: "Exposure", type: "slider", value: 0, min: -4, max: 4, step: 0.1, suffix: " ev" },
      { key: "contrast", label: "Contrast", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "highlights", label: "Highlights", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "shadows", label: "Shadows", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "whites", label: "Whites", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "blacks", label: "Blacks", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "clarity", label: "Clarity", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "vibrance", label: "Vibrance", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "saturation", label: "Saturation", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "temperature", label: "Temperature", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "tint", label: "Tint", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "vignette", label: "Vignette", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "grain", label: "Grain", type: "slider", value: 0, min: 0, max: 100, suffix: "" },
    ],
  });
  if (!res) return false;
  const P: RawParams = {
    preset: String(res.preset ?? "Auto"),
    exposure: Number(res.exposure ?? 0),
    contrast: Number(res.contrast ?? 0),
    highlights: Number(res.highlights ?? 0),
    shadows: Number(res.shadows ?? 0),
    whites: Number(res.whites ?? 0),
    blacks: Number(res.blacks ?? 0),
    clarity: Number(res.clarity ?? 0),
    vibrance: Number(res.vibrance ?? 0),
    saturation: Number(res.saturation ?? 0),
    temperature: Number(res.temperature ?? 0),
    tint: Number(res.tint ?? 0),
    vignette: Number(res.vignette ?? 0),
    grain: Number(res.grain ?? 0),
  };
  const preset = PRESETS[P.preset];
  if (preset && preset !== "auto") {
    for (const [k, v] of Object.entries(preset)) {
      (P as any)[k] += v;
    }
  }
  return applyPixelsToActiveLayer(canvas, (data, w, h) => applyRaw(data, w, h, P));
}
