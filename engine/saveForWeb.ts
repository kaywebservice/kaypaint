/* eslint-disable @typescript-eslint/no-explicit-any */
import { compositeCanvas } from "@/engine/pixelOps";
import { downloadBlob } from "@/engine/actionsEngine";
import { showOptions } from "@/components/Menu/OptionDialog";

const SIZES: { id: string; label: string; px: number | null; pct: number | null }[] = [
  { id: "original", label: "Original", px: null, pct: 1 },
  { id: "25", label: "25%", px: null, pct: 0.25 },
  { id: "50", label: "50%", px: null, pct: 0.5 },
  { id: "75", label: "75%", px: null, pct: 0.75 },
  { id: "1280", label: "1280 px wide", px: 1280, pct: null },
  { id: "640", label: "640 px wide", px: 640, pct: null },
  { id: "320", label: "320 px wide", px: 320, pct: null },
];

const EXT: Record<string, string> = {
  jpeg: ".jpg",
  "png-24": ".png",
  "png-8": ".png",
  webp: ".webp",
};

function scaleTo(src: HTMLCanvasElement, size: { px: number | null; pct: number | null }): HTMLCanvasElement {
  let w = src.width;
  let h = src.height;
  if (size.px != null) {
    const s = Math.min(1, size.px / w);
    w = Math.round(w * s);
    h = Math.round(h * s);
  } else if (size.pct != null) {
    w = Math.max(1, Math.round(w * size.pct));
    h = Math.max(1, Math.round(h * size.pct));
  }
  if (w === src.width && h === src.height) return src;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return out;
}

function quantizePng8(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext("2d")!;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const levels = 6;
  const mult = 255 / (levels - 1);
  const err = new Float64Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = d[o + c] + err[o + c];
        const q = Math.round(Math.max(0, Math.min(255, v)) / mult) * mult;
        d[o + c] = q;
        const e = v - q;
        if (x + 1 < w) err[o + 4 + c] += (e * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) err[o + w * 4 - 4 + c] += (e * 3) / 16;
          err[o + w * 4 + c] += (e * 5) / 16;
          if (x + 1 < w) err[o + w * 4 + 4 + c] += e / 16;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

export async function saveForWebDialog(canvas: any): Promise<void> {
  if (!canvas) {
    window.alert("Open a document first.");
    return;
  }
  const composite = await compositeCanvas(canvas);
  if (!composite) {
    window.alert("Nothing to export.");
    return;
  }
  const res = await showOptions({
    title: "Save for Web",
    fields: [
      {
        key: "format",
        label: "Format",
        type: "select",
        value: "jpeg",
        options: [
          { value: "jpeg", label: "JPEG" },
          { value: "png-24", label: "PNG-24" },
          { value: "png-8", label: "PNG-8 (256 colors, dithered)" },
          { value: "webp", label: "WebP" },
        ],
      },
      { key: "quality", label: "Quality", type: "slider", min: 1, max: 100, step: 1, value: 85, suffix: "%" },
      { key: "transparency", label: "Transparency", type: "checkbox", value: true },
      {
        key: "size",
        label: "Size",
        type: "select",
        value: "original",
        options: SIZES.map((s) => ({ value: s.id, label: s.label })),
      },
    ],
    okLabel: "Export",
  });
  if (!res) return;

  const format = String(res.format ?? "jpeg");
  const quality = Number(res.quality ?? 85) / 100;
  const transparency = !!res.transparency;
  const size = SIZES.find((s) => s.id === res.size) ?? SIZES[0];

  let img = scaleTo(composite, size);
  if (!transparency || format === "jpeg") {
    const flat = document.createElement("canvas");
    flat.width = img.width;
    flat.height = img.height;
    const g = flat.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, flat.width, flat.height);
    g.drawImage(img, 0, 0);
    img = flat;
  }
  if (format === "png-8") img = quantizePng8(img);

  const mime =
    format === "jpeg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : "image/png";
  const blob = await new Promise<Blob | null>((r) =>
    img.toBlob(r, mime, format === "png-24" || format === "png-8" ? undefined : quality)
  );
  if (!blob) {
    window.alert("Export failed.");
    return;
  }
  downloadBlob(blob, `web-export-${size.id}.${EXT[format].replace(".", "")}`);
}
