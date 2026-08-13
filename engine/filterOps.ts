export type FilterParams = Record<string, unknown>;

export function numP(p: FilterParams, key: string, dflt: number): number {
  const v = p[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
}

export function strP(p: FilterParams, key: string, dflt: string): string {
  const v = p[key];
  return typeof v === "string" && v.length > 0 ? v : dflt;
}

export function boolP(p: FilterParams, key: string, dflt = false): boolean {
  const v = p[key];
  return typeof v === "boolean" ? v : dflt;
}

type OpFn = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: FilterParams
) => void;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashNoise = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function gaussKernel(radius: number): { k: Float64Array; m: number; stride: number } {
  const r = Math.max(1, Math.round(radius));
  const stride = r > 48 ? Math.ceil(r / 48) : 1;
  const m = Math.max(1, Math.round(r / stride));
  const k = new Float64Array(m * 2 + 1);
  const sig = Math.max(0.6, radius / 3);
  let sum = 0;
  for (let s = -m; s <= m; s++) {
    const v = Math.exp(-((s * stride) * (s * stride)) / (2 * sig * sig));
    k[s + m] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return { k, m, stride };
}

function separable(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  kern: Float64Array,
  m: number,
  stride: number
): void {
  const src = new Uint8ClampedArray(data);
  const midLen = w * h * 4;
  const mid = new Float64Array(midLen);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let ks = 0; ks < kern.length; ks++) {
        const k = (ks - m) * stride;
        const kx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        const i = (row + kx) * 4;
        const a = src[i + 3];
        const wt = kern[ks] * a;
        rs += src[i] * wt;
        gs += src[i + 1] * wt;
        bs += src[i + 2] * wt;
        as += wt;
      }
      const o = (row + x) * 4;
      if (as > 0) {
        mid[o] = rs / as;
        mid[o + 1] = gs / as;
        mid[o + 2] = bs / as;
      }
      mid[o + 3] = as;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let ks = 0; ks < kern.length; ks++) {
        const k = (ks - m) * stride;
        const ky = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        const i = (ky * w + x) * 4;
        const a = mid[i + 3];
        const wt = kern[ks] * a;
        rs += mid[i] * wt;
        gs += mid[i + 1] * wt;
        bs += mid[i + 2] * wt;
        as += wt;
      }
      const o = (y * w + x) * 4;
      if (as > 0) {
        data[o] = rs / as;
        data[o + 1] = gs / as;
        data[o + 2] = bs / as;
        data[o + 3] = as;
      } else {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
      }
    }
  }
}

function boxKernel(data: Uint8ClampedArray, w: number, h: number, r: number): void {
  const n = r * 2 + 1;
  const src = new Uint8ClampedArray(data);
  const midLen = w * h * 4;
  const mid = new Float64Array(midLen);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let x = -r; x <= r; x++) {
      const kx = x < 0 ? 0 : x >= w ? w - 1 : x;
      const i = (row + kx) * 4;
      rs += src[i] * src[i + 3];
      gs += src[i + 1] * src[i + 3];
      bs += src[i + 2] * src[i + 3];
      as += src[i + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 4;
      if (as > 0) {
        mid[o] = rs / as;
        mid[o + 1] = gs / as;
        mid[o + 2] = bs / as;
      }
      mid[o + 3] = as / n;
      const inx = x + r + 1 < w ? x + r + 1 : w - 1;
      const outx = x - r >= 0 ? x - r : 0;
      const ii = (row + inx) * 4;
      const oi = (row + outx) * 4;
      rs += src[ii] * src[ii + 3] - src[oi] * src[oi + 3];
      gs += src[ii + 1] * src[ii + 3] - src[oi + 1] * src[oi + 3];
      bs += src[ii + 2] * src[ii + 3] - src[oi + 2] * src[oi + 3];
      as += src[ii + 3] - src[oi + 3];
    }
  }
  for (let x = 0; x < w; x++) {
    let rs = 0, gs = 0, bs = 0, as = 0;
    for (let k = -r; k <= r; k++) {
      const ky = k < 0 ? 0 : k >= h ? h - 1 : k;
      const i = (ky * w + x) * 4;
      const a = mid[i + 3];
      rs += mid[i] * a;
      gs += mid[i + 1] * a;
      bs += mid[i + 2] * a;
      as += a;
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      if (as > 0) {
        data[o] = rs / as;
        data[o + 1] = gs / as;
        data[o + 2] = bs / as;
      }
      data[o + 3] = as / n;
      const iny = y + r + 1 < h ? y + r + 1 : h - 1;
      const outy = y - r >= 0 ? y - r : 0;
      const ii = (iny * w + x) * 4;
      const oi = (outy * w + x) * 4;
      rs += mid[ii] * mid[ii + 3] - mid[oi] * mid[oi + 3];
      gs += mid[ii + 1] * mid[ii + 3] - mid[oi + 1] * mid[oi + 3];
      bs += mid[ii + 2] * mid[ii + 3] - mid[oi + 2] * mid[oi + 3];
      as += mid[ii + 3] - mid[oi + 3];
    }
  }
}

