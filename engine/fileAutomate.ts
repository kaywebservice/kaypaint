/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";
import { showOptions } from "@/components/Menu/OptionDialog";
import type { OptionField } from "@/components/Menu/OptionDialog";
import { canvasNow, compositeCanvas } from "@/engine/pixelOps";
import { downloadDataURL } from "@/utils/imageUtils";
import { pickImages, fileToDataURL } from "@/engine/actionsEngine";

function push() {
  const h = useEditorStore.getState().history;
  try { h?.push?.(); } catch {}
}

export async function fitImageDialog(): Promise<void> {
  const canvas = canvasNow() as any;
  if (!canvas) {
    window.alert("Fit Image: no active canvas.");
    return;
  }
  const res = await showOptions({
    title: "Fit Image",
    fields: [
      { key: "w", label: "Width", type: "number", value: 1920, min: 1, max: 30000, step: 1, suffix: " px" },
      { key: "h", label: "Height", type: "number", value: 1080, min: 1, max: 30000, step: 1, suffix: " px" },
    ] as OptionField[],
  });
  if (!res) return;
  const tw = Math.max(1, Number(res.w));
  const th = Math.max(1, Number(res.h));
  const src = await compositeCanvas(canvas);
  if (!src) return;
  const sw = src.width, sh = src.height;
  const s = Math.min(tw / sw, th / sh, 1);
  const nw = Math.round(s * sw);
  const nh = Math.round(s * sh);
  canvas.setWidth(nw);
  canvas.setHeight(nh);
  canvas.clear();
  canvas.setBackgroundImage(src, canvas.requestRenderAll.bind(canvas));
  canvas.add();
  canvas.requestRenderAll();
  push();
}

function estimateCanvasAngle(pixels: Uint8ClampedArray, w: number, h: number): number {
  let sin = 0, cos = 0, count = 0;
  const band = 6;
  const gx = (x: number, y: number) => {
    if (x <= 0 || x >= w - 1 || y < 0 || y >= h) return 0;
    const i = (y * w + x) * 4;
    return (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
  };
  const borders: Array<[number, number, number, number]> = [
    [0, band, w, band],
    [w - band, band, band, h],
    [0, h - band, w, band],
    [0, band, band, h],
  ];
  for (const [x0, y0, dw, dh] of borders) {
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + dh); y += 3) {
      for (let x = Math.max(0, x0); x < Math.min(w, x0 + dw); x += 3) {
        const gxL = gx(x - 1, y), gxR = gx(x + 1, y);
        const gyU = gx(x, y - 1), gyD = gx(x, y + 1);
        const dx = gxR - gxL, dy = gyD - gyU;
        if (Math.abs(dx) + Math.abs(dy) < 1e-6) continue;
        const mag = Math.sqrt(dx * dx + dy * dy);
        cos += dx * mag;
        sin += dy * mag;
        count += 1;
      }
    }
  }
  if (count < 4) return 0;
  return Math.atan2(sin / count, cos / count) / 2;
}

