/*
 * Pixel worker — offloads heavy pixel math off the main thread so the UI
 * never blocks. Self-contained (no imports). Mirrors the pure TS engines in
 * engine/ (inpaintFallback, rawDemosaic, healEngine, shapeBoolean); parity is
 * enforced by scripts/test_pixelWorker in the repo.
 *
 * Protocol: postMessage({ id, op, payload, transfer? })
 *   -> posts back { id, ok, result } where typed-array results are transferred.
 *
 * Ops: inpaint, demosaic, whiteBalance, healOffset, healStamp,
 *      combineMasks, trace.
 */

/* eslint-disable */

"use strict";

function lumaOf(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ---------------- inpaint (nearest-fill + edge-preserving diffusion) ---------------- */

function inpaint(src, mask, w, h) {
  const n = w * h;
  const out = new Uint8ClampedArray(src);
  let masked = 0;
  for (let i = 0; i < n; i++) if (mask[i] > 16) masked++;
  if (masked === 0) return out;

  // Stage 1: nearest-known BFS fill.
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
  let guard = 0;
  while (head < tail && guard++ < 100000) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;
    const d = dist[idx] + 1;
    const si = idx * 4;
    const nb = (j) => {
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
  }

  // Stage 2: edge-preserving (Perona–Malik style) diffusion.
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
        const c0 = lumaOf(cur[o], cur[o + 1], cur[o + 2]);
        let sr = 0, sg = 0, sb = 0, ws = 0;
        const acc = (j) => {
          const jj = j * 4;
          const dl = Math.abs(c0 - lumaOf(cur[jj], cur[jj + 1], cur[jj + 2]));
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
  return cur;
}

/* ---------------- demosaic ---------------- */

function demosaic(bayer, w, h, pattern, blackLevel, whiteLevel) {
  const scale = 255 / Math.max(1, whiteLevel - blackLevel);
  const out = new Uint8ClampedArray(w * h * 4);
  const valueAt = (x, y) => {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= w) x = w - 1;
    if (y >= h) y = h - 1;
    return bayer[y * w + x];
  };
  const channelFor = (x, y) => {
    const row = y % 2 === 0 ? pattern.slice(0, 2) : pattern.slice(2, 4);
    return row[x % 2 === 0 ? 0 : 1];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = Math.max(0, valueAt(x, y) - blackLevel) * scale;
      const own = channelFor(x, y);
      let r = 0, g = 0, b = 0;
      if (own === "R") {
        r = raw;
        g = (valueAt(x - 1, y) + valueAt(x + 1, y) + valueAt(x, y - 1) + valueAt(x, y + 1)) / 4;
        b = (valueAt(x - 1, y - 1) + valueAt(x + 1, y - 1) + valueAt(x - 1, y + 1) + valueAt(x + 1, y + 1)) / 4;
      } else if (own === "B") {
        b = raw;
        g = (valueAt(x - 1, y) + valueAt(x + 1, y) + valueAt(x, y - 1) + valueAt(x, y + 1)) / 4;
        r = (valueAt(x - 1, y - 1) + valueAt(x + 1, y - 1) + valueAt(x - 1, y + 1) + valueAt(x + 1, y + 1)) / 4;
      } else {
        const horizontalIsR = channelFor(x - 1, y) === "R";
        const hVal = (valueAt(x - 1, y) + valueAt(x + 1, y)) / 2;
        const vVal = (valueAt(x, y - 1) + valueAt(x, y + 1)) / 2;
        const dh = Math.abs(valueAt(x - 1, y) - valueAt(x + 1, y));
        const dv = Math.abs(valueAt(x, y - 1) - valueAt(x, y + 1));
        g = raw;
        if (horizontalIsR === (dh <= dv)) {
          r = hVal;
          b = vVal;
        } else {
          r = vVal;
          b = hVal;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clamp(Math.round(r), 0, 255);
      out[o + 1] = clamp(Math.round(g), 0, 255);
      out[o + 2] = clamp(Math.round(b), 0, 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

function whiteBalance(rgba, w, h) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    sr += rgba[i * 4];
    sg += rgba[i * 4 + 1];
    sb += rgba[i * 4 + 2];
    n++;
  }
  if (!n || sg <= 0) return rgba;
  const kr = sg / (sr || 1);
  const kb = sg / (sb || 1);
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = clamp(Math.round(out[i * 4] * kr), 0, 255);
    out[i * 4 + 2] = clamp(Math.round(out[i * 4 + 2] * kb), 0, 255);
  }
  return out;
}

/* ---------------- heal ---------------- */

function healOffset(data, w, h, cx, cy, brushR) {
  const radii = [Math.round(brushR * 1.6), Math.round(brushR * 2.4), Math.round(brushR * 3.2)];
  const dirs = 8;
  let best = null;
  let bestV = Infinity;
  for (let ri = 0; ri < radii.length; ri++) {
    const rr = Math.max(1, radii[ri]);
    for (let k = 0; k < dirs; k++) {
      const ang = (Math.PI * 2 * k) / dirs;
      const px = Math.round(cx + Math.cos(ang) * rr);
      const py = Math.round(cy + Math.sin(ang) * rr);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const r0 = Math.max(0, Math.floor(px - brushR * 0.5));
      const r1 = Math.min(w - 1, Math.ceil(px + brushR * 0.5));
      const c0 = Math.max(0, Math.floor(py - brushR * 0.5));
      const c1 = Math.min(h - 1, Math.ceil(py + brushR * 0.5));
      let sum = 0, cnt = 0;
      for (let yy = c0; yy <= c1; yy++) {
        for (let xx = r0; xx <= r1; xx++) {
          const i = (yy * w + xx) * 4;
          sum += lumaOf(data[i], data[i + 1], data[i + 2]);
          cnt++;
        }
      }
      if (!cnt) continue;
      const mean = sum / cnt;
      let v = 0;
      for (let yy = c0; yy <= c1; yy++) {
        for (let xx = r0; xx <= r1; xx++) {
          const i = (yy * w + xx) * 4;
          const d = lumaOf(data[i], data[i + 1], data[i + 2]) - mean;
          v += d * d;
        }
      }
      v /= cnt;
      if (v < bestV) {
        bestV = v;
        best = { dx: px - Math.round(cx), dy: py - Math.round(cy) };
      }
    }
  }
  return best ? { dx: best.dx, dy: best.dy } : { dx: Math.round(brushR), dy: 0 };
}

function healStamp(data, w, h, cx, cy, r, dx, dy) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  let ringLum = 0, ringN = 0;
  const ringMax = r * 1.5;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r || d > ringMax) continue;
      const i = (y * w + x) * 4;
      ringLum += lumaOf(data[i], data[i + 1], data[i + 2]);
      ringN++;
    }
  }
  const ccx = Math.round(cx), ccy = Math.round(cy);
  const targetLum = ringN > 0 ? ringLum / ringN : lumaOf(data[(ccy * w + ccx) * 4], data[(ccy * w + ccx) * 4 + 1], data[(ccy * w + ccx) * 4 + 2]);
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dxc = x - cx, dyc = y - cy;
      const d2 = dxc * dxc + dyc * dyc;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / r;
      const a = f * f * (2 - f);
      const sx = clamp(x - dx, 0, w - 1);
      const sy = clamp(y - dy, 0, h - 1);
      const si = (sy * w + sx) * 4;
      const srcLum = lumaOf(data[si], data[si + 1], data[si + 2]);
      const k = clamp(targetLum / (srcLum || 1), 0.6, 1.6);
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = clamp(data[si + ch] * k, 0, 255);
        data[i + ch] = data[i + ch] * (1 - a) + v * a;
      }
    }
  }
  return data;
}

