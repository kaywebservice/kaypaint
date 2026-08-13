/* eslint-disable @typescript-eslint/no-explicit-any */

import { Image as FabricImage } from "fabric";
import { useDocStore } from "@/store/documentStore";
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";
import { nextObjectId } from "@/utils/imageUtils";
import { pickImages, fileToDataURL } from "@/engine/actionsEngine";
import { loadImageCanvas } from "@/engine/pixelOps";
import { syncCanvasSizeStore } from "@/engine/canvasSizeEngine";

export interface PairOffset {
  dx: number;
  dy: number;
  score: number;
}

export interface LumaSample {
  data: Float32Array;
  w: number;
  h: number;
}

/** Read a File into an offscreen canvas element. */
function loadFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return fileToDataURL(file).then((url) => loadImageCanvas(url));
}

/** Load picked image files into offscreen canvases (unreadable files are skipped). */
export async function loadImageFiles(files: File[]): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = [];
  for (const f of files) {
    try {
      out.push(await loadFileToCanvas(f));
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

/** Downscaled luminance array of a canvas (drawn on white for transparency). */
export function sampleLuma(src: HTMLCanvasElement, targetMax: number): LumaSample {
  const scale = Math.min(1, targetMax / Math.max(1, Math.max(src.width, src.height)));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    data[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  return { data, w, h };
}

/** Normalized cross-correlation over the overlap of two luma samples at offset (ox, oy). */
function corrScore(
  a: Float32Array,
  aw: number,
  ah: number,
  b: Float32Array,
  bw: number,
  bh: number,
  ox: number,
  oy: number,
  stride: number
): number {
  const x0 = Math.max(0, ox);
  const x1 = Math.min(aw, ox + bw);
  const y0 = Math.max(0, oy);
  const y1 = Math.min(ah, oy + bh);
  if (x1 - x0 < 4 || y1 - y0 < 4) return -Infinity;
  let n = 0;
  let ma = 0;
  let mb = 0;
  for (let y = y0; y < y1; y += stride) {
    const ra = y * aw;
    const rb = (y - oy) * bw;
    for (let x = x0; x < x1; x += stride) {
      ma += a[ra + x];
      mb += b[rb + (x - ox)];
      n++;
    }
  }
  if (!n) return -Infinity;
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let y = y0; y < y1; y += stride) {
    const ra = y * aw;
    const rb = (y - oy) * bw;
    for (let x = x0; x < x1; x += stride) {
      const av = a[ra + x] - ma;
      const bv = b[rb + (x - ox)] - mb;
      num += av * bv;
      da += av * av;
      db += bv * bv;
    }
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : -Infinity;
}

/**
 * Best translation of image b relative to image a (in a's pixel space) using
 * coarse-to-fine normalized cross-correlation of downscaled luminance.
 */
export function findPairOffset(a: HTMLCanvasElement, b: HTMLCanvasElement): PairOffset {
  const maxDim = Math.max(a.width, a.height, b.width, b.height);
  const targets = [100, 512, 1600].filter((t) => t < maxDim);
  if (maxDim <= 2048) targets.push(maxDim);
  if (!targets.length) targets.push(maxDim);

  let best = { dx: 0, dy: 0, score: -Infinity };
  let prevScale = 0;
  for (let i = 0; i < targets.length; i++) {
    const sa = sampleLuma(a, targets[i]);
    const sb = sampleLuma(b, targets[i]);
    const scale = Math.min(1, targets[i] / maxDim);
    if (scale === prevScale) continue;
    prevScale = scale;

    let dx0: number;
    let dx1: number;
    let dy0: number;
    let dy1: number;
    if (i === 0) {
      dx0 = -Math.round(sa.w * 0.9);
      dx1 = Math.round(sb.w * 0.9);
      dy0 = -Math.round(sa.h * 0.9);
      dy1 = Math.round(sb.h * 0.9);
    } else {
      const ratio = scale / prevScale;
      const m = Math.ceil((i === targets.length - 1 ? 2 : 5) * ratio) + 1;
      const cx = Math.round(best.dx * ratio);
      const cy = Math.round(best.dy * ratio);
      dx0 = cx - m;
      dx1 = cx + m;
      dy0 = cy - m;
      dy1 = cy + m;
    }
    if (dx1 - dx0 < 1 || dy1 - dy0 < 1) continue;

    const stepSize = i === 0 ? 2 : 1;
    const stride = i < targets.length - 1 ? 1 : sa.w * sa.h > 400000 ? 2 : 1;
    let bx = 0;
    let by = 0;
    let bs = -Infinity;
    for (let dy = dy0; dy <= dy1; dy += stepSize) {
      for (let dx = dx0; dx <= dx1; dx += stepSize) {
        const s = corrScore(sa.data, sa.w, sa.h, sb.data, sb.w, sb.h, dx, dy, stride);
        if (s > bs) {
          bs = s;
          bx = dx;
          by = dy;
        }
      }
    }
    best = { dx: bx, dy: by, score: bs };
  }
  const scale = Math.min(1, targets[targets.length - 1] / maxDim);
  return { dx: best.dx / scale, dy: best.dy / scale, score: best.score };
}

/** Apply an alpha ramp (destination-in) across a band of an image copy. */
function feathered(
  src: HTMLCanvasElement,
  from: number,
  to: number,
  horizontal: boolean,
  fadeOut: boolean
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const a = Math.max(0, from);
  const b = Math.min(horizontal ? c.width : c.height, to);
  if (b - a < 1) return c;
  const grad = g.createLinearGradient(
    horizontal ? a : 0,
    horizontal ? 0 : a,
    horizontal ? b : 0,
    horizontal ? 0 : b
  );
  const opaque = fadeOut ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)";
  const clear = fadeOut ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)";
  grad.addColorStop(0, opaque);
  grad.addColorStop(1, clear);
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = grad;
  if (horizontal) g.fillRect(a, 0, b - a, c.height);
  else g.fillRect(0, a, c.width, b - a);
  return c;
}

/**
 * Stitch images side by side using the given pairwise offsets, cross-fading
 * each overlapping band with an alpha ramp.
 */
export function buildPanorama(images: HTMLCanvasElement[], offsets: PairOffset[]): HTMLCanvasElement {
  const n = images.length;
  const px = new Array<number>(n).fill(0);
  const py = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    px[i] = px[i - 1] + offsets[i - 1].dx;
    py[i] = py[i - 1] + offsets[i - 1].dy;
  }
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, px[i]);
    minY = Math.min(minY, py[i]);
    maxX = Math.max(maxX, px[i] + images[i].width);
    maxY = Math.max(maxY, py[i] + images[i].height);
  }
  const W = Math.max(1, Math.round(maxX - minX));
  const H = Math.max(1, Math.round(maxY - minY));
  let horiz = 0;
  let vert = 0;
  for (const o of offsets) {
    horiz += Math.abs(o.dx);
    vert += Math.abs(o.dy);
  }
  const horizontal = horiz >= vert;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  for (let i = 0; i < n; i++) {
    let src = images[i];
    const x = px[i] - minX;
    const y = py[i] - minY;
    if (i > 0) {
      const pj = images[i - 1];
      const ppx = px[i - 1] - minX;
      const ppy = py[i - 1] - minY;
      const oL = Math.max(x, ppx);
      const oT = Math.max(y, ppy);
      const oR = Math.min(x + src.width, ppx + pj.width);
      const oB = Math.min(y + src.height, ppy + pj.height);
      if (oR - oL >= 2 && oB - oT >= 2) {
        src = feathered(src, horizontal ? oL - x : oT - y, horizontal ? oR - x : oB - y, horizontal, false);
      }
    }
    if (i < n - 1) {
      const pj = images[i + 1];
      const ppx = px[i + 1] - minX;
      const ppy = py[i + 1] - minY;
      const oL = Math.max(x, ppx);
      const oT = Math.max(y, ppy);
      const oR = Math.min(x + src.width, ppx + pj.width);
      const oB = Math.min(y + src.height, ppy + pj.height);
      if (oR - oL >= 2 && oB - oT >= 2) {
        src = feathered(src, horizontal ? oL - x : oT - y, horizontal ? oR - x : oB - y, horizontal, true);
      }
    }
    g.drawImage(src, x, y);
  }
  return out;
}