function lumAt(b: Uint8ClampedArray, o: number): number {
  return 0.299 * b[o] + 0.587 * b[o + 1] + 0.114 * b[o + 2];
}

function meanColor(data: Uint8ClampedArray, n: number): [number, number, number] {
  let r = 0, g = 0, b = 0, a = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const al = data[o + 3];
    r += data[o] * al;
    g += data[o + 1] * al;
    b += data[o + 2] * al;
    a += al;
  }
  if (a <= 0) return [128, 128, 128];
  return [r / a, g / a, b / a];
}

function bilinear(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  fx: number,
  fy: number,
  out: Float32Array
): void {
  let x = fx, y = fy;
  if (x < 0) x = 0;
  else if (x >= w) x = w - 1;
  if (y < 0) y = 0;
  else if (y >= h) y = h - 1;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const t = x - x0;
  const u = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y1 * w + x0) * 4;
  const i01 = (y0 * w + x1) * 4;
  const i11 = (y1 * w + x1) * 4;
  const w00 = (1 - t) * (1 - u);
  const w10 = (1 - t) * u;
  const w01 = t * (1 - u);
  const w11 = t * u;
  out[0] = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
  out[1] = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11;
  out[2] = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11;
  out[3] = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
}

function medianAt(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  r: number,
  stride: number,
  med: number[]
): void {
  const keys: number[] = [];
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const as: number[] = [];
  for (let dy = -r; dy <= r; dy += stride) {
    const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
    for (let dx = -r; dx <= r; dx += stride) {
      const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
      const i = (ky * w + kx) * 4;
      const rr = src[i], gg = src[i + 1], bb = src[i + 2], aa = src[i + 3];
      keys.push(0.299 * rr + 0.587 * gg + 0.114 * bb + (255 - aa) * 2);
      rs.push(rr);
      gs.push(gg);
      bs.push(bb);
      as.push(aa);
    }
  }
  const idx = keys.map((_, i) => i).sort((a, b) => keys[a] - keys[b]);
  const m = idx[Math.floor(idx.length / 2)];
  med[0] = rs[m];
  med[1] = gs[m];
  med[2] = bs[m];
  med[3] = as[m];
}

function valueNoise(
  w: number,
  h: number,
  cell: number,
  seed: number,
  out: Float32Array
): void {
  const rnd = mulberry32(seed);
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const lat = new Float32Array(cols * rows);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  for (let y = 0; y < h; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const wy = fy * fy * (3 - 2 * fy);
    const row0 = y0 * cols;
    const row1 = (y0 + 1) * cols;
    for (let x = 0; x < w; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const wx = fx * fx * (3 - 2 * fx);
      const v00 = lat[row0 + x0];
      const v01 = lat[row0 + x0 + 1];
      const v10 = lat[row1 + x0];
      const v11 = lat[row1 + x0 + 1];
      out[y * w + x] =
        v00 + (v01 - v00) * wx + (v10 + (v11 - v10) * wx - v00 - (v01 - v00) * wx) * wy;
    }
  }
}

function vnoise2(w: number, h: number, seed: number): Float32Array {
  const a = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const cell = Math.max(2, Math.round(Math.min(w, h) / 10));
  valueNoise(w, h, cell, seed, a);
  valueNoise(w, h, Math.max(2, Math.floor(cell / 2)), seed ^ 0x9e3779b9, b);
  for (let i = 0; i < out.length; i++) out[i] = (0.5 * a[i] + 0.25 * b[i]) * 1.3333;
  return out;
}

function gaussianBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const radius = clamp(numP(p, "radius", 2), 0.5, 250);
  const g = gaussKernel(radius);
  separable(data, w, h, g.k, g.m, g.stride);
}

function boxBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  boxKernel(data, w, h, clamp(Math.round(numP(p, "radius", 3)), 1, 250));
}

function motionBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const ang = numP(p, "angle", 0);
  const dist = clamp(Math.round(numP(p, "distance", 10)), 1, 999);
  const rad = (ang * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const N = Math.max(8, Math.min(160, Math.round(dist / 6)));
  const step = dist / N;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let t = 0; t < N; t++) {
        const f = (t - (N - 1) / 2) * step;
        const sx = x + dx * f;
        const sy = y + dy * f;
        const ix = sx < 0 ? 0 : sx >= w ? w - 1 : Math.round(sx);
        const iy = sy < 0 ? 0 : sy >= h ? h - 1 : Math.round(sy);
        const i = (iy * w + ix) * 4;
        const a = src[i + 3];
        rs += src[i] * a;
        gs += src[i + 1] * a;
        bs += src[i + 2] * a;
        as += a;
      }
      const o = (y * w + x) * 4;
      if (as > 0) {
        data[o] = rs / as;
        data[o + 1] = gs / as;
        data[o + 2] = bs / as;
      }
      data[o + 3] = as / N;
    }
  }
}

function radialBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amount = clamp(numP(p, "amount", 10), 0, 100);
  const zoom = strP(p, "method", "Zoom") === "Zoom";
  const frac = amount / 100;
  const src = new Uint8ClampedArray(data);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  const N = 24;
  const scratch = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vx = x - cx;
      const vy = y - cy;
      const r = Math.hypot(vx, vy);
      const a0 = Math.atan2(vy, vx);
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let t = 0; t < N; t++) {
        const f = t / (N - 1) - 0.5;
        let sx: number, sy: number;
        if (zoom) {
          const sc = 1 - frac * (0.5 + f);
          const rr = Math.min(r * sc, maxR);
          sx = cx + Math.cos(a0) * rr;
          sy = cy + Math.sin(a0) * rr;
        } else {
          const da = frac * Math.PI * f;
          sx = cx + Math.cos(a0 + da) * r;
          sy = cy + Math.sin(a0 + da) * r;
        }
        bilinear(src, w, h, sx, sy, scratch);
        const a = scratch[3];
        rs += scratch[0] * a;
        gs += scratch[1] * a;
        bs += scratch[2] * a;
        as += a;
      }
      const o = (y * w + x) * 4;
      if (as > 0) {
        data[o] = rs / as;
        data[o + 1] = gs / as;
        data[o + 2] = bs / as;
      }
      data[o + 3] = as / N;
    }
  }
}

function average(data: Uint8ClampedArray, w: number, h: number): void {
  const n = w * h;
  const m = meanColor(data, n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    data[o] = m[0];
    data[o + 1] = m[1];
    data[o + 2] = m[2];
  }
}

function blurMore(data: Uint8ClampedArray, w: number, h: number): void {
  boxKernel(data, w, h, 1);
}

function lensBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const radius = clamp(numP(p, "radius", 5), 1, 100);
  const bright = clamp(numP(p, "brightness", 10), 0, 100) / 100;
  const g = gaussKernel(radius);
  separable(data, w, h, g.k, g.m, g.stride);
  for (let i = 0; i < w * h * 4; i += 4) {
    data[i] += (255 - data[i]) * bright * 0.4;
    data[i + 1] += (255 - data[i + 1]) * bright * 0.4;
    data[i + 2] += (255 - data[i + 2]) * bright * 0.4;
  }
}

function shapeBlur(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const r = clamp(Math.round(numP(p, "radius", 10)), 1, 100);
  const shape = strP(p, "shape", "Circle");
  const stride = r > 12 ? Math.ceil(r / 12) : 1;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let dy = -r; dy <= r; dy += stride) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -r; dx <= r; dx += stride) {
          const inShape =
            shape === "Square"
              ? true
              : shape === "Diamond"
                ? Math.abs(dx) + Math.abs(dy) <= r
                : dx * dx + dy * dy <= r * r;
          if (!inShape) continue;
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky * w + kx) * 4;
          const a = src[i + 3];
          rs += src[i] * a;
          gs += src[i + 1] * a;
          bs += src[i + 2] * a;
          as += a;
        }
      }
      const o = (y * w + x) * 4;
      if (as > 0) {
        data[o] = rs / as;
        data[o + 1] = gs / as;
        data[o + 2] = bs / as;
      }
      data[o + 3] = as;
    }
  }
}

function kernel3(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  k: number[],
  strength: number
): void {
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky * w + kx) * 4;
          const wt = k[(dy + 1) * 3 + (dx + 1)] * src[i + 3];
          rs += src[i] * wt;
          gs += src[i + 1] * wt;
          bs += src[i + 2] * wt;
          as += wt;
        }
      }
      const o = (y * w + x) * 4;
      if (as > 0) {
        const ir = rs / as, ig = gs / as, ib = bs / as;
        data[o] = src[o] + (ir - src[o]) * strength;
        data[o + 1] = src[o + 1] + (ig - src[o + 1]) * strength;
        data[o + 2] = src[o + 2] + (ib - src[o + 2]) * strength;
      }
      data[o + 3] = src[o + 3];
    }
  }
}

function sharpen(data: Uint8ClampedArray, w: number, h: number): void {
  kernel3(data, w, h, [0, -1, 0, -1, 5, -1, 0, -1, 0], 0.8);
}

function sharpenMore(data: Uint8ClampedArray, w: number, h: number): void {
  kernel3(data, w, h, [-1, -1, -1, -1, 9, -1, -1, -1, -1], 0.6);
}

function sharpenEdges(data: Uint8ClampedArray, w: number, h: number): void {
  kernel3(data, w, h, [0, -1, 0, -1, 4, -1, 0, -1, 0], 1.3);
}

