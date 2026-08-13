/* eslint-disable @typescript-eslint/no-explicit-any */
import { Image as FabricImage } from "fabric";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import {
  applyPixelsToActiveLayer,
  compositeCanvas,
  flattenToLayer,
  readActivePixels,
} from "@/engine/pixelOps";
import { syncCanvasSizeStore } from "@/engine/canvasSizeEngine";
import { geminiGenerate } from "@/lib/geminiClient";

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function lumAt(b: Uint8ClampedArray, o: number): number {
  return 0.299 * b[o] + 0.587 * b[o + 1] + 0.114 * b[o + 2];
}

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

function separableBlur(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  kern: Float64Array,
  m: number,
  stride: number
): void {
  const src = new Uint8ClampedArray(data);
  const mid = new Float64Array(w * h * 4);
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

function gaussianBlur(data: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) return;
  const g = gaussKernel(radius);
  separableBlur(data, w, h, g.k, g.m, g.stride);
}

function medianBlur(data: Uint8ClampedArray, w: number, h: number, r: number): void {
  const radius = Math.max(1, Math.round(r));
  const src = new Uint8ClampedArray(data);
  const med = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const keys: number[] = [];
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        const ky = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -radius; dx <= radius; dx++) {
          const kx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const i = (ky * w + kx) * 4;
          keys.push(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
          rs.push(src[i]);
          gs.push(src[i + 1]);
          bs.push(src[i + 2]);
        }
      }
      const idx = keys.map((_, i) => i).sort((a, b) => keys[a] - keys[b]);
      const p = idx[Math.floor(idx.length / 2)];
      const o = (y * w + x) * 4;
      med[0] = rs[p];
      med[1] = gs[p];
      med[2] = bs[p];
      data[o] = med[0];
      data[o + 1] = med[1];
      data[o + 2] = med[2];
      data[o + 3] = src[o + 3];
    }
  }
}

function unsharpMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number,
  radius: number,
  threshold: number
): void {
  const orig = new Uint8ClampedArray(data);
  gaussianBlur(data, w, h, radius);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (Math.abs(lumAt(orig, o) - lumAt(data, o)) > threshold) {
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

function autoContrast(data: Uint8ClampedArray, w: number, h: number): void {
  const n = w * h;
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const l = Math.round(lumAt(data, o));
    hist[clamp(l, 0, 255)] += data[o + 3] / 255;
  }
  const total = Math.max(1, n * 0.002);
  let lo = 0;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= total) {
      lo = i;
      break;
    }
  }
  let hi = 255;
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= total) {
      hi = i;
      break;
    }
  }
  const span = Math.max(1, hi - lo);
  const scale = 255 / span;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const l = clamp(lumAt(data, o) - lo, 0, 255) * scale;
    const f = l / Math.max(0.001, lumAt(data, o));
    data[o] = clamp(data[o] * f, 0, 255);
    data[o + 1] = clamp(data[o + 1] * f, 0, 255);
    data[o + 2] = clamp(data[o + 2] * f, 0, 255);
  }
}

function weightedMean(data: Uint8ClampedArray, n: number): [number, number, number] {
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

async function loadOpenCVFromCDN(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("OpenCV only available in browser");
  }
  if ((window as any).cv) {
    return (window as any).cv;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.onload = () => {
      const cv = (window as any).cv;
      if (cv) resolve(cv);
      else reject(new Error("OpenCV failed to load"));
    };
    script.onerror = () => reject(new Error("Could not load OpenCV from CDN"));
    document.head.appendChild(script);
  });
}

/** Rasterize a fabric object into a document-sized canvas at its own position. */
function renderObjectToCanvas(obj: any, width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d")!;
  const el = obj.toCanvasElement({
    multiplier: 1,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  });
  g.drawImage(el, 0, 0);
  return c;
}

/** Apply a pixel transform to the active object, or to the flattened document. */
async function applyToCanvasOrActive(
  canvas: any,
  fn: (data: Uint8ClampedArray, width: number, height: number) => void
): Promise<boolean> {
  if (!canvas) return false;
  if (canvas.getActiveObject?.()) {
    return applyPixelsToActiveLayer(canvas, fn);
  }
  const composite = await compositeCanvas(canvas);
  if (!composite) return false;
  const g = composite.getContext("2d")!;
  const img = g.getImageData(0, 0, composite.width, composite.height);
  fn(img.data, composite.width, composite.height);
  g.putImageData(img, 0, 0);
  const done = await flattenToLayer(canvas, composite, "Background");
  syncCanvasSizeStore(canvas);
  return done;
}