export async function cropAndStraightenPhotos(): Promise<void> {
  const canvas = canvasNow() as any;
  if (!canvas) {
    window.alert("Crop and Straighten: no active canvas.");
    return;
  }
  const src = await compositeCanvas(canvas);
  if (!src) return;
  const pixels = src.getContext("2d")!.getImageData(0, 0, src.width, src.height).data;
  const angle = estimateCanvasAngle(pixels, src.width, src.height);
  let bgsrc = src;
  if (Math.abs(angle) > 0.1) {
    const c = document.createElement("canvas");
    const rad = angle;
    const diag = Math.hypot(src.width, src.height);
    c.width = Math.ceil(diag);
    c.height = Math.ceil(diag);
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.rotate(rad);
    g.drawImage(src, -src.width / 2, -src.height / 2);
    g.restore();
    bgsrc = c;
  }
  const px = bgsrc.getContext("2d")!.getImageData(0, 0, bgsrc.width, bgsrc.height).data;
  const same = (a: number, b: number) => Math.abs(a - b) < 8;
  let left = bgsrc.width, right = -1, top = bgsrc.height, bottom = -1;
  const step = 3;
  for (let y = 0; y < bgsrc.height; y += step) {
    for (let x = 0; x < bgsrc.width; x += step) {
      const i = (y * bgsrc.width + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const bg = px[0];
      const isBg = same(r, bg) && same(g, bg + 1) && same(b, bg + 2) && r > 240 && g > 240 && b > 240;
      if (!isBg) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (left > right || top > bottom) {
    push();
    return;
  }
  const pad = 2;
  const nl = Math.max(0, left - pad), nr = Math.min(bgsrc.width, right + pad);
  const nt = Math.max(0, top - pad), nbot = Math.min(bgsrc.height, bottom + pad);
  const cw = nr - nl, ch = nbot - nt;
  canvas.setWidth(cw);
  canvas.setHeight(ch);
  canvas.clear();
  const cropImg = bgsrc.getContext("2d")!.getImageData(nl, nt, cw, ch);
  const tmp = document.createElement("canvas");
  tmp.width = cw; tmp.height = ch;
  tmp.getContext("2d")!.putImageData(cropImg, 0, 0);
  canvas.setBackgroundImage(tmp, canvas.requestRenderAll.bind(canvas));
  canvas.requestRenderAll();
  push();
}

export async function placeEmbedded(): Promise<void> {
  const canvas = canvasNow() as any;
  if (!canvas) {
    window.alert("Place Embedded: no active canvas.");
    return;
  }
  const files = await pickImages(false);
  const file = files && files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  (window as any).fabric.Image.fromURL(dataUrl, (img: any) => {
    const cw = canvas.width, ch = canvas.height;
    const imgScale = Math.min(cw / img.width, ch / img.height, 1);
    img.set({
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
      scaleX: imgScale,
      scaleY: imgScale,
      angle: 0,
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
    push();
  }, (err: any) => {
    window.alert(err?.message ?? "Could not place image.");
  });
}

export function quickExportPng(): void {
  const canvas = canvasNow();
  if (!canvas) return;
  downloadDataURL((canvas as any).toDataURL({ format: "png", quality: 1, multiplier: 1 }), "kaypaint.png");
}

export function quickExportJpeg(): void {
  const canvas = canvasNow() as any;
  if (!canvas) return;
  const url = canvas.toDataURL({ format: "jpeg", quality: 0.92 });
  downloadDataURL(url, "kaypaint.jpg");
}

export async function exportLayersToFiles(): Promise<void> {
  const canvas = canvasNow() as any;
  if (!canvas) {
    window.alert("Export Layers to Files: no active canvas.");
    return;
  }
  const res = await showOptions({
    title: "Export Layers to Files",
    fields: [
      { key: "prefix", label: "File Prefix", type: "text", value: "layer" },
      { key: "format", label: "Format", type: "select", value: "png", options: [{ value: "png", label: "PNG" }, { value: "jpg", label: "JPEG" }] },
      { key: "scale", label: "Scale", type: "number", value: 1, min: 0.1, max: 4, step: 0.1, suffix: "x" },
      { key: "visibleOnly", label: "Visible Layers Only", type: "checkbox", value: true },
    ] as OptionField[],
  });
  if (!res) return;
  const prefix = String(res.prefix || "layer");
  const fmt = String(res.format) === "jpg" ? "jpg" : "png";
  const scale = Math.max(0.1, Number(res.scale));
  const visibleOnly = !!res.visibleOnly;
  const objs: any[] = (canvas.getObjects?.() ?? []).filter((o: any) => {
    if (visibleOnly && (o.excludeFromExport || o.hidden)) return false;
    return true;
  });
  if (!objs.length) {
    window.alert("No layers to export.");
    return;
  }
  for (let i = 0; i < objs.length; i++) {
    const obj = objs[i];
    const name = (obj.id || obj.type || "layer").toString().replace(/[^\w-]/g, "_") || `layer${i}`;
    const r = obj.getBoundingRect ? obj.getBoundingRect() : { width: obj.width, height: obj.height, left: 0, top: 0 };
    const ow = Math.max(1, Math.round(r.width * scale));
    const oh = Math.max(1, Math.round(r.height * scale));
    const off = document.createElement("canvas");
    off.width = ow; off.height = oh;
    const g = off.getContext("2d");
    if (g) {
      g.clearRect(0, 0, ow, oh);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, ow, oh);
      g.save();
      g.translate(-r.left * scale, -r.top * scale);
      g.scale(scale, scale);
      if (typeof obj.render === "function") obj.render(g);
      g.restore();
      downloadDataURL(off.toDataURL(fmt), `${prefix}-${i + 1}-${name}.${fmt}`);
    }
  }
  push();
}