function unsharpMask(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amount = clamp(numP(p, "amount", 100), 0, 500) / 100;
  const radius = clamp(numP(p, "radius", 1), 0.5, 250);
  const thresh = clamp(numP(p, "threshold", 0), 0, 255);
  const orig = new Uint8ClampedArray(data);
  const g = gaussKernel(radius);
  separable(data, w, h, g.k, g.m, g.stride);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (Math.abs(lumAt(orig, o) - lumAt(data, o)) > thresh) {
      data[o] = clamp(orig[o] + (orig[o] - data[o]) * amount, 0, 255);
      data[o + 1] = clamp(orig[o + 1] + (orig[o + 1] - data[o + 1]) * amount, 0, 255);
      data[o + 2] = clamp(orig[o + 2] + (orig[o + 2] - data[o + 2]) * amount, 0, 255);
    } else {
      data[o] = orig[o];
      data[o + 1] = orig[o + 1];
      data[o + 2] = orig[o + 2];
    }
    data[o + 3] = orig[o + 3];
  }
}

function smartSharpen(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amount = clamp(numP(p, "amount", 100), 0, 500) / 100;
  const radius = clamp(numP(p, "radius", 1), 0.5, 250);
  const rn = strP(p, "reduceNoise", "None");
  const pre = rn === "Low" ? 0.6 : rn === "Medium" ? 1.2 : rn === "High" ? 2 : 0;
  const orig = new Uint8ClampedArray(data);
  let clean = orig;
  if (pre > 0) {
    clean = new Uint8ClampedArray(data);
    const gp = gaussKernel(pre);
    separable(clean, w, h, gp.k, gp.m, gp.stride);
  }
  const g = gaussKernel(radius);
  separable(data, w, h, g.k, g.m, g.stride);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = clamp(clean[o] + (clean[o] - data[o]) * amount, 0, 255);
    data[o + 1] = clamp(clean[o + 1] + (clean[o + 1] - data[o + 1]) * amount, 0, 255);
    data[o + 2] = clamp(clean[o + 2] + (clean[o + 2] - data[o + 2]) * amount, 0, 255);
    data[o + 3] = orig[o + 3];
  }
}

function emboss(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const ang = numP(p, "angle", 135);
  const height = clamp(numP(p, "height", 10), 1, 100);
  const amount = clamp(numP(p, "amount", 100), 0, 500) / 100;
  const rad = (ang * Math.PI) / 180;
  const kx = Math.cos(rad);
  const ky = Math.sin(rad);
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ky2 = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const kx2 = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky2 * w + kx2) * 4;
          const l = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
          c += (dx * kx + dy * ky) * l;
        }
      }
      const e = clamp(128 + (c / 3) * height * 0.6, 0, 255);
      const o = (y * w + x) * 4;
      data[o] = src[o] * (1 - amount) + e * amount;
      data[o + 1] = src[o + 1] * (1 - amount) + e * amount;
      data[o + 2] = src[o + 2] * (1 - amount) + e * amount;
      data[o + 3] = src[o + 3];
    }
  }
}

function findEdges(data: Uint8ClampedArray, w: number, h: number): void {
  const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const src = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + x + dx) * 4;
          const l = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
          const ki = (dy + 1) * 3 + dx + 1;
          gx += l * SOBEL_X[ki];
          gy += l * SOBEL_Y[ki];
        }
      }
      const m = clamp(Math.sqrt(gx * gx + gy * gy), 0, 255);
      const o = (y * w + x) * 4;
      const v = 255 - m;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
    }
  }
}

function solarize(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const t = clamp(numP(p, "threshold", 128), 0, 255);
  void h;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      data[i + c] = v >= t ? 255 - v : v;
    }
  }
}

function diffuse(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const mode = strP(p, "mode", "Normal");
  const src = new Uint8ClampedArray(data);
  const lums: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      lums.length = 0;
      let picked = o;
      for (let d = 0; d < 4; d++) {
        let nx = x, ny = y;
        if (d === 0) nx = x - 1;
        else if (d === 1) nx = x + 1;
        else if (d === 2) ny = y - 1;
        else ny = y + 1;
        if (nx < 0) nx = 0;
        else if (nx >= w) nx = w - 1;
        if (ny < 0) ny = 0;
        else if (ny >= h) ny = h - 1;
        const i = (ny * w + nx) * 4;
        lums.push(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
        if (mode === "Normal" && d === Math.floor(Math.random() * 4)) picked = i;
      }
      if (mode === "Darken Only") {
        let m = 1e9;
        for (let d = 0; d < 4; d++) {
          if (lums[d] < m) {
            m = lums[d];
            let nx = x, ny = y;
            if (d === 0) nx = x - 1;
            else if (d === 1) nx = x + 1;
            else if (d === 2) ny = y - 1;
            else ny = y + 1;
            picked = ((ny < 0 ? 0 : ny >= h ? h - 1 : ny) * w + (nx < 0 ? 0 : nx >= w ? w - 1 : nx)) * 4;
          }
        }
      } else if (mode === "Lighten Only") {
        let m = -1;
        for (let d = 0; d < 4; d++) {
          if (lums[d] > m) {
            m = lums[d];
            let nx = x, ny = y;
            if (d === 0) nx = x - 1;
            else if (d === 1) nx = x + 1;
            else if (d === 2) ny = y - 1;
            else ny = y + 1;
            picked = ((ny < 0 ? 0 : ny >= h ? h - 1 : ny) * w + (nx < 0 ? 0 : nx >= w ? w - 1 : nx)) * 4;
          }
        }
      }
      data[o] = src[picked];
      data[o + 1] = src[picked + 1];
      data[o + 2] = src[picked + 2];
      data[o + 3] = src[o + 3];
    }
  }
}

