import { useDocStore } from "@/store/documentStore";
import { useLayerStore } from "@/store/layerStore";
import {
  applyPixelsToActiveLayer,
  blendPixel,
  canvasNow,
  compositeCanvas,
  flattenToLayer,
  hexToRgb01,
  notifyNoLayer,
  pushHistory,
  readActivePixels,
} from "@/engine/pixelOps";
import { applyCurves, applyHueSat, applyLevels } from "@/engine/adjustmentEngine";
import { cmykToRgb, labToSrgb, rgbToCmyk, srgbToLab } from "@/engine/colorEngine";
import { syncCanvasSizeStore } from "@/engine/canvasSizeEngine";

function clamp(v: number, lo = 0, hi = 255) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export type ImageMode = "rgb" | "grayscale" | "cmyk" | "lab" | "indexed";

const MODE_KEY = "kaypaint:imageMode";
const VALID_MODES: ImageMode[] = ["rgb", "grayscale", "cmyk", "lab", "indexed"];

const modeListeners = new Set<() => void>();

export function getImageMode(): ImageMode {
  if (typeof window === "undefined") return "rgb";
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m && (VALID_MODES as string[]).includes(m)) return m as ImageMode;
  } catch {
    /* ignore */
  }
  return "rgb";
}

export function setImageMode(mode: ImageMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  modeListeners.forEach((fn) => fn());
}

export function onImageModeChange(fn: () => void) {
  modeListeners.add(fn);
  return () => {
    modeListeners.delete(fn);
  };
}

async function applyCompositePixels(
  fn: (data: Uint8ClampedArray, width: number, height: number) => void
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const g = composite.getContext("2d");
  if (!g) return false;
  const img = g.getImageData(0, 0, composite.width, composite.height);
  fn(img.data, composite.width, composite.height);
  g.putImageData(img, 0, 0);
  const done = await flattenToLayer(canvas, composite, "Background");
  syncCanvasSizeStore(canvas);
  return done;
}

function grayscalePixels(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = l;
    data[i + 1] = l;
    data[i + 2] = l;
  }
}

function cmykRoundTrip(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = clamp01(data[i] / 255);
    const g = clamp01(data[i + 1] / 255);
    const b = clamp01(data[i + 2] / 255);
    const cmyk = rgbToCmyk(r, g, b);
    const back = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    data[i] = Math.round(clamp01(back.r) * 255);
    data[i + 1] = Math.round(clamp01(back.g) * 255);
    data[i + 2] = Math.round(clamp01(back.b) * 255);
  }
}

function labRoundTrip(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const lab = srgbToLab(
      clamp01(data[i] / 255),
      clamp01(data[i + 1] / 255),
      clamp01(data[i + 2] / 255)
    );
    const out = labToSrgb(lab.L, lab.a, lab.b);
    data[i] = Math.round(out[0] * 255);
    data[i + 1] = Math.round(out[1] * 255);
    data[i + 2] = Math.round(out[2] * 255);
  }
}

function posterizePixels(data: Uint8ClampedArray, levels: number) {
  const n = Math.max(2, Math.min(255, Math.round(levels)));
  const step = 255 / (n - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(Math.round(data[i] / step) * step);
    data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
    data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
  }
}

export function convertToGrayscale() {
  return applyCompositePixels(grayscalePixels);
}

export function convertToCmyk() {
  return applyCompositePixels(cmykRoundTrip);
}

export function convertToLab() {
  return applyCompositePixels(labRoundTrip);
}

export function convertToIndexedColor(numColors: number) {
  return applyCompositePixels((data) => posterizePixels(data, numColors));
}

export async function runAdjustment(
  fn: (data: Uint8ClampedArray, width: number, height: number) => void
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  return applyPixelsToActiveLayer(canvas, fn);
}

export function adjLevels(black: number, gamma: number, white: number) {
  return (data: Uint8ClampedArray) => applyLevels(data, black, gamma, white);
}

