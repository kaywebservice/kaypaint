/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyPixelsToActiveLayer, readActivePixels, notifyNoLayer } from "@/engine/pixelOps";

type Pt = { x: number; y: number };
type UV = { u: number; v: number };

interface VPSession {
  canvas: any;
  obj: any;
  work: HTMLCanvasElement;
  workData: Uint8ClampedArray;
  w: number;
  h: number;
  corners: Pt[];
  mode: "grid" | "clone" | "transform";
  srcUV: UV | null;
  brushEl: Pt | null;
  overlay: HTMLDivElement;
  draw: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  hint: HTMLDivElement;
  handles: HTMLDivElement[];
  modeBtns: Record<string, HTMLButtonElement>;
  dragging: null | { type: "handle"; idx: number } | { type: "transform"; start: Pt; cur: Pt };
  painting: boolean;
  lastPaint: Pt | null;
  redrawPending: boolean;
  previewScheduled: boolean;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
  onKey: (e: KeyboardEvent) => void;
  onResize: () => void;
}

let active: VPSession | null = null;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function getVP(canvas: any): number[] {
  return canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
}

function sceneToScreen(canvas: any, p: Pt): Pt {
  const vp = getVP(canvas);
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  return { x: rect.left + p.x * vp[0] + vp[4], y: rect.top + p.y * vp[3] + vp[5] };
}

function screenToScene(canvas: any, sx: number, sy: number): Pt {
  const vp = getVP(canvas);
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  return { x: (sx - rect.left - vp[4]) / vp[0], y: (sy - rect.top - vp[5]) / vp[3] };
}

function sceneToElement(obj: any, p: Pt): Pt {
  try {
    const local = obj.toLocalPoint({ x: p.x, y: p.y }, "left", "top");
    return { x: local.x, y: local.y };
  } catch {
    return { x: p.x, y: p.y };
  }
}

function uvToPoint(u: number, v: number, c: Pt[]): Pt {
  const p0 = c[0];
  const p1 = c[1];
  const p2 = c[2];
  const p3 = c[3];
  return {
    x: (1 - v) * ((1 - u) * p0.x + u * p1.x) + v * ((1 - u) * p3.x + u * p2.x),
    y: (1 - v) * ((1 - u) * p0.y + u * p1.y) + v * ((1 - u) * p3.y + u * p2.y),
  };
}

function pixelToUV(px: number, py: number, c: Pt[]): UV | null {
  const p0 = c[0];
  const p1 = c[1];
  const p2 = c[2];
  const p3 = c[3];
  let u = 0.5;
  let v = 0.5;
  for (let it = 0; it < 14; it++) {
    const x = (1 - v) * ((1 - u) * p0.x + u * p1.x) + v * ((1 - u) * p3.x + u * p2.x);
    const y = (1 - v) * ((1 - u) * p0.y + u * p1.y) + v * ((1 - u) * p3.y + u * p2.y);
    const errX = px - x;
    const errY = py - y;
    const dxU = (1 - v) * (p1.x - p0.x) + v * (p2.x - p3.x);
    const dxV = (1 - u) * (p3.x - p0.x) + u * (p2.x - p1.x);
    const dyU = (1 - v) * (p1.y - p0.y) + v * (p2.y - p3.y);
    const dyV = (1 - u) * (p3.y - p0.y) + u * (p2.y - p1.y);
    const det = dxU * dyV - dxV * dyU;
    if (Math.abs(det) < 1e-9) break;
    const du = (errX * dyV - dxV * errY) / det;
    const dv = (dxU * errY - errX * dyU) / det;
    u += du;
    v += dv;
    if (Math.abs(du) < 1e-4 && Math.abs(dv) < 1e-4) break;
  }
  if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) return null;
  return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };
}

