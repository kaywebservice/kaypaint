/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { readActivePixels } from "@/engine/pixelOps";
import { findHealOffset, healStamp } from "@/engine/healEngine";
import { notify } from "@/utils/notify";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

interface Stroke {
  obj: any;
  work: HTMLCanvasElement;
  img: ImageData;
  w: number;
  h: number;
  dx: number;
  dy: number;
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
    const offset = findHealOffset(img.data, w, h, lp.x, lp.y, r);
    stroke = {
      obj,
      work,
      img,
      w,
      h,
      dx: offset.dx,
      dy: offset.dy,
      lastX: lp.x,
      lastY: lp.y,
      dirty: false,
      lastPreview: 0,
    };
    healStamp(img, w, h, lp.x, lp.y, r, stroke.dx, stroke.dy);
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
    healStamp(stroke.img, stroke.w, stroke.h, lp.x, lp.y, r, stroke.dx, stroke.dy);
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

export function syncHeal(ctx: ToolCtx) {
  // Brush size is read live via ctx.get; nothing to cache here.
  void ctx;
}