/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pure-JS content-aware inpaint fallback.
 *
 * Two-stage fill that runs off the main thread via the pixel worker:
 *  1. A nearest-known BFS fill seeds every masked pixel (Voronoi fill keeps
 *     hard edges and textures intact).
 *  2. Edge-preserving (Perona–Malik style) diffusion smooths the seams — the
 *     conductivity of each neighbor depends on the local gradient, so flat
 *     areas blend smoothly while strong edges are left sharp.
 *
 * Pure and node-testable; the worker mirrors this exactly (parity is enforced
 * by the pixel-worker test).
 */

export interface InpaintResult {
  data: Uint8ClampedArray;
  iterations: number;
}

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function inpaintFallback(
  src: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  maxIterations = 100000
): InpaintResult {
  const n = w * h;
  const out = new Uint8ClampedArray(src);

  let masked = 0;
  for (let i = 0; i < n; i++) if (mask[i] > 16) masked++;
  if (masked === 0) return { data: out, iterations: 0 };

  // ---- Stage 1: nearest-known BFS fill (seeds the hole) ----
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i] <= 16) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  let iterations = 0;
  while (head < tail && iterations < maxIterations) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;
    const d = dist[idx] + 1;
    const si = idx * 4;
    const nb = (j: number) => {
      if (dist[j] < 0) {
        dist[j] = d;
        out[j * 4] = out[si];
        out[j * 4 + 1] = out[si + 1];
        out[j * 4 + 2] = out[si + 2];
        queue[tail++] = j;
      }
    };
    if (x > 0) nb(idx - 1);
    if (x < w - 1) nb(idx + 1);
    if (y > 0) nb(idx - w);
    if (y < h - 1) nb(idx + w);
    iterations++;
  }

  // ---- Stage 2: edge-preserving diffusion on the masked region ----
  const K = 30;
  const passes = Math.min(16, Math.max(3, Math.round(Math.sqrt(masked) / 8)));
  let cur = out;
  let nxt = new Uint8ClampedArray(out);

  for (let p = 0; p < passes; p++) {
    let changed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx] <= 16) continue;
        const o = idx * 4;
        const c0 = luma(cur[o], cur[o + 1], cur[o + 2]);
        let sr = 0, sg = 0, sb = 0, ws = 0;

        const acc = (j: number) => {
          const jj = j * 4;
          const dl = Math.abs(c0 - luma(cur[jj], cur[jj + 1], cur[jj + 2]));
          const cd = 1 / (1 + (dl / K) * (dl / K));
          sr += cur[jj] * cd;
          sg += cur[jj + 1] * cd;
          sb += cur[jj + 2] * cd;
          ws += cd;
        };
        if (x > 0) acc(idx - 1);
        if (x < w - 1) acc(idx + 1);
        if (y > 0) acc(idx - w);
        if (y < h - 1) acc(idx + w);

        if (ws > 0) {
          const nr = sr / ws;
          const ng = sg / ws;
          const nb2 = sb / ws;
          if (Math.abs(nr - cur[o]) + Math.abs(ng - cur[o + 1]) + Math.abs(nb2 - cur[o + 2]) > 0.5) changed++;
          nxt[o] = nr;
          nxt[o + 1] = ng;
          nxt[o + 2] = nb2;
        }
      }
    }
    const t = cur;
    cur = nxt;
    nxt = t;
    if (changed === 0) break;
  }

  return { data: cur, iterations: iterations + passes };
}