function wind(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const method = strP(p, "method", "Wind");
  const dir = strP(p, "direction", "From the Right");
  const passes = method === "Wind" ? 2 : method === "Blast" ? 4 : 6;
  const sign = dir === "From the Right" ? -1 : 1;
  const src = new Uint8ClampedArray(data);
  for (let pass = 0; pass < passes; pass++) {
    src.set(data);
    const shift = sign * (pass % 2 === 0 ? 1 : 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sx = x + shift;
        if (sx < 0) sx = 0;
        else if (sx >= w) sx = w - 1;
        const o = (y * w + x) * 4;
        const i = (y * w + sx) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      }
    }
  }
}

function tiles(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const n = clamp(Math.round(numP(p, "tiles", 6)), 2, 100);
  const off = clamp(numP(p, "offset", 20), 0, 99) / 100;
  const fill = strP(p, "fill", "Background");
  const src = new Uint8ClampedArray(data);
  let bg: [number, number, number] | null = null;
  if (fill !== "Unchanged") {
    const m = meanColor(src, w * h);
    bg = fill === "Inverse" ? [255 - m[0], 255 - m[1], 255 - m[2]] : m;
  }
  const cw = Math.max(1, w / n);
  const ch = Math.max(1, h / n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.min(n - 1, Math.floor(x / cw));
      const cy = Math.min(n - 1, Math.floor(y / ch));
      const parity = (cx + cy) % 2 === 0 ? 1 : -1;
      const shift = parity * off * cw * 0.5;
      const sx = Math.round(x - shift);
      const o = (y * w + x) * 4;
      if (sx >= 0 && sx < w) {
        const i = (y * w + sx) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (bg) {
        data[o] = bg[0];
        data[o + 1] = bg[1];
        data[o + 2] = bg[2];
        data[o + 3] = 255;
      } else {
        const i = (y * w + (sx < 0 ? 0 : w - 1)) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      }
    }
  }
}

function pinch(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amt = clamp(numP(p, "amount", 50), -100, 100) / 100;
  const f = amt * 0.9;
  const src = new Uint8ClampedArray(data);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  const scratch = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vx = x - cx;
      const vy = y - cy;
      const r = Math.hypot(vx, vy);
      const rr = Math.min(1, r / maxR);
      const a0 = Math.atan2(vy, vx);
      const s = 1 + f * (1 - rr);
      const sx = cx + Math.cos(a0) * r * s;
      const sy = cy + Math.sin(a0) * r * s;
      bilinear(src, w, h, sx, sy, scratch);
      const o = (y * w + x) * 4;
      data[o] = scratch[0];
      data[o + 1] = scratch[1];
      data[o + 2] = scratch[2];
      data[o + 3] = scratch[3];
    }
  }
}

function spherize(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amt = clamp(numP(p, "amount", 50), -100, 100) / 100;
  const mode = strP(p, "mode", "Normal");
  const f = amt * 0.9;
  const src = new Uint8ClampedArray(data);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const scratch = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n: number;
      let sx: number, sy: number;
      if (mode === "Horizontal Only") {
        n = cx > 0 ? Math.abs(x - cx) / cx : 0;
        const s = 1 + f * (1 - Math.min(1, n * n));
        sx = cx + (x - cx) * s;
        sy = y;
      } else if (mode === "Vertical Only") {
        n = cy > 0 ? Math.abs(y - cy) / cy : 0;
        const s = 1 + f * (1 - Math.min(1, n * n));
        sy = cy + (y - cy) * s;
        sx = x;
      } else {
        const rx = cx > 0 ? (x - cx) / cx : 0;
        const ry = cy > 0 ? (y - cy) / cy : 0;
        n = Math.sqrt(rx * rx + ry * ry);
        const s = 1 + f * (1 - Math.min(1, n * n));
        sx = cx + rx * s * cx;
        sy = cy + ry * s * cy;
      }
      bilinear(src, w, h, sx, sy, scratch);
      const o = (y * w + x) * 4;
      data[o] = scratch[0];
      data[o + 1] = scratch[1];
      data[o + 2] = scratch[2];
      data[o + 3] = scratch[3];
    }
  }
}

