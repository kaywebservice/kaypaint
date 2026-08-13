/* eslint-disable @typescript-eslint/no-explicit-any */
import { util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function toLocal(obj: any, pt: { x: number; y: number }) {
  const inv = util.invertTransform(obj.calcTransformMatrix());
  const lp = util.transformPoint(pt, inv);
  return { x: lp.x, y: lp.y };
}

function outlinePath(g: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  g.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  });
  if (pts.length > 2) g.closePath();
}

function buildMask(pts: { x: number; y: number }[], w: number, h: number): Uint8Array {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  outlinePath(g, pts);
  g.fillStyle = "#fff";
  g.fill();
  const d = g.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4] > 128 ? 255 : 0;
  return mask;
}

function edgeDist(mask: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = Infinity;
      if (mask[i] !== 255) continue;
      const boundary =
        x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
        mask[i - 1] !== 255 || mask[i + 1] !== 255 ||
        mask[i - w] !== 255 || mask[i + w] !== 255;
      if (boundary) {
        d[i] = 0;
        queue.push(i);
      }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const nd = d[i] + 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0 && mask[i - 1] === 255 && d[i - 1] > nd) {
      d[i - 1] = nd;
      queue.push(i - 1);
    }
    if (x < w - 1 && mask[i + 1] === 255 && d[i + 1] > nd) {
      d[i + 1] = nd;
      queue.push(i + 1);
    }
    if (y > 0 && mask[i - w] === 255 && d[i - w] > nd) {
      d[i - w] = nd;
      queue.push(i - w);
    }
    if (y < h - 1 && mask[i + w] === 255 && d[i + w] > nd) {
      d[i + w] = nd;
      queue.push(i + w);
    }
  }
  return d;
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

const FEATHER = 6;

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let stroke: {
    obj: any;
    base: HTMLCanvasElement;
    w: number;
    h: number;
    phase: 1 | 2;
    pts: { x: number; y: number }[];
    mask: Uint8Array | null;
    region: HTMLCanvasElement | null;
    dragStart: { x: number; y: number } | null;
    offset: { x: number; y: number };
    last: { x: number; y: number };
  } | null = null;

  const redraw = () => {
    if (!stroke) return;
    const { base, w, h, obj, pts } = stroke;
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const wg = work.getContext("2d")!;
    wg.drawImage(base, 0, 0);
    if (stroke.phase === 2 && stroke.dragStart && stroke.region) {
      wg.save();
      wg.translate(stroke.offset.x, stroke.offset.y);
      outlinePath(wg, pts);
      wg.clip();
      wg.drawImage(stroke.region, 0, 0);
      wg.restore();
    } else if (pts.length > 1) {
      wg.save();
      if (pts.length > 2) {
        wg.fillStyle = "rgba(0,0,0,0.35)";
        wg.beginPath();
        wg.rect(0, 0, w, h);
        wg.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) wg.lineTo(pts[i].x, pts[i].y);
        wg.closePath();
        wg.fill("evenodd");
      }
      wg.strokeStyle = "rgba(255,255,255,0.9)";
      wg.lineWidth = 1.5;
      wg.setLineDash([6, 4]);
      outlinePath(wg, pts);
      wg.stroke();
      wg.restore();
    }
    live(obj, work, canvas);
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
    const lp = toLocal(obj, getPointer(canvas, e.e));
    if (stroke && stroke.phase === 1 && stroke.mask && stroke.pts.length > 2) {
      stroke.phase = 2;
      stroke.dragStart = lp;
      stroke.offset = { x: 0, y: 0 };
      redraw();
      return;
    }
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    base.getContext("2d")!.drawImage(el, 0, 0, w, h);
    stroke = {
      obj,
      base,
      w,
      h,
      phase: 1,
      pts: [{ x: lp.x, y: lp.y }],
      mask: null,
      region: null,
      dragStart: null,
      offset: { x: 0, y: 0 },
      last: lp,
    };
    redraw();
  };

  const move = (e: any) => {
    if (!stroke || !e.e.buttons) return;
    const lp = toLocal(stroke.obj, getPointer(canvas, e.e));
    if (stroke.phase === 1) {
      const dx = lp.x - stroke.last.x;
      const dy = lp.y - stroke.last.y;
      if (dx * dx + dy * dy < 16) return;
      stroke.last = lp;
      stroke.pts.push(lp);
      redraw();
    } else if (stroke.phase === 2 && stroke.dragStart) {
      stroke.offset = { x: lp.x - stroke.dragStart.x, y: lp.y - stroke.dragStart.y };
      redraw();
    }
  };

  const up = () => {
    if (!stroke) return;
    if (stroke.phase === 1) {
      stroke.mask = buildMask(stroke.pts, stroke.w, stroke.h);
      const rc = document.createElement("canvas");
      rc.width = stroke.w;
      rc.height = stroke.h;
      const rg = rc.getContext("2d")!;
      rg.save();
      outlinePath(rg, stroke.pts);
      rg.clip();
      rg.drawImage(stroke.base, 0, 0);
      rg.restore();
      stroke.region = rc;
      redraw();
      return;
    }
    if (stroke.phase === 2 && stroke.dragStart) {
      const s = stroke;
      stroke = null;
      const off = s.offset;
      if (Math.hypot(off.x, off.y) < 2) {
        live(s.obj, s.base, canvas);
        return;
      }
      const baseData = s.base.getContext("2d")!.getImageData(0, 0, s.w, s.h);
      const out = new Uint8ClampedArray(baseData.data);
      const dist = edgeDist(s.mask!, s.w, s.h);
      for (let i = 0; i < s.w * s.h; i++) {
        if (s.mask![i] !== 255) continue;
        const x = i % s.w;
        const y = (i / s.w) | 0;
        const sx = x + off.x;
        const sy = y + off.y;
        if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
        const si = (sy * s.w + sx) * 4;
        const t = Math.min(1, dist[i] / FEATHER);
        const di = i * 4;
        out[di] = baseData.data[si] * t + baseData.data[di] * (1 - t);
        out[di + 1] = baseData.data[si + 1] * t + baseData.data[di + 1] * (1 - t);
        out[di + 2] = baseData.data[si + 2] * t + baseData.data[di + 2] * (1 - t);
        out[di + 3] = baseData.data[si + 3] * t + baseData.data[di + 3] * (1 - t);
      }
      const work = document.createElement("canvas");
      work.width = s.w;
      work.height = s.h;
      work.getContext("2d")!.putImageData(new ImageData(out, s.w, s.h), 0, 0);
      live(s.obj, work, canvas);
      commit(ctx, s.obj, work);
    }
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
