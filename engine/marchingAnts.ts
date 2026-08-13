/* eslint-disable @typescript-eslint/no-explicit-any */
import { traceMask } from "@/engine/shapeBoolean";
import { readActivePixels } from "@/engine/pixelOps";

/**
 * Marching-ants selection overlay.
 *
 * Selections in this app live as the active layer's alpha; the overlay traces
 * that alpha into closed contours (via shapeBoolean.traceMask) and draws the
 * classic animated dashed outline over the canvas.
 */

export interface AntLoop {
  x: number;
  y: number;
}

export interface AntContour {
  loops: AntLoop[][];
  transform: number[];
}

/** Build the object-local alpha contours of the active image object. */
export function buildContour(canvas: any): AntContour | null {
  if (!canvas) return null;
  const obj = canvas.getActiveObject?.();
  if (!obj || obj.type !== "image") return null;
  const read = readActivePixels(canvas);
  if (!read || read.obj !== obj) return null;
  const { width, height, data } = read;
  const mask = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * 4 + 3] > 16 ? 255 : 0;
  }
  const loops = traceMask(mask, width, height);
  if (!loops.length) return null;
  return { loops, transform: obj.calcTransformMatrix() };
}

/** Map an object-local point to scene coordinates via a 2D affine matrix. */
export function localToScene(m: number[], x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

export function contourToPath(contour: AntContour): Path2D {
  const path = new Path2D();
  for (const loop of contour.loops) {
    let first = true;
    for (const p of loop) {
      const s = localToScene(contour.transform, p.x, p.y);
      if (first) {
        path.moveTo(s.x, s.y);
        first = false;
      } else {
        path.lineTo(s.x, s.y);
      }
    }
    path.closePath();
  }
  return path;
}

/** Draw the ants into `ctx` which is expected to be in scene coordinates. */
export function drawAnts(ctx: CanvasRenderingContext2D, path: Path2D, offset: number) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke(path);
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -offset;
  ctx.stroke(path);
  ctx.restore();
}