function sampleBilinear(data: Uint8ClampedArray, w: number, h: number, fx: number, fy: number): number[] {
  const x = clamp(fx, 0, w - 1);
  const y = clamp(fy, 0, h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const t = x - x0;
  const u = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i01 = (y0 * w + x1) * 4;
  const i10 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const w00 = (1 - t) * (1 - u);
  const w01 = t * (1 - u);
  const w10 = (1 - t) * u;
  const w11 = t * u;
  return [
    data[i00] * w00 + data[i01] * w01 + data[i10] * w10 + data[i11] * w11,
    data[i00 + 1] * w00 + data[i01 + 1] * w01 + data[i10 + 1] * w10 + data[i11 + 1] * w11,
    data[i00 + 2] * w00 + data[i01 + 2] * w01 + data[i10 + 2] * w10 + data[i11 + 2] * w11,
    data[i00 + 3] * w00 + data[i01 + 3] * w01 + data[i10 + 3] * w10 + data[i11 + 3] * w11,
  ];
}

function affineFromPairs(el: Pt[], sc: Pt[]): ((p: Pt) => Pt) | null {
  const p0 = el[0];
  const p1 = el[1];
  const p2 = el[2];
  const q0 = sc[0];
  const q1 = sc[1];
  const q2 = sc[2];
  const den = (p1.x - p2.x) * (p0.y - p2.y) - (p1.y - p2.y) * (p0.x - p2.x);
  if (Math.abs(den) < 1e-9) return null;
  const a = ((q1.x - q2.x) * (p0.y - p2.y) - (q1.y - q2.y) * (p0.x - p2.x)) / den;
  const b = ((q1.y - q2.y) * (p0.x - p2.x) - (q1.x - q2.x) * (p0.y - p2.y)) / den;
  const c = q2.x - a * p2.x - b * p2.y;
  const d = ((q0.y - q2.y) * (p1.x - p2.x) - (q0.x - q2.x) * (p1.y - p2.y)) / den;
  const e = ((q0.x - q2.x) * (p1.y - p2.y) - (q0.y - q2.y) * (p1.x - p2.x)) / den;
  const f = q2.y - d * p2.x - e * p2.y;
  return (p: Pt): Pt => ({ x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f });
}

function schedulePreview(s: VPSession) {
  if (s.previewScheduled) return;
  s.previewScheduled = true;
  requestAnimationFrame(() => {
    s.previewScheduled = false;
    const ctx = s.work.getContext("2d")!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(s.workData), s.w, s.h), 0, 0);
    try {
      s.obj.setElement(s.work);
    } catch {
      s.obj._element = s.work;
    }
    s.obj.setCoords?.();
    s.canvas.requestRenderAll();
  });
}

function stamp(s: VPSession, center: Pt, radius: number) {
  if (!s.srcUV) return;
  const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
  const src = uvToPoint(s.srcUV.u, s.srcUV.v, cornersEl);
  const r2 = radius * radius;
  const x0 = clamp(Math.floor(center.x - radius), 0, s.w - 1);
  const x1 = clamp(Math.ceil(center.x + radius), 0, s.w - 1);
  const y0 = clamp(Math.floor(center.y - radius), 0, s.h - 1);
  const y1 = clamp(Math.ceil(center.y + radius), 0, s.h - 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ddx = x - center.x;
      const ddy = y - center.y;
      const dist2 = ddx * ddx + ddy * ddy;
      if (dist2 > r2) continue;
      if (!pixelToUV(x, y, cornersEl)) continue;
      const d = Math.sqrt(dist2);
      const a = clamp((radius - d) / 1.5, 0, 1);
      const c = sampleBilinear(s.workData, s.w, s.h, src.x, src.y);
      const o = (y * s.w + x) * 4;
      s.workData[o] = s.workData[o] * (1 - a) + c[0] * a;
      s.workData[o + 1] = s.workData[o + 1] * (1 - a) + c[1] * a;
      s.workData[o + 2] = s.workData[o + 2] * (1 - a) + c[2] * a;
    }
  }
  schedulePreview(s);
}

function paintStroke(s: VPSession, scene: Pt) {
  const elPt = sceneToElement(s.obj, scene);
  if (!s.srcUV || !pixelToUV(elPt.x, elPt.y, s.corners.map((p) => sceneToElement(s.obj, p)))) return;
  const radius = 30;
  if (!s.lastPaint) {
    stamp(s, elPt, radius);
    s.lastPaint = elPt;
    return;
  }
  const dx = elPt.x - s.lastPaint.x;
  const dy = elPt.y - s.lastPaint.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, radius * 0.4);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let k = 1; k <= n; k++) {
    stamp(s, { x: s.lastPaint.x + (dx * k) / n, y: s.lastPaint.y + (dy * k) / n }, radius);
  }
  s.lastPaint = elPt;
}

