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
  svgPolygon,
  startDrag,
  type WarpPoint,
} from "@/engine/warpShared";

/**
 * Perspective warp: 4 corner handles define a (possibly non-rectangular)
 * quad. On Apply a homography mapping the quad onto the object's full
 * rectangle is computed by solving the standard 8-unknown linear system
 * (Gaussian elimination), inverted, and the output is resampled.
 */
export function startPerspectiveWarp(canvas: any) {
  const read = activeImageElement(canvas);
  if (!read) return;
  const { obj, el } = read;
  const w = el.width;
  const h = el.height;

  const corners: WarpPoint[] = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];

  let session: any = null;

  const apply = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
    void applyPerspective(canvas, corners, w, h);
  };
  const cancel = () => {
    const s = session;
    session = null;
    if (s) closeSession(s);
  };

  session = sessionOverlay(apply, cancel);
  const svg = sessionSvg();
  session.overlay.appendChild(svg);

  const handles = corners.map(() => sessionHandle());
  handles.forEach((handle, idx) => {
    startDrag(handle, (e) => {
      const sc = screenToScene(canvas, e);
      corners[idx] = sceneToElement(obj, sc.x, sc.y);
      redraw();
    });
  });

  const redraw = () => {
    if (!session) return;
    svg.replaceChildren();
    const screen = corners.map((p) => {
      const sp = elementToScene(obj, p.x, p.y);
      return sceneToScreen(canvas, sp.x, sp.y);
    });
    svgPolygon(svg, screen);
    screen.forEach((s, idx) => {
      placeAt(session.overlay, handles[idx], s.x, s.y);
    });
  };

  redraw();
}

function applyPerspective(canvas: any, corners: WarpPoint[], w: number, h: number) {
  const srcQuad: number[][] = corners.map((p) => [p.x + w / 2, p.y + h / 2]);
  const dstQuad: number[][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];

  const H = solveHomography(srcQuad, dstQuad);
  if (!H) {
    window.alert("Degenerate quad — corners must form a valid quadrilateral.");
    return;
  }
  const Hinv = invertHomography(H);

  const obj = canvas?.getActiveObject?.();
  const work = cloneElementPixels(obj?.getElement?.());
  const img = work.getContext("2d")!.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src.length);
  const sample = makeSampler(src, w, h);
  const tmp: number[] = [0, 0, 0, 0];

  const m00 = Hinv[0][0];
  const m01 = Hinv[0][1];
  const m02 = Hinv[0][2];
  const m10 = Hinv[1][0];
  const m11 = Hinv[1][1];
  const m12 = Hinv[1][2];
  const m20 = Hinv[2][0];
  const m21 = Hinv[2][1];
  const m22 = Hinv[2][2];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sw = m20 * px + m21 * py + m22;
      if (Math.abs(sw) < 1e-9) {
        const o = (py * w + px) * 4;
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }
      const sx = (m00 * px + m01 * py + m02) / sw;
      const sy = (m10 * px + m11 * py + m12) / sw;
      sample(sx, sy, tmp);
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

/**
 * Solve for a 3x3 homography (h33 = 1) mapping 4 source points to 4
 * destination points via an 8x8 Gaussian-elimination linear solve.
 * Returns null on a degenerate (singular) system.
 */
function solveHomography(src: number[][], dst: number[][]): number[][] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = src[k];
    const [u, v] = dst[k];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const x = gaussianSolve(A, b);
  if (!x) return null;
  return [
    [x[0], x[1], x[2]],
    [x[3], x[4], x[5]],
    [x[6], x[7], 1],
  ];
}

function gaussianSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

function invertHomography(h: number[][]): number[][] {
  const a = h[0][0];
  const b = h[0][1];
  const c = h[0][2];
  const d = h[1][0];
  const e = h[1][1];
  const f = h[1][2];
  const g = h[2][0];
  const i = h[2][1];
  const j = h[2][2];
  const A = e * j - f * i;
  const B = c * i - b * j;
  const C = b * f - c * e;
  const D = f * g - d * j;
  const E = a * j - c * g;
  const F = c * d - a * f;
  const G = d * i - e * g;
  const H = b * g - a * i;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-12) return h;
  const inv = 1 / det;
  return [
    [A * inv, D * inv, G * inv],
    [B * inv, E * inv, H * inv],
    [C * inv, F * inv, I * inv],
  ];
}
