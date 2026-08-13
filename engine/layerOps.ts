import { Rect, Image as FabricImage, StaticCanvas, Gradient, Pattern, FabricObject, Canvas as FabricCanvas } from "fabric";
import type { OptionField } from "@/components/Menu/OptionDialog";
import { showOptions } from "@/components/Menu/OptionDialog";
import { useLayerStore } from "@/store/layerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCtx } from "@/utils/menuUtils";
import { nextObjectId } from "@/utils/imageUtils";
import type { KayLayer } from "@/types/layer";
import { parseLayerStyles, applyLayerStyles, stringifyStyles, DEFAULT_STYLE, type LayerStyles } from "@/engine/layerStylesEngine";
import { addMask, removeMask } from "@/engine/maskEngine";
import { compositeCanvas, flattenToLayer, rasterizeObject, loadImageCanvas } from "@/engine/pixelOps";

interface Mutable {
  set(patch: Record<string, unknown>): unknown;
  setCoords?: () => void;
  setElement?: (el: unknown) => unknown;
}
function ensure(o: unknown): Mutable {
  return o as Mutable;
}
function getProp(o: unknown, key: string): unknown {
  return (o as Record<string, unknown>)[key];
}
function getOid(o: unknown): string | undefined {
  const id = getProp(o, "kaypaintId") ?? getProp(o, "id");
  return typeof id === "string" ? id : undefined;
}
function activeTarget(canvas: FabricCanvas | null): { obj: FabricObject; layer: KayLayer | undefined } | null {
  if (!canvas) return null;
  const ls = useLayerStore.getState();
  const active = ls.layers.find((l) => l.id === ls.activeLayer);
  if (!active?.objectId) {
    const sel = canvas.getActiveObject?.();
    if (sel) {
      const oid = getOid(sel);
      const lay = oid ? ls.layers.find((l) => l.objectId === oid) : undefined;
      return lay ? { obj: sel, layer: lay } : { obj: sel, layer: undefined };
    }
    return null;
  }
  const obj = canvas.getObjects().find((o) => getOid(o) === active.objectId);
  return obj ? { obj, layer: active } : null;
}
function layerIdsForObjects(canvas: FabricCanvas | null): string[] {
  const ls = useLayerStore.getState();
  const ids = new Set<string>();
  for (const o of canvas?.getActiveObjects?.() ?? []) {
    const oid = getOid(o);
    const lay = oid ? ls.layers.find((l) => l.objectId === oid) : undefined;
    if (lay) ids.add(lay.id);
  }
  if (!ids.size && ls.activeLayer) ids.add(ls.activeLayer);
  return [...ids];
}
function objectIdsSelected(canvas: FabricCanvas | null): string[] {
  const ids: string[] = [];
  for (const o of canvas?.getActiveObjects?.() ?? []) {
    const id = getOid(o);
    if (id) ids.push(id);
  }
  if (!ids.length) {
    const t = activeTarget(canvas);
    const id = t ? getOid(t.obj) : undefined;
    if (id) ids.push(id);
  }
  return ids;
}
function push() {
  getCtx().push();
}