function twirl(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const ang = clamp(numP(p, "angle", 50), -999, 999);
  const rad = (ang * Math.PI) / 180;
  const src = new Uint8ClampedArray(data);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  const scratch = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vx = x - cx;
      const vy = y - cy;
      const r = Math.hypot(vx, vy);
      const rr = Math.min(1, r / maxR);
      const a0 = Math.atan2(vy, vx);
      const a1 = a0 + rad * (1 - rr);
      const sx = cx + Math.cos(a1) * r;
      const sy = cy + Math.sin(a1) * r;
      bilinear(src, w, h, sx, sy, scratch);
      const o = (y * w + x) * 4;
      data[o] = scratch[0];
      data[o + 1] = scratch[1];
      data[o + 2] = scratch[2];
      data[o + 3] = scratch[3];
    }
  }
}

function ripple(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amount = clamp(numP(p, "amount", 100), -999, 999);
  const size = strP(p, "size", "Medium");
  const wave = size === "Small" ? 80 : size === "Large" ? 320 : 160;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    const sn = Math.sin((2 * Math.PI * y) / wave);
    const shift = amount * sn;
    for (let x = 0; x < w; x++) {
      const sx = Math.round(x + shift);
      const kx = sx < 0 ? 0 : sx >= w ? w - 1 : sx;
      const i = (y * w + kx) * 4;
      const o = (y * w + x) * 4;
      data[o] = src[i];
      data[o + 1] = src[i + 1];
      data[o + 2] = src[i + 2];
      data[o + 3] = src[i + 3];
    }
  }
}

function shear(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const offset = clamp(numP(p, "offset", 0), -100, 100);
  const fill = strP(p, "fill", "Wrap Around");
  const src = new Uint8ClampedArray(data);
  let bg: [number, number, number] | null = null;
  if (fill === "Set to Background") bg = meanColor(src, w * h);
  for (let y = 0; y < h; y++) {
    const sh = (offset / 100) * (w / 2) * ((2 * y) / Math.max(1, h - 1) - 1);
    for (let x = 0; x < w; x++) {
      const sx = x + sh;
      const o = (y * w + x) * 4;
      if (sx >= 0 && sx < w) {
        const i = (y * w + Math.round(sx)) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (fill === "Wrap Around") {
        const wx2 = ((Math.round(sx) % w) + w) % w;
        const i = (y * w + wx2) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (fill === "Repeat Edge") {
        const kx = sx < 0 ? 0 : w - 1;
        const i = (y * w + kx) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (bg) {
        data[o] = bg[0];
        data[o + 1] = bg[1];
        data[o + 2] = bg[2];
      }
    }
  }
}

function displace(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const hs = clamp(numP(p, "horizontal", 20), 0, 100) / 100;
  const vs = clamp(numP(p, "vertical", 20), 0, 100) / 100;
  const src = new Uint8ClampedArray(data);
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2];
  }
  const lap = new Float32Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = lum[i - w] + lum[i + w] + lum[i - 1] + lum[i + 1] - 4 * lum[i];
      lap[i] = v;
      const a = Math.abs(v);
      if (a > max) max = a;
    }
  }
  const n = max || 1;
  const scratch = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = lap[y * w + x] / n;
      const sx = x + d * hs * (w / 2);
      const sy = y + d * vs * (h / 2);
      bilinear(src, w, h, sx, sy, scratch);
      const o = (y * w + x) * 4;
      data[o] = scratch[0];
      data[o + 1] = scratch[1];
      data[o + 2] = scratch[2];
      data[o + 3] = scratch[3];
    }
  }
}

function clouds(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const seed = clamp(Math.round(numP(p, "seed", Math.floor(Math.random() * 1e9))), 1, 2147483647);
  const n = vnoise2(w, h, seed);
  const m = meanColor(data, w * h);
  for (let i = 0; i < w * h; i++) {
    const t = n[i];
    const k = 0.35 + 1.3 * t;
    const o = i * 4;
    data[o] = m[0] * k;
    data[o + 1] = m[1] * k;
    data[o + 2] = m[2] * k;
  }
}

function differenceClouds(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const seed = clamp(Math.round(numP(p, "seed", Math.floor(Math.random() * 1e9))), 1, 2147483647);
  const n = vnoise2(w, h, seed);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const c = n[i] * 255;
    data[o] = Math.abs(data[o] - c);
    data[o + 1] = Math.abs(data[o + 1] - c);
    data[o + 2] = Math.abs(data[o + 2] - c);
  }
}

function fibers(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const variance = clamp(numP(p, "variance", 20), 0, 100);
  const strength = clamp(numP(p, "strength", 40), 0, 100);
  const rnd = mulberry32(Math.floor(Math.random() * 1e9));
  const rows = new Float32Array(h);
  for (let y = 0; y < h; y++) rows[y] = rnd();
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    const t = rows[y];
    const warp = (t - 0.5) * variance * 3;
    const shade = 1 - (strength / 100) * (0.4 + 0.6 * t);
    for (let x = 0; x < w; x++) {
      const j = (hashNoise(x * 0.05, y * 0.5) - 0.5) * variance * 2;
      let sx = Math.round(x + warp + j);
      if (sx < 0) sx = 0;
      else if (sx >= w) sx = w - 1;
      const i = (y * w + sx) * 4;
      const o = (y * w + x) * 4;
      data[o] = src[i] * shade;
      data[o + 1] = src[i + 1] * shade;
      data[o + 2] = src[i + 2] * shade;
      data[o + 3] = src[i + 3];
    }
  }
}

