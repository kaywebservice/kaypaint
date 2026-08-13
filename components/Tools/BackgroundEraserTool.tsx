/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function eraseCircle(data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number, tol: number) {
  const ccx = Math.max(0, Math.min(w - 1, Math.round(cx)));
  const ccy = Math.max(0, Math.min(h - 1, Math.round(cy)));
  const si = (ccy * w + ccx) * 4;
  const seed = [data[si], data[si + 1], data[si + 2]];
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
      if (Math.abs(data[i] - seed[0]) + Math.abs(data[i + 1] - seed[1]) + Math.abs(data[i + 2] - seed[2]) <= tol) {
        data[i + 3] = 0;
      }
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
    const cx = lp.x;
    const cy = lp.y;
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(obj.scaleX || 1));
    const tol = 32;
    eraseCircle(img.data, w, h, cx, cy, r, tol);
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
    eraseCircle(img.data, stroke.w, stroke.h, lp.x, lp.y, r, 32);
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
