/* eslint-disable @typescript-eslint/no-explicit-any */
import { useFeaturesStore } from "@/store/featuresStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useLayerStore } from "@/store/layerStore";
import { getImageMode } from "@/engine/imageOps";

export interface CursorInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  hex: string;
  docW: number;
  docH: number;
  zoom: number;
  layerName: string;
  selW: number;
  selH: number;
}

const elementCache = new WeakMap<any, HTMLCanvasElement>();
let compositeCanvas: HTMLCanvasElement | null = null;
let compositeValid = false;
let lastCompositeBuild = 0;

function ensureElementCanvas(el: any): HTMLCanvasElement | null {
  if (!el) return null;
  const cached = elementCache.get(el);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = el.width ?? 0;
  c.height = el.height ?? 0;
  const ctx = c.getContext("2d");
  if (!ctx || !c.width || !c.height) return null;
  ctx.drawImage(el, 0, 0);
  elementCache.set(el, c);
  return c;
}

function buildComposite(canvas: any) {
  const now = Date.now();
  if (compositeValid && now - lastCompositeBuild < 300) return;
  lastCompositeBuild = now;
  compositeValid = true;
  const w = canvas.getWidth?.() ?? canvas.width ?? 0;
  const h = canvas.getHeight?.() ?? canvas.height ?? 0;
  compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = w;
  compositeCanvas.height = h;
  const ctx = compositeCanvas.getContext("2d");
  const lower = canvas.getElement?.() ?? canvas.lowerCanvasEl;
  if (!ctx || !lower) return;
  try {
    ctx.drawImage(lower, 0, 0);
  } catch {
    compositeValid = false;
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function sampleFromActiveObject(canvas: any, scene: any): { r: number; g: number; b: number } | null {
  const obj = canvas.getActiveObject?.();
  if (!obj || typeof obj.toLocalPoint !== "function") return null;
  const el = obj._element ?? obj.element;
  if (!el) return null;
  const local = obj.toLocalPoint({ x: scene.x, y: scene.y }, "left", "top");
  const px = Math.floor(local.x / (obj.scaleX ?? 1));
  const py = Math.floor(local.y / (obj.scaleY ?? 1));
  if (px < 0 || py < 0 || px >= el.width || py >= el.height) return null;
  const ec = ensureElementCanvas(el);
  if (!ec) return null;
  try {
    const data = ec.getContext("2d")?.getImageData(px, py, 1, 1).data;
    if (!data) return null;
    return { r: data[0], g: data[1], b: data[2] };
  } catch {
    return null;
  }
}

function sampleFromComposite(canvas: any, scene: any): { r: number; g: number; b: number } {
  buildComposite(canvas);
  try {
    const data = compositeCanvas?.getContext("2d")?.getImageData(Math.floor(scene.x), Math.floor(scene.y), 1, 1).data;
    if (data) return { r: data[0], g: data[1], b: data[2] };
  } catch {
    /* keep fallback */
  }
  return { r: 0, g: 0, b: 0 };
}

function selectionSize(canvas: any): { selW: number; selH: number } {
  const objs = canvas.getActiveObjects?.() ?? [];
  if (!objs.length) return { selW: 0, selH: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objs) {
    const r = o.getBoundingRect?.();
    if (!r) continue;
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.left + r.width);
    maxY = Math.max(maxY, r.top + r.height);
  }
  if (!isFinite(minX)) return { selW: 0, selH: 0 };
  return { selW: maxX - minX, selH: maxY - minY };
}

export function subscribeCursorInfo(canvas: any, fn: (info: CursorInfo) => void): () => void {
  if (!canvas || typeof fn !== "function") return () => {};
  const upper = canvas.upperCanvasEl;
  if (!upper) return () => {};

  const read = (e: any) => {
    const scene =
      typeof canvas.getScenePoint === "function" ? canvas.getScenePoint(e) : canvas.getPointer?.(e);
    if (!scene) return;
    const sample = sampleFromActiveObject(canvas, scene) ?? sampleFromComposite(canvas, scene);
    const { activeLayer, layers } = useLayerStore.getState();
    const { selW, selH } = selectionSize(canvas);
    fn({
      x: Math.round(scene.x),
      y: Math.round(scene.y),
      r: sample.r,
      g: sample.g,
      b: sample.b,
      hex: rgbToHex(sample.r, sample.g, sample.b),
      docW: canvas.getWidth?.() ?? canvas.width ?? 0,
      docH: canvas.getHeight?.() ?? canvas.height ?? 0,
      zoom: canvas.getZoom?.() ?? 1,
      layerName: layers.find((l) => l.id === activeLayer)?.name ?? "Background",
      selW: Math.round(selW),
      selH: Math.round(selH),
    });
  };

  const onRender = () => buildComposite(canvas);
  upper.addEventListener("mousemove", read);
  upper.addEventListener("mouseleave", read);
  canvas.on?.("after:render", onRender);

  return () => {
    upper.removeEventListener("mousemove", read);
    upper.removeEventListener("mouseleave", read);
    canvas.off?.("after:render", onRender);
  };
}

export function getDocumentInfo(canvas: any) {
  const settings = useSettingsStore.getState();
  const features = useFeaturesStore.getState();
  return {
    docW: canvas?.getWidth?.() ?? canvas?.width ?? 0,
    docH: canvas?.getHeight?.() ?? canvas?.height ?? 0,
    dpi: settings.dpi,
    profile: features.assignedProfile ?? "sRGB IEC61966-2.1",
    depth: features.bitDepth,
    mode: getImageMode(),
    zoom: canvas?.getZoom?.() ?? 1,
  };
}
