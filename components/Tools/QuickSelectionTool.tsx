/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { readActivePixels } from "@/engine/pixelOps";
import { notify } from "@/utils/notify";

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function growPass(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  seed: [number, number, number],
  seedLuma: number,
  targetAlpha: number,
  tol: number
) {
  const sx = Math.round(cx);
  const sy = Math.round(cy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const r2 = r * r;
  const visited = new Uint8Array(w * h);
  const queue: number[] = [sy * w + sx];
  visited[queue[0]] = 1;
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy > r2) continue;
    const i = idx * 4;
    const dr = data[i] - seed[0];
    const dg = data[i + 1] - seed[1];
    const db = data[i + 2] - seed[2];
    if (Math.hypot(dr, dg, db) > tol) continue;
    if (Math.abs(luma(data[i], data[i + 1], data[i + 2]) - seedLuma) > tol * 2.5) continue;
    data[i + 3] = targetAlpha;
    if (x > 0 && !visited[idx - 1]) {
      visited[idx - 1] = 1;
      queue.push(idx - 1);
    }
    if (x < w - 1 && !visited[idx + 1]) {
      visited[idx + 1] = 1;
      queue.push(idx + 1);
    }
    if (y > 0 && !visited[idx - w]) {
      visited[idx - w] = 1;
      queue.push(idx - w);
    }
    if (y < h - 1 && !visited[idx + w]) {
      visited[idx + w] = 1;
      queue.push(idx + w);
    }
  }
}

interface Stroke {
  obj: any;
  work: HTMLCanvasElement;
  w: number;
  h: number;
  img: ImageData;
  seed: [number, number, number];
  seedLuma: number;
  targetAlpha: number;
  lastX: number;
  lastY: number;
  dirty: boolean;
  lastPreview: number;
}

function sync(s: Stroke, canvas: any) {
  const g = s.work.getContext("2d")!;
  g.putImageData(s.img, 0, 0);
  s.obj.setElement(s.work);
  s.obj.setCoords();
  canvas.requestRenderAll();
}

function commit(ctx: ToolCtx, s: Stroke) {
  const g = s.work.getContext("2d")!;
  g.putImageData(s.img, 0, 0);
  const prev = {
    left: s.obj.left,
    top: s.obj.top,
    scaleX: s.obj.scaleX,
    scaleY: s.obj.scaleY,
    angle: s.obj.angle,
    opacity: s.obj.opacity,
    visible: s.obj.visible,
    id: s.obj.kaypaintId,
    styles: s.obj.layerStyleJson,
  };
  const img = new Image();
  img.onload = () => {
    s.obj.setElement(img);
    s.obj.set({
      left: prev.left,
      top: prev.top,
      scaleX: prev.scaleX,
      scaleY: prev.scaleY,
      angle: prev.angle,
      opacity: prev.opacity,
      visible: prev.visible,
    });
    if (prev.styles !== undefined) s.obj.set("layerStyleJson", prev.styles);
    if (prev.id !== undefined) s.obj.set("kaypaintId", prev.id);
    s.obj.setCoords();
    ctx.canvas.requestRenderAll();
    ctx.push();
  };
  img.src = s.work.toDataURL("image/png");
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let stroke: Stroke | null = null;

  const tolerance = () => Math.max(1, Number(ctx.get("tolerance") ?? 30));

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const obj = canvas.getActiveObject?.();
    if (!obj || obj.type !== "image") {
      notify("Select an image layer first.", "warning");
      return;
    }
    const read = readActivePixels(canvas);
    if (!read || read.obj !== obj) return;
    const { width: w, height: h } = read;
    const el = obj.getElement?.();
    if (!el || !w || !h) return;
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const g = work.getContext("2d")!;
    g.drawImage(el, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    const lp = toLocal(obj, getPointer(canvas, e.e));
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / Math.abs(obj.scaleX || 1));
    const sx = Math.max(0, Math.min(w - 1, Math.round(lp.x)));
    const sy = Math.max(0, Math.min(h - 1, Math.round(lp.y)));
    const si = (sy * w + sx) * 4;
    const seed: [number, number, number] = [img.data[si], img.data[si + 1], img.data[si + 2]];
    stroke = {
      obj,
      work,
      w,
      h,
      img,
      seed,
      seedLuma: luma(seed[0], seed[1], seed[2]),
      targetAlpha: e.e.altKey ? 0 : 255,
      lastX: lp.x,
      lastY: lp.y,
      dirty: false,
      lastPreview: 0,
    };
    growPass(img.data, w, h, lp.x, lp.y, r, seed, stroke.seedLuma, stroke.targetAlpha, tolerance());
    stroke.dirty = true;
    sync(stroke, canvas);
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    const scale = Math.abs(stroke.obj.scaleX || 1);
    const dx = lp.x - stroke.lastX;
    const dy = lp.y - stroke.lastY;
    if ((dx * dx + dy * dy) * scale * scale < 16) return;
    stroke.lastX = lp.x;
    stroke.lastY = lp.y;
    const r = Math.max(1, (Number(ctx.get("size") ?? 20) / 2) / scale);
    growPass(stroke.img.data, stroke.w, stroke.h, lp.x, lp.y, r, stroke.seed, stroke.seedLuma, stroke.targetAlpha, tolerance());
    stroke.dirty = true;
    const now = Date.now();
    if (now - stroke.lastPreview >= 80) {
      stroke.lastPreview = now;
      sync(stroke, canvas);
    }
  };

  const up = () => {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    if (s.dirty) commit(ctx, s);
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