const CURVE_PRESETS: Record<string, { x: number; y: number }[]> = {
  linear: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  sCurve: [
    { x: 0, y: 0 },
    { x: 96, y: 88 },
    { x: 160, y: 176 },
    { x: 255, y: 255 },
  ],
  negative: [
    { x: 0, y: 255 },
    { x: 255, y: 0 },
  ],
};

export function buildCurvePoints(presetId: string, adjust: number) {
  const base = CURVE_PRESETS[presetId] ?? CURVE_PRESETS.linear;
  const a = clamp(adjust, -100, 100) / 100;
  return base.map((p) => ({
    x: p.x,
    y: Math.round(clamp(p.y + a * 128 * Math.sin((Math.PI * p.x) / 255))),
  }));
}

export function adjCurves(presetId: string, adjust: number) {
  return (data: Uint8ClampedArray) => applyCurves(data, buildCurvePoints(presetId, adjust));
}

export function adjHueSat(hue: number, saturation: number, lightness: number) {
  return (data: Uint8ClampedArray) => applyHueSat(data, hue, saturation, lightness);
}

export function adjColorBalance(
  rCyan: number,
  gMagenta: number,
  bYellow: number,
  preserveLuminosity: boolean
) {
  const sr = (clamp(rCyan, -100, 100) / 100) * 127.5;
  const sg = (clamp(gMagenta, -100, 100) / 100) * 127.5;
  const sb = (clamp(bYellow, -100, 100) / 100) * 127.5;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const nr = clamp(r + sr);
      const ng = clamp(g + sg);
      const nb = clamp(b + sb);
      if (preserveLuminosity) {
        const nl = 0.299 * nr + 0.587 * ng + 0.114 * nb;
        if (nl > 0.5 && nl !== lum) {
          const f = lum / nl;
          data[i] = clamp(nr * f);
          data[i + 1] = clamp(ng * f);
          data[i + 2] = clamp(nb * f);
          continue;
        }
      }
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  };
}

export function adjBrightnessContrast(brightness: number, contrast: number) {
  const add = (clamp(brightness, -100, 100) / 100) * 255;
  const c = clamp(contrast, -100, 100);
  const factor = c === 0 ? 1 : (259 * (c + 255)) / (255 * (259 - c));
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = clamp(data[i] + add);
      const g = clamp(data[i + 1] + add);
      const b = clamp(data[i + 2] + add);
      data[i] = clamp(factor * (r - 128) + 128);
      data[i + 1] = clamp(factor * (g - 128) + 128);
      data[i + 2] = clamp(factor * (b - 128) + 128);
    }
  };
}

export function adjExposure(exposure: number) {
  const f = Math.pow(2, clamp(exposure, -4, 4));
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(data[i] * f);
      data[i + 1] = clamp(data[i + 1] * f);
      data[i + 2] = clamp(data[i + 2] * f);
    }
  };
}

function rgbToHsv01(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const mx = Math.max(rr, gg, bb);
  const mn = Math.min(rr, gg, bb);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (mx === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  const s = mx === 0 ? 0 : d / mx;
  return { h, s, v: mx };
}

function hsv01ToRgb(h: number, s: number, v: number) {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = v;
  let g = p;
  let b = p;
  if (i === 0) {
    r = v;
    g = t;
    b = p;
  } else if (i === 1) {
    r = q;
    g = v;
    b = p;
  } else if (i === 2) {
    r = p;
    g = v;
    b = t;
  } else if (i === 3) {
    r = p;
    g = q;
    b = v;
  } else if (i === 4) {
    r = t;
    g = p;
    b = v;
  } else {
    r = v;
    g = p;
    b = q;
  }
  return [
    Math.round(clamp01(r) * 255),
    Math.round(clamp01(g) * 255),
    Math.round(clamp01(b) * 255),
  ];
}

export function adjVibrance(vibrance: number, saturation: number) {
  const vib = clamp(vibrance, -100, 100) / 100;
  const sat = 1 + clamp(saturation, -100, 100) / 100;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const { h, s, v } = rgbToHsv01(r, g, b);
      let ns = vib > 0 ? s + (1 - s) * vib * 0.9 : s * (1 + vib * 0.9);
      ns = clamp01(ns) * sat;
      const out = hsv01ToRgb(h, clamp01(ns), v);
      data[i] = out[0];
      data[i + 1] = out[1];
      data[i + 2] = out[2];
    }
  };
}

