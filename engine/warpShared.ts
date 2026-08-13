/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WarpPoint {
  x: number;
  y: number;
}

/** Screen-space bounding rect of the fabric canvas element. */
export function canvasRect(canvas: any): { left: number; top: number; width: number; height: number } {
  const el = canvas?.upperCanvasEl;
  if (!el) return { left: 0, top: 0, width: 0, height: 0 };
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Scene coords (fabric canvas plane) → viewport screen coords. */
export function sceneToScreen(canvas: any, x: number, y: number): WarpPoint {
  const rect = canvasRect(canvas);
  const vt = canvas?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const zoom = canvas?.getZoom?.() ?? 1;
  return { x: rect.left + (vt[4] ?? 0) + x * zoom, y: rect.top + (vt[5] ?? 0) + y * zoom };
}

/** Pointer/mouse event → scene coords (delegates to fabric). */
export function screenToScene(canvas: any, e: any): WarpPoint {
  const p = canvas?.getPointer?.(e) ?? canvas?.getScenePoint?.(e);
  return { x: p?.x ?? 0, y: p?.y ?? 0 };
}

const OX: Record<string, number> = { left: 0, center: 0.5, right: 1 };
const OY: Record<string, number> = { top: 0, center: 0.5, bottom: 1 };

/** Scene coords → element-local (unscaled) pixel space, origin at element top-left. */
export function sceneToElement(obj: any, x: number, y: number): WarpPoint {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  const ox = (OX[obj.originX ?? "left"] ?? 0) * w;
  const oy = (OY[obj.originY ?? "top"] ?? 0) * h;
  const rad = ((obj.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = (obj.scaleX ?? 1) * (obj.flipX ? -1 : 1);
  const sy = (obj.scaleY ?? 1) * (obj.flipY ? -1 : 1);
  const dx = x - (obj.left ?? 0);
  const dy = y - (obj.top ?? 0);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return { x: lx / sx + ox, y: ly / sy + oy };
}

/** Element-local (unscaled) pixel space → scene coords. */
export function elementToScene(obj: any, x: number, y: number): WarpPoint {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  const ox = (OX[obj.originX ?? "left"] ?? 0) * w;
  const oy = (OY[obj.originY ?? "top"] ?? 0) * h;
  const rad = ((obj.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = (obj.scaleX ?? 1) * (obj.flipX ? -1 : 1);
  const sy = (obj.scaleY ?? 1) * (obj.flipY ? -1 : 1);
  const lx = (x - ox) * sx;
  const ly = (y - oy) * sy;
  return {
    x: (obj.left ?? 0) + lx * cos - ly * sin,
    y: (obj.top ?? 0) + lx * sin + ly * cos,
  };
}

export interface WarpSession {
  overlay: HTMLDivElement;
  wrapper: HTMLDivElement;
  bar: HTMLDivElement;
  applyBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

/**
 * Create a full-screen warp session UI: a fixed overlay (backdrop is
 * pointer-events none; children such as handles opt in) plus an Apply/Cancel
 * bar. Escape cancels. Remove everything via closeSession().
 */
export function sessionOverlay(onApply: () => void, onCancel: () => void): WarpSession {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;inset:0;z-index:200;pointer-events:none;";

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;top:14px;right:16px;display:flex;gap:8px;pointer-events:auto;z-index:201;";

  const applyBtn = sessionButton("Apply", true);
  const cancelBtn = sessionButton("Cancel", false);
  applyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onApply();
  });
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onCancel();
  });
  bar.append(applyBtn, cancelBtn);
  wrapper.append(overlay, bar);
  document.body.appendChild(wrapper);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  window.addEventListener("keydown", onKey);
  (wrapper as any).__kayEscape = onKey;

  return { overlay, wrapper, bar, applyBtn, cancelBtn };
}

function sessionButton(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    `padding:6px 14px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;` +
    `border:1px solid ${primary ? "#6366f1" : "rgba(255,255,255,0.15)"};` +
    `background:${primary ? "#6366f1" : "rgba(15,17,26,0.92)"};` +
    `color:${primary ? "#ffffff" : "#d1d5db"};box-shadow:0 4px 12px rgba(0,0,0,0.4);`;
  return b;
}

/** Remove a session overlay and its listeners. Accepts the WarpSession or the overlay div. */
export function closeSession(session: any) {
  const wrapper = session?.wrapper ?? session?.overlay?.wrapper ?? session?.parentElement;
  if (!wrapper) return;
  const onKey = (wrapper as any).__kayEscape;
  if (onKey) window.removeEventListener("keydown", onKey);
  wrapper.remove();
}

/** Small draggable square handle (absolutely positioned; place with placeAt). */
export function sessionHandle(): HTMLDivElement {
  const d = document.createElement("div");
  d.style.cssText =
    "position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;" +
    "background:#8a95fb;border:1.5px solid #fff;border-radius:2px;pointer-events:auto;cursor:grab;" +
    "box-shadow:0 0 5px rgba(0,0,0,0.6);z-index:5;";
  return d;
}

/** Place an element at viewport screen coords inside the session overlay. */
export function placeAt(overlay: HTMLDivElement, el: HTMLElement, sx: number, sy: number) {
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  overlay.appendChild(el);
}

/** Full-viewport SVG layer for drawing warp grid lines (screen coords). */
export function sessionSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute(
    "style",
    "position:absolute;inset:0;overflow:visible;pointer-events:none;"
  );
  return svg;
}

export function svgLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "rgba(255,255,255,0.85)",
  width = 1.5
) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", String(width));
  svg.appendChild(line);
}

