/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import {
  activeImageElement,
  closeSession,
  cloneElementPixels,
  elementToScene,
  makeSampler,
  sceneToElement,
  sceneToScreen,
  screenToScene,
  sessionOverlay,
  startDrag,
  type WarpSession,
} from "@/engine/warpShared";

const MAX_PINS = 12;
const EPS = 0.01;

interface Pin {
  x: number;
  y: number;
  ox: number;
  oy: number;
  fixed: boolean;
  el: HTMLDivElement;
}

/**
 * Puppet warp: the 8 corners/edge-midpoints are auto-pinned as FIXED anchors;
 * Alt+click adds movable pins (max 12 total), dragging a pin moves it. On
 * Apply the displacement field is computed with inverse-distance weighting
 * (w_i = 1 / (dist_i^2 + ε)) and the image is resampled.
 */
export function startPuppetWarp(canvas: any) {
  const read = activeImageElement(canvas);
  if (!read) return;
  const { obj, el } = read;
  const w = el.width;
  const h = el.height;

  let session: WarpSession | null = null;

  const apply = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
    void applyPuppet(canvas, pins, w, h);
  };
  const cancel = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
  };

  session = sessionOverlay(apply, cancel);
  session.overlay.style.pointerEvents = "auto";

  const pins: Pin[] = [];

  const addPin = (x: number, y: number, fixed: boolean) => {
    if (!session) return null;
    if (pins.length >= MAX_PINS) {
      window.alert(`Maximum of ${MAX_PINS} pins.`);
      return null;
    }
    const dot = document.createElement("div");
    dot.style.cssText = fixed
      ? "position:absolute;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;" +
        "border:2px solid rgba(255,255,255,0.95);background:rgba(0,0,0,0.25);" +
        "border-radius:50%;pointer-events:auto;cursor:default;box-shadow:0 0 5px rgba(0,0,0,0.7);z-index:5;"
      : "position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;" +
        "background:#f472b6;border:2px solid #fff;border-radius:50%;pointer-events:auto;" +
        "cursor:grab;box-shadow:0 0 5px rgba(0,0,0,0.7);z-index:5;";
    const pin: Pin = { x, y, ox: x, oy: y, fixed, el: dot };
    dot.addEventListener("click", (e) => e.stopPropagation());
    if (!fixed) {
      startDrag(dot, (e) => {
        const sc = screenToScene(canvas, e);
        const pt = sceneToElement(obj, sc.x, sc.y);
        pin.x = pt.x;
        pin.y = pt.y;
        redraw();
      });
    }
    pins.push(pin);
    return pin;
  };

  const redraw = () => {
    if (!session) return;
    for (const pin of pins) {
      const p = elementToScene(obj, pin.x, pin.y);
      const s = sceneToScreen(canvas, p.x, p.y);
      pin.el.style.left = `${s.x}px`;
      pin.el.style.top = `${s.y}px`;
      session.overlay.appendChild(pin.el);
    }
  };

  addPin(-w / 2, -h / 2, true);
  addPin(0, -h / 2, true);
  addPin(w / 2, -h / 2, true);
  addPin(-w / 2, 0, true);
  addPin(w / 2, 0, true);
  addPin(-w / 2, h / 2, true);
  addPin(0, h / 2, true);
  addPin(w / 2, h / 2, true);

  session.overlay.addEventListener("click", (e) => {
    if (!e.altKey) return;
    const sc = screenToScene(canvas, e);
    const pt = sceneToElement(obj, sc.x, sc.y);
    if (pt.x < -w / 2 || pt.x > w / 2 || pt.y < -h / 2 || pt.y > h / 2) return;
    addPin(pt.x, pt.y, false);
    redraw();
  });

  redraw();
}

function applyPuppet(canvas: any, pins: Pin[], w: number, h: number) {
  const obj = canvas?.getActiveObject?.();
  const work = cloneElementPixels(obj?.getElement?.());
  const img = work.getContext("2d")!.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src.length);
  const sample = makeSampler(src, w, h);
  const tmp: number[] = [0, 0, 0, 0];

  for (let py = 0; py < h; py++) {
    const v = py - h / 2;
    for (let px = 0; px < w; px++) {
      const u = px - w / 2;
      let dx = 0;
      let dy = 0;
      let wsum = 0;
      for (const pin of pins) {
        const ddx = u - pin.x;
        const ddy = v - pin.y;
        const wi = 1 / (ddx * ddx + ddy * ddy + EPS);
        dx += wi * (pin.x - pin.ox);
        dy += wi * (pin.y - pin.oy);
        wsum += wi;
      }
      if (wsum > 0) {
        dx /= wsum;
        dy /= wsum;
      }
      sample(px - dx, py - dy, tmp);
      const o = (py * w + px) * 4;
      out[o] = tmp[0];
      out[o + 1] = tmp[1];
      out[o + 2] = tmp[2];
      out[o + 3] = tmp[3];
    }
  }

  void applyPixelsToActiveLayer(canvas, (o) => {
    o.set(out);
  });
}
