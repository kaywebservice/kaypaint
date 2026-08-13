/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function boxBlurMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
) {
  if (radius <= 0) return;
  const out = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ya = Math.max(0, y - radius);
      const yb = Math.min(h - 1, y + radius);
      const xa = Math.max(0, x - radius);
      const xb = Math.min(w - 1, x + radius);
      let sum = 0;
      let n = 0;
      for (let yy = ya; yy <= yb; yy++) {
        for (let xx = xa; xx <= xb; xx++) {
          sum += mask[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  mask.set(out);
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const point = getPointer(canvas, e.e);
    const target = canvas.findTarget?.(e.e);
    if (!target || target.type !== "image") return;

    const el = target.getElement?.();
    if (!el) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = target.width || 1;
    tempCanvas.height = target.height || 1;
    const tctx = tempCanvas.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(el, 0, 0, tempCanvas.width, tempCanvas.height);

    const localX = Math.floor((point.x - target.left) * (tempCanvas.width / (target.width * target.scaleX)));
    const localY = Math.floor((point.y - target.top) * (tempCanvas.height / (target.height * target.scaleY)));
    if (localX < 0 || localY < 0 || localX >= tempCanvas.width || localY >= tempCanvas.height) return;

    const w = tempCanvas.width;
    const h = tempCanvas.height;
    const imgData = tctx.getImageData(0, 0, w, h);
    const seed = tctx.getImageData(localX, localY, 1, 1).data;
    const tolerance = clamp(Number(ctx.get("tolerance") ?? 30), 1, 150);
    const feather = clamp(Number(ctx.get("feather") ?? 0), 0, 16);

    const mask = new Uint8ClampedArray(w * h);
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const start = localY * w + localX;
    visited[start] = 1;
    queue[tail++] = start;

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % w;
      const y = (idx / w) | 0;
      const o = idx * 4;
      const dr = imgData.data[o] - seed[0];
      const dg = imgData.data[o + 1] - seed[1];
      const db = imgData.data[o + 2] - seed[2];
      if (Math.hypot(dr, dg, db) > tolerance) continue;

      mask[idx] = 255;
      if (x > 0 && !visited[idx - 1]) {
        visited[idx - 1] = 1;
        queue[tail++] = idx - 1;
      }
      if (x < w - 1 && !visited[idx + 1]) {
        visited[idx + 1] = 1;
        queue[tail++] = idx + 1;
      }
      if (y > 0 && !visited[idx - w]) {
        visited[idx - w] = 1;
        queue[tail++] = idx - w;
      }
      if (y < h - 1 && !visited[idx + w]) {
        visited[idx + w] = 1;
        queue[tail++] = idx + w;
      }
    }

    if (feather > 0) boxBlurMask(mask, w, h, feather);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const octx = outCanvas.getContext("2d");
    if (!octx) return;
    const outData = octx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
      const alpha = mask[i];
      outData.data[i * 4] = imgData.data[i * 4];
      outData.data[i * 4 + 1] = imgData.data[i * 4 + 1];
      outData.data[i * 4 + 2] = imgData.data[i * 4 + 2];
      outData.data[i * 4 + 3] = alpha;
    }
    octx.putImageData(outData, 0, 0);

    target.setSrc(outCanvas.toDataURL()).then(() => {
      target.setCoords();
      canvas.requestRenderAll();
      ctx.push();
    });
  };

  canvas.on("mouse:down", down);

  return () => {
    canvas.off("mouse:down", down);
    canvas.requestRenderAll();
  };
}