// ---------------------------------------------------------------- Layer Style
type EffectDef = {
  label: string;
  fields: () => OptionField[];
  apply: (res: Record<string, unknown>, s: LayerStyles, obj: unknown) => void;
};
function colorF(key: string, value: string, label = "Color"): OptionField {
  return { key, label, type: "color", value };
}
function opacityF(value: number, key = "opacity"): OptionField {
  return { key, label: "Opacity", type: "slider", min: 0, max: 100, value, suffix: "%" };
}
function numF(key: string, label: string, value: number, min: number, max: number): OptionField {
  return { key, label, type: "number", min, max, value };
}
function sliderF(key: string, label: string, value: number, max: number): OptionField {
  return { key, label, type: "slider", min: 0, max, value };
}
function selectF(key: string, label: string, value: string, options: { value: string; label: string }[]): OptionField {
  return { key, label, type: "select", value, options };
}
function dsFields(offsetX = 8, offsetY = 8, blur = 5, color = "#000000", opacity = 75): OptionField[] {
  return [
    colorF("color", color),
    opacityF(opacity),
    numF("offsetX", "Distance X", offsetX, -200, 200),
    numF("offsetY", "Distance Y", offsetY, -200, 200),
    sliderF("blur", "Size", blur, 250),
  ];
}
function glowFields(blur = 35, color = "#ffffff", opacity = 75): OptionField[] {
  return [colorF("color", color), opacityF(opacity), sliderF("blur", "Size", blur, 250)];
}
function setShadowFrom(res: Record<string, unknown>) {
  return {
    enabled: true,
    offsetX: Number(res.offsetX ?? 0),
    offsetY: Number(res.offsetY ?? 0),
    blur: Number(res.blur ?? 5),
    color: String(res.color ?? "#000000"),
    opacity: Number(res.opacity ?? 75),
  };
}
function overlayFrom(res: Record<string, unknown>, defColor: string) {
  return {
    enabled: true,
    color: String(res.color ?? defColor),
  };
}
const EFFECTS: Record<string, EffectDef> = {
  dropShadow: { label: "Drop Shadow", fields: () => dsFields(), apply: (res, s) => { s.dropShadow = setShadowFrom(res); } },
  innerShadow: { label: "Inner Shadow", fields: () => dsFields(2, 2, 8), apply: (res, s) => { s.dropShadow = setShadowFrom(res); } },
  outerGlow: {
    label: "Outer Glow",
    fields: () => glowFields(),
    apply: (res, s) => {
      s.dropShadow = { enabled: true, offsetX: 0, offsetY: 0, blur: Number(res.blur ?? 35), color: String(res.color ?? "#ffffff"), opacity: Number(res.opacity ?? 75) };
    },
  },
  innerGlow: {
    label: "Inner Glow",
    fields: () => glowFields(20, "#ffffff", 60),
    apply: (res, s) => {
      s.dropShadow = { enabled: true, offsetX: 0, offsetY: 0, blur: Number(res.blur ?? 20), color: String(res.color ?? "#ffffff"), opacity: Number(res.opacity ?? 60) };
    },
  },
  bevelEmboss: {
    label: "Bevel & Emboss",
    fields: () => [colorF("color", "#ffffff"), opacityF(75), numF("angle", "Angle", 135, 0, 360), numF("distance", "Distance", 4, 0, 100), sliderF("size", "Size", 7, 100)],
    apply: (res, s) => {
      const rad = (Number(res.angle ?? 135) * Math.PI) / 180;
      const d = Number(res.distance ?? 4);
      s.dropShadow = { enabled: true, offsetX: Math.round(Math.cos(rad) * d), offsetY: Math.round(Math.sin(rad) * d), blur: Number(res.size ?? 7), color: String(res.color ?? "#ffffff"), opacity: Number(res.opacity ?? 75) };
    },
  },
  satin: {
    label: "Satin",
    fields: () => [colorF("color", "#000000"), opacityF(50), numF("angle", "Angle", 45, 0, 360), numF("distance", "Distance", 10, 0, 100), sliderF("size", "Blur", 16, 250)],
    apply: (res, s) => {
      const rad = (Number(res.angle ?? 45) * Math.PI) / 180;
      const d = Number(res.distance ?? 10);
      s.dropShadow = { enabled: true, offsetX: Math.round(Math.cos(rad) * d), offsetY: Math.round(Math.sin(rad) * d), blur: Number(res.size ?? 16), color: String(res.color ?? "#000000"), opacity: Number(res.opacity ?? 50) };
    },
  },
  colorOverlay: {
    label: "Color Overlay",
    fields: () => [colorF("color", "#3b82f6"), opacityF(50)],
    apply: (res, s, obj) => {
      const fill = getProp(obj, "fill");
      if (typeof fill === "string" && !getProp(obj, "layerOriginalFill")) ensure(obj).set({ layerOriginalFill: fill });
      s.colorOverlay = { ...overlayFrom(res, "#3b82f6"), originalFill: typeof fill === "string" ? fill : undefined };
    },
  },
  gradientOverlay: {
    label: "Gradient Overlay",
    fields: () => [
      selectF("type", "Type", "linear", [
        { value: "linear", label: "Linear" },
        { value: "radial", label: "Radial" },
      ]),
      numF("angle", "Angle", 90, 0, 360),
      colorF("color1", "#3b82f6", "Start Color"),
      colorF("color2", "#111827", "End Color"),
    ],
    apply: (res, s) => {
      s.gradientOverlay = {
        enabled: true,
        angle: Number(res.angle ?? 90),
        type: res.type === "radial" ? "radial" : "linear",
        stops: [
          { offset: 0, color: String(res.color1 ?? "#3b82f6") },
          { offset: 1, color: String(res.color2 ?? "#111827") },
        ],
      };
    },
  },
  patternOverlay: {
    label: "Pattern Overlay",
    fields: () => [colorF("color", "#10b981", "Pattern Tint"), opacityF(50)],
    apply: (res, s, obj) => {
      const fill = getProp(obj, "fill");
      if (typeof fill === "string" && !getProp(obj, "layerOriginalFill")) ensure(obj).set({ layerOriginalFill: fill });
      s.colorOverlay = { ...overlayFrom(res, "#10b981"), originalFill: typeof fill === "string" ? fill : undefined };
    },
  },
  stroke: {
    label: "Stroke",
    fields: () => [colorF("color", "#111827"), sliderF("size", "Size", 3, 100)],
    apply: (res, s) => {
      s.outerStroke = { enabled: true, color: String(res.color ?? "#111827"), size: Number(res.size ?? 3) };
    },
  },
};
export async function applyLayerEffectDialog(canvas: FabricCanvas | null, key: string) {
  const def = EFFECTS[key];
  if (!def) return;
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  const styles = parseLayerStyles(t.layer?.layerStyles ?? "");
  const res = await showOptions({ title: def.label, fields: def.fields() });
  if (!res) return;
  def.apply(res, styles, t.obj);
  applyLayerStyles(t.obj, styles);
  ensure(t.obj).set({ layerStyleJson: stringifyStyles(styles) });
  if (t.layer) useLayerStore.getState().updateLayerStyles(t.layer.id, stringifyStyles(styles));
  canvas?.requestRenderAll?.();
  push();
}
export async function blendingOptionsDialog(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  const res = await showOptions({
    title: "Blending Options",
    fields: [selectF("effect", "Effect", "dropShadow", Object.keys(EFFECTS).map((k) => ({ value: k, label: EFFECTS[k].label })))],
  });
  if (!res) return;
  await applyLayerEffectDialog(canvas, String(res.effect));
}
export function resetLayerStyle(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  const styles: LayerStyles = {
    dropShadow: { ...DEFAULT_STYLE.dropShadow! },
    outerStroke: { ...DEFAULT_STYLE.outerStroke! },
    colorOverlay: { ...DEFAULT_STYLE.colorOverlay! },
    gradientOverlay: { ...DEFAULT_STYLE.gradientOverlay!, stops: DEFAULT_STYLE.gradientOverlay!.stops.map((st) => ({ ...st })) },
  };
  applyLayerStyles(t.obj, styles);
  ensure(t.obj).set({ layerStyleJson: stringifyStyles(styles), layerOriginalFill: undefined });
  if (t.layer) useLayerStore.getState().updateLayerStyles(t.layer.id, stringifyStyles(styles));
  canvas?.requestRenderAll?.();
  push();
}

