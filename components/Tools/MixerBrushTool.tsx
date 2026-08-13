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

const WET = 0.4;
const LOAD = 0.5;
const DILUTE = 0.3;

function applyMix(
  work: Uint8ClampedArray,
  paint: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  color: [number, number, number],
  firstTouch: boolean
) {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  const mix = WET * LOAD;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * w + x) * 4;
      if (work[i + 3] === 0) continue;
      if (firstTouch) {
        paint[i] = work[i] * 0.5 + color[0] * 0.5;
        paint[i + 1] = work[i + 1] * 0.5 + color[1] * 0.5;
        paint[i + 2] = work[i + 2] * 0.5 + color[2] * 0.5;
      } else {
        paint[i] = paint[i] * (1 - DILUTE) + color[0] * DILUTE;
        paint[i + 1] = paint[i + 1] * (1 - DILUTE) + color[1] * DILUTE;
        paint[i + 2] = paint[i + 2] * (1 - DILUTE) + color[2] * DILUTE;
      }
      work[i] = work[i] * (1 - mix) + paint[i] * mix;
      work[i + 1] = work[i + 1] * (1 - mix) + paint[i + 1] * mix;
      work[i + 2] = work[i + 2] * (1 - mix) + paint[i + 2] * mix;
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

let strokePaint: HTMLCanvasElement | null = null;

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
    firstTouch: boolean;
    dirty: boolean;
  } | null = null;

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

    strokePaint = document.createElement("canvas");
    strokePaint.width = w;
    strokePaint.height = h;
    const pg = strokePaint.getContext("2d")!;
    pg.fillStyle = ctx.get("color") ?? "#000000";
    pg.fillRect(0, 0, w, h);
    const paint = pg.getImageData(0, 0, w, h);

    const lp = toLocal(obj, getPointer(canvas, e.e));
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(obj.scaleX || 1));
    const color = hexToRgb(ctx.get("color") ?? "#000000");
    applyMix(img.data, paint.data, w, h, lp.x, lp.y, r, color, true);
    pg.putImageData(paint, 0, 0);
    g.putImageData(img, 0, 0);
    stroke = { obj, work, w, h, lastX: lp.x, lastY: lp.y, firstTouch: false, dirty: true };
    live(obj, work, canvas);
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    const dx = lp.x - stroke.lastX;
    const dy = lp.y - stroke.lastY;
    if (dx * dx + dy * dy < 16) return;
    stroke.lastX = lp.x;
    stroke.lastY = lp.y;
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(stroke.obj.scaleX || 1));
    const g = stroke.work.getContext("2d")!;
    const img = g.getImageData(0, 0, stroke.w, stroke.h);
    const pg = strokePaint!.getContext("2d")!;
    const paint = pg.getImageData(0, 0, stroke.w, stroke.h);
    const color = hexToRgb(ctx.get("color") ?? "#000000");
    applyMix(img.data, paint.data, stroke.w, stroke.h, lp.x, lp.y, r, color, stroke.firstTouch);
    stroke.firstTouch = false;
    pg.putImageData(paint, 0, 0);
    g.putImageData(img, 0, 0);
    stroke.dirty = true;
    live(stroke.obj, stroke.work, canvas);
  };

  const up = () => {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    strokePaint = null;
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
    strokePaint = null;
    canvas.requestRenderAll();
  };
}
