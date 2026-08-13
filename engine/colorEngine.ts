import Color from "colorjs.io";

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** Parse a CSS hex string (#rgb, #rrggbb, #rrggbbaa) into [r,g,b] in [0,1]. */
export function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  } else if (h.length === 8 || h.length === 4) {
    h = h.slice(0, 6);
  }
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ];
}

/**
 * Convert straight sRGB [0,1] RGB to a pragmatic CMYK separation
 * (standard subtractive model). Returns C,M,Y,K in [0,1].
 */
export function rgbToCmyk(r: number, g: number, b: number) {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return { c: clamp(c), m: clamp(m), y: clamp(y), k: clamp(k) };
}

/** Convert CMYK [0,1] back to an sRGB preview (what the print would look like on screen). */
export function cmykToRgb(c: number, m: number, y: number, k: number) {
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  return { r, g, b };
}

export type RenderingIntent = "relative" | "perceptual" | "saturation";

export interface CmykPreviewOptions {
  /** How aggressively out-of-gamut colors are mapped back into gamut. */
  renderingIntent?: RenderingIntent;
  /** Tint the preview toward a paper white and cap black generation. */
  simulatePaperBlack?: boolean;
  /** If true, return a gamut-overlay mask (magenta tint on out-of-gamut pixels). */
  gamutOverlay?: boolean;
  /** Working RGB space the canvas is interpreted as (default sRGB). */
  workingSpace?: WorkingSpace;
}