async function imageFromCanvas(src: HTMLCanvasElement): Promise<any> {
  const url = src.toDataURL("image/png");
  if (url.length < 5000) {
    throw new Error("Generative operation produced no result");
  }
  return new Promise<any>((resolve, reject) => {
    FabricImage.fromURL(url, {}, {})
       .then((i: any) => resolve(i))
       .catch(reject);
  });
}

async function tryGemini(
  canvas: any,
  prompt: string,
  mode: "generate" | "inpaint" | "upscale",
  width?: number,
  height?: number
): Promise<HTMLCanvasElement | null> {
  const flat = await compositeCanvas(canvas);
  if (!flat) return null;
  const b64 = (flat as any).toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  const res = await geminiGenerate({ prompt, imageBase64: b64, mode, width, height });
  if (!res) return null;
  const img = new Image();
  img.src = res.dataUrl;
  const c = document.createElement("canvas");
  const load = new Promise<void>((resolve) => {
    img.onload = () => {
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve();
    };
  });
  await load;
  return c;
}

async function tryGeminiInpaint(canvas: any, region: any, prompt?: string): Promise<HTMLCanvasElement | null> {
  const bb = region.getBoundingRect();
  const cw = canvas.width, ch = canvas.height;
  const orig = canvas.toCanvasElement({ multiplier: 1 });
  const oc = document.createElement("canvas");
  oc.width = cw; oc.height = ch;
  const ocg = oc.getContext("2d")!;
  ocg.drawImage(orig, 0, 0);
  const result = await tryGemini(canvas, prompt ?? "fill this region to match the surroundings, blending edges", "inpaint");
  if (!result) return null;
  const comp = document.createElement("canvas");
  comp.width = cw; comp.height = ch;
  const cg = comp.getContext("2d")!;
  cg.drawImage(oc, 0, 0);
  cg.save();
  cg.beginPath();
  cg.rect(bb.left, bb.top, bb.width, bb.height);
  cg.clip();
  cg.drawImage(result, 0, 0, result.width, result.height, bb.left, bb.top, bb.width, bb.height);
  cg.restore();
  return comp;
}

async function insertGeneratedResult(canvas: any, resultCanvas: HTMLCanvasElement, prompt?: string): Promise<{ label: string }> {
  const img = await imageFromCanvas(resultCanvas);
  const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  img.set({ left: 0, top: 0, originX: "left", originY: "top", selectable: true, evented: true, kaypaintId: objectId });
  img.setCoords();
  canvas.insertAt(0, img);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  const label = prompt && prompt.trim() ? `Generative Fill: ${prompt.trim()}` : "Generative Fill";
  const active = canvas.getActiveObject?.();
  if (active && active.kaypaintId) {
    const layer = useLayerStore.getState().layers.find((l: any) => l.objectId === objectId);
    if (layer) useLayerStore.getState().setActiveLayer(layer.id);
  }
  return { label };
}



/**
 * Generative Fill: inpaint the active selection region (lasso / marquee /
 * shape) using OpenCV Telea inpainting. `prompt` is recorded in the layer name.
 */
