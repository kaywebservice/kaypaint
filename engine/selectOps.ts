/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useLayerStore } from "@/store/layerStore";
import { canvasNow } from "@/utils/menuUtils";
import { notify as showToast } from "@/utils/notify";
import {
  applyPixelsToActiveLayer,
  readActivePixels,
  hexToRgb01,
} from "@/engine/pixelOps";

const renderListeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  renderListeners.add(fn);
  return () => {
    renderListeners.delete(fn);
  };
}

function notify() {
  renderListeners.forEach((fn) => fn());
}

let isolated = false;
let hiddenObjects: any[] = [];

export function isIsolated() {
  return isolated;
}

export function toggleIsolate(): boolean {
  const canvas = canvasNow();
  if (!canvas) return isolated;
  if (isolated) {
    hiddenObjects.forEach((o: any) => o.set({ visible: true }));
    hiddenObjects = [];
    isolated = false;
  } else {
    const all = canvas.getObjects() as any[];
    const selected = canvas.getActiveObjects?.() ?? [];
    hiddenObjects = all.filter((o: any) => !selected.includes(o));
    hiddenObjects.forEach((o: any) => o.set({ visible: false }));
    isolated = true;
  }
  canvas.requestRenderAll();
  notify();
  return isolated;
}

let tracking: any = null;

export function ensureSelectionTracking() {
  const canvas = canvasNow();
  if (!canvas) return;
  if (tracking) {
    if (tracking.canvas === canvas) return;
    tracking.canvas.off("selection:created", tracking.created);
    tracking.canvas.off("selection:updated", tracking.updated);
    tracking.canvas.off("selection:cleared", tracking.cleared);
  }
  const created = () => storeSelection(canvas);
  const updated = () => storeSelection(canvas);
  const cleared = () => useSettingsStore.getState().setReselect([]);
  canvas.on("selection:created", created);
  canvas.on("selection:updated", updated);
  canvas.on("selection:cleared", cleared);
  tracking = { canvas, created, updated, cleared };
}

function storeSelection(canvas: any) {
  const ids = (canvas.getActiveObjects?.() ?? [])
    .map((o: any) => o.kaypaintId ?? o.id)
    .filter(Boolean);
  useSettingsStore.getState().setReselect(ids);
}

export function reselect(): boolean {
  const canvas = canvasNow();
  if (!canvas) return false;
  ensureSelectionTracking();
  const ids = useSettingsStore.getState().reselectIds;
  const found = (canvas.getObjects() as any[]).filter((o: any) =>
    ids.includes(o.kaypaintId ?? o.id)
  );
  if (!found.length) return false;
  canvas.discardActiveObject();
  canvas.setActiveObject(found.length === 1 ? found[0] : found);
  canvas.requestRenderAll();
  return true;
}

export function selectAllLayers() {
  const canvas = canvasNow();
  if (!canvas) return;
  const objects = (canvas.getObjects() as any[]).filter(
    (o: any) => o.type !== "SAdjustment"
  );
  if (!objects.length) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(objects.length === 1 ? objects[0] : objects);
  canvas.requestRenderAll();
}

export function deselectLayers() {
  canvasNow()?.discardActiveObject?.();
}

export function findLayers(query: string): boolean {
  const canvas = canvasNow();
  if (!canvas) return false;
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return false;
  const layers = useLayerStore.getState().layers;
  const matches = (canvas.getObjects() as any[]).filter((o: any) => {
    const id = o.kaypaintId ?? o.id;
    const layerName = layers.find((l) => l.objectId === id)?.name ?? "";
    return [o.name, o.type, layerName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  if (!matches.length) return false;
  canvas.discardActiveObject();
  canvas.setActiveObject(matches.length === 1 ? matches[0] : matches);
  canvas.requestRenderAll();
  return true;
}

interface MaskState {
  objectId: string | null;
  w: number;
  h: number;
  mask: Uint8ClampedArray | null;
  fuzziness: number;
}

let maskState: MaskState = {
  objectId: null,
  w: 0,
  h: 0,
  mask: null,
  fuzziness: 32,
};

export function lastFuzziness() {
  return maskState.fuzziness;
}

function objId(obj: any) {
  return obj.kaypaintId ?? obj.id ?? null;
}

interface MaskRead {
  obj: any;
  w: number;
  h: number;
  alpha: Uint8ClampedArray;
  data: Uint8ClampedArray;
}

function currentMask(canvas: any): MaskRead | null {
  const read = readActivePixels(canvas);
  if (!read) return null;
  const id = objId(read.obj);
  if (maskState.objectId !== id) {
    maskState = {
      objectId: id,
      w: read.width,
      h: read.height,
      mask: null,
      fuzziness: maskState.fuzziness,
    };
  }
  const { width, height, data } = read;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { obj: read.obj, w: width, h: height, alpha, data };
}

function thresholdMask(alpha: Uint8ClampedArray) {
  const m = new Uint8ClampedArray(alpha.length);
  for (let i = 0; i < alpha.length; i++) m[i] = alpha[i] > 16 ? 255 : 0;
  return m;
}

function dilate(bin: Uint8ClampedArray, w: number, h: number, r: number) {
  let cur = bin;
  for (let s = 0; s < r; s++) {
    const next = new Uint8ClampedArray(cur);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (cur[yy * w + xx]) {
              next[i] = 255;
              break;
            }
          }
          if (next[i]) break;
        }
      }
    }
    cur = next;
  }
  return cur;
}