function doTransform(s: VPSession, a: Pt, b: Pt) {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const rw = x1 - x0;
  const rh = y1 - y0;
  if (rw < 2 || rh < 2) return;
  const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
  const ix0 = Math.max(0, Math.floor(x0));
  const ix1 = Math.min(s.w - 1, Math.ceil(x1));
  const iy0 = Math.max(0, Math.floor(y0));
  const iy1 = Math.min(s.h - 1, Math.ceil(y1));
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      const t = (x - x0) / rw;
      const u = (y - y0) / rh;
      const uv = pixelToUV(x, y, cornersEl);
      if (!uv) continue;
      const spx = x0 + uv.u * rw;
      const spy = y0 + uv.v * rh;
      const c = sampleBilinear(s.workData, s.w, s.h, spx, spy);
      const e = Math.min(t, u, 1 - t, 1 - u) * Math.min(rw, rh);
      const a2 = smoothstep(0, 4, e);
      const o = (y * s.w + x) * 4;
      s.workData[o] = s.workData[o] * (1 - a2) + c[0] * a2;
      s.workData[o + 1] = s.workData[o + 1] * (1 - a2) + c[1] * a2;
      s.workData[o + 2] = s.workData[o + 2] * (1 - a2) + c[2] * a2;
    }
  }
  schedulePreview(s);
}

function drawFrame(s: VPSession) {
  const d = s.dctx;
  d.clearRect(0, 0, s.draw.width, s.draw.height);
  if (s.corners.length > 0) {
    d.strokeStyle = "rgba(34,211,238,0.9)";
    d.lineWidth = 1.5;
    d.setLineDash([]);
    d.beginPath();
    s.corners.forEach((p, i) => {
      const sp = sceneToScreen(s.canvas, p);
      if (i === 0) d.moveTo(sp.x, sp.y);
      else d.lineTo(sp.x, sp.y);
    });
    if (s.corners.length === 4) d.closePath();
    d.stroke();
    if (s.corners.length === 4) {
      d.setLineDash([4, 4]);
      d.strokeStyle = "rgba(34,211,238,0.35)";
      for (let i = 1; i < 3; i++) {
        const a = uvToPoint(i / 3, 0, s.corners);
        const b = uvToPoint(i / 3, 1, s.corners);
        line(d, sceneToScreen(s.canvas, a), sceneToScreen(s.canvas, b));
        const c = uvToPoint(0, i / 3, s.corners);
        const e = uvToPoint(1, i / 3, s.corners);
        line(d, sceneToScreen(s.canvas, c), sceneToScreen(s.canvas, e));
      }
      d.setLineDash([]);
    }
    s.corners.forEach((p, i) => {
      const sp = sceneToScreen(s.canvas, p);
      d.beginPath();
      d.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      d.fillStyle = "#ffffff";
      d.fill();
      d.lineWidth = 1.5;
      d.strokeStyle = "#0891b2";
      d.stroke();
      if (s.corners.length < 4) {
        d.font = "11px ui-sans-serif, system-ui";
        d.fillStyle = "#ffffff";
        d.fillText(String(i + 1), sp.x + 7, sp.y - 7);
      }
    });
  }

  if (s.dragging?.type === "transform") {
    const a = s.dragging.start;
    const b = s.dragging.cur;
    const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
    const af = affineFromPairs(cornersEl, s.corners);
    if (af) {
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);
      const tl = af({ x: x0, y: y0 });
      const tr = af({ x: x1, y: y0 });
      const br = af({ x: x1, y: y1 });
      const bl = af({ x: x0, y: y1 });
      d.fillStyle = "rgba(251,191,36,0.18)";
      d.strokeStyle = "rgba(251,191,36,0.9)";
      d.lineWidth = 1.5;
      d.beginPath();
      d.moveTo(tl.x, tl.y);
      d.lineTo(tr.x, tr.y);
      d.lineTo(br.x, br.y);
      d.lineTo(bl.x, bl.y);
      d.closePath();
      d.fill();
      d.stroke();
    }
  }

  if (s.mode === "clone") {
    if (s.srcUV) {
      const sp = uvToPoint(s.srcUV.u, s.srcUV.v, s.corners);
      const pt = sceneToScreen(s.canvas, sp);
      d.beginPath();
      d.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      d.strokeStyle = "rgba(248,113,113,0.95)";
      d.lineWidth = 2;
      d.stroke();
      d.beginPath();
      d.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      d.fillStyle = "rgba(248,113,113,0.95)";
      d.fill();
    }
    if (s.brushEl && s.corners.length === 4) {
      const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
      const af = affineFromPairs(cornersEl, s.corners);
      if (af) {
        const pt = sceneToScreen(s.canvas, af(s.brushEl));
        const zoom = getVP(s.canvas)[0];
        const scale = Math.abs(s.obj.scaleX ?? 1);
        d.beginPath();
        d.arc(pt.x, pt.y, 30 * zoom * Math.max(0.001, scale), 0, Math.PI * 2);
        d.strokeStyle = "rgba(255,255,255,0.85)";
        d.lineWidth = 1.5;
        d.stroke();
      }
    }
  }
}

