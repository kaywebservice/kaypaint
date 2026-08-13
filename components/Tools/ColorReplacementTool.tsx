/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(f(h + 1 / 3) * 255),
    Math.round(f(h) * 255),
    Math.round(f(h - 1 / 3) * 255),
  ];
}

function replaceCircle(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  seed: number[],
  targetHsl: [number, number]
) {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      if (
        Math.abs(data[i] - seed[0]) +
          Math.abs(data[i + 1] - seed[1]) +
          Math.abs(data[i + 2] - seed[2]) >
        35
      ) {
        continue;
      }
      const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const rgb = hslToRgb(targetHsl[0], targetHsl[1], hsl[2]);
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
}

function live(obj: any, work: HTMLCanvasElement, canvas: any) {
  try {
    obj.setElement(work);
    obj.setCoords();
  } catch {
    /* keep previous element */
  }
  canvas.requestRenderAll();
}

function commit(ctx: ToolCtx, obj: any, work: HTMLCanvasElement) {
  const canvas = ctx.canvas;
  const prev = {
    left: obj.left,
    top: obj.top,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    angle: obj.angle,
    opacity: obj.opacity,
    visible: obj.visible,
    id: obj.kaypaintId,
    styles: obj.layerStyleJson,
  };
  const img = new Image();
  img.onload = () => {
    obj.setElement(img);
    obj.set({
      left: prev.left,
      top: prev.top,
      scaleX: prev.scaleX,
      scaleY: prev.scaleY,
      angle: prev.angle,
      opacity: prev.opacity,
      visible: prev.visible,
    });
    if (prev.styles !== undefined) obj.set("layerStyleJson", prev.styles);
    if (prev.id !== undefined) obj.set("kaypaintId", prev.id);
    obj.setCoords();
    canvas.requestRenderAll();
    ctx.push();
  };
  img.src = work.toDataURL("image/png");
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let stroke: {
    obj: any;
    work: HTMLCanvasElement;
    w: number;
    h: number;
    lastX: number;
    lastY: number;
    dirty: boolean;
  } | null = null;

  const targetHsl = (): [number, number] => {
    const rgb = hexToRgb(ctx.get("color") ?? "#ff0000");
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return [hsl[0], hsl[1]];
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const obj = canvas.getActiveObject?.();
    if (!obj || obj.type !== "image") {
      window.alert("Select an image layer first.");
      return;
    }
    const el = obj.getElement?.();
    if (!el) return;
    const w = el.naturalWidth || el.width;
    const h = el.naturalHeight || el.height;
    if (!w || !h) return;
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const g = work.getContext("2d")!;
    g.drawImage(el, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    const lp = toLocal(obj, getPointer(canvas, e.e));
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(obj.scaleX || 1));
    const ccx = Math.max(0, Math.min(w - 1, Math.round(lp.x)));
    const ccy = Math.max(0, Math.min(h - 1, Math.round(lp.y)));
    const si = (ccy * w + ccx) * 4;
    const seed = [img.data[si], img.data[si + 1], img.data[si + 2]];
    replaceCircle(img.data, w, h, lp.x, lp.y, r, seed, targetHsl());
    g.putImageData(img, 0, 0);
    stroke = { obj, work, w, h, lastX: lp.x, lastY: lp.y, dirty: true };
    live(obj, work, canvas);
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    const dx = lp.x - stroke.lastX;
    const dy = lp.y - stroke.lastY;
    if (dx * dx + dy * dy < 64) return;
    stroke.lastX = lp.x;
    stroke.lastY = lp.y;
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(stroke.obj.scaleX || 1));
    const g = stroke.work.getContext("2d")!;
    const img = g.getImageData(0, 0, stroke.w, stroke.h);
    const ccx = Math.max(0, Math.min(stroke.w - 1, Math.round(lp.x)));
    const ccy = Math.max(0, Math.min(stroke.h - 1, Math.round(lp.y)));
    const si = (ccy * stroke.w + ccx) * 4;
    const seed = [img.data[si], img.data[si + 1], img.data[si + 2]];
    replaceCircle(img.data, stroke.w, stroke.h, lp.x, lp.y, r, seed, targetHsl());
    g.putImageData(img, 0, 0);
    stroke.dirty = true;
    live(stroke.obj, stroke.work, canvas);
  };

  const up = () => {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    if (s.dirty) commit(ctx, s.obj, s.work);
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    stroke = null;
    canvas.requestRenderAll();
  };
}