function erode(bin: Uint8ClampedArray, w: number, h: number, r: number) {
  let cur = bin;
  for (let s = 0; s < r; s++) {
    const next = new Uint8ClampedArray(cur);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w) {
              next[i] = 0;
              continue;
            }
            if (!cur[yy * w + xx]) next[i] = 0;
          }
        }
      }
    }
    cur = next;
  }
  return cur;
}

function blurAxis(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean
) {
  const out = new Uint8ClampedArray(src.length);
  const n = horizontal ? w : h;
  const other = horizontal ? h : w;
  const line = new Float32Array(n);
  const prefix = new Float32Array(n + 1);
  for (let j = 0; j < other; j++) {
    for (let i = 0; i < n; i++) {
      line[i] = horizontal ? src[j * w + i] : src[i * w + j];
    }
    prefix[0] = 0;
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + line[i];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - radius);
      const b = Math.min(n - 1, i + radius);
      const v = (prefix[b + 1] - prefix[a]) / (b - a + 1);
      if (horizontal) out[j * w + i] = v;
      else out[i * w + j] = v;
    }
  }
  return out;
}

function boxBlur(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  passes: number
) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    cur = blurAxis(cur, w, h, radius, true);
    cur = blurAxis(cur, w, h, radius, false);
  }
  return cur;
}

function applyMaskToLayer(
  canvas: any,
  mask: Uint8ClampedArray,
  w: number,
  h: number
): Promise<boolean> {
  maskState.mask = mask;
  maskState.w = w;
  maskState.h = h;
  return applyPixelsToActiveLayer(canvas, (data, width, height) => {
    if (width !== w || height !== h) return;
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 3] = Math.round((data[i * 4 + 3] * mask[i]) / 255);
    }
  });
}

function alertNoLayer() {
  showToast("Select a layer first.", "warning");
}

function averageColor(
  data: Uint8ClampedArray,
  bin: Uint8ClampedArray,
  w: number,
  h: number
) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (!bin[i]) continue;
    const o = i * 4;
    sr += data[o];
    sg += data[o + 1];
    sb += data[o + 2];
    count++;
  }
  if (!count) return null;
  return { r: sr / count, g: sg / count, b: sb / count };
}

function similarityMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  tr: number,
  tg: number,
  tb: number,
  fuzz: number
) {
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const dist = Math.hypot(data[o] - tr, data[o + 1] - tg, data[o + 2] - tb);
    mask[i] = fuzz <= 0 ? (dist === 0 ? 255 : 0) : Math.max(0, Math.min(255, 255 * (1 - dist / fuzz)));
  }
  return mask;
}

export async function colorRange(
  color: string,
  fuzziness: number,
  invert: boolean
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha, data } = cur;
  const fuzz = Math.max(1, fuzziness);
  const rgb = hexToRgb01(color).map((v) => Math.round(v * 255));
  const mask = similarityMask(data, w, h, rgb[0], rgb[1], rgb[2], fuzz);
  if (invert) {
    for (let i = 0; i < mask.length; i++) mask[i] = 255 - mask[i];
  }
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Math.round((mask[i] * alpha[i]) / 255);
  }
  maskState.fuzziness = fuzziness;
  return applyMaskToLayer(canvas, mask, w, h);
}

export async function similar(): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha, data } = cur;
  const bin = thresholdMask(alpha);
  const avg = averageColor(data, bin, w, h);
  if (!avg) return false;
  const fuzz = maskState.fuzziness;
  const mask = similarityMask(data, w, h, avg.r, avg.g, avg.b, fuzz);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Math.round((mask[i] * alpha[i]) / 255);
  }
  return applyMaskToLayer(canvas, mask, w, h);
}