function lensFlare(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const b = clamp(numP(p, "brightness", 100), 0, 300);
  const center = strP(p, "center", "C");
  const prime = strP(p, "lens", "50-300mm Zoom") === "35mm Prime";
  const P: Record<string, [number, number]> = {
    TL: [0.2, 0.2],
    TR: [0.8, 0.2],
    C: [0.5, 0.5],
    BR: [0.8, 0.8],
    BL: [0.2, 0.8],
  };
  const pos = P[center] ?? P.C;
  const fx = pos[0] * (w - 1);
  const fy = pos[1] * (h - 1);
  const maxR = Math.hypot(w, h) / 2 || 1;
  const ringFreq = prime ? 6 : 12;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - fx, y - fy) / maxR;
      const core = Math.exp(-r * r * 8) * b;
      const halo = Math.max(0, (1 - r) * (1 - r)) * b * 1.6;
      const rings = Math.abs(Math.sin(r * ringFreq * Math.PI)) * (1 - r) * b * 0.5;
      const add = core + halo + rings;
      const o = (y * w + x) * 4;
      data[o] = Math.min(255, data[o] + add);
      data[o + 1] = Math.min(255, data[o + 1] + add);
      data[o + 2] = Math.min(255, data[o + 2] + add);
    }
  }
}

function gaussSample(amount: number): number {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * (amount / 4);
}

function addNoise(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const amount = clamp(numP(p, "amount", 30), 0, 400);
  const dist = strP(p, "distribution", "Uniform");
  const mono = boolP(p, "monochromatic", false);
  const gauss = dist === "Gaussian";
  void h;
  for (let i = 0; i < data.length; i += 4) {
    const n1 = gauss ? gaussSample(amount) : (Math.random() * 2 - 1) * amount;
    data[i] += n1;
    data[i + 1] += gauss || mono ? n1 : (Math.random() * 2 - 1) * amount;
    data[i + 2] += gauss || mono ? n1 : (Math.random() * 2 - 1) * amount;
  }
}

function reduceNoise(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const strength = clamp(numP(p, "strength", 5), 0, 10);
  const preserve = clamp(numP(p, "preserveDetails", 50), 0, 100);
  const colorN = clamp(numP(p, "reduceColorNoise", 50), 0, 100);
  const src = new Uint8ClampedArray(data);
  const med = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      medianAt(src, w, h, x, y, 1, 1, med);
      const o = (y * w + x) * 4;
      const lum = lumAt(src, o);
      const ml = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2];
      const detail = Math.abs(lum - ml) / 255;
      const keep = Math.max(0, 1 - detail * 4 * (preserve / 100) * 2);
      const m = keep * (strength / 10) * 0.85;
      const cc = (colorN / 100) * m;
      const lRet = lum + (ml - lum) * (m - cc);
      const ld = lRet - lum;
      data[o] = clamp(src[o] + (med[0] - src[o]) * cc + ld, 0, 255);
      data[o + 1] = clamp(src[o + 1] + (med[1] - src[o + 1]) * cc + ld, 0, 255);
      data[o + 2] = clamp(src[o + 2] + (med[2] - src[o + 2]) * cc + ld, 0, 255);
      data[o + 3] = src[o + 3];
    }
  }
}

function median(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const r = clamp(Math.round(numP(p, "radius", 3)), 1, 100);
  const stride = r > 12 ? Math.ceil(r / 12) : 1;
  const src = new Uint8ClampedArray(data);
  const med = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      medianAt(src, w, h, x, y, r, stride, med);
      const o = (y * w + x) * 4;
      data[o] = med[0];
      data[o + 1] = med[1];
      data[o + 2] = med[2];
      data[o + 3] = med[3];
    }
  }
}

function dustScratches(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const r = clamp(Math.round(numP(p, "radius", 3)), 1, 100);
  const thr = clamp(numP(p, "threshold", 128), 0, 255);
  const stride = r > 12 ? Math.ceil(r / 12) : 1;
  const orig = new Uint8ClampedArray(data);
  const med = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      medianAt(orig, w, h, x, y, r, stride, med);
      const o = (y * w + x) * 4;
      const diff = Math.abs(lumAt(orig, o) - (0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2]));
      if (diff > thr) {
        data[o] = med[0];
        data[o + 1] = med[1];
        data[o + 2] = med[2];
      } else {
        data[o] = orig[o];
        data[o + 1] = orig[o + 1];
        data[o + 2] = orig[o + 2];
      }
      data[o + 3] = orig[o + 3];
    }
  }
}