export async function generativeFill(
  canvas: any,
  opts: { prompt?: string; radius?: number } = {}
): Promise<boolean> {
  if (!canvas) throw new Error("Canvas not ready");
  const region = canvas.getActiveObject();
  if (!region) throw new Error("Select a region first (lasso / marquee / shape)");
  const radius = Math.max(1, Math.round(opts.radius ?? 10));

  const cw = canvas.width;
  const ch = canvas.height;
  const bb = region.getBoundingRect();

  const genRes = await tryGeminiInpaint(canvas, region, opts.prompt);
  if (genRes) {
    await insertGeneratedResult(canvas, genRes, opts.prompt);
    return true;
  }

  const cv = await loadOpenCVFromCDN();

  const maskRender = region.toCanvasElement({
    multiplier: 1,
    width: Math.max(1, Math.round(bb.width)),
    height: Math.max(1, Math.round(bb.height)),
  });
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = cw;
  maskCanvas.height = ch;
  const mg = maskCanvas.getContext("2d")!;
  mg.drawImage(maskRender, bb.left, bb.top);

  const flatCanvas = canvas.toCanvasElement({ multiplier: 1 });
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = cw;
  fullCanvas.height = ch;
  const fg = fullCanvas.getContext("2d")!;
  fg.drawImage(flatCanvas, 0, 0);

  const src = cv.imread(fullCanvas);
  const mask = cv.imread(maskCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(mask, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.threshold(gray, gray, 16, 255, cv.THRESH_BINARY);
  const dst = new cv.Mat();
  cv.inpaint(src, gray, dst, radius, cv.INPAINT_TELEA);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = ch;
  cv.imshow(outCanvas, dst);

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = cw;
  resultCanvas.height = ch;
  const rg = resultCanvas.getContext("2d")!;
  rg.drawImage(fullCanvas, 0, 0);
  rg.drawImage(outCanvas, 0, 0);
  rg.globalCompositeOperation = "destination-in";
  rg.drawImage(maskCanvas, 0, 0);
  rg.globalCompositeOperation = "source-over";

  src.delete();
  mask.delete();
  gray.delete();
  dst.delete();

  const img = await imageFromCanvas(resultCanvas);
  const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
    kaypaintId: objectId,
  });
  img.setCoords();
  canvas.insertAt(0, img);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  const label = opts.prompt && opts.prompt.trim() ? `Generative Fill: ${opts.prompt.trim()}` : "Generative Fill";
  useLayerStore.getState().addCanvasLayer(label, objectId);
  useEditorStore.getState().history?.push?.();
  return true;
}

/**
 * Generative Expand: grow the canvas to the target size (default +25% each
 * dimension, centered) and inpaint the four border bands with OpenCV.
 */
export async function generativeExpand(
  canvas: any,
  opts: { width?: number; height?: number } = {}
): Promise<boolean> {
  if (!canvas) throw new Error("Canvas not ready");
  const cw = canvas.width;
  const ch = canvas.height;
  const newW = Math.max(cw + 1, Math.round(opts.width ?? cw * 1.25));
  const newH = Math.max(ch + 1, Math.round(opts.height ?? ch * 1.25));
  const dx = Math.max(0, Math.round((newW - cw) / 2));
  const dy = Math.max(0, Math.round((newH - ch) / 2));

  const expandRes = await tryGemini(canvas, `Extend this canvas to ${newW}x${newH} pixels, placing the existing content centered and seamlessly generating new background to fill the borders, matching lighting and style.`, "generate", newW, newH);
  if (expandRes) {
    canvas.setDimensions({ width: newW, height: newH });
    syncCanvasSizeStore(canvas);
    return flattenToLayer(canvas, expandRes, "Background");
  }

  const cv = await loadOpenCVFromCDN();

  const flatCanvas = canvas.toCanvasElement({ multiplier: 1 });
  const bigCanvas = document.createElement("canvas");
  bigCanvas.width = newW;
  bigCanvas.height = newH;
  const bg = bigCanvas.getContext("2d")!;
  bg.fillStyle = canvas.backgroundColor ?? "white";
  bg.fillRect(0, 0, newW, newH);
  bg.drawImage(flatCanvas, dx, dy);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = newW;
  maskCanvas.height = newH;
  const mg = maskCanvas.getContext("2d")!;
  mg.fillStyle = "white";
  mg.fillRect(0, 0, newW, newH);
  mg.fillStyle = "black";
  mg.fillRect(dx, dy, cw, ch);

  const src = cv.imread(bigCanvas);
  const mask = cv.imread(maskCanvas);
  const gray = new cv.Mat();
  cv.cvtColor(mask, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.threshold(gray, gray, 16, 255, cv.THRESH_BINARY);
  const dst = new cv.Mat();
  const radius = Math.max(4, Math.round(Math.min(newW, newH) / 40));
  cv.inpaint(src, gray, dst, radius, cv.INPAINT_TELEA);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = newW;
  outCanvas.height = newH;
  cv.imshow(outCanvas, dst);
  src.delete();
  mask.delete();
  gray.delete();
  dst.delete();

  canvas.setDimensions({ width: newW, height: newH });
  syncCanvasSizeStore(canvas);
  return flattenToLayer(canvas, outCanvas, "Background");
}

/**
 * Generative Upscale: resize the flattened canvas by `scale` with high-quality
 * interpolation, then apply an unsharp mask pass for detail.
 */
export async function generativeUpscale(canvas: any, scale = 2): Promise<boolean> {
  if (!canvas) throw new Error("Canvas not ready");
  const cw = canvas.width;
  const ch = canvas.height;
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));

  const upRes = await tryGemini(canvas, `Upscale this image to ${nw}x${nh} pixels, adding plausible fine detail, texture, and sharp edges, no blur or artifacts.`, "upscale", nw, nh);
  if (upRes) {
    canvas.setDimensions({ width: nw, height: nh });
    syncCanvasSizeStore(canvas);
    return flattenToLayer(canvas, upRes, "Background");
  }

  const flatCanvas = canvas.toCanvasElement({ multiplier: 1 });
  const bigCanvas = document.createElement("canvas");
  bigCanvas.width = nw;
  bigCanvas.height = nh;
  const g = bigCanvas.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(flatCanvas, 0, 0, nw, nh);
  const img = g.getImageData(0, 0, nw, nh);
  unsharpMask(img.data, nw, nh, 0.6, 1.5, 2);
  g.putImageData(img, 0, 0);
  canvas.setDimensions({ width: nw, height: nh });
  syncCanvasSizeStore(canvas);
  return flattenToLayer(canvas, bigCanvas, "Background");
}

