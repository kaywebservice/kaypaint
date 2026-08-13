/* eslint-disable @typescript-eslint/no-explicit-any */
import { downloadDataURL } from "@/utils/imageUtils";
import { bakeAdjustments, getAdjustments } from "@/engine/adjustmentEngine";
import { compositeCanvas } from "@/engine/pixelOps";
import { encodePng } from "@/engine/pngWriter";
import { sRgbProfile } from "@/engine/iccEngine";

export function exportPNG(canvas: any, filename = "kaypaint.png") {
  const adjustments = getAdjustments(canvas);
  if (adjustments.length) {
    bakeAdjustments(canvas).then((baked) => {
      if (baked) {
        downloadDataURL(baked.toDataURL("image/png"), filename);
      }
    });
    return;
  }
  const dataURL = canvas.toDataURL({
    format: "png",
    quality: 1,
    multiplier: 1,
  });
  downloadDataURL(dataURL, filename);
}

export async function exportPngWithIcc(
  canvas: any,
  filename = "kaypaint-color-managed.png"
) {
  const adjustments = getAdjustments(canvas);
  let src: HTMLCanvasElement | null = null;
  if (adjustments.length) {
    src = await bakeAdjustments(canvas);
  }
  if (!src) src = await compositeCanvas(canvas);
  if (!src) return;
  const w = src.width;
  const h = src.height;
  const g = src.getContext("2d");
  if (!g) return;
  const img = g.getImageData(0, 0, w, h);
  const bytes = encodePng(w, h, img.data, { icc: sRgbProfile() });
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportJPEG(canvas: any, filename = "kaypaint.jpg") {
  const adjustments = getAdjustments(canvas);
  if (adjustments.length) {
    bakeAdjustments(canvas).then((baked) => {
      if (baked) {
        downloadDataURL(baked.toDataURL("image/jpeg", 0.92), filename);
      }
    });
    return;
  }
  const dataURL = canvas.toDataURL({
    format: "jpeg",
    quality: 0.92,
    multiplier: 1,
  });
  downloadDataURL(dataURL, filename);
}

export function exportJSON(canvas: any, filename = "kaypaint.json") {
  const data = JSON.stringify(canvas.toJSON(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportSVG(canvas: any, filename = "kaypaint.svg") {
  const svg = canvas.toSVG();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function importCanvasJSON(canvas: any, data: any): Promise<void> {
  return canvas
    .loadFromJSON(data)
    .then(() => {
      canvas.requestRenderAll();
    });
}

export function clearCanvas(canvas: any) {
  canvas.getObjects().forEach((object: any) => {
    canvas.remove(object);
  });
  canvas.backgroundColor = "white";
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export interface ExportPreset {
  width: number;
  height: number;
}

export const EXPORT_PRESETS: Record<string, ExportPreset> = {
  "1080 × 1080 (Instagram)": { width: 1080, height: 1080 },
  "1920 × 1080 (16:9)": { width: 1920, height: 1080 },
  "3840 × 2160 (4K UHD)": { width: 3840, height: 2160 },
  "2480 × 3508 (A4 @300dpi)": { width: 2480, height: 3508 },
};

/**
 * Render the document onto a canvas of exactly `width`×`height`, scaling the
 * artwork to fit (letterboxed on white), and download it. Uses the composite
 * (adjustment-aware) canvas so presets match what the user sees.
 */
export async function exportScaled(
  canvas: any,
  opts: {
    width: number;
    height: number;
    format?: "png" | "jpeg";
    quality?: number;
    filename?: string;
    fit?: "contain" | "fill";
  }
): Promise<boolean> {
  if (!canvas) return false;
  const format = opts.format ?? "png";
  const src = (await compositeCanvas(canvas)) ?? canvas.getElement?.();
  if (!src) return false;

  const ow0 = src.width || canvas.width;
  const oh0 = src.height || canvas.height;
  const fit = opts.fit ?? "contain";
  const scale = fit === "fill"
    ? Math.max(opts.width / ow0, opts.height / oh0)
    : Math.min(opts.width / ow0, opts.height / oh0);
  const ow = Math.max(1, Math.round(ow0 * scale));
  const oh = Math.max(1, Math.round(oh0 * scale));

  const c = document.createElement("canvas");
  c.width = opts.width;
  c.height = opts.height;
  const g = c.getContext("2d");
  if (!g) return false;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, opts.width, opts.height);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const ox = Math.round((opts.width - ow) / 2);
  const oy = Math.round((opts.height - oh) / 2);
  g.drawImage(src, ox, oy, ow, oh);

  const dataUrl = c.toDataURL(`image/${format}`, opts.quality ?? 0.95);
  downloadDataURL(
    dataUrl,
    opts.filename ?? `kaypaint-${opts.width}x${opts.height}.${format === "jpeg" ? "jpg" : "png"}`
  );
  return true;
}