function highPass(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const radius = clamp(numP(p, "radius", 2), 0.5, 250);
  const orig = new Uint8ClampedArray(data);
  const g = gaussKernel(radius);
  separable(data, w, h, g.k, g.m, g.stride);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = clamp(orig[o] - data[o] + 128, 0, 255);
    data[o + 1] = clamp(orig[o + 1] - data[o + 1] + 128, 0, 255);
    data[o + 2] = clamp(orig[o + 2] - data[o + 2] + 128, 0, 255);
    data[o + 3] = orig[o + 3];
  }
}

function offset(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const dx = Math.round(numP(p, "horizontal", 0));
  const dy = Math.round(numP(p, "vertical", 0));
  const fill = strP(p, "fill", "Repeat");
  const src = new Uint8ClampedArray(data);
  let bg: [number, number, number] | null = null;
  if (fill === "Set to Background") bg = meanColor(src, w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      const sy = y - dy;
      const o = (y * w + x) * 4;
      let i: number;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        i = (sy * w + sx) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (fill === "Wrap") {
        i = ((((sy % h) + h) % h) * w + (((sx % w) + w) % w)) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (fill === "Repeat") {
        i =
          ((sy < 0 ? 0 : sy >= h ? h - 1 : sy) * w + (sx < 0 ? 0 : sx >= w ? w - 1 : sx)) * 4;
        data[o] = src[i];
        data[o + 1] = src[i + 1];
        data[o + 2] = src[i + 2];
        data[o + 3] = src[i + 3];
      } else if (bg) {
        data[o] = bg[0];
        data[o + 1] = bg[1];
        data[o + 2] = bg[2];
        data[o + 3] = 255;
      }
    }
  }
}

function custom(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  const k = [
    numP(p, "k11", 0), numP(p, "k12", 0), numP(p, "k13", 0),
    numP(p, "k21", 0), numP(p, "k22", 1), numP(p, "k23", 0),
    numP(p, "k31", 0), numP(p, "k32", 0), numP(p, "k33", 0),
  ];
  const scale = numP(p, "scale", 1);
  const off = numP(p, "offset", 0);
  if (scale === 0) return;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky * w + kx) * 4;
          const wt = k[(dy + 1) * 3 + (dx + 1)];
          rs += src[i] * wt;
          gs += src[i + 1] * wt;
          bs += src[i + 2] * wt;
        }
      }
      const o = (y * w + x) * 4;
      data[o] = rs / scale + off;
      data[o + 1] = gs / scale + off;
      data[o + 2] = bs / scale + off;
      data[o + 3] = src[o + 3];
    }
  }
}

function morph(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  isMax: boolean
): void {
  const stride = r > 12 ? Math.ceil(r / 12) : 1;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let mr = isMax ? -1 : 256;
      let mg = mr;
      let mb = mr;
      for (let dy = -r; dy <= r; dy += stride) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -r; dx <= r; dx += stride) {
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky * w + kx) * 4;
          if (isMax) {
            if (src[i] > mr) mr = src[i];
            if (src[i + 1] > mg) mg = src[i + 1];
            if (src[i + 2] > mb) mb = src[i + 2];
          } else {
            if (src[i] < mr) mr = src[i];
            if (src[i + 1] < mg) mg = src[i + 1];
            if (src[i + 2] < mb) mb = src[i + 2];
          }
        }
      }
      const o = (y * w + x) * 4;
      data[o] = mr;
      data[o + 1] = mg;
      data[o + 2] = mb;
      data[o + 3] = src[o + 3];
    }
  }
}

function maximum(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  morph(data, w, h, clamp(Math.round(numP(p, "radius", 10)), 1, 100), true);
}

function minimum(data: Uint8ClampedArray, w: number, h: number, p: FilterParams): void {
  morph(data, w, h, clamp(Math.round(numP(p, "radius", 10)), 1, 100), false);
}

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

function dither(data: Uint8ClampedArray, w: number, h: number): void {
  const levels = 4;
  const scale = 255 / levels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const thr = (BAYER8[(y & 7) * 8 + (x & 7)] + 1) / 64;
      for (let c = 0; c < 4; c++) {
        const q = (data[o + c] / 255) * levels;
        let nv = Math.floor(q);
        if (q - nv > thr) nv += 1;
        data[o + c] = nv >= levels ? 255 : nv * scale;
      }
    }
  }
}

const FILTER_OPS: Record<string, OpFn> = {
  gaussianBlur,
  boxBlur,
  motionBlur,
  radialBlur,
  average,
  blurMore,
  lensBlur,
  shapeBlur,
  sharpen,
  sharpenMore,
  sharpenEdges,
  unsharpMask,
  smartSharpen,
  emboss,
  findEdges,
  solarize,
  diffuse,
  wind,
  tiles,
  pinch,
  spherize,
  twirl,
  ripple,
  shear,
  displace,
  clouds,
  differenceClouds,
  fibers,
  lensFlare,
  addNoise,
  reduceNoise,
  median,
  dustScratches,
  highPass,
  offset,
  custom,
  maximum,
  minimum,
  dither,
};

export { FILTER_OPS };