/** Generative Remove: inpaint the active selection without any prompt. */
export async function generativeRemove(canvas: any): Promise<boolean> {
  return generativeFill(canvas, {});
}

/**
 * Harmonize: match the active layer's color and lighting to the layer directly
 * below it using per-channel gain plus a gamma adjustment on luminance.
 */
export async function harmonizeLayers(canvas: any): Promise<boolean> {
  if (!canvas) throw new Error("Canvas not ready");
  const active = canvas.getActiveObject?.();
  if (!active) throw new Error("Select a layer to harmonize");
  const objects = canvas.getObjects();
  const idx = objects.indexOf(active);
  let below: any = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (objects[i].type !== "SAdjustment") {
      below = objects[i];
      break;
    }
  }

  const bb = active.getBoundingRect();
  const rx = Math.max(0, Math.floor(bb.left));
  const ry = Math.max(0, Math.floor(bb.top));
  const rw = Math.min(canvas.width - rx, Math.max(1, Math.ceil(bb.width)));
  const rh = Math.min(canvas.height - ry, Math.max(1, Math.ceil(bb.height)));
  if (rw <= 0 || rh <= 0) throw new Error("Layer is outside the canvas");

  let belowCanvas: HTMLCanvasElement;
  if (below) {
    belowCanvas = renderObjectToCanvas(below, canvas.width, canvas.height);
  } else {
    const vis = active.visible;
    active.set({ visible: false });
    canvas.requestRenderAll();
    belowCanvas = canvas.toCanvasElement({ multiplier: 1 });
    active.set({ visible: vis });
    canvas.requestRenderAll();
  }
  const bg = belowCanvas.getContext("2d")!;
  const belowData = bg.getImageData(rx, ry, rw, rh).data;
  const belowMean = weightedMean(belowData, rw * rh);

  const read = readActivePixels(canvas);
  if (!read) return false;
  const activeMean = weightedMean(read.data, read.width * read.height);

  const gain = [
    clamp(belowMean[0] / Math.max(1, activeMean[0]), 0.4, 2.5),
    clamp(belowMean[1] / Math.max(1, activeMean[1]), 0.4, 2.5),
    clamp(belowMean[2] / Math.max(1, activeMean[2]), 0.4, 2.5),
  ];
  const lumBelow = 0.299 * belowMean[0] + 0.587 * belowMean[1] + 0.114 * belowMean[2];
  const lumActive = 0.299 * activeMean[0] + 0.587 * activeMean[1] + 0.114 * activeMean[2];
  const gamma = clamp(1 + ((lumBelow - lumActive) / 255) * 0.8, 0.6, 1.6);

  return applyPixelsToActiveLayer(canvas, (data, w, h) => {
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (data[o + 3] === 0) continue;
      const l = lumAt(data, o);
      const l2 = 255 * Math.pow(l / 255, gamma);
      const f = l > 0 ? l2 / l : 1;
      data[o] = clamp(data[o] * f * gain[0], 0, 255);
      data[o + 1] = clamp(data[o + 1] * f * gain[1], 0, 255);
      data[o + 2] = clamp(data[o + 2] * f * gain[2], 0, 255);
    }
  });
}

/**
 * Neural filter: Photo Restoration. Denoise (median), unsharp mask and
 * histogram-stretch auto contrast.
 */