export function adjBlackAndWhite(
  reds: number,
  yellows: number,
  greens: number,
  cyans: number,
  blues: number,
  magentas: number
) {
  const wr = reds + yellows * 0.5 + magentas * 0.5;
  const wg = greens + yellows * 0.5 + cyans * 0.5;
  const wb = blues + cyans * 0.5 + magentas * 0.5;
  const total = wr + wg + wb;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l =
        total > 0 ? (r * wr + g * wg + b * wb) / total : 0.299 * r + 0.587 * g + 0.114 * b;
      const v = Math.round(clamp(l));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  };
}

export function adjPhotoFilter(hex: string, density: number) {
  const [cr, cg, cb] = hexToRgb01(hex);
  const d = clamp(density, 0, 100) / 100;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clamp(Math.round(gray + (cr * 255 - gray) * d));
      data[i + 1] = clamp(Math.round(gray + (cg * 255 - gray) * d));
      data[i + 2] = clamp(Math.round(gray + (cb * 255 - gray) * d));
    }
  };
}

export type MixChannel = "r" | "g" | "b";

export function adjChannelMixer(channel: MixChannel, red: number, green: number, blue: number) {
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const out = clamp(Math.round((data[i] * red + data[i + 1] * green + data[i + 2] * blue) / 100));
      if (channel === "r") data[i] = out;
      else if (channel === "g") data[i + 1] = out;
      else data[i + 2] = out;
    }
  };
}

export const COLOR_LOOKUP_PRESETS = [
  "none",
  "nightFromDay",
  "tealOrange",
  "warm",
  "cool",
  "mono",
] as const;

const COLOR_LOOKUP: Record<string, number[][]> = {
  none: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  nightFromDay: [
    [0.2, 0.25, 0.55],
    [0.05, 0.35, 0.3],
    [0.05, 0.1, 0.42],
  ],
  tealOrange: [
    [1.02, 0.35, 0],
    [0, 1, 0.1],
    [0.25, 0.45, 1.05],
  ],
  warm: [
    [1.12, 0.06, 0],
    [0, 1.02, 0],
    [0, 0.04, 0.86],
  ],
  cool: [
    [0.82, 0, 0.05],
    [0, 0.98, 0.05],
    [0.08, 0.06, 1.12],
  ],
  mono: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

export function adjColorLookup(preset: string) {
  const m = COLOR_LOOKUP[preset] ?? COLOR_LOOKUP.none;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      data[i] = clamp(Math.round(r * m[0][0] + g * m[0][1] + b * m[0][2]));
      data[i + 1] = clamp(Math.round(r * m[1][0] + g * m[1][1] + b * m[1][2]));
      data[i + 2] = clamp(Math.round(r * m[2][0] + g * m[2][1] + b * m[2][2]));
    }
  };
}

export function adjInvert() {
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  };
}

export function adjPosterize(levels: number) {
  return (data: Uint8ClampedArray) => posterizePixels(data, levels);
}

export function adjThreshold(level: number) {
  const t = clamp(Math.round(level), 1, 255);
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const v = l >= t ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  };
}

export function adjGradientMap(darkHex: string, lightHex: string, smoothness: number) {
  const [dr, dg, db] = hexToRgb01(darkHex);
  const [lr, lg, lb] = hexToRgb01(lightHex);
  const e = 1 / (1 + clamp(smoothness, 0, 100) / 25);
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const t = Math.pow(clamp01(lum), e);
      data[i] = Math.round((dr + (lr - dr) * t) * 255);
      data[i + 1] = Math.round((dg + (lg - dg) * t) * 255);
      data[i + 2] = Math.round((db + (lb - db) * t) * 255);
    }
  };
}

