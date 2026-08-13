/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function mirror(i: number, n: number): number {
  if (i < 0) return -i;
  if (i >= n) return 2 * n - 2 - i;
  return i;
}

function buildKernels(angle: number, length: number): { kx: Float64Array; ky: Float64Array } {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const R = Math.max(1, Math.ceil(length / 2));
  const steps = Math.max(2, Math.round(length));
  const kx = new Float64Array(2 * R + 1);
  const ky = new Float64Array(2 * R + 1);
  for (let s = 0; s <= steps; s++) {
    const f = (s / steps) * length - length / 2;
    const px = Math.round(f * dx);
    const py = Math.round(f * dy);
    if (Math.abs(px) <= R) kx[px + R] += 1;
    if (Math.abs(py) <= R) ky[py + R] += 1;
  }
  let sx = 0;
  for (let i = 0; i < kx.length; i++) sx += kx[i];
  if (sx > 0) for (let i = 0; i < kx.length; i++) kx[i] /= sx;
  let sy = 0;
  for (let i = 0; i < ky.length; i++) sy += ky[i];
  if (sy > 0) for (let i = 0; i < ky.length; i++) ky[i] /= sy;
  return { kx, ky };
}

function extent(k: Float64Array): { lo: number; hi: number } {
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < k.length; i++) {
    if (k[i] !== 0) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  return { lo, hi };
}

function conv1D(
  src: Float64Array,
  dst: Float64Array,
  w: number,
  h: number,
  kern: Float64Array,
  horizontal: boolean
) {
  const R = (kern.length - 1) / 2;
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let t = -R; t <= R; t++) {
          s += src[row + mirror(x + t, w)] * kern[t + R];
        }
        dst[row + x] = s;
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let t = -R; t <= R; t++) {
          s += src[mirror(y + t, h) * w + x] * kern[t + R];
        }
        dst[y * w + x] = s;
      }
    }
  }
}

function lucyRichardson(
  y: Float64Array,
  est: Float64Array,
  kx: Float64Array,
  ky: Float64Array,
  kxExt: { lo: number; hi: number } | null,
  kyExt: { lo: number; hi: number } | null,
  w: number,
  h: number,
  iterations: number,
  blurred: Float64Array,
  ratio: Float64Array,
  mid: Float64Array
) {
  const n = w * h;
  const hasX = !!kxExt && kxExt.hi - kxExt.lo > 0;
  const hasY = !!kyExt && kyExt.hi - kyExt.lo > 0;
  for (let iter = 0; iter < iterations; iter++) {
    if (hasX) {
      conv1D(est, mid, w, h, kx, true);
      if (hasY) conv1D(mid, blurred, w, h, ky, false);
      else blurred.set(mid);
    } else {
      if (hasY) conv1D(est, blurred, w, h, ky, false);
      else blurred.set(est);
    }
    for (let i = 0; i < n; i++) {
      ratio[i] = (y[i] + 1e-6) / (blurred[i] + 1e-6);
    }
    if (hasX) {
      conv1D(ratio, mid, w, h, kx, true);
      if (hasY) conv1D(mid, blurred, w, h, ky, false);
      else blurred.set(mid);
    } else {
      if (hasY) conv1D(ratio, blurred, w, h, ky, false);
      else blurred.set(ratio);
    }
    for (let i = 0; i < n; i++) {
      est[i] = Math.max(0, est[i] * blurred[i]);
    }
  }
}

export async function cameraShake(canvas: any): Promise<boolean> {
  const res = await showOptions({
    title: "Shake Reduction",
    fields: [
      { key: "angle", label: "Angle", type: "slider", value: 0, min: -180, max: 180, suffix: " °" },
      { key: "length", label: "Blur Length", type: "slider", value: 10, min: 1, max: 50, suffix: " px" },
      { key: "iterations", label: "Iterations", type: "slider", value: 6, min: 1, max: 10, suffix: "" },
    ],
  });
  if (!res) return false;
  const angle = Number(res.angle ?? 0);
  const length = Number(res.length ?? 10);
  const iterations = Number(res.iterations ?? 6);
  return applyPixelsToActiveLayer(canvas, (data, w, h) => {
    const { kx, ky } = buildKernels(angle, length);
    const kxExt = extent(kx);
    const kyExt = extent(ky);
    const n = w * h;
    const mid = new Float64Array(n);
    const blurred = new Float64Array(n);
    const ratio = new Float64Array(n);
    for (let c = 0; c < 3; c++) {
      const y = new Float64Array(n);
      const est = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        y[i] = data[i * 4 + c];
        est[i] = y[i];
      }
      lucyRichardson(y, est, kx, ky, kxExt, kyExt, w, h, iterations, blurred, ratio, mid);
      for (let i = 0; i < n; i++) {
        data[i * 4 + c] = clamp(est[i], 0, 255);
      }
    }
  });
}