export async function neuralPhotoRestoration(canvas: any, intensity = 50): Promise<boolean> {
  const amt = clamp(intensity, 0, 100);
  return applyToCanvasOrActive(canvas, (data, w, h) => {
    medianBlur(data, w, h, 1);
    unsharpMask(data, w, h, 0.4 + (amt / 100) * 0.7, 1.2, 2);
    autoContrast(data, w, h);
  });
}

/** Neural filter: Enhance Details. Unsharp mask plus a light denoise pass. */
export async function neuralEnhanceDetails(canvas: any, intensity = 50): Promise<boolean> {
  const amt = clamp(intensity, 0, 100);
  return applyToCanvasOrActive(canvas, (data, w, h) => {
    const orig = new Uint8ClampedArray(data);
    unsharpMask(data, w, h, 0.5 + (amt / 100) * 1.1, 1.5, 3);
    const denoised = new Uint8ClampedArray(data);
    medianBlur(denoised, w, h, 1);
    const k = 0.15 + (amt / 100) * 0.25;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      data[o] = clamp(data[o] + (denoised[o] - data[o]) * k, 0, 255);
      data[o + 1] = clamp(data[o + 1] + (denoised[o + 1] - data[o + 1]) * k, 0, 255);
      data[o + 2] = clamp(data[o + 2] + (denoised[o + 2] - data[o + 2]) * k, 0, 255);
      data[o + 3] = orig[o + 3];
    }
  });
}

/** Neural filter: Smart Portrait Defocus. Keep the center subject in focus. */
export async function neuralPortraitDefocus(canvas: any, intensity = 50): Promise<boolean> {
  const amt = clamp(intensity, 0, 100);
  return applyToCanvasOrActive(canvas, (data, w, h) => {
    const orig = new Uint8ClampedArray(data);
    const blurred = new Uint8ClampedArray(data);
    gaussianBlur(blurred, w, h, 1 + (amt / 100) * 24);
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.max(1, w * 0.437);
    const ry = Math.max(1, h * 0.437);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        let t = 0;
        if (d > 0.64) t = d >= 1.21 ? 1 : (d - 0.64) / 0.57;
        const o = (y * w + x) * 4;
        data[o] = orig[o] + (blurred[o] - orig[o]) * t;
        data[o + 1] = orig[o + 1] + (blurred[o + 1] - orig[o + 1]) * t;
        data[o + 2] = orig[o + 2] + (blurred[o + 2] - orig[o + 2]) * t;
        data[o + 3] = orig[o + 3];
      }
    }
  });
}

/** Neural filter: Super Zoom. Same upscale routine as Generative Upscale (2x). */
export async function neuralSuperZoom(canvas: any): Promise<boolean> {
  return generativeUpscale(canvas, 2);
}

/**
 * Correction filter: Reflection Removal. Desaturates highlight areas through a
 * soft mask and blurs bright reflection streaks into their surroundings.
 */
export async function reflectionRemoval(canvas: any, amount = 50): Promise<boolean> {
  const amt = clamp(amount, 0, 100);
  return applyToCanvasOrActive(canvas, (data, w, h) => {
    const orig = new Uint8ClampedArray(data);
    const blurred = new Uint8ClampedArray(data);
    gaussianBlur(blurred, w, h, 3);
    const wgt = amt / 100;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const r = orig[o];
      const g = orig[o + 1];
      const b = orig[o + 2];
      const maxC = Math.max(r, g, b);
      const lum = lumAt(orig, o);
      let hm = (maxC / 255 - 0.55) / 0.37;
      hm = hm < 0 ? 0 : hm > 1 ? 1 : hm;
      const dr = lum + (blurred[o] - lum) * 0.45;
      const dg = lum + (blurred[o + 1] - lum) * 0.45;
      const db = lum + (blurred[o + 2] - lum) * 0.45;
      const t = hm * wgt;
      data[o] = clamp(r + (dr - r) * t, 0, 255);
      data[o + 1] = clamp(g + (dg - g) * t, 0, 255);
      data[o + 2] = clamp(b + (db - b) * t, 0, 255);
      data[o + 3] = orig[o + 3];
    }
  });
}