export function svgPolygon(
  svg: SVGSVGElement,
  pts: WarpPoint[],
  color = "rgba(255,255,255,0.85)",
  width = 1.5
) {
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
  poly.setAttribute("fill", "rgba(138,149,251,0.08)");
  poly.setAttribute("stroke", color);
  poly.setAttribute("stroke-width", String(width));
  svg.appendChild(poly);
}

/** Require an active IMAGE layer; alerts and returns null otherwise. */
export function activeImageElement(canvas: any): { obj: any; el: any } | null {
  const obj = canvas?.getActiveObject?.();
  const el = obj?.getElement?.();
  if (!obj || obj.type !== "image" || !el || !el.width || !el.height) {
    window.alert("Select an image layer first.");
    return null;
  }
  return { obj, el };
}

/** Clone the active layer element's pixels into a standalone canvas. */
export function cloneElementPixels(el: any): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = el.width;
  c.height = el.height;
  const g = c.getContext("2d")!;
  g.drawImage(el, 0, 0);
  return c;
}

/** Clamped bilinear RGBA sampler over a Uint8ClampedArray (writes 4 values to out). */
export function makeSampler(src: Uint8ClampedArray, w: number, h: number) {
  const xMax = w - 1;
  const yMax = h - 1;
  return function sample(x: number, y: number, out: number[]) {
    const ix = x < 0 ? 0 : x > xMax ? xMax : x;
    const iy = y < 0 ? 0 : y > yMax ? yMax : y;
    const x0 = Math.floor(ix);
    const y0 = Math.floor(iy);
    const x1 = x0 < xMax ? x0 + 1 : x0;
    const y1 = y0 < yMax ? y0 + 1 : y0;
    const tx = ix - x0;
    const ty = iy - y0;
    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;
    for (let c = 0; c < 4; c++) {
      const top = src[i00 + c] * (1 - tx) + src[i10 + c] * tx;
      const bot = src[i01 + c] * (1 - tx) + src[i11 + c] * tx;
      out[c] = top * (1 - ty) + bot * ty;
    }
  };
}

/** Wire a handle element to window-level pointer drag tracking. */
export function startDrag(
  el: HTMLElement,
  onMove: (e: PointerEvent) => void,
  onEnd?: () => void
) {
  const move = (e: PointerEvent) => {
    e.preventDefault();
    onMove(e);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.();
  };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}