/* ---------------- shape boolean ---------------- */

function combineMasks(a, b, w, h, op) {
  const n = w * h;
  const out = new Uint8ClampedArray(n);
  if (op === "union") {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 || b[i] > 16 ? 255 : 0;
  } else if (op === "intersect") {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 && b[i] > 16 ? 255 : 0;
  } else {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 && b[i] <= 16 ? 255 : 0;
  }
  return out;
}

const vkey = (x, y) => x + "," + y;

function trace(mask, w, h) {
  const edges = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] <= 16) continue;
      if (y === 0 || mask[(y - 1) * w + x] <= 16) edges.push({ ax: x, ay: y, bx: x + 1, by: y, used: false, dx: 1, dy: 0 });
      if (y === h - 1 || mask[(y + 1) * w + x] <= 16) edges.push({ ax: x + 1, ay: y + 1, bx: x, by: y + 1, used: false, dx: -1, dy: 0 });
      if (x === 0 || mask[y * w + x - 1] <= 16) edges.push({ ax: x, ay: y + 1, bx: x, by: y, used: false, dx: 0, dy: -1 });
      if (x === w - 1 || mask[y * w + x + 1] <= 16) edges.push({ ax: x + 1, ay: y, bx: x + 1, by: y + 1, used: false, dx: 0, dy: 1 });
    }
  }
  const adj = new Map();
  for (const e of edges) {
    const k = vkey(e.ax, e.ay);
    let list = adj.get(k);
    if (!list) {
      list = [];
      adj.set(k, list);
    }
    list.push(e);
  }
  const loops = [];
  const startEdge = () => {
    for (const e of edges) if (!e.used) return e;
    return null;
  };
  let e0 = startEdge();
  while (e0) {
    const loop = [];
    let cur = e0;
    let guard = 0;
    const maxGuard = edges.length + 4;
    while (cur && !cur.used && guard++ < maxGuard) {
      cur.used = true;
      loop.push({ x: cur.ax, y: cur.ay });
      const vk = vkey(cur.bx, cur.by);
      const candidates = (adj.get(vk) || []).filter((e) => !e.used);
      if (!candidates.length) break;
      const ix = cur.dx, iy = cur.dy;
      let best = null;
      let bestTurn = -Infinity;
      for (const c of candidates) {
        const cross = ix * c.dy - iy * c.dx;
        const dot = ix * c.dx + iy * c.dy;
        let ang = Math.atan2(-cross, dot);
        if (ang < 0) ang += Math.PI * 2;
        if (ang > bestTurn) {
          bestTurn = ang;
          best = c;
        }
      }
      cur = best;
    }
    if (loop.length >= 3) loops.push(loop);
    e0 = startEdge();
  }
  return loops;
}

