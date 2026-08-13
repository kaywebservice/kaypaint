/* eslint-disable @typescript-eslint/no-explicit-any */
import { Rect, util } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { applyPixelsToActiveLayer, readActivePixels } from "@/engine/pixelOps";

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

interface LocalBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function growRegion(data: Uint8ClampedArray, w: number, h: number, box: LocalBox, seedLx: number, seedLy: number) {
  const sx = Math.max(0, Math.min(w - 1, Math.round(seedLx)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(seedLy)));
  const minX = Math.max(0, Math.floor(box.minX));
  const minY = Math.max(0, Math.floor(box.minY));
  const maxX = Math.min(w - 1, Math.ceil(box.maxX));
  const maxY = Math.min(h - 1, Math.ceil(box.maxY));
  const si = (sy * w + sx) * 4;
  const seedR = data[si];
  const seedG = data[si + 1];
  const seedB = data[si + 2];
  const seedLuma = luma(seedR, seedG, seedB);
  const visited = new Uint8Array(w * h);
  const queue: number[] = [sy * w + sx];
  visited[queue[0]] = 1;
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const i = idx * 4;
    const dr = data[i] - seedR;
    const dg = data[i + 1] - seedG;
    const db = data[i + 2] - seedB;
    if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 35) continue;
    if (Math.abs(luma(data[i], data[i + 1], data[i + 2]) - seedLuma) > 70) continue;
    data[i + 3] = 255;
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

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let overlay: Rect | null = null;

  const makeOverlay = () => {
    if (overlay) canvas.remove(overlay);
    overlay = new Rect({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      fill: "rgba(80,150,255,0.12)",
      stroke: "rgba(80,150,255,0.9)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      isObjectSelectionOverlay: true,
    });
    canvas.add(overlay);
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    makeOverlay();
  };

  const move = (e: any) => {
    if (!start || !overlay) return;
    const p = getPointer(canvas, e.e);
    overlay.set({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
    overlay.setCoords();
    canvas.requestRenderAll();
  };

  const up = (e: any) => {
    if (!start) return;
    const p = getPointer(canvas, e.e);
    const left = Math.min(start.x, p.x);
    const top = Math.min(start.y, p.y);
    const width = Math.abs(p.x - start.x);
    const height = Math.abs(p.y - start.y);
    start = null;

    if (overlay) {
      canvas.remove(overlay);
      overlay = null;
    }

    const obj = canvas.getActiveObject?.();
    if (!obj) {
      window.alert("Select an image layer first.");
      return;
    }
    const read = readActivePixels(canvas);
    if (!read || read.obj !== obj) {
      window.alert("Select an image layer first.");
      return;
    }

    const inv = util.invertTransform(obj.calcTransformMatrix());
    const a = util.transformPoint({ x: left, y: top }, inv);
    const b = util.transformPoint({ x: left + width, y: top + height }, inv);
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x, b.x);
    const maxY = Math.max(a.y, b.y);

    const seedLx = (minX + maxX) / 2;
    const seedLy = (minY + maxY) / 2;
    if (seedLx < 0 || seedLy < 0 || seedLx >= read.width || seedLy >= read.height) {
      window.alert("Selection is outside the image.");
      return;
    }

    const box: LocalBox = { minX, minY, maxX, maxY };
    const isDrag = width > 2 && height > 2;
    void applyPixelsToActiveLayer(ctx, (data, w, h) => {
      if (isDrag) {
        growRegion(data, w, h, box, seedLx, seedLy);
      } else {
        growRegion(data, w, h, { minX: seedLx, minY: seedLy, maxX: seedLx, maxY: seedLy }, seedLx, seedLy);
      }
    });
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    start = null;
    if (overlay) {
      canvas.remove(overlay);
      overlay = null;
    }
    canvas.requestRenderAll();
  };
}