/** Image adjustment: Clarity. Unsharp contrast on a midtone-weighted mask. */
export function adjClarity(amount: number) {
  const amt = clamp(amount, 0, 100) / 100;
  return (data: Uint8ClampedArray, w: number, h: number) => {
    if (amt <= 0) return;
    const orig = new Uint8ClampedArray(data);
    const blur = new Uint8ClampedArray(data);
    gaussianBlur(blur, w, h, Math.max(0.8, Math.min(w, h) / 20));
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const l = lumAt(orig, o);
      const mt = 1 - Math.abs(l - 128) / 128;
      const adj = (l - lumAt(blur, o)) * mt * amt * 2.5;
      data[o] = clamp(orig[o] + adj, 0, 255);
      data[o + 1] = clamp(orig[o + 1] + adj, 0, 255);
      data[o + 2] = clamp(orig[o + 2] + adj, 0, 255);
      data[o + 3] = orig[o + 3];
    }
  };
}

/**
 * Image adjustment: Dehaze. Subtracts the low-frequency haze layer and
 * contrast-stretches the result.
 */
export function adjDehaze(amount: number) {
  const amt = clamp(amount, 0, 100) / 100;
  return (data: Uint8ClampedArray, w: number, h: number) => {
    if (amt <= 0) return;
    const orig = new Uint8ClampedArray(data);
    const blur = new Uint8ClampedArray(data);
    gaussianBlur(blur, w, h, Math.max(2, Math.min(w, h) / 15));
    let sum = 0;
    for (let i = 0; i < w * h; i++) sum += lumAt(blur, i * 4);
    const meanL = sum / Math.max(1, w * h);
    const f = amt * 0.9;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const l = lumAt(orig, o);
      const bl = lumAt(blur, o);
      const l2 = l - (bl - meanL) * f;
      const l3 = clamp(128 + (l2 - meanL) * (1 + f), 0, 255);
      const k = l > 0 ? l3 / l : 1;
      data[o] = clamp(orig[o] * k, 0, 255);
      data[o + 1] = clamp(orig[o + 1] * k, 0, 255);
      data[o + 2] = clamp(orig[o + 2] * k, 0, 255);
      data[o + 3] = orig[o + 3];
    }
  };
}

/** Image adjustment: Grain. Adds film-grain style noise scaled by amount. */
export function adjGrain(amount: number) {
  const amt = clamp(amount, 0, 100) / 100;
  return (data: Uint8ClampedArray, w: number, h: number) => {
    if (amt <= 0) return;
    void h;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() * 2 - 1) * amt * 48;
      data[i] = clamp(data[i] + n, 0, 255);
      data[i + 1] = clamp(data[i + 1] + n, 0, 255);
      data[i + 2] = clamp(data[i + 2] + n, 0, 255);
    }
  };
}

export interface ColorVibranceParams {
  red: number;
  green: number;
  blue: number;
  cyan: number;
  magenta: number;
  yellow: number;
  vibrance: number;
}

/**
 * Image adjustment: Color and Vibrance. Per-channel R/G/B/C/M/Y balance plus
 * a selective saturation boost that protects already-saturated pixels.
 */
export function adjColorAndVibrance(p: ColorVibranceParams) {
  const rB = clamp(p.red, -100, 100) * 0.6;
  const gB = clamp(p.green, -100, 100) * 0.6;
  const bB = clamp(p.blue, -100, 100) * 0.6;
  const cB = clamp(p.cyan, -100, 100) * 0.6;
  const mB = clamp(p.magenta, -100, 100) * 0.6;
  const yB = clamp(p.yellow, -100, 100) * 0.6;
  const vib = clamp(p.vibrance, -100, 100) / 100;
  return (data: Uint8ClampedArray, w: number, h: number) => {
    void h;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] + rB - cB;
      let g = data[i + 1] + gB - mB;
      let b = data[i + 2] + bB - yB;
      r = clamp(r, 0, 255);
      g = clamp(g, 0, 255);
      b = clamp(b, 0, 255);
      if (vib !== 0) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const l = (maxC + minC) / 2;
        const sat = maxC - minC;
        const boost = 1 + vib * (1 - (sat / 255) * 0.6);
        const target = clamp(l + (maxC - l) * boost, 0, 255);
        const k = sat > 0 ? (target - l) / Math.max(1, maxC - l) : 1;
        const mr = clamp(l + (r - l) * k, 0, 255);
        const mg = clamp(l + (g - l) * k, 0, 255);
        const mb = clamp(l + (b - l) * k, 0, 255);
        data[i] = mr;
        data[i + 1] = mg;
        data[i + 2] = mb;
      } else {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
  };
}
