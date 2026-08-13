/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function matches(d: Uint8ClampedArray, i: number, seed: number[], tol: number) {
  return (
    Math.abs(d[i] - seed[0]) +
    Math.abs(d[i + 1] - seed[1]) +
    Math.abs(d[i + 2] - seed[2]) <=
    tol
  );
}

function floodErase(data: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, seed: number[], tol: number) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!matches(data, i * 4, seed, tol)) continue;
    data[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
}

function eraseAll(data: Uint8ClampedArray, w: number, h: number, seed: number[], tol: number) {
  for (let i = 0; i < w * h; i++) {
    if (matches(data, i * 4, seed, tol)) data[i * 4 + 3] = 0;
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
    seed: number[];
    tol: number;
    global: boolean;
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
    const px = Math.floor(lp.x);
    const py = Math.floor(lp.y);
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const si = (py * w + px) * 4;
    const seed = [img.data[si], img.data[si + 1], img.data[si + 2]];
    const fa = ctx.get("filterAmount");
    const tol = fa == null ? 30 : Math.round(15 + (Number(fa) / 100) * 55);
    if (e.e.altKey) {
      eraseAll(img.data, w, h, seed, tol);
    } else {
      floodErase(img.data, w, h, px, py, seed, tol);
    }
    g.putImageData(img, 0, 0);
    stroke = { obj, work, w, h, seed, tol, global: !!e.e.altKey, lastX: px, lastY: py, dirty: true };
    live(obj, work, canvas);
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    const px = Math.floor(lp.x);
    const py = Math.floor(lp.y);
    const dx = px - stroke.lastX;
    const dy = py - stroke.lastY;
    if (dx * dx + dy * dy < 16) return;
    stroke.lastX = px;
    stroke.lastY = py;
    if (px < 0 || py < 0 || px >= stroke.w || py >= stroke.h) return;
    const g = stroke.work.getContext("2d")!;
    const img = g.getImageData(0, 0, stroke.w, stroke.h);
    if (stroke.global) {
      eraseAll(img.data, stroke.w, stroke.h, stroke.seed, stroke.tol);
    } else {
      floodErase(img.data, stroke.w, stroke.h, px, py, stroke.seed, stroke.tol);
    }
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