/**
 * Estimate the tilt of a panorama in degrees (positive when the right side is
 * lower) from the vertical shift between left and right border strips.
 */
export function estimateTiltAngle(src: HTMLCanvasElement): number {
  const s = sampleLuma(src, 300);
  const { data, w, h } = s;
  if (w < 40 || h < 20) return 0;
  const stripW = Math.max(4, Math.round(w * 0.2));
  const sep = w - stripW;
  const maxShift = Math.max(1, Math.round(h * 0.3));
  let bestShift = 0;
  let bestScore = -Infinity;
  for (let dy = -maxShift; dy <= maxShift; dy += 1) {
    const y0 = Math.max(0, -dy);
    const y1 = Math.min(h, h - dy);
    if (y1 - y0 < 4) continue;
    let n = 0;
    let ma = 0;
    let mb = 0;
    for (let y = y0; y < y1; y++) {
      const rl = y * w;
      const rr = (y + dy) * w + stripW;
      for (let x = 0; x < stripW; x++) {
        ma += data[rl + x];
        mb += data[rr + x];
        n++;
      }
    }
    if (!n) continue;
    ma /= n;
    mb /= n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let y = y0; y < y1; y++) {
      const rl = y * w;
      const rr = (y + dy) * w + stripW;
      for (let x = 0; x < stripW; x++) {
        const av = data[rl + x] - ma;
        const bv = data[rr + x] - mb;
        num += av * bv;
        da += av * av;
        db += bv * bv;
      }
    }
    const den = Math.sqrt(da * db);
    if (den > 0) {
      const c = num / den;
      if (c > bestScore) {
        bestScore = c;
        bestShift = dy;
      }
    }
  }
  if (bestScore < 0.6 || Math.abs(bestShift) < 1) return 0;
  return (Math.atan2(bestShift, sep) * 180) / Math.PI;
}