// ------------------------------------------------------------- Fill Layers
function fullCanvasRect(canvas: FabricCanvas | null, extra: Record<string, unknown>) {
  if (!canvas) return null;
  return new Rect({ left: 0, top: 0, originX: "left", originY: "top", width: canvas?.width ?? 1920, height: canvas?.height ?? 1080, selectable: true, evented: true, ...extra });
}
function addFillLayerObject(canvas: FabricCanvas | null, obj: FabricObject | null, name: string) {
  if (!canvas || !obj) return;
  const objectId = nextObjectId();
  ensure(obj).set({ kaypaintId: objectId });
  canvas.add(obj);
  canvas.setActiveObject(obj);
  obj.setCoords();
  canvas.requestRenderAll();
  useLayerStore.getState().addCanvasLayer(name, objectId);
  push();
}
export async function addFillLayerDialog(canvas: FabricCanvas | null, kind: "solid" | "gradient") {
  if (kind === "solid") {
    const res = await showOptions({ title: "Solid Color Fill", fields: [colorF("color", "#3b82f6"), opacityF(100)] });
    if (!res) return;
    addFillLayerObject(canvas, fullCanvasRect(canvas, { fill: String(res.color ?? "#3b82f6"), opacity: Number(res.opacity ?? 100) / 100 }), "Color Fill");
    return;
  }
  const res = await showOptions({
    title: "Gradient Fill",
    fields: [
      selectF("type", "Type", "linear", [
        { value: "linear", label: "Linear" },
        { value: "radial", label: "Radial" },
      ]),
      numF("angle", "Angle", 90, 0, 360),
      colorF("color1", "#3b82f6", "Start Color"),
      colorF("color2", "#111827", "End Color"),
    ],
  });
  if (!res) return;
  const w = canvas?.width ?? 1920;
  const h = canvas?.height ?? 1080;
  let coords: Record<string, number>;
  if (res.type === "radial") {
    const cx = w / 2;
    const cy = h / 2;
    coords = { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: Math.max(w, h) / 2 };
  } else {
    const rad = (Number(res.angle ?? 90) * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    coords = { x1: w * (0.5 - dx * 0.5), y1: h * (0.5 - dy * 0.5), x2: w * (0.5 + dx * 0.5), y2: h * (0.5 + dy * 0.5) };
  }
  const gradient = new Gradient({ type: res.type === "radial" ? "radial" : "linear", coords, colorStops: [{ offset: 0, color: String(res.color1 ?? "#3b82f6") }, { offset: 1, color: String(res.color2 ?? "#111827") }] });
  addFillLayerObject(canvas, fullCanvasRect(canvas, { fill: gradient as unknown }), "Gradient Fill");
}
const PATTERN_NAMES = ["Checkerboard", "Diagonal Lines", "Dots", "Crosshatch"];
function drawPresetPattern(ctx: CanvasRenderingContext2D, size: number, name: string) {
  if (name === "Checkerboard") {
    const tile = 16;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d1d5db";
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        if ((x / tile + y / tile) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    return;
  }
  if (name === "Diagonal Lines") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    return;
  }
  if (name === "Dots") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d1d5db";
    for (let y = 10; y < size; y += 20) {
      for (let x = 10; x < size; x += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 0.5;
  for (let i = 0; i < size; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
}
export async function addPatternFillLayerDialog(canvas: FabricCanvas | null) {
  const res = await showOptions({
    title: "Pattern Fill",
    fields: [selectF("pattern", "Pattern", "Checkerboard", PATTERN_NAMES.map((name) => ({ value: name, label: name }))), opacityF(100)],
  });
  if (!res) return;
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = 64;
  patternCanvas.height = 64;
  const ctx = patternCanvas.getContext("2d")!;
  drawPresetPattern(ctx, 64, String(res.pattern ?? "Checkerboard"));
  const img = new window.Image();
  img.src = patternCanvas.toDataURL();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  const pattern = new Pattern({ source: img, repeat: "repeat" });
  addFillLayerObject(canvas, fullCanvasRect(canvas, { fill: pattern as unknown, opacity: Number(res.opacity ?? 100) / 100 }), "Pattern Fill");
}

// ------------------------------------------------------ Adjustment Layers
const ADJUSTMENT_NAMES: Record<string, string> = {
  brightnessContrast: "Brightness/Contrast",
  exposure: "Exposure",
  posterize: "Posterize",
  threshold: "Threshold",
  invert: "Invert",
};
export function addAdjustmentLayerMenu(canvas: FabricCanvas | null, type: string) {
  const ls = useLayerStore.getState();
  if (type === "levels") {
    ls.addAdjustmentLayer("levels");
    return;
  }
  if (type === "curves") {
    ls.addAdjustmentLayer("curves");
    return;
  }
  if (type === "hueSat") {
    ls.addAdjustmentLayer("hueSat");
    return;
  }
  ls.addAdjustmentLayer("levels");
  const adj = canvas?.getActiveObject?.();
  if (adj && adj.type === "SAdjustment") ensure(adj).set({ adjustmentType: type });
  const cur = useLayerStore.getState();
  const name = ADJUSTMENT_NAMES[type] ?? "Adjustment";
  if (cur.activeLayer) {
    useLayerStore.setState({ layers: cur.layers.map((l) => (l.id === cur.activeLayer ? { ...l, name } : l)) });
  }
  canvas?.requestRenderAll?.();
}

// ------------------------------------------------------------------- Masks
export function revealAllMask(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  addMask(t.obj);
  canvas?.requestRenderAll?.();
  push();
}
export function hideAllMask(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  addMask(t.obj);
  t.obj.clipPath?.set?.({ fill: "#000000" });
  canvas?.requestRenderAll?.();
  push();
}
export function revealSelectionMask(canvas: FabricCanvas | null) {
  window.alert("No selection. Revealing the full layer instead.");
  revealAllMask(canvas);
}
export function hideSelectionMask(canvas: FabricCanvas | null) {
  window.alert("No selection. Hiding the full layer instead.");
  hideAllMask(canvas);
}
export function deleteLayerMask(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  if (!t?.obj) return;
  removeMask(t.obj);
  ensure(t.obj).set({ maskClip: null });
  canvas?.requestRenderAll?.();
  push();
}
export function applyLayerMask(canvas: FabricCanvas | null) {
  if (!canvas) return;
  const t = activeTarget(canvas);
  const obj = t?.obj;
  if (!obj || !obj.clipPath) return;
  const index = canvas.getObjects().indexOf(obj);
  const raster = rasterizeObject(obj);
  if (!raster) return;
  if (obj.type === "image" && typeof ensure(obj).setElement === "function") {
    const prev = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle, opacity: obj.opacity, visible: obj.visible };
    ensure(obj).setElement?.(raster as unknown);
    obj.set(prev);
    obj.setCoords();
  } else {
    const img = new FabricImage(raster, { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle, opacity: obj.opacity, visible: obj.visible, selectable: true, evented: true });
    ensure(img).set({ kaypaintId: getOid(obj) });
    img.setCoords();
    canvas.remove(obj);
    if (index >= 0) canvas.insertAt(index, img);
    else canvas.add(img);
    canvas.setActiveObject(img);
  }
  removeMask(obj);
  canvas?.requestRenderAll?.();
  push();
}
export function toggleLayerMaskEnabled(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  const obj = t?.obj;
  if (!obj || (obj.clipPath === null && !getProp(obj, "maskClip"))) return;
  const stored = getProp(obj, "maskClip");
  if (stored) {
    obj.clipPath = stored as FabricObject;
    ensure(obj).set({ maskClip: null });
  } else {
    ensure(obj).set({ maskClip: obj.clipPath });
    ensure(obj).set({ clipPath: null });
  }
  obj.setCoords?.();
  canvas?.requestRenderAll?.();
  push();
}
export function maskFromTransparency(canvas: FabricCanvas | null) {
  const t = activeTarget(canvas);
  const obj = t?.obj;
  if (!obj) return;
  const savedClip = obj.clipPath;
  ensure(obj).set({ clipPath: null });
  const raster = rasterizeObject(obj);
  if (savedClip) obj.clipPath = savedClip;
  if (!raster) return;
  const g = raster.getContext("2d")!;
  const imgData = g.getImageData(0, 0, raster.width, raster.height);
  const out = document.createElement("canvas");
  out.width = raster.width;
  out.height = raster.height;
  const og = out.getContext("2d")!;
  const outData = og.createImageData(out.width, out.height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = imgData.data[i + 3];
    outData.data[i] = v;
    outData.data[i + 1] = v;
    outData.data[i + 2] = v;
    outData.data[i + 3] = 255;
  }
  og.putImageData(outData, 0, 0);
  const clipImg = new FabricImage(out, { left: 0, top: 0, originX: "left", originY: "top", scaleX: 1 / (obj.scaleX || 1), scaleY: 1 / (obj.scaleY || 1), selectable: false, evented: false });
  obj.clipPath = clipImg;
  obj.setCoords?.();
  canvas?.requestRenderAll?.();
  push();
}

// ------------------------------------------------------- Clipping Masks
export async function createClippingMask(canvas: FabricCanvas | null) {
  const obj = canvas?.getActiveObject?.();
  if (!obj) return;
  if (obj.clipPath) {
    window.alert("This layer already has a mask. Release it first.");
    return;
  }
  const objects = canvas?.getObjects() ?? [];
  const index = objects.indexOf(obj);
  if (index <= 0) {
    window.alert("Select a layer above the layer you want to clip into.");
    return;
  }
  const below = objects[index - 1];
  const clone = await below.clone();
  ensure(clone).set({ absolutePositioned: true, kpClipping: true, selectable: false, evented: false, lockMovementX: true, lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true });
  obj.clipPath = clone;
  obj.setCoords?.();
  canvas?.requestRenderAll?.();
  push();
}
export function releaseClippingMask(canvas: FabricCanvas | null) {
  const obj = canvas?.getActiveObject?.();
  if (!obj || !obj.clipPath) return;
  ensure(obj).set({ clipPath: null });
  obj.setCoords?.();
  canvas?.requestRenderAll?.();
  push();
}

// ------------------------------------------------------------ Group / Ungroup
export function groupLayers(canvas: FabricCanvas | null) {
  const ids = layerIdsForObjects(canvas);
  if (!ids.length) return;
  useLayerStore.getState().createGroup(ids);
  push();
}
export function ungroupLayers(canvas: FabricCanvas | null) {
  const ls = useLayerStore.getState();
  const ids = layerIdsForObjects(canvas);
  const groupIds = new Set<string>();
  for (const id of ids) {
    const g = ls.groupForLayer(id);
    if (g) groupIds.add(g.id);
  }
  for (const gid of groupIds) ls.deleteGroup(gid);
  push();
}

// --------------------------------------------------------------------- Align
export function alignObjects(canvas: FabricCanvas | null, mode: "top" | "vc" | "bottom" | "left" | "hc" | "right") {
  const objs: FabricObject[] = (canvas?.getActiveObjects?.() ?? []).filter((o) => o.type !== "SAdjustment");
  if (!objs.length) {
    const t = activeTarget(canvas);
    if (t?.obj) objs.push(t.obj);
  }
  if (!objs.length) return;
  const rects = objs.map((o) => o.getBoundingRect());
  const minL = Math.min(...rects.map((r) => r.left));
  const maxR = Math.max(...rects.map((r) => r.left + r.width));
  const minT = Math.min(...rects.map((r) => r.top));
  const maxB = Math.max(...rects.map((r) => r.top + r.height));
  const cX = (minL + maxR) / 2;
  const cY = (minT + maxB) / 2;
  objs.forEach((o, i) => {
    const r = rects[i];
    const ocX = r.left + r.width / 2;
    const ocY = r.top + r.height / 2;
    if (mode === "top") o.set({ top: o.top + (minT - r.top) });
    else if (mode === "vc") o.set({ top: o.top + (cY - ocY) });
    else if (mode === "bottom") o.set({ top: o.top + (maxB - (r.top + r.height)) });
    else if (mode === "left") o.set({ left: o.left + (minL - r.left) });
    else if (mode === "hc") o.set({ left: o.left + (cX - ocX) });
    else if (mode === "right") o.set({ left: o.left + (maxR - (r.left + r.width)) });
    o.setCoords?.();
  });
  canvas?.requestRenderAll?.();
  push();
}

// --------------------------------------------------------------- Distribute
export function distributeObjects(canvas: FabricCanvas | null, mode: "hl" | "hc" | "hr" | "vt" | "vc" | "vb") {
  const objs: FabricObject[] = (canvas?.getActiveObjects?.() ?? []).filter((o) => o.type !== "SAdjustment");
  if (objs.length < 3) return;
  const anchorOf = (r: ReturnType<FabricObject["getBoundingRect"]>): number => {
    if (mode === "hl") return r.left;
    if (mode === "hc") return r.left + r.width / 2;
    if (mode === "hr") return r.left + r.width;
    if (mode === "vt") return r.top;
    if (mode === "vc") return r.top + r.height / 2;
    return r.top + r.height;
  };
  const keys: { o: FabricObject; a: number }[] = objs
    .map((o) => ({ o, a: anchorOf(o.getBoundingRect()) }))
    .sort((x, y) => x.a - y.a);
  const minA = keys[0].a;
  const maxA = keys[keys.length - 1].a;
  const step = (maxA - minA) / (keys.length - 1);
  keys.forEach((k, i) => {
    const delta = minA + step * i - k.a;
    if (mode === "hl" || mode === "hc" || mode === "hr") k.o.set({ left: k.o.left + delta });
    else k.o.set({ top: k.o.top + delta });
    k.o.setCoords?.();
  });
  canvas?.requestRenderAll?.();
  push();
}

// ------------------------------------------------------------------ Locks
export function lockLayers(canvas: FabricCanvas | null, mode: "allPixels" | "position" | "transparent" | "all" | "none") {
  const objs: FabricObject[] = (canvas?.getActiveObjects?.() ?? []).filter((o) => o.type !== "SAdjustment");
  if (!objs.length) {
    const t = activeTarget(canvas);
    if (t?.obj) objs.push(t.obj);
  }
  if (!objs.length) return;
  const flags: Record<string, unknown> = { lockMovementX: false, lockMovementY: false, lockRotation: false, lockScalingX: false, lockScalingY: false, kpLockPixels: false, kpLockTransparent: false };
  if (mode === "position") {
    flags.lockMovementX = true;
    flags.lockMovementY = true;
  } else if (mode === "transparent") {
    flags.kpLockTransparent = true;
  } else if (mode === "allPixels") {
    flags.lockRotation = true;
    flags.lockScalingX = true;
    flags.lockScalingY = true;
    flags.kpLockPixels = true;
  } else if (mode === "all") {
    flags.lockMovementX = true;
    flags.lockMovementY = true;
    flags.lockRotation = true;
    flags.lockScalingX = true;
    flags.lockScalingY = true;
    flags.kpLockPixels = true;
  }
  for (const o of objs) {
    ensure(o).set(flags);
    o.setCoords?.();
  }
  const ls = useLayerStore.getState();
  const locked = mode !== "none";
  const objectIds = new Set(objs.map((o) => getOid(o)).filter(Boolean));
  useLayerStore.setState({ layers: ls.layers.map((l) => (l.objectId && objectIds.has(l.objectId) ? { ...l, locked } : l)) });
  canvas?.requestRenderAll?.();
}

// ------------------------------------------------------------------- Links
const linkedGuarded = new WeakSet<FabricCanvas>();
export function ensureLinkedMoveSupport(canvas: FabricCanvas | null) {
  if (!canvas || linkedGuarded.has(canvas)) return;
  linkedGuarded.add(canvas);
  const dragBase = new Map<string, { x: number; y: number }>();
  const byId = (id: string) => canvas.getObjects().find((o) => getOid(o) === id);
  canvas.on("object:moving", (ev: unknown) => {
    const target = getProp(ev, "target") as FabricObject;
    const id = getOid(target);
    if (!id) return;
    if ((canvas.getActiveObjects?.() ?? []).length > 1) {
      dragBase.clear();
      return;
    }
    const linked = useSettingsStore.getState().linkedIds;
    if (!linked.includes(id)) {
      dragBase.clear();
      return;
    }
    if (!dragBase.size) {
      for (const linkedId of linked) {
        const other = byId(linkedId);
        if (other) dragBase.set(linkedId, { x: other.left ?? 0, y: other.top ?? 0 });
      }
    }
    const base = dragBase.get(id);
    if (!base) {
      dragBase.set(id, { x: target.left ?? 0, y: target.top ?? 0 });
      return;
    }
    const dx = (target.left ?? 0) - base.x;
    const dy = (target.top ?? 0) - base.y;
    for (const [linkedId, start] of dragBase) {
      if (linkedId === id) continue;
      const other = byId(linkedId);
      if (!other || other.visible === false) continue;
      other.set({ left: start.x + dx, top: start.y + dy });
      other.setCoords?.();
    }
  });
  canvas.on("mouse:up", () => dragBase.clear());
}
export function linkLayers(canvas: FabricCanvas | null) {
  const ids = objectIdsSelected(canvas);
  if (!ids.length) return;
  const cur = useSettingsStore.getState().linkedIds;
  const allLinked = ids.every((i) => cur.includes(i));
  const next = allLinked ? cur.filter((i) => !ids.includes(i)) : Array.from(new Set([...cur, ...ids]));
  useSettingsStore.getState().setLinked(next);
}
export function unlinkLayers(canvas: FabricCanvas | null) {
  const ids = objectIdsSelected(canvas);
  if (!ids.length) return;
  const cur = useSettingsStore.getState().linkedIds;
  useSettingsStore.getState().setLinked(cur.filter((i) => !ids.includes(i)));
}

// ------------------------------------------------------------------ Merging
export async function mergeDown(canvas: FabricCanvas | null) {
  if (!canvas) return;
  const target = canvas?.getActiveObject?.();
  if (!target) return;
  const objects = canvas.getObjects();
  const index = objects.indexOf(target);
  if (index <= 0) return;
  const below = objects[index - 1];
  if (!below) return;
  const ls = useLayerStore.getState();
  const topLayer = ls.layers.find((l) => l.objectId === getOid(target));
  const belowLayer = ls.layers.find((l) => l.objectId === getOid(below));
  if (!topLayer || !belowLayer) return;
  const tRect = target.getBoundingRect();
  const bRect = below.getBoundingRect();
  const minL = Math.min(tRect.left, bRect.left);
  const minT = Math.min(tRect.top, bRect.top);
  const maxR = Math.max(tRect.left + tRect.width, bRect.left + bRect.width);
  const maxB = Math.max(tRect.top + tRect.height, bRect.top + bRect.height);
  const w = Math.max(1, maxR - minL);
  const h = Math.max(1, maxB - minT);
  const sc = new StaticCanvas(document.createElement("canvas"), { width: w, height: h, backgroundColor: "transparent" });
  const place = (obj: FabricObject) =>
    obj.clone().then((cl: FabricObject) => {
      ensure(cl).set({ left: (obj.left ?? 0) - minL, top: (obj.top ?? 0) - minT, selectable: false, evented: false });
      cl.setCoords?.();
      sc.add(cl);
    });
  await Promise.all([place(target), place(below)]);
  const url = sc.toDataURL({ format: "png", multiplier: 1 });
  sc.dispose();
  const el = await loadImageCanvas(url);
  const img = new FabricImage(el, { left: minL, top: minT, originX: "left", originY: "top", selectable: true, evented: true });
  ensure(img).set({ kaypaintId: nextObjectId() });
  img.setCoords();
  canvas.remove(target, below);
  canvas.insertAt(Math.max(0, index - 1), img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
  useLayerStore.setState((state) => {
    const layers = state.layers.filter((l) => l.id !== topLayer.id && l.id !== belowLayer.id);
    const merged = { id: `layer-${Date.now()}`, name: belowLayer.name, type: "image" as const, visible: true, locked: false, opacity: 100, blendMode: "normal", hasMask: false, objectId: getOid(img) as string };
    const pos = Math.min(state.layers.indexOf(belowLayer), state.layers.indexOf(topLayer));
    layers.splice(Math.max(0, pos), 0, merged);
    return {
      layers,
      groups: state.groups.map((g) => ({ ...g, children: g.children.filter((c) => c !== topLayer.id && c !== belowLayer.id) })),
      activeLayer: merged.id,
    };
  });
  push();
}
export async function mergeVisibleLayers(canvas: FabricCanvas | null) {
  if (!canvas) return;
  const composite = await compositeCanvas(canvas);
  if (!composite) return;
  await flattenToLayer(canvas, composite, "Merged");
}
export async function flattenImageLayer(canvas: FabricCanvas | null) {
  if (!canvas) return;
  const hidden: FabricObject[] = [];
  for (const o of canvas.getObjects()) {
    if (!o.visible) {
      hidden.push(o);
      o.set({ visible: true });
    }
  }
  const composite = await compositeCanvas(canvas);
  for (const o of hidden) o.set({ visible: false });
  canvas.requestRenderAll();
  if (!composite) return;
  await flattenToLayer(canvas, composite, "Background");
}