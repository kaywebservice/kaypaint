/* eslint-disable @typescript-eslint/no-explicit-any */
import { util, Rect } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { readActivePixels, applyPixelsToActiveLayer } from "@/engine/pixelOps";
import {
  blurAlpha,
  morphAlpha,
  applyContrast,
  decontaminateColors,
} from "@/engine/refineEdge";
import { notify } from "@/utils/notify";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function stamp(
  img: ImageData,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  erase: boolean
) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / r;
      const a = Math.round(255 * f * f * (2 - f));
      const i = (y * w + x) * 4;
      const cur = img.data[i + 3];
      img.data[i + 3] = erase ? Math.min(cur, 255 - a) : Math.max(cur, a);
    }
  }
}

interface Stroke {
  obj: any;
  work: HTMLCanvasElement;
  img: ImageData;
  w: number;
  h: number;
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

  let overlay: any = null;
  let stroke: Stroke | null = null;

  const showOverlay = () => {
    if (overlay) return;
    overlay = new Rect({
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
      fill: "rgba(80, 120, 255, 0.3)",
      selectable: false,
      evented: false,
      isRefineOverlay: true,
      globalCompositeOperation: "multiply",
    });
    canvas.add(overlay);
    canvas.requestRenderAll();
  };

  const removeOverlay = () => {
    if (!overlay) return;
    canvas.remove(overlay);
    overlay = null;
    canvas.requestRenderAll();
  };

  const begin = (e: any) => {
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
    showOverlay();
    stroke = {
      obj,
      work,
      img,
      w,
      h,
      lastX: lp.x,
      lastY: lp.y,
      dirty: false,
      lastPreview: 0,
    };
    stamp(img, w, h, lp.x, lp.y, r, !!e.e.altKey);
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
    stamp(stroke.img, stroke.w, stroke.h, lp.x, lp.y, r, !!e.e.altKey);
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
    removeOverlay();
  };

  canvas.on("mouse:down", begin);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", begin);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    stroke = null;
    removeOverlay();
  };
}

export function refineActiveLayer(canvas: any, opts: {
  smooth?: number;
  feather?: number;
  contract?: number;
  contrast?: number;
  decontaminate?: boolean;
}) {
  const smooth = Math.max(0, Number(opts.smooth ?? 0));
  const feather = Math.max(0, Number(opts.feather ?? 0));
  const contract = Number(opts.contract ?? 0);
  const contrast = Math.max(0, Number(opts.contrast ?? 50));
  const decontaminate = !!opts.decontaminate;

  return applyPixelsToActiveLayer(canvas, (data, w, h) => {
    if (smooth > 0) blurAlpha(data, w, h, Math.max(1, Math.round(smooth / 10)));
    if (feather > 0) blurAlpha(data, w, h, Math.max(1, Math.round(feather / 5)));
    if (contract !== 0) {
      morphAlpha(data, w, h, Math.max(1, Math.round(Math.abs(contract) / 10)), contract < 0 ? "erode" : "dilate");
    }
    applyContrast(data, w, h, contrast);
    if (decontaminate) decontaminateColors(data, w, h);
  });
}