export interface CmykResult {
  cmykPreview: string;
  plates: Record<"c" | "m" | "y" | "k", string>;
  gamutOverlay?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Soft-proof a raster image to CMYK under the chosen rendering intent.
 * - relative: plain clip to [0,1] after round-trip (colorimetric).
 * - perceptual: scale out-of-gamut excursion down to the gamut boundary.
 * - saturation: preserve chroma by clamping the most-saturated driver channel.
 */
export async function buildCmykPreview(
  dataURL: string,
  options: CmykPreviewOptions = {}
): Promise<CmykResult> {
  const {
    renderingIntent = "relative",
    simulatePaperBlack = false,
    gamutOverlay = false,
    workingSpace = "srgb",
  } = options;
  const img = await loadImage(dataURL);
  const w = img.width;
  const h = img.height;

  const preview = document.createElement("canvas");
  preview.width = w;
  preview.height = h;
  const pg = preview.getContext("2d")!;
  preview.width = w;
  preview.height = h;

  const plates: Record<"c" | "m" | "y" | "k", HTMLCanvasElement> = {
    c: document.createElement("canvas"),
    m: document.createElement("canvas"),
    y: document.createElement("canvas"),
    k: document.createElement("canvas"),
  };
  for (const key of ["c", "m", "y", "k"] as const) {
    plates[key].width = w;
    plates[key].height = h;
    plates[key].getContext("2d")!.fillStyle = "#000";
    plates[key].getContext("2d")!.fillRect(0, 0, w, h);
  }

  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sg = scratch.getContext("2d")!;
  sg.drawImage(img, 0, 0);
  const src = sg.getImageData(0, 0, w, h);
  const previewData = pg.createImageData(w, h);
  const cImg = plates.c.getContext("2d")!;
  const mImg = plates.m.getContext("2d")!;
  const yImg = plates.y.getContext("2d")!;
  const kImg = plates.k.getContext("2d")!;
  const cData = cImg.getImageData(0, 0, w, h);
  const mData = mImg.getImageData(0, 0, w, h);
  const yData = yImg.getImageData(0, 0, w, h);
  const kData = kImg.getImageData(0, 0, w, h);
  const maskData: Uint8ClampedArray | null = gamutOverlay
    ? new Uint8ClampedArray(w * h * 4)
    : null;

  const srcPx = src.data;
  const prPx = previewData.data;
  const cPx = cData.data;
  const mPx = mData.data;
  const yPx = yData.data;
  const kPx = kData.data;

  const paperWhite = simulatePaperBlack ? 0.97 : 1;
  const maxBlack = simulatePaperBlack ? 0.8 : 1;

  for (let i = 0; i < srcPx.length; i += 4) {
    const r = srcPx[i] / 255;
    const g = srcPx[i + 1] / 255;
    const b = srcPx[i + 2] / 255;

    let cmyk = rgbToCmyk(clamp(r), clamp(g), clamp(b));
    let rb = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);

    let outOfGamut = false;
    const dr = rb.r - r;
    const dg = rb.g - g;
    const db = rb.b - b;
    const excursion = Math.max(dr, dg, db, 0);

    if (excursion > 0) {
      outOfGamut = true;
      if (renderingIntent === "perceptual") {
        // Real perceptual gamut mapping (colorjs.io): reduce an out-of-gamut
        // color's chroma along the Lab/OKLab hue until it fits sRGB, keeping
        // lightness. Re-derive the CMYK separation from the mapped color.
        const [mr, mg, mb] = gamutMapRgb(r, g, b);
        rb = { r: mr, g: mg, b: mb };
        cmyk = rgbToCmyk(mr, mg, mb);
      } else if (renderingIntent === "saturation") {
        // Preserve chroma: drop the least-driven of C/M/Y toward K.
        const minInk = Math.min(cmyk.c, cmyk.m, cmyk.y);
        cmyk.c = clamp(cmyk.c - minInk);
        cmyk.m = clamp(cmyk.m - minInk);
        cmyk.y = clamp(cmyk.y - minInk);
        cmyk.k = clamp(cmyk.k + minInk * (1 - cmyk.k));
        rb = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
      } else {
        // relative colorimetric: clip.
        rb = { r: clamp(rb.r), g: clamp(rb.g), b: clamp(rb.b) };
      }
    }

    const rOut = clamp(rb.r * paperWhite);
    const gOut = clamp(rb.g * paperWhite);
    const bOut = clamp(rb.b * paperWhite);

    const mapped = workingSpaceToRgb(rOut, gOut, bOut, workingSpace);

    prPx[i] = Math.round(mapped[0] * 255);
    prPx[i + 1] = Math.round(mapped[1] * 255);
    prPx[i + 2] = Math.round(mapped[2] * 255);
    prPx[i + 3] = srcPx[i + 3];

    cPx[i] = Math.round(cmyk.c * 255);
    cPx[i + 1] = cPx[i];
    cPx[i + 2] = cPx[i];
    cPx[i + 3] = 255;
    mPx[i + 1] = Math.round(cmyk.m * 255);
    mPx[i] = mPx[i + 1];
    mPx[i + 2] = mPx[i + 1];
    mPx[i + 3] = 255;
    yPx[i + 2] = Math.round(cmyk.y * 255);
    yPx[i] = yPx[i + 2];
    yPx[i + 1] = yPx[i + 2];
    yPx[i + 3] = 255;
    kPx[i] = Math.round((cmyk.k * maxBlack) * 255);
    kPx[i + 1] = kPx[i];
    kPx[i + 2] = kPx[i];
    kPx[i + 3] = 255;

    if (maskData) {
      const m = i;
      if (outOfGamut) {
        maskData[m] = 191; // magenta
        maskData[m + 1] = 63;
        maskData[m + 2] = 127;
        maskData[m + 3] = 110; // ~43% opacity
      } else {
        maskData[m + 3] = 0;
      }
    }
  }

  pg.putImageData(previewData, 0, 0);
  cImg.putImageData(cData, 0, 0);
  mImg.putImageData(mData, 0, 0);
  yImg.putImageData(yData, 0, 0);
  kImg.putImageData(kData, 0, 0);

  const result: CmykResult = {
    cmykPreview: preview.toDataURL("image/png"),
    plates: {
      c: plates.c.toDataURL("image/png"),
      m: plates.m.toDataURL("image/png"),
      y: plates.y.toDataURL("image/png"),
      k: plates.k.toDataURL("image/png"),
    },
  };
  if (gamutOverlay && maskData) {
    const overlay = document.createElement("canvas");
    overlay.width = w;
    overlay.height = h;
    const og = overlay.getContext("2d")!;
    const maskImg = og.createImageData(w, h);
    maskImg.data.set(maskData);
    og.putImageData(maskImg, 0, 0);
    result.gamutOverlay = overlay.toDataURL("image/png");
  }
  return result;
}

