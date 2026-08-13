/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { activeImageElement, cloneElementPixels } from "@/engine/warpShared";

type ProtectMode = "none" | "center" | "alpha";

/**
 * Content-aware scale via seam carving. Energy = RGBA gradient magnitude;
 * "center" protect multiplies energy x8 in the central 25% region, "alpha"
 * protect weights energy by (1 + 3 * alpha). Low-energy seams are removed
 * (shrink) or duplicated (grow) iteratively until the target size is met.
 */
export async function contentAwareScale(canvas: any) {
  const read = activeImageElement(canvas);
  if (!read) return;
  const { el } = read;
  const width = el.width;
  const height = el.height;
  const work = cloneElementPixels(el);
  const srcData = work.getContext("2d")!.getImageData(0, 0, width, height).data;

  const res = await showOptions({
    title: "Content-Aware Scale",
    fields: [
      { key: "width", label: "Target Width", type: "number", min: 1, max: 20000, step: 1, value: width },
      { key: "height", label: "Target Height", type: "number", min: 1, max: 20000, step: 1, value: height },
      {
        key: "protect",
        label: "Protect",
        type: "select",
        value: "center",
        options: [
          { value: "none", label: "None" },
          { value: "center", label: "Center" },
          { value: "alpha", label: "Alpha" },
        ],
      },
    ],
    okLabel: "Scale",
  });
  if (!res) return;

  let tw = Math.max(1, Math.round(Number(res.width ?? width)));
  let th = Math.max(1, Math.round(Number(res.height ?? height)));
  tw = Math.min(tw, width * 2);
  th = Math.min(th, height * 2);
  const protect: ProtectMode = res.protect === "alpha" || res.protect === "center" ? res.protect : "none";

  const dw = Math.abs(tw - width);
  const dh = Math.abs(th - height);
  if (dw + dh === 0) return;
  if (dw > 300 || dh > 300) window.alert("Large resize may take a while.");

  let buf: Uint8ClampedArray<ArrayBufferLike> = new Uint8ClampedArray(srcData);
  let w = width;
  let h = height;

  while (w > tw) {
    buf = removeVerticalSeam(buf, w, h, protect);
    w--;
  }
  while (w < tw) {
    buf = insertVerticalSeam(buf, w, h, protect);
    w++;
  }
  while (h > th) {
    const t = transpose(buf, w, h);
    const r = removeVerticalSeam(t, h, w, protect);
    buf = transpose(r, h - 1, w);
    h--;
  }
  while (h < th) {
    const t = transpose(buf, w, h);
    const r = insertVerticalSeam(t, h, w, protect);
    buf = transpose(r, h + 1, w);
    h++;
  }

  await applyPixelsToActiveLayer(canvas, (out) => {
    out.set(buf);
  });
}

function transpose(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = (x * h + y) * 4;
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = data[i + 3];
    }
  }
  return out;
}

function buildEnergy(data: Uint8ClampedArray, w: number, h: number, protect: ProtectMode): Float32Array {
  const e = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];

      const xm = x > 0 ? (y * w + x - 1) * 4 : i;
      const xp = x < w - 1 ? (y * w + x + 1) * 4 : i;
      const ym = y > 0 ? ((y - 1) * w + x) * 4 : i;
      const yp = y < h - 1 ? ((y + 1) * w + x) * 4 : i;

      const gx =
        Math.abs(data[xp] - data[xm]) +
        Math.abs(data[xp + 1] - data[xm + 1]) +
        Math.abs(data[xp + 2] - data[xm + 2]) +
        Math.abs(data[xp + 3] - data[xm + 3]);
      const gy =
        Math.abs(data[yp] - data[ym]) +
        Math.abs(data[yp + 1] - data[ym + 1]) +
        Math.abs(data[yp + 2] - data[ym + 2]) +
        Math.abs(data[yp + 3] - data[ym + 3]);

      let energy = gx + gy;
      if (protect === "center") {
        const inX = x >= w * 0.375 && x <= w * 0.625;
        const inY = y >= h * 0.375 && y <= h * 0.625;
        if (inX && inY) energy *= 8;
      } else if (protect === "alpha") {
        energy *= 1 + (3 * a) / 255;
      }
      e[y * w + x] = energy;
    }
  }
  return e;
}

/** Lowest-energy vertical seam via dynamic programming → array of column indices. */
function findVerticalSeam(e: Float32Array, w: number, h: number): Int32Array {
  const dp = new Float32Array(e);
  const bt = new Int32Array(w * h);
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = dp[(y - 1) * w + x];
      let bx = x;
      if (x > 0 && dp[(y - 1) * w + x - 1] < best) {
        best = dp[(y - 1) * w + x - 1];
        bx = x - 1;
      }
      if (x < w - 1 && dp[(y - 1) * w + x + 1] < best) {
        best = dp[(y - 1) * w + x + 1];
        bx = x + 1;
      }
      dp[y * w + x] += best;
      bt[y * w + x] = bx;
    }
  }
  const seam = new Int32Array(h);
  let c = 0;
  for (let x = 1; x < w; x++) {
    if (dp[(h - 1) * w + x] < dp[(h - 1) * w + c]) c = x;
  }
  seam[h - 1] = c;
  for (let y = h - 1; y > 0; y--) seam[y - 1] = bt[y * w + seam[y]];
  return seam;
}

function removeVerticalSeam(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  protect: ProtectMode
): Uint8ClampedArray {
  const e = buildEnergy(data, w, h, protect);
  const seam = findVerticalSeam(e, w, h);
  const out = new Uint8ClampedArray((w - 1) * h * 4);
  for (let y = 0; y < h; y++) {
    const c = seam[y];
    const rowStart = y * w * 4;
    out.set(data.subarray(rowStart, rowStart + c * 4), y * (w - 1) * 4);
    out.set(data.subarray(rowStart + (c + 1) * 4, rowStart + w * 4), y * (w - 1) * 4 + c * 4);
  }
  return out;
}

function insertVerticalSeam(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  protect: ProtectMode
): Uint8ClampedArray {
  const e = buildEnergy(data, w, h, protect);
  const seam = findVerticalSeam(e, w, h);
  const out = new Uint8ClampedArray((w + 1) * h * 4);
  for (let y = 0; y < h; y++) {
    const c = seam[y];
    const rowStart = y * w * 4;
    const outRow = y * (w + 1) * 4;
    out.set(data.subarray(rowStart, rowStart + (c + 1) * 4), outRow);
    const px = rowStart + c * 4;
    out[outRow + (c + 1) * 4] = data[px];
    out[outRow + (c + 1) * 4 + 1] = data[px + 1];
    out[outRow + (c + 1) * 4 + 2] = data[px + 2];
    out[outRow + (c + 1) * 4 + 3] = data[px + 3];
    out.set(data.subarray(rowStart + (c + 1) * 4, rowStart + w * 4), outRow + (c + 2) * 4);
  }
  return out;
}