export type SelectiveTarget =
  | "reds"
  | "yellows"
  | "greens"
  | "cyans"
  | "blues"
  | "magentas"
  | "whites"
  | "neutrals"
  | "blacks";

const SEL_WEIGHTS: Record<SelectiveTarget, [number, number, number]> = {
  reds: [1, 0.2, 0.2],
  yellows: [0.8, 0.8, 0.2],
  greens: [0.2, 1, 0.2],
  cyans: [0.2, 0.8, 0.8],
  blues: [0.2, 0.2, 1],
  magentas: [0.8, 0.2, 0.8],
  whites: [1, 1, 1],
  neutrals: [0.55, 0.55, 0.55],
  blacks: [1, 1, 1],
};

function matchesTarget(target: SelectiveTarget, r: number, g: number, b: number) {
  switch (target) {
    case "reds":
      return r >= 128 && r >= g && r >= b;
    case "yellows":
      return r >= 128 && g >= 128 && r >= b && g >= b;
    case "greens":
      return g >= 128 && g >= r && g >= b;
    case "cyans":
      return g >= 128 && b >= 128 && r < g && r < b;
    case "blues":
      return b >= 128 && b >= r && b >= g;
    case "magentas":
      return r >= 128 && b >= 128 && g < r && g < b;
    case "whites":
      return r > 200 && g > 200 && b > 200;
    case "blacks":
      return r < 56 && g < 56 && b < 56;
    case "neutrals":
    default: {
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      return mn >= 56 && mx <= 200 && mx - mn <= 40;
    }
  }
}

export function adjSelectiveColor(
  target: SelectiveTarget,
  cyan: number,
  magenta: number,
  yellow: number,
  black: number
) {
  const [wr, wg, wb] = SEL_WEIGHTS[target];
  const cr = (clamp(cyan, -100, 100) / 100) * 255;
  const mg = (clamp(magenta, -100, 100) / 100) * 255;
  const ye = (clamp(yellow, -100, 100) / 100) * 255;
  const kf = 1 - (clamp(black, 0, 100) / 100) * 0.6;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!matchesTarget(target, r, g, b)) continue;
      data[i] = clamp(clamp(r - cr * wr) * kf);
      data[i + 1] = clamp(clamp(g - mg * wg) * kf);
      data[i + 2] = clamp(clamp(b - ye * wb) * kf);
    }
  };
}

export function adjShadowsHighlights(shadows: number, highlights: number) {
  const s = clamp(shadows, 0, 100) / 100;
  const h = clamp(highlights, 0, 100) / 100;
  return (data: Uint8ClampedArray) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let lift = 0;
      if (lum < 128) lift = s * (1 - lum / 128) * 90;
      else lift = -h * ((lum - 128) / 128) * 90;
      data[i] = clamp(r + lift);
      data[i + 1] = clamp(g + lift);
      data[i + 2] = clamp(b + lift);
    }
  };
}

function channelMinMax(data: Uint8ClampedArray, offset: number, pct: number) {
  const hist = new Uint32Array(256);
  for (let i = offset; i < data.length; i += 4) hist[data[i]]++;
  let total = 0;
  for (const c of hist) total += c;
  const cut = total * pct;
  let acc = 0;
  let lo = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= cut) {
      lo = v;
      break;
    }
  }
  acc = 0;
  let hi = 255;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= cut) {
      hi = v;
      break;
    }
  }
  return lo < hi ? [lo, hi] : [0, 255];
}

function makeStretchLut(lo: number, hi: number) {
  const lut = new Uint8Array(256);
  const span = Math.max(1, hi - lo);
  for (let v = 0; v < 256; v++) {
    lut[v] = clamp(Math.round(((v - lo) / span) * 255));
  }
  return lut;
}

function channelAverage(data: Uint8ClampedArray, offset: number) {
  let sum = 0;
  let n = 0;
  for (let i = offset; i < data.length; i += 4) {
    sum += data[i];
    n++;
  }
  return n > 0 ? sum / n : 128;
}