/**
 * True if an sRGB color cannot be represented in a CMYK separation (i.e. it
 * would shift when printed). Uses the CMYK round-trip distance, matching the
 * document's CMYK proof.
 */
export function isOutOfGamut(r: number, g: number, b: number) {
  const cmyk = rgbToCmyk(clamp(r), clamp(g), clamp(b));
  const back = cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
  const delta =
    Math.abs(back.r - clamp(r)) +
    Math.abs(back.g - clamp(g)) +
    Math.abs(back.b - clamp(b));
  return delta > 0.06;
}

/** Working RGB spaces Photoshop-style color settings can target. */
export type WorkingSpace = "srgb" | "p3" | "adobergb" | "prophoto";

const WS_MAP: Record<WorkingSpace, string> = {
  srgb: "srgb",
  p3: "p3",
  adobergb: "a98rgb",
  prophoto: "prophoto",
};

function toColorSpaceId(space: WorkingSpace) {
  return WS_MAP[space];
}

/**
 * Convert an sRGB [0,1] color into the chosen working RGB space.
 * Returns [r,g,b] in that space's [0,1] range (may clip for out-of-gamut input).
 */
export function toWorkingSpace(
  r: number,
  g: number,
  b: number,
  space: WorkingSpace = "srgb"
): [number, number, number] {
  if (space === "srgb") return [clamp(r), clamp(g), clamp(b)];
  try {
    const c = new Color("srgb", [clamp(r), clamp(g), clamp(b)]).to(
      toColorSpaceId(space)
    );
    const vals = c.coords.map((v) => v ?? 0);
    return [vals[0], vals[1], vals[2]];
  } catch {
    return [clamp(r), clamp(g), clamp(b)];
  }
}

/** Back-convert a working-space color to displayable sRGB (perceptual). */
export function workingSpaceToRgb(
  r: number,
  g: number,
  b: number,
  space: WorkingSpace = "srgb"
): [number, number, number] {
  if (space === "srgb") return [clamp(r), clamp(g), clamp(b)];
  try {
    const c = new Color(toColorSpaceId(space), [
      clamp(r),
      clamp(g),
      clamp(b),
    ]).to("srgb");
    const vals = c.coords.map((v) => v ?? 0);
    return [vals[0], vals[1], vals[2]];
  } catch {
    return [clamp(r), clamp(g), clamp(b)];
  }
}

/**
 * Perceptually map an out-of-gamut sRGB color back into sRGB using
 * colorjs.io's gamut mapping (CSS algorithm).
 */
export function gamutMapRgb(r: number, g: number, b: number): [number, number, number] {
  try {
    const c = new Color("srgb", [clamp(r), clamp(g), clamp(b)]).toGamut("srgb");
    const vals = c.coords.map((v) => v ?? 0);
    return [vals[0], vals[1], vals[2]];
  } catch {
    return [clamp(r), clamp(g), clamp(b)];
  }
}

export function srgbToLab(r: number, g: number, b: number) {
  const lin = (c: number) =>
    c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);
  const X = 0.4124 * rl + 0.3576 * gl + 0.1805 * bl;
  const Y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  const Z = 0.0193 * rl + 0.1192 * gl + 0.9505 * bl;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y / 1);
  const fz = f(Z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToSrgb(L: number, a: number, b: number) {
  const finv = (t: number) => (t > 0.206893 ? t ** 3 : (t - 16 / 116) / 7.787);
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const X = 0.95047 * finv(fx);
  const Y = finv(fy);
  const Z = 1.08883 * finv(fz);
  const toGamma = (c: number) =>
    c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  const rl = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  const gl = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  const bl = X * 0.0557 + Y * -0.204 + Z * 1.057;
  return [
    Math.min(Math.max(toGamma(rl), 0), 1),
    Math.min(Math.max(toGamma(gl), 0), 1),
    Math.min(Math.max(toGamma(bl), 0), 1),
  ];
}