function line(d: CanvasRenderingContext2D, a: Pt, b: Pt) {
  d.beginPath();
  d.moveTo(a.x, a.y);
  d.lineTo(b.x, b.y);
  d.stroke();
}

function redraw(s: VPSession) {
  if (s.redrawPending) return;
  s.redrawPending = true;
  requestAnimationFrame(() => {
    s.redrawPending = false;
    drawFrame(s);
    positionHandles(s);
  });
}

function positionHandles(s: VPSession) {
  s.corners.forEach((p, i) => {
    const hd = s.handles[i];
    if (!hd) return;
    const sp = sceneToScreen(s.canvas, p);
    hd.style.left = `${sp.x}px`;
    hd.style.top = `${sp.y}px`;
  });
}

function setMode(s: VPSession, mode: "grid" | "clone" | "transform") {
  s.mode = mode;
  s.dragging = null;
  s.painting = false;
  s.lastPaint = null;
  s.brushEl = null;
  const defined = s.corners.length === 4;
  s.handles.forEach((hd) => {
    hd.style.display = defined && mode === "grid" ? "block" : "none";
  });
  for (const [m, btn] of Object.entries(s.modeBtns)) {
    btn.className =
      m === mode
        ? "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-cyan-600/80 text-white"
        : "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-white/5 text-gray-300 hover:bg-white/10";
  }
  if (mode === "clone") {
    s.hint.textContent = "Alt+click inside the grid to set the source point, then drag to paint";
  } else if (mode === "transform") {
    s.hint.textContent = "Drag inside the grid to select a region; release to transform it";
  } else {
    s.hint.textContent = defined
      ? "Drag the corner handles to adjust the grid"
      : "Click 4 points to define the perspective grid (corners 1-4)";
  }
  redraw(s);
}

function setSourceFromScene(s: VPSession, scene: Pt) {
  const elPt = sceneToElement(s.obj, scene);
  const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
  const uv = pixelToUV(elPt.x, elPt.y, cornersEl);
  if (!uv) return;
  s.srcUV = uv;
  s.hint.textContent = "Source set - drag to paint through the grid";
  redraw(s);
}

export function cancelVanishingPoint() {
  const s = active;
  if (!s) return;
  active = null;
  window.removeEventListener("pointermove", s.onMove);
  window.removeEventListener("pointerup", s.onUp);
  window.removeEventListener("keydown", s.onKey);
  window.removeEventListener("resize", s.onResize);
  s.overlay.remove();
  try {
    s.canvas.selection = true;
    s.canvas.defaultCursor = "default";
    s.canvas.requestRenderAll();
  } catch {
    // canvas may already be gone
  }
}