export function adjAutoTone() {
  return (data: Uint8ClampedArray) => {
    const pct = 0.01;
    const [rl, rh] = channelMinMax(data, 0, pct);
    const [gl, gh] = channelMinMax(data, 1, pct);
    const [bl, bh] = channelMinMax(data, 2, pct);
    const lr = makeStretchLut(rl, rh);
    const lg = makeStretchLut(gl, gh);
    const lb = makeStretchLut(bl, bh);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lr[data[i]];
      data[i + 1] = lg[data[i + 1]];
      data[i + 2] = lb[data[i + 2]];
    }
  };
}

export function adjAutoContrast() {
  return (data: Uint8ClampedArray) => {
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
    }
    let total = 0;
    for (const c of hist) total += c;
    const cut = total * 0.01;
    let acc = 0;
    let lo = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= cut) {
        lo = v;
        break;
      }
    }
    acc = 0;
    let hi = 255;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= cut) {
        hi = v;
        break;
      }
    }
    const lut = lo < hi ? makeStretchLut(lo, hi) : null;
    if (!lut) return;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  };
}

export function adjAutoColor() {
  return (data: Uint8ClampedArray) => {
    const pct = 0.01;
    const [rl, rh] = channelMinMax(data, 0, pct);
    const [gl, gh] = channelMinMax(data, 1, pct);
    const [bl, bh] = channelMinMax(data, 2, pct);
    const lr = makeStretchLut(rl, rh);
    const lg = makeStretchLut(gl, gh);
    const lb = makeStretchLut(bl, bh);
    const ar = channelAverage(data, 0);
    const ag = channelAverage(data, 1);
    const ab = channelAverage(data, 2);
    const dr = (128 - ar) * 0.5;
    const dg = (128 - ag) * 0.5;
    const db = (128 - ab) * 0.5;
    for (let i = 0; i < data.length; i += 4) {
      const r = clamp(lr[data[i]] + dr);
      const g = clamp(lg[data[i + 1]] + dg);
      const b = clamp(lb[data[i + 2]] + db);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clamp(gray + (r - gray) * 1.08);
      data[i + 1] = clamp(gray + (g - gray) * 1.08);
      data[i + 2] = clamp(gray + (b - gray) * 1.08);
    }
  };
}

export async function rotateDocument(angleDeg: number): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const nw = Math.max(1, Math.round(composite.width * cos + composite.height * sin));
  const nh = Math.max(1, Math.round(composite.width * sin + composite.height * cos));
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const g = out.getContext("2d");
  if (!g) return false;
  g.translate(nw / 2, nh / 2);
  g.rotate(rad);
  g.drawImage(composite, -composite.width / 2, -composite.height / 2);
  canvas.setDimensions({ width: nw, height: nh });
  const done = await flattenToLayer(canvas, out, "Background");
  syncCanvasSizeStore(canvas);
  return done;
}

export async function flipDocument(horizontal: boolean): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const out = document.createElement("canvas");
  out.width = composite.width;
  out.height = composite.height;
  const g = out.getContext("2d");
  if (!g) return false;
  g.translate(horizontal ? composite.width : 0, horizontal ? 0 : composite.height);
  g.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  g.drawImage(composite, 0, 0);
  return flattenToLayer(canvas, out, "Background");
}

export async function cropDocument(
  left: number,
  top: number,
  width: number,
  height: number
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const l = clamp(Math.round(left), 0, composite.width - 1);
  const t = clamp(Math.round(top), 0, composite.height - 1);
  const w = Math.max(1, Math.min(Math.round(width), composite.width - l));
  const h = Math.max(1, Math.min(Math.round(height), composite.height - t));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d");
  if (!g) return false;
  g.drawImage(composite, -l, -t);
  canvas.setDimensions({ width: w, height: h });
  const done = await flattenToLayer(canvas, out, "Background");
  syncCanvasSizeStore(canvas);
  return done;
}

export type TrimMode = "transparent" | "topleft" | "bottomright";

