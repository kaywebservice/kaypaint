/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { useFeaturesStore } from "@/store/featuresStore";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function makeDefaultTile(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 64, 64);
  g.save();
  g.translate(32, 32);
  g.rotate(Math.PI / 4);
  g.translate(-32, -32);
  g.fillStyle = color;
  for (let x = -64; x < 128; x += 16) {
    g.fillRect(x, 0, 8, 64);
  }
  g.restore();
  return c;
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

  let tile: HTMLCanvasElement | null = makeDefaultTile(ctx.get("color") ?? "#000000");
  let tileSource: string | null = null;
  let tilePending: string | null = null;

  const loadTile = () => {
    const src = useFeaturesStore.getState().patternSource;
    if (src === tileSource && tile) return;
    if (!src) {
      tile = makeDefaultTile(ctx.get("color") ?? "#000000");
      tileSource = null;
      tilePending = null;
      return;
    }
    if (tilePending === src) return;
    tilePending = src;
    const img = new Image();
    img.onload = () => {
      if (tilePending !== src) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 64;
      c.height = img.naturalHeight || 64;
      c.getContext("2d")!.drawImage(img, 0, 0);
      tile = c;
      tileSource = src;
      tilePending = null;
    };
    img.onerror = () => {
      tilePending = null;
    };
    img.src = src;
  };
  loadTile();

  const stamp = (g: CanvasRenderingContext2D, t: HTMLCanvasElement, cx: number, cy: number, r: number, tsize: number) => {
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    const x0 = Math.floor((cx - r) / tsize) * tsize;
    const y0 = Math.floor((cy - r) / tsize) * tsize;
    for (let y = y0; y <= cy + r; y += tsize) {
      for (let x = x0; x <= cx + r; x += tsize) {
        g.drawImage(t, x, y, tsize, tsize);
      }
    }
    g.restore();
  };

  const capturePattern = (obj: any, w: number, h: number, lp: { x: number; y: number }) => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d")!;
    const el = obj.getElement();
    const sx = Math.max(0, Math.floor(lp.x - 32));
    const sy = Math.max(0, Math.floor(lp.y - 32));
    const sw = Math.min(64, w - sx);
    const sh = Math.min(64, h - sy);
    if (sw <= 0 || sh <= 0) return;
    g.drawImage(el, sx, sy, sw, sh, Math.floor((64 - sw) / 2), Math.floor((64 - sh) / 2), sw, sh);
    const url = c.toDataURL("image/png");
    useFeaturesStore.getState().setPatternSource(url);
    tile = c;
    tileSource = url;
  };

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
    const lp = toLocal(obj, getPointer(canvas, e.e));
    if (e.e.altKey) {
      capturePattern(obj, w, h, lp);
      live(obj, work, canvas);
      return;
    }
    loadTile();
    if (!tile) return;
    const size = Math.max(4, Number(ctx.get("size") ?? 40) / Math.abs(obj.scaleX || 1));
    stamp(g, tile, lp.x, lp.y, size / 2, size);
    stroke = { obj, work, w, h, lastX: lp.x, lastY: lp.y, dirty: true };
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
    if (!tile) return;
    const size = Math.max(4, Number(ctx.get("size") ?? 40) / Math.abs(stroke.obj.scaleX || 1));
    const g = stroke.work.getContext("2d")!;
    stamp(g, tile, lp.x, lp.y, size / 2, size);
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
    tile = null;
    tileSource = null;
    tilePending = null;
    canvas.requestRenderAll();
  };
}
