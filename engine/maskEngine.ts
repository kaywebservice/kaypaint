/* eslint-disable @typescript-eslint/no-explicit-any */
import { Image as FabricImage } from "fabric";

/**
 * Layer mask support.
 *
 * A mask lives on the fabric object as:
 *   object.maskData  - Uint8ClampedArray alpha mask (w*h)
 *   object.maskW/H   - mask dimensions (object's unscaled pixel size)
 *   object.clipPath  - a fabric.Image whose element renders the mask
 *                      (white = visible). Painting black hides pixels.
 *
 * Adding a mask seeds it from the object's current alpha (so the look is
 * unchanged until you paint it). `applyMask` bakes the mask into the layer's
 * pixels; `removeMask` discards it.
 */

function maskCanvasFrom(maskData: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = maskData[i];
  }
  g.putImageData(img, 0, 0);
  return c;
}

function maskSize(object: any): { w: number; h: number } {
  const el = object?.getElement?.();
  const w = Math.max(1, Math.round(el?.width || object?.width || 1));
  const h = Math.max(1, Math.round(el?.height || object?.height || 1));
  return { w, h };
}

function seedFromAlpha(object: any, maskData: Uint8ClampedArray, w: number, h: number) {
  const el = object?.getElement?.();
  if (!el || !el.width || !el.height) return;
  try {
    const tc = document.createElement("canvas");
    tc.width = el.width;
    tc.height = el.height;
    const tg = tc.getContext("2d");
    if (!tg) return;
    const id = tg.getImageData(0, 0, el.width, el.height);
    const sw = el.width, sh = el.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.min(sw - 1, Math.floor((x * sw) / w));
        const sy = Math.min(sh - 1, Math.floor((y * sh) / h));
        maskData[y * w + x] = id.data[(sy * sw + sx) * 4 + 3];
      }
    }
  } catch {
    /* keep full mask */
  }
}

export function hasMask(object: any): boolean {
  return !!object && !!object.maskData && !!object.clipPath;
}

export function addMask(object: any) {
  if (!object || object.clipPath) return;
  const { w, h } = maskSize(object);
  const maskData = new Uint8ClampedArray(w * h);
  maskData.fill(255);
  seedFromAlpha(object, maskData, w, h);
  object.maskData = maskData;
  object.maskW = w;
  object.maskH = h;
  const clip = new FabricImage(maskCanvasFrom(maskData, w, h), {
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: (object.width || w) / w,
    scaleY: (object.height || h) / h,
    objectCaching: false,
  });
  object.clipPath = clip;
  object.setCoords();
  object.canvas?.requestRenderAll();
}

export function removeMask(object: any) {
  if (!object) return;
  object.clipPath = null;
  object.maskData = null;
  object.maskW = undefined;
  object.maskH = undefined;
  object.setCoords();
  object.canvas?.requestRenderAll();
}

export function toggleMask(object: any) {
  if (!object) return false;
  if (hasMask(object)) {
    removeMask(object);
    return false;
  }
  addMask(object);
  return true;
}

/**
 * Edit the mask in place. `fn(maskData, w, h)` mutates the mask alpha.
 * The clip element is refreshed so changes render immediately.
 */
export function paintMask(object: any, fn: (mask: Uint8ClampedArray, w: number, h: number) => void) {
  if (!hasMask(object)) return;
  const w = object.maskW, h = object.maskH;
  fn(object.maskData, w, h);
  object.clipPath.setElement(maskCanvasFrom(object.maskData, w, h));
  object.canvas?.requestRenderAll();
}

/** Bake the mask into the object's pixels and drop the clip. */
export function applyMask(object: any) {
  if (!hasMask(object)) return;
  const w = object.maskW, h = object.maskH;
  const el = object.getElement?.();
  if (el && el.width && el.height) {
    try {
      const tc = document.createElement("canvas");
      tc.width = el.width;
      tc.height = el.height;
      const tg = tc.getContext("2d");
      if (tg) {
        const id = tg.getImageData(0, 0, el.width, el.height);
        for (let y = 0; y < el.height; y++) {
          for (let x = 0; x < el.width; x++) {
            const mx = Math.min(w - 1, Math.floor((x * w) / el.width));
            const my = Math.min(h - 1, Math.floor((y * h) / el.height));
            const i = (y * el.width + x) * 4;
            id.data[i + 3] = Math.round((id.data[i + 3] * object.maskData[my * w + mx]) / 255);
          }
        }
        tg.putImageData(id, 0, 0);
        const prev = {
          left: object.left, top: object.top,
          scaleX: object.scaleX, scaleY: object.scaleY,
          angle: object.angle, opacity: object.opacity, visible: object.visible,
          id: object.kaypaintId ?? object.id,
        };
        object.setElement(tc);
        object.set({
          left: prev.left, top: prev.top,
          scaleX: prev.scaleX, scaleY: prev.scaleY,
          angle: prev.angle, opacity: prev.opacity, visible: prev.visible,
        });
        if (prev.id !== undefined) object.kaypaintId = prev.id;
      }
    } catch {
      /* fall through: still drop the clip */
    }
  }
  object.clipPath = null;
  object.maskData = null;
  object.maskW = undefined;
  object.maskH = undefined;
  object.setCoords();
  object.canvas?.requestRenderAll();
}

export function maskClipElement(object: any): HTMLCanvasElement {
  const w = object.maskW, h = object.maskH;
  return maskCanvasFrom(object.maskData, w, h);
}