export async function trimDocument(mode: TrimMode): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const g = composite.getContext("2d");
  if (!g) return false;
  const img = g.getImageData(0, 0, composite.width, composite.height);
  const w = composite.width;
  const h = composite.height;
  const d = img.data;
  let ref: [number, number, number] = [0, 0, 0];
  if (mode === "topleft") {
    ref = [d[0], d[1], d[2]];
  } else if (mode === "bottomright") {
    const o = ((h - 1) * w + (w - 1)) * 4;
    ref = [d[o], d[o + 1], d[o + 2]];
  }
  const matches = (o: number) => {
    if (mode === "transparent") return d[o + 3] === 0;
    return d[o] === ref[0] && d[o + 1] === ref[1] && d[o + 2] === ref[2];
  };
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (matches(o)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return false;
  return cropDocument(minX, minY, maxX - minX + 1, maxY - minY + 1);
}

export async function revealAll(): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  let maxX = canvas.width;
  let maxY = canvas.height;
  for (const obj of canvas.getObjects()) {
    if (obj.type === "SAdjustment") continue;
    const r = obj.getBoundingRect();
    maxX = Math.max(maxX, Math.ceil(r.left + r.width));
    maxY = Math.max(maxY, Math.ceil(r.top + r.height));
  }
  if (maxX <= canvas.width && maxY <= canvas.height) return false;
  canvas.setDimensions({ width: Math.max(1, maxX), height: Math.max(1, maxY) });
  canvas.discardActiveObject();
  syncCanvasSizeStore(canvas);
  canvas.requestRenderAll();
  pushHistory();
  return true;
}

export function duplicateDocument(name?: string): boolean {
  const canvas = canvasNow();
  if (!canvas) return false;
  const docStore = useDocStore.getState();
  let data: string | null = null;
  let groups: string | null = null;
  try {
    data = JSON.stringify(canvas.toJSON());
    groups = JSON.stringify(useLayerStore.getState().groups);
  } catch {
    data = null;
  }
  docStore.createDoc();
  const activeId = useDocStore.getState().activeDocId;
  if (name && name.trim()) docStore.renameDoc(activeId, name.trim());
  if (data) docStore.updateDocData(activeId, data, groups);
  return true;
}

export interface ApplyImageOptions {
  source: "merged" | "active";
  blendMode: string;
  opacity: number;
  invert: boolean;
}

export async function applyImage(opts: ApplyImageOptions): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const read = readActivePixels(canvas);
  if (!read) {
    notifyNoLayer();
    return false;
  }
  let sourceEl: HTMLCanvasElement | null = null;
  if (opts.source === "merged") {
    sourceEl = await compositeCanvas(canvas);
  } else {
    const c = document.createElement("canvas");
    c.width = read.width;
    c.height = read.height;
    const cg = c.getContext("2d");
    if (!cg) return false;
    const imgData = cg.createImageData(read.width, read.height);
    imgData.data.set(read.data);
    cg.putImageData(imgData, 0, 0);
    sourceEl = c;
  }
  if (!sourceEl) return false;
  const src = document.createElement("canvas");
  src.width = read.width;
  src.height = read.height;
  const sg = src.getContext("2d");
  if (!sg) return false;
  sg.drawImage(sourceEl, 0, 0, read.width, read.height);
  const srcData = sg.getImageData(0, 0, read.width, read.height).data;
  const op = clamp(opts.opacity, 0, 100) / 100;
  const mode = opts.blendMode || "normal";
  const invert = opts.invert;
  return applyPixelsToActiveLayer(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      let br = srcData[i];
      let bg = srcData[i + 1];
      let bb = srcData[i + 2];
      const ba = srcData[i + 3];
      if (invert) {
        br = 255 - br;
        bg = 255 - bg;
        bb = 255 - bb;
      }
      const out = blendPixel(
        [data[i], data[i + 1], data[i + 2], data[i + 3]],
        [br, bg, bb, ba],
        mode,
        op
      );
      data[i] = out[0];
      data[i + 1] = out[1];
      data[i + 2] = out[2];
      data[i + 3] = out[3];
    }
  });
}