/** Rotate a canvas around its center and trim the transparent borders. */
export function rotateTrim(src: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const W = Math.max(1, Math.round(src.width * cos + src.height * sin));
  const H = Math.max(1, Math.round(src.width * sin + src.height * cos));
  const rot = document.createElement("canvas");
  rot.width = W;
  rot.height = H;
  const g = rot.getContext("2d")!;
  g.translate(W / 2, H / 2);
  g.rotate(rad);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  const px = g.getImageData(0, 0, W, H).data;
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return rot;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(rot, -minX, -minY);
  return out;
}

/**
 * Install a rendered result as a new document in the app: creates a fresh
 * document tab, swaps the canvas content and layer store, and stores the
 * snapshot. The previous document's snapshot is restored after the doc-switch
 * commit so it is not overwritten by the canvas swap.
 */
export function installNewDocument(src: HTMLCanvasElement, name: string): boolean {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return false;
  let prevJson: string | null = null;
  let prevGroupsJson: string | null = null;
  const prevId = useDocStore.getState().activeDocId;
  const prevDoc = useDocStore.getState().docs.find((d) => d.id === prevId);
  try {
    prevJson = prevDoc?.data ?? JSON.stringify(canvas.toJSON());
    prevGroupsJson = prevDoc?.groups ?? JSON.stringify(useLayerStore.getState().groups);
  } catch {
    prevJson = prevDoc?.data ?? null;
    prevGroupsJson = prevDoc?.groups ?? null;
  }

  canvas.getObjects().forEach((o: any) => canvas.remove(o));
  canvas.setDimensions({ width: src.width, height: src.height });
  canvas.backgroundColor = "white";
  canvas.discardActiveObject();
  const obj = new FabricImage(src, {
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
  });
  const objectId = nextObjectId();
  obj.set({ kaypaintId: objectId } as any);
  obj.setCoords();
  canvas.add(obj);
  canvas.setActiveObject(obj);
  canvas.requestRenderAll();

  useLayerStore.setState({
    layers: [
      {
        id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "Background",
        type: "image",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        hasMask: false,
        objectId,
      },
    ],
    activeLayer: null,
    groups: [],
  });
  syncCanvasSizeStore(canvas);

  const docStore = useDocStore.getState();
  docStore.createDoc();
  const docId = useDocStore.getState().activeDocId;
  docStore.renameDoc(docId, name);
  let json: string | null = null;
  try {
    json = JSON.stringify(canvas.toJSON());
  } catch {
    /* fall back to an empty snapshot */
  }
  docStore.updateDocData(docId, json ?? "[]", "[]");
  if (prevId !== docId) {
    window.setTimeout(() => {
      docStore.updateDocData(prevId, prevJson ?? "[]", prevGroupsJson ?? "[]");
    }, 30);
  }
  useEditorStore.getState().history?.push?.();
  return true;
}

/**
 * File > Automate > Photomerge: pick 2+ images, correlate each consecutive
 * pair, stitch with feathered overlaps, auto-straighten and install the
 * panorama as a new document.
 */
export async function photomergeDialog(): Promise<void> {
  const files = await pickImages(true);
  if (files.length < 2) {
    window.alert("Photomerge requires at least 2 images selected in one batch.");
    return;
  }
  const loaded = await loadImageFiles(files);
  if (loaded.length !== files.length) {
    window.alert("One or more selected images could not be loaded.");
    return;
  }
  const offsets: PairOffset[] = [];
  for (let i = 0; i < loaded.length - 1; i++) {
    offsets.push(findPairOffset(loaded[i], loaded[i + 1]));
  }
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i].score < 0.5) {
      window.alert(
        `Photomerge could not find a confident overlap between "${files[i].name}" and "${files[i + 1].name}". Try images with more shared content.`
      );
      return;
    }
  }
  let out = buildPanorama(loaded, offsets);
  const tilt = estimateTiltAngle(out);
  if (Math.abs(tilt) > 0.1) out = rotateTrim(out, -tilt);
  installNewDocument(out, "Panorama");
}