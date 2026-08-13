/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import {
  activeImageElement,
  closeSession,
  cloneElementPixels,
  elementToScene,
  makeSampler,
  placeAt,
  sceneToElement,
  sceneToScreen,
  screenToScene,
  sessionHandle,
  sessionOverlay,
  sessionSvg,
  svgLine,
  startDrag,
  type WarpPoint,
} from "@/engine/warpShared";

const ROWS = 4;
const COLS = 4;

/**
 * Mesh warp: a 4x4 grid of draggable control points over the active image
 * layer. Dragging a point deforms the mesh; on Apply each output pixel is
 * displaced by the bilinear interpolation of the 4 surrounding corner
 * displacements and resampled from the source.
 */
export function startMeshWarp(canvas: any) {
  const read = activeImageElement(canvas);
  if (!read) return;
  const { obj, el } = read;
  const w = el.width;
  const h = el.height;

  const orig: WarpPoint[][] = [];
  const pts: WarpPoint[][] = [];
  for (let i = 0; i < ROWS; i++) {
    orig.push([]);
    pts.push([]);
    for (let j = 0; j < COLS; j++) {
      const x = (j / (COLS - 1) - 0.5) * w;
      const y = (i / (ROWS - 1) - 0.5) * h;
      orig[i].push({ x, y });
      pts[i].push({ x, y });
    }
  }

  const handles: HTMLDivElement[][] = [];
  const svg = sessionSvg();
  let session: { overlay: HTMLDivElement } | null = null;

  const apply = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
    void applyMesh(canvas, pts, orig, w, h);
  };
  const cancel = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
  };

  session = sessionOverlay(apply, cancel);
  session.overlay.appendChild(svg);

  const redraw = () => {
    if (!session) return;
    svg.replaceChildren();
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const p = elementToScene(obj, pts[i][j].x, pts[i][j].y);
        const s = sceneToScreen(canvas, p.x, p.y);
        placeAt(session.overlay, handles[i][j], s.x, s.y);
        if (j < COLS - 1) {
          const b = elementToScene(obj, pts[i][j + 1].x, pts[i][j + 1].y);
          const sb = sceneToScreen(canvas, b.x, b.y);
          svgLine(svg, s.x, s.y, sb.x, sb.y);
        }
        if (i < ROWS - 1) {
          const b = elementToScene(obj, pts[i + 1][j].x, pts[i + 1][j].y);
          const sb = sceneToScreen(canvas, b.x, b.y);
          svgLine(svg, s.x, s.y, sb.x, sb.y);
        }
      }
    }
  };

  for (let i = 0; i < ROWS; i++) {
    handles.push([]);
    for (let j = 0; j < COLS; j++) {
      const handle = sessionHandle();
      handles[i].push(handle);
      startDrag(handle, (e) => {
        const sc = screenToScene(canvas, e);
        pts[i][j] = sceneToElement(obj, sc.x, sc.y);
        redraw();
      });
    }
  }
  redraw();
}

function applyMesh(
  canvas: any,
  pts: WarpPoint[][],
  orig: WarpPoint[][],
  w: number,
  h: number
) {
  const obj = canvas?.getActiveObject?.();
  const work = cloneElementPixels(obj?.getElement?.());
  const img = work.getContext("2d")!.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src.length);
  const sample = makeSampler(src, w, h);
  const cw = w / (COLS - 1);
  const ch = h / (ROWS - 1);
  const tmp: number[] = [0, 0, 0, 0];

  for (let py = 0; py < h; py++) {
    const v = py - h / 2;
    const ciRaw = Math.floor((v + h / 2) / ch);
    const ci = ciRaw < 0 ? 0 : ciRaw > ROWS - 2 ? ROWS - 2 : ciRaw;
    const tv = (v + h / 2 - ci * ch) / ch;
    for (let px = 0; px < w; px++) {
      const u = px - w / 2;
      const cjRaw = Math.floor((u + w / 2) / cw);
      const cj = cjRaw < 0 ? 0 : cjRaw > COLS - 2 ? COLS - 2 : cjRaw;
      const tu = (u + w / 2 - cj * cw) / cw;

      const p00 = pts[ci][cj];
      const p10 = pts[ci][cj + 1];
      const p01 = pts[ci + 1][cj];
      const p11 = pts[ci + 1][cj + 1];
      const o00 = orig[ci][cj];
      const o10 = orig[ci][cj + 1];
      const o01 = orig[ci + 1][cj];
      const o11 = orig[ci + 1][cj + 1];

      const w00 = (1 - tu) * (1 - tv);
      const w10 = tu * (1 - tv);
      const w01 = (1 - tu) * tv;
      const w11 = tu * tv;
      const dx =
        w00 * (p00.x - o00.x) + w10 * (p10.x - o10.x) + w01 * (p01.x - o01.x) + w11 * (p11.x - o11.x);
      const dy =
        w00 * (p00.y - o00.y) + w10 * (p10.y - o10.y) + w01 * (p01.y - o01.y) + w11 * (p11.y - o11.y);

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
