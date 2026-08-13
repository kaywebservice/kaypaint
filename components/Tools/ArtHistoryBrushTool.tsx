/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function takeSnapshot(obj: any): HTMLCanvasElement | null {
  const el = obj?.getElement?.();
  if (!el) return null;
  const w = el.naturalWidth || el.width;
  const h = el.naturalHeight || el.height;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(el, 0, 0, w, h);
  return c;
}

function dabCircle(
  data: Uint8ClampedArray,
  snap: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number
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
      const scx = Math.max(0, Math.min(w - 1, Math.round(cx + dx)));
      const scy = Math.max(0, Math.min(h - 1, Math.round(cy + dy)));
      const si = (scy * w + scx) * 4;
      const sa = snap[si + 3] / 255;
      if (sa <= 0) continue;
      const a = 0.6 * sa;
      const i = (y * w + x) * 4;
      const da = data[i + 3] / 255;
      const outA = a + da * (1 - a);
      if (outA <= 0) continue;
      data[i] = Math.round((snap[si] * a + data[i] * da * (1 - a)) / outA);
      data[i + 1] = Math.round((snap[si + 1] * a + data[i + 1] * da * (1 - a)) / outA);
      data[i + 2] = Math.round((snap[si + 2] * a + data[i + 2] * da * (1 - a)) / outA);
      data[i + 3] = Math.round(outA * 255);
    }
  }
}

function stampDabs(
  data: Uint8ClampedArray,
  snap: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number
) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(2, size / 4);
  const n = Math.max(1, Math.ceil(dist / step));
  const jitter = size / 2;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const bx = x0 + (x1 - x0) * t;
    const by = y0 + (y1 - y0) * t;
    const cx = bx + (Math.random() * 2 - 1) * jitter;
    const cy = by + (Math.random() * 2 - 1) * jitter;
    const r = 2 + Math.random() * 3;
    dabCircle(data, snap, w, h, cx, cy, r);
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

  let snapshot: HTMLCanvasElement | null = null;
  const active = canvas.getActiveObject?.();
  if (active && active.type === "image") {
    snapshot = takeSnapshot(active);
  }

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
    if (!snapshot) snapshot = takeSnapshot(obj);
    if (!snapshot) return;
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const g = work.getContext("2d")!;
    g.drawImage(el, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    const snapData = snapshot.getContext("2d")!.getImageData(0, 0, w, h).data;
    const lp = toLocal(obj, getPointer(canvas, e.e));
    const size = Math.max(4, (Number(ctx.get("size") ?? 20) / Math.abs(obj.scaleX || 1)));
    stampDabs(img.data, snapData, w, h, lp.x, lp.y, lp.x, lp.y, size);
    g.putImageData(img, 0, 0);
    stroke = { obj, work, w, h, lastX: lp.x, lastY: lp.y, dirty: true };
    live(obj, work, canvas);
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    const dx = lp.x - stroke.lastX;
    const dy = lp.y - stroke.lastY;
    if (dx * dx + dy * dy < 16) return;
    const size = Math.max(4, (Number(ctx.get("size") ?? 20) / Math.abs(stroke.obj.scaleX || 1)));
    const g = stroke.work.getContext("2d")!;
    const img = g.getImageData(0, 0, stroke.w, stroke.h);
    const snapData = snapshot!.getContext("2d")!.getImageData(0, 0, stroke.w, stroke.h).data;
    stampDabs(img.data, snapData, stroke.w, stroke.h, stroke.lastX, stroke.lastY, lp.x, lp.y, size);
    stroke.lastX = lp.x;
    stroke.lastY = lp.y;
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
    snapshot = null;
    canvas.requestRenderAll();
  };
}