/* ---------------- adjustments (levels / curves / hue-sat) ---------------- */

function adjustLevels(data, black, gamma, white) {
  const b = Math.max(0, Math.min(255, black));
  const w = Math.max(b + 1, Math.min(255, white));
  const range = w - b;
  const g = Math.max(0.05, Math.min(5, gamma));
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let n = (v - b) / range;
    n = Math.max(0, Math.min(1, n));
    n = Math.pow(n, 1 / g);
    lut[v] = Math.round(n * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

function adjustCurves(data, pts) {
  const sorted = pts
    .map((p) => ({ x: Math.max(0, Math.min(255, p.x)), y: Math.max(0, Math.min(255, p.y)) }))
    .sort((a, b) => a.x - b.x);
  if (sorted.length < 2) return;
  const lut = new Uint8Array(256);
  let seg = 0;
  for (let v = 0; v < 256; v++) {
    while (seg < sorted.length - 2 && sorted[seg + 1].x < v) seg++;
    const a = sorted[seg];
    const b = sorted[seg + 1];
    const span = Math.max(1, b.x - a.x);
    const t = (v - a.x) / span;
    lut[v] = Math.round(a.y + (b.y - a.y) * t);
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return { h, s, v: mx };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function adjustHueSat(data, hue, saturation, lightness) {
  const hShift = (Math.max(-180, Math.min(180, hue)) / 180) * 180;
  const sShift = 1 + Math.max(-100, Math.min(100, saturation)) / 100;
  const lShift = Math.max(-100, Math.min(100, lightness)) / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const { h, s, v } = rgbToHsv(r, g, b);
    const out = hsvToRgb((h + hShift + 360) % 360, Math.max(0, Math.min(1, s * sShift)), v + lShift);
    data[i] = out.r;
    data[i + 1] = out.g;
    data[i + 2] = out.b;
  }
}

function adjust(data, adjustments) {
  for (const adj of adjustments) {
    const p = adj.params || {};
    if (adj.type === "levels") adjustLevels(data, p.black || 0, p.gamma || 1, p.white || 255);
    else if (adj.type === "curves") adjustCurves(data, p.curve || [{ x: 0, y: 0 }, { x: 255, y: 255 }]);
    else if (adj.type === "hueSat") adjustHueSat(data, p.hue || 0, p.saturation || 0, p.lightness || 0);
  }
  return data;
}

/* ---------------- dispatcher ---------------- */

function handle(msg) {
  const { id, op, payload } = msg;
  let result = null;
  switch (op) {
    case "inpaint":
      result = inpaint(payload.src, payload.mask, payload.w, payload.h);
      break;
    case "demosaic":
      result = demosaic(payload.bayer, payload.w, payload.h, payload.pattern || "RGGB", payload.blackLevel || 0, payload.whiteLevel || 255);
      break;
    case "whiteBalance":
      result = whiteBalance(payload.rgba, payload.w, payload.h);
      break;
    case "healOffset":
      result = healOffset(payload.data, payload.w, payload.h, payload.cx, payload.cy, payload.r);
      break;
    case "healStamp":
      result = healStamp(payload.data, payload.w, payload.h, payload.cx, payload.cy, payload.r, payload.dx, payload.dy);
      break;
    case "combineMasks":
      result = combineMasks(payload.a, payload.b, payload.w, payload.h, payload.op);
      break;
    case "trace":
      result = trace(payload.mask, payload.w, payload.h);
      break;
    case "adjust":
      result = adjust(new Uint8ClampedArray(payload.data), payload.adjustments);
      break;
    default:
      self.postMessage({ id, ok: false, error: "unknown op: " + op });
      return;
  }
  self.postMessage({ id, ok: true, result });
}

self.onmessage = (e) => {
  try {
    handle(e.data);
  } catch (err) {
    self.postMessage({ id: e.data.id, ok: false, error: String((err && err.message) || err) });
  }
};
