import { showOptions } from "@/components/Menu/OptionDialog";
import { pickImages, fileToDataURL } from "@/engine/actionsEngine";
import { loadImageCanvas } from "@/engine/pixelOps";
import { installNewDocument } from "@/engine/photomerge";

const MAX_MERGE_DIM = 4500;

export interface HdrOptions {
  exposure: number;
  whitePoint: number;
}

/** Mean of log-luminance over a downsampled copy (exposure invariant proxy). */
export function meanLogLuminance(src: HTMLCanvasElement): number {
  const s = Math.min(1, Math.sqrt(400000 / Math.max(1, src.width * src.height)));
  const w = Math.max(8, Math.round(src.width * s));
  const h = Math.max(8, Math.round(src.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const L = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] + 1;
    sum += Math.log(L);
    n++;
  }
  return n ? sum / n : 0;
}

function scaledTo(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Smoothstep function peaking at mid luminance (0 at black/white, 1 at 0.5). */
function midLuminanceWeight(L: number): number {
  const t1 = L <= 0 ? 0 : L >= 0.5 ? 1 : L / 0.5;
  const t2 = L <= 0.5 ? 0 : L >= 1 ? 1 : (L - 0.5) / 0.5;
  const s1 = t1 * t1 * (3 - 2 * t1);
  const s2 = t2 * t2 * (3 - 2 * t2);
  return s1 * (1 - s2);
}

/**
 * Merge multiple exposures (already gain-normalized) into a single image by
 * luminance-weighted averaging: weights favor well-exposed, saturated pixels.
 */
export function mergeExposures(images: HTMLCanvasElement[], gains: number[]): HTMLCanvasElement {
  const W = images[0].width;
  const H = images[0].height;
  const sumR = new Float64Array(W * H);
  const sumG = new Float64Array(W * H);
  const sumB = new Float64Array(W * H);
  const sumW = new Float64Array(W * H);
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const tg = tmp.getContext("2d")!;
  for (let k = 0; k < images.length; k++) {
    tg.clearRect(0, 0, W, H);
    tg.drawImage(images[k], 0, 0, W, H);
    const px = tg.getImageData(0, 0, W, H).data;
    const gain = gains[k] ?? 1;
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const mx = Math.max(r, g, b) / 255;
      const mn = Math.min(r, g, b) / 255;
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      const w = Math.max(midLuminanceWeight(L) * (0.3 + 0.7 * sat), 0.02);
      sumW[p] += w;
      sumR[p] += r * gain * w;
      sumG[p] += g * gain * w;
      sumB[p] += b * gain * w;
    }
  }
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const og = out.getContext("2d")!;
  const img = og.createImageData(W, H);
  for (let p = 0; p < W * H; p++) {
    const w = sumW[p] || 1;
    img.data[p * 4] = sumR[p] / w;
    img.data[p * 4 + 1] = sumG[p] / w;
    img.data[p * 4 + 2] = sumB[p] / w;
    img.data[p * 4 + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Simple Reinhard-style tone reproduction applied to an ImageData in place. */
export function reinhardToneMap(data: Uint8ClampedArray, opts: HdrOptions): void {
  const white = Math.max(0.1, opts.whitePoint * opts.whitePoint);
  const ev = Math.pow(2, opts.exposure);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] * ev;
    const g = data[i + 1] * ev;
    const b = data[i + 2] * ev;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const mapped = (L * (1 + L / white)) / (1 + L);
    const s = L > 0.0001 ? mapped / L : 0;
    data[i] = clamp255(r * s);
    data[i + 1] = clamp255(g * s);
    data[i + 2] = clamp255(b * s);
    data[i + 3] = 255;
  }
}

/**
 * File > Automate > Merge to HDR Pro: pick 2+ exposures, estimate relative
 * exposure per image, merge with luminance weighting, tone map and install as
 * a new document.
 */
export async function hdrMergeDialog(): Promise<void> {
  const files = await pickImages(true);
  if (files.length < 2) {
    window.alert("Merge to HDR Pro requires at least 2 exposures selected in one batch.");
    return;
  }
  const images: HTMLCanvasElement[] = [];
  for (const f of files) {
    try {
      const url = await fileToDataURL(f);
      images.push(await loadImageCanvas(url));
    } catch {
      window.alert(`Could not load "${f.name}".`);
      return;
    }
  }
  const maxDim = Math.max(...images.map((c) => Math.max(c.width, c.height)));
  if (maxDim > MAX_MERGE_DIM) {
    const s = MAX_MERGE_DIM / maxDim;
    for (let i = 0; i < images.length; i++) {
      images[i] = scaledTo(images[i], images[i].width * s, images[i].height * s);
    }
  }
  const means = images.map(meanLogLuminance);
  const gains = means.map((m) => Math.exp(means[0] - m));
  const res = await showOptions({
    title: "Merge to HDR Pro",
    fields: [
      { key: "whitePoint", label: "White Point", type: "slider", min: 5, max: 200, value: 75, suffix: "%" },
      { key: "exposure", label: "Exposure", type: "number", min: -5, max: 5, step: 0.1, value: 0, suffix: " EV" },
    ],
  });
  const opts: HdrOptions = {
    whitePoint: Number(res?.whitePoint ?? 75) / 100,
    exposure: Number(res?.exposure ?? 0),
  };
  const merged = mergeExposures(images, gains);
  const g = merged.getContext("2d")!;
  const imgData = g.getImageData(0, 0, merged.width, merged.height);
  reinhardToneMap(imgData.data, opts);
  g.putImageData(imgData, 0, 0);
  installNewDocument(merged, "HDR Pro");
}