export async function startVanishingPoint(canvas: any): Promise<boolean> {
  cancelVanishingPoint();
  if (!canvas) return false;
  const read = readActivePixels(canvas);
  if (!read) {
    notifyNoLayer();
    return false;
  }
  const { obj, width: w, height: h } = read;
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wctx = work.getContext("2d")!;
  const el = obj.getElement?.();
  if (obj.type === "image" && el?.width && el?.height) {
    wctx.drawImage(el, 0, 0);
  } else {
    wctx.putImageData(new ImageData(new Uint8ClampedArray(read.data), w, h), 0, 0);
  }
  const workData = new Uint8ClampedArray(wctx.getImageData(0, 0, w, h).data);

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:200;cursor:crosshair;background:rgba(0,0,0,0.06);touch-action:none;";
  const draw = document.createElement("canvas");
  draw.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  draw.width = window.innerWidth;
  draw.height = window.innerHeight;
  const dctx = draw.getContext("2d")!;
  overlay.appendChild(draw);

  const toolbar = document.createElement("div");
  toolbar.style.cssText =
    "position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(17,24,39,0.94);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:8px 12px;z-index:203;box-shadow:0 10px 36px rgba(0,0,0,0.55);";
  const hint = document.createElement("div");
  hint.style.cssText =
    "font-size:11px;color:#9ca3af;max-width:240px;margin-right:6px;line-height:1.35;";
  toolbar.appendChild(hint);

  const mkBtn = (label: string, cls: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = cls;
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", onClick);
    toolbar.appendChild(btn);
    return btn;
  };

  const modeBtns: Record<string, HTMLButtonElement> = {};
  modeBtns.grid = mkBtn("Edit Grid", "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-white/5 text-gray-300 hover:bg-white/10", () => setMode(s, "grid"));
  modeBtns.clone = mkBtn("Clone", "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-white/5 text-gray-300 hover:bg-white/10", () => setMode(s, "clone"));
  modeBtns.transform = mkBtn("Transform", "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-white/5 text-gray-300 hover:bg-white/10", () => setMode(s, "transform"));
  mkBtn("Apply", "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white", () => {
    void applySession(s);
  });
  mkBtn("Cancel", "rounded-lg px-3 py-1.5 text-[12px] font-medium bg-white/5 text-gray-300 hover:bg-white/10", () => {
    cancelVanishingPoint();
  });

  const handles = [0, 1, 2, 3].map((idx) => {
    const hd = document.createElement("div");
    hd.style.cssText =
      "position:absolute;width:11px;height:11px;margin:-5px 0 0 -5px;border-radius:50%;background:#fff;border:2px solid #22d3ee;z-index:202;cursor:move;display:none;box-shadow:0 1px 4px rgba(0,0,0,0.6);";
    hd.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (s.corners.length !== 4 || s.mode !== "grid") return;
      s.dragging = { type: "handle", idx };
      hd.setPointerCapture(e.pointerId);
    });
    hd.addEventListener("pointermove", (e) => {
      if (s.dragging?.type === "handle" && s.dragging.idx === idx) {
        s.corners[idx] = screenToScene(s.canvas, e.clientX, e.clientY);
        redraw(s);
      }
    });
    hd.addEventListener("pointerup", () => {
      if (s.dragging?.type === "handle" && s.dragging.idx === idx) s.dragging = null;
    });
    overlay.appendChild(hd);
    return hd;
  });

  overlay.appendChild(toolbar);
  document.body.appendChild(overlay);

  const s: VPSession = {
    canvas,
    obj,
    work,
    workData,
    w,
    h,
    corners: [],
    mode: "grid",
    srcUV: null,
    brushEl: null,
    overlay,
    draw,
    dctx,
    hint,
    handles,
    modeBtns,
    dragging: null,
    painting: false,
    lastPaint: null,
    redrawPending: false,
    previewScheduled: false,
    onMove: () => {},
    onUp: () => {},
    onKey: () => {},
    onResize: () => {},
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (e.target !== overlay && e.target !== draw) return;
    const scene = screenToScene(canvas, e.clientX, e.clientY);
    if (s.corners.length < 4) {
      s.corners.push(scene);
      if (s.corners.length === 4) setMode(s, "grid");
      else {
        s.hint.textContent = `Click corner ${s.corners.length + 1} of 4`;
        redraw(s);
      }
      return;
    }
    if (s.mode === "clone") {
      if (e.altKey) {
        setSourceFromScene(s, scene);
        return;
      }
      s.painting = true;
      s.lastPaint = null;
      paintStroke(s, scene);
      return;
    }
    if (s.mode === "transform") {
      const elPt = sceneToElement(s.obj, scene);
      const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
      if (pixelToUV(elPt.x, elPt.y, cornersEl)) {
        s.dragging = { type: "transform", start: elPt, cur: elPt };
      }
      return;
    }
  };

  const onMove = (e: PointerEvent) => {
    if (s.dragging?.type === "handle") return;
    const scene = screenToScene(canvas, e.clientX, e.clientY);
    if (s.mode === "clone") {
      if (s.painting && (e.buttons & 1) === 1) paintStroke(s, scene);
      const elPt = sceneToElement(s.obj, scene);
      const cornersEl = s.corners.map((p) => sceneToElement(s.obj, p));
      s.brushEl = s.corners.length === 4 && pixelToUV(elPt.x, elPt.y, cornersEl) ? elPt : null;
      redraw(s);
    } else if (s.dragging?.type === "transform") {
      s.dragging.cur = sceneToElement(s.obj, scene);
      redraw(s);
    }
  };

  const onUp = () => {
    if (s.mode === "clone" && s.painting) {
      s.painting = false;
      s.lastPaint = null;
    }
    if (s.dragging?.type === "transform") {
      doTransform(s, s.dragging.start, s.dragging.cur);
      s.dragging = null;
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") cancelVanishingPoint();
  };

  const onResize = () => {
    s.draw.width = window.innerWidth;
    s.draw.height = window.innerHeight;
    redraw(s);
  };

  s.onMove = onMove;
  s.onUp = onUp;
  s.onKey = onKey;
  s.onResize = onResize;

  overlay.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);

  try {
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";
    canvas.requestRenderAll();
  } catch {
    // ignore
  }

  s.hint.textContent = "Click corner 1 of 4";
  redraw(s);
  active = s;
  return true;
}

async function applySession(s: VPSession) {
  const ctx = s.work.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(s.workData), s.w, s.h), 0, 0);
  const data = s.workData;
  cancelVanishingPoint();
  await applyPixelsToActiveLayer(s.canvas, (out) => {
    out.set(data);
  });
}