export async function grow(): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha, data } = cur;
  const bin = thresholdMask(alpha);
  const avg = averageColor(data, bin, w, h);
  if (!avg) return false;
  const fuzz = maskState.fuzziness;
  const dilated = dilate(bin, w, h, 1);
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!dilated[i]) {
      mask[i] = 0;
      continue;
    }
    if (bin[i]) {
      mask[i] = 255;
      continue;
    }
    const o = i * 4;
    const dist = Math.hypot(data[o] - avg.r, data[o + 1] - avg.g, data[o + 2] - avg.b);
    mask[i] = dist <= fuzz ? 255 : 0;
  }
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Math.round((mask[i] * alpha[i]) / 255);
  }
  return applyMaskToLayer(canvas, mask, w, h);
}

export type ModifyKind = "border" | "smooth" | "expand" | "contract" | "feather";

export async function modifyMask(
  kind: ModifyKind,
  value: number
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha } = cur;
  const bin = thresholdMask(alpha);
  let mask: Uint8ClampedArray;
  switch (kind) {
    case "border": {
      const dilated = dilate(bin, w, h, Math.round(value));
      const eroded = erode(bin, w, h, Math.round(value));
      mask = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) mask[i] = dilated[i] && !eroded[i] ? 255 : 0;
      break;
    }
    case "smooth": {
      const blurred = boxBlur(bin, w, h, Math.round(value), 1);
      mask = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) mask[i] = blurred[i] > 128 ? 255 : 0;
      break;
    }
    case "expand":
      mask = dilate(bin, w, h, Math.round(value));
      break;
    case "contract":
      mask = erode(bin, w, h, Math.round(value));
      break;
    case "feather": {
      const r = Math.max(1, Math.round(value));
      const blurred = boxBlur(bin, w, h, r, Math.min(r, 32));
      mask = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) mask[i] = blurred[i];
      break;
    }
    default:
      return false;
  }
  return applyMaskToLayer(canvas, mask, w, h);
}

export async function transformSelection(
  scalePct: number,
  rotateDeg: number
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha } = cur;
  const bin = thresholdMask(alpha);
  const s = scalePct / 100;
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = w / 2;
  const cy = h / 2;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / s;
      const dy = (y - cy) / s;
      const sx = dx * cos + dy * sin + cx;
      const sy = -dx * sin + dy * cos + cy;
      if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = y0 * w + x0;
      const i10 = i00 + 1;
      const i01 = i00 + w;
      const i11 = i01 + 1;
      const v =
        bin[i00] * (1 - fx) * (1 - fy) +
        bin[i10] * fx * (1 - fy) +
        bin[i01] * (1 - fx) * fy +
        bin[i11] * fx * fy;
      out[y * w + x] = v;
    }
  }
  return applyMaskToLayer(canvas, out, w, h);
}

const SELECTION_PREFIX = "kaypaint:selection:";

export function selectionNames(): string[] {
  if (typeof window === "undefined") return [];
  const names: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SELECTION_PREFIX)) {
      names.push(key.slice(SELECTION_PREFIX.length));
    }
  }
  return names.sort();
}

export async function saveSelection(name: string): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  const { w, h, alpha } = cur;
  const bin = thresholdMask(alpha);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return false;
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = bin[i];
    img.data[i * 4 + 1] = bin[i];
    img.data[i * 4 + 2] = bin[i];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  try {
    localStorage.setItem(SELECTION_PREFIX + name, c.toDataURL("image/png"));
    return true;
  } catch {
    return false;
  }
}

function resizeMask(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number
) {
  const out = new Uint8ClampedArray(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      out[y * dw + x] = src[sy * sw + sx];
    }
  }
  return out;
}

export async function loadSelection(
  name: string,
  applyToAlpha: boolean
): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;
  const raw = localStorage.getItem(SELECTION_PREFIX + name);
  if (!raw) return false;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = raw;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  if (!g) return false;
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, img.width, img.height);
  const mask = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4];
  if (!applyToAlpha) {
    maskState = {
      objectId: maskState.objectId,
      w: img.width,
      h: img.height,
      mask,
      fuzziness: maskState.fuzziness,
    };
    return true;
  }
  const cur = currentMask(canvas);
  if (!cur) {
    alertNoLayer();
    return false;
  }
  let m = mask;
  if (cur.w !== img.width || cur.h !== img.height) {
    m = resizeMask(mask, img.width, img.height, cur.w, cur.h);
  }
  return applyMaskToLayer(canvas, m, cur.w, cur.h);
}

export function isQuickMaskOn() {
  return useEditorStore.getState().activeTool === "quickMask";
}

export function toggleQuickMask(): boolean {
  const on = isQuickMaskOn();
  useEditorStore.getState().setTool(on ? "move" : "quickMask");
  return !on;
}