/* eslint-disable @typescript-eslint/no-explicit-any */

import { Image as FabricImage, StaticCanvas, Group } from "fabric";
import { useLayerStore } from "@/store/layerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { useEditorStore } from "@/store/editorStore";
import { nextObjectId } from "@/utils/imageUtils";
import { rasterizeObject, loadImageCanvas } from "@/engine/pixelOps";
import { findPairOffset } from "@/engine/photomerge";

const RASTER_TYPES = new Set([
  "i-text",
  "textbox",
  "text",
  "path",
  "rect",
  "circle",
  "triangle",
  "ellipse",
  "polygon",
  "line",
  "group",
  "video",
  "shape",
]);

function objId(o: any): string | undefined {
  const id = o?.kaypaintId ?? o?.id;
  return typeof id === "string" ? id : undefined;
}

function layerForObject(layerId: string | undefined): { id: string; name: string } | null {
  const objId2 = layerId;
  const layer = useLayerStore
    .getState()
    .layers.find((l) => l.objectId === objId2);
  return layer ? { id: layer.id, name: layer.name } : null;
}

/**
 * Layer > Auto-Align Layers: align the active layer(s) to the layer below them
 * using the same translation correlation as Photomerge. Only translation is
 * applied (no rotation/scaling).
 */
export async function autoAlignLayers(canvas: any): Promise<boolean> {
  if (!canvas) return false;
  const objs: any[] = (canvas.getObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment" && !o.isGuideLine
  );
  let targets: any[] = (canvas.getActiveObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment" && !o.isGuideLine
  );
  if (!targets.length) {
    const ls = useLayerStore.getState();
    const active = ls.layers.find((l) => l.id === ls.activeLayer);
    const obj = active?.objectId
      ? objs.find((o) => o.kaypaintId === active.objectId)
      : null;
    if (obj) targets = [obj];
    else targets = objs.filter((o: any) => o.visible !== false);
  }
  if (targets.length < 2) {
    window.alert("Select at least two layers to align.");
    return false;
  }
  const indexes = targets.map((o) => objs.indexOf(o));
  const baseIdx = Math.min(...indexes) - 1;
  if (baseIdx < 0) {
    window.alert("Auto-Align needs a base layer below the selected layers.");
    return false;
  }
  const base = objs[baseIdx];
  const baseRaster = rasterizeObject(base);
  if (!baseRaster) {
    window.alert("Could not render the base layer.");
    return false;
  }
  for (const t of targets) {
    const tr = rasterizeObject(t);
    if (!tr) continue;
    const off = findPairOffset(baseRaster, tr);
    if (!isFinite(off.score) || off.score < 0.5) continue;
    t.set({
      left: (base.left ?? 0) + off.dx,
      top: (base.top ?? 0) + off.dy,
    });
    t.setCoords?.();
  }
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
  return true;
}

/** Alpha ramp along the edges of a layer render (smoothstep on edge distance). */
function featheredLayerCanvas(src: HTMLCanvasElement, feather: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  if (feather < 1 || src.width < 3 || src.height < 3) return c;
  const m = document.createElement("canvas");
  m.width = src.width;
  m.height = src.height;
  const mg = m.getContext("2d")!;
  const id = mg.createImageData(src.width, src.height);
  const d = id.data;
  const w = src.width;
  const h = src.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.min(x, y, w - 1 - x, h - 1 - y);
      const t = Math.min(1, dist / feather);
      d[(y * w + x) * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 255);
    }
  }
  mg.putImageData(id, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(m, 0, 0);
  return c;
}

/**
 * Layer > Auto-Blend Layers: blend all visible non-background layers above the
 * active layer into it with a feathered edge mask (alpha ramp along each
 * layer's bounding box), then merge them into one layer.
 */
export async function autoBlendLayers(canvas: any): Promise<boolean> {
  if (!canvas) return false;
  const objects = canvas.getObjects();
  const ls = useLayerStore.getState();
  const activeLayer = ls.layers.find((l) => l.id === ls.activeLayer);
  const base =
    (activeLayer?.objectId
      ? objects.find((o: any) => o.kaypaintId === activeLayer.objectId)
      : (canvas.getActiveObject?.() ?? null)) ?? null;
  if (!base) return false;
  const baseIdx = objects.indexOf(base);
  if (baseIdx < 0) return false;
  const above = objects
    .slice(baseIdx + 1)
    .filter((o: any) => o.visible !== false && o.type !== "SAdjustment" && !o.isGuideLine);
  if (!above.length) {
    window.alert("Auto-Blend needs visible layers above the active layer.");
    return false;
  }
  const all: any[] = [base, ...above];
  const rects = all.map((o) => o.getBoundingRect());
  const minL = Math.min(...rects.map((r) => r.left));
  const minT = Math.min(...rects.map((r) => r.top));
  const maxR = Math.max(...rects.map((r) => r.left + r.width));
  const maxB = Math.max(...rects.map((r) => r.top + r.height));
  const w = Math.max(1, Math.round(maxR - minL));
  const h = Math.max(1, Math.round(maxB - minT));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  for (let i = 0; i < all.length; i++) {
    const o = all[i];
    const r = rects[i];
    const bw = Math.max(1, Math.round(r.width));
    const bh = Math.max(1, Math.round(r.height));
    const sc = new StaticCanvas(document.createElement("canvas"), {
      width: bw,
      height: bh,
      backgroundColor: "transparent",
    });
    const cl = await o.clone();
    cl.set({ left: (o.left ?? 0) - r.left, top: (o.top ?? 0) - r.top, selectable: false, evented: false });
    cl.setCoords?.();
    sc.add(cl);
    const url = sc.toDataURL({ format: "png", multiplier: 1 });
    sc.dispose();
    const rendered = await loadImageCanvas(url);
    const painted =
      i === 0
        ? rendered
        : featheredLayerCanvas(
            rendered,
            Math.max(6, Math.round(Math.min(r.width, r.height) * 0.08))
          );
    g.drawImage(painted, r.left - minL, r.top - minT);
  }
  const el = out;
  const img = new FabricImage(el, {
    left: minL,
    top: minT,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
  });
  const objectId = nextObjectId();
  img.set({ kaypaintId: objectId } as any);
  img.setCoords();
  canvas.remove(...all);
  canvas.insertAt(Math.max(0, baseIdx), img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();

  const involvedIds = new Set(all.map(objId).filter(Boolean));
  const involvedLayerIds = new Set(
    ls.layers.filter((l) => l.objectId && involvedIds.has(l.objectId)).map((l) => l.id)
  );
  useLayerStore.setState((state) => {
    const layers = state.layers.filter((l) => !involvedLayerIds.has(l.id));
    const merged = {
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: activeLayer?.name ?? "Blended",
      type: "image" as const,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      hasMask: false,
      objectId,
    };
    const pos = Math.min(
      ...ls.layers
        .map((l, i) => (involvedLayerIds.has(l.id) ? i : Number.MAX_SAFE_INTEGER))
    );
    layers.splice(Math.max(0, pos), 0, merged);
    return {
      layers,
      groups: state.groups.map((g) => ({
        ...g,
        children: g.children.filter((c) => !involvedLayerIds.has(c)),
      })),
      activeLayer: merged.id,
    };
  });
  useEditorStore.getState().history?.push?.();
  return true;
}

/** Rasterize a single fabric object in place (mirrors smartObjectEngine.rasterizeActiveLayer). */
export function rasterizeLayerObject(canvas: any, obj: any, layerName = "Rasterized"): boolean {
  if (!canvas || !obj || obj.type === "SAdjustment") return false;
  const el = obj.toCanvasElement({ multiplier: 1 });
  const id = obj.kaypaintId ?? `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const index = canvas.getObjects().indexOf(obj);
  const img = new FabricImage(el, {
    left: obj.left ?? 0,
    top: obj.top ?? 0,
    angle: 0,
    opacity: obj.opacity ?? 1,
    visible: obj.visible ?? true,
    selectable: true,
    evented: true,
    kaypaintId: id,
  });
  img.setCoords();
  canvas.remove(obj);
  if (index >= 0) canvas.insertAt(index, img);
  else canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
  useLayerStore.setState((state) => ({
    layers: state.layers.map((l) =>
      l.objectId === id ? { ...l, name: layerName, type: "image" as const } : l
    ),
  }));
  return true;
}

const SHAPE_TYPES = new Set(["path", "rect", "circle", "triangle", "ellipse", "polygon", "line"]);
const FILL_TYPES = new Set(["rect", "circle", "triangle", "ellipse", "polygon", "path"]);

/**
 * Layer > Rasterize submenu commands: rasterize the active layer according to
 * its kind (Type / Shape / Fill Content / Smart Object / Layer Style / Video).
 */
export function rasterizeLayerByKind(
  canvas: any,
  kind: "type" | "shape" | "fill" | "smart" | "style" | "video"
): boolean {
  const obj = canvas?.getActiveObject?.();
  if (!canvas || !obj) return false;
  if (kind === "type") {
    if (!["i-text", "textbox", "text"].includes(obj.type)) return false;
    return rasterizeLayerObject(canvas, obj, "Type");
  }
  if (kind === "shape") {
    if (!SHAPE_TYPES.has(obj.type)) return false;
    return rasterizeLayerObject(canvas, obj, "Shape");
  }
  if (kind === "fill") {
    if (!FILL_TYPES.has(obj.type)) return false;
    return rasterizeLayerObject(canvas, obj, "Fill Content");
  }
  if (kind === "smart") {
    if (obj instanceof Group || obj.type === "group") {
      return rasterizeLayerObject(canvas, obj, "Smart Object");
    }
    const id = objId(obj);
    const layer = id
      ? useLayerStore.getState().layers.find((l) => l.objectId === id)
      : null;
    if (layer && useFeaturesStore.getState().smartObjects[layer.id]) {
      useFeaturesStore.getState().removeSO(layer.id);
      return rasterizeLayerObject(canvas, obj, "Rasterized");
    }
    return false;
  }
  if (kind === "style") {
    if (!(obj as any).layerStyleJson) return false;
    return rasterizeLayerObject(canvas, obj, "Rasterized Style");
  }
  if (kind === "video") {
    if (obj.type !== "video") return false;
    return rasterizeLayerObject(canvas, obj, "Video");
  }
  return false;
}

/** Rasterize every vector/text/smart/layer-style object in the document. */
export function rasterizeAllLayers(canvas: any): boolean {
  if (!canvas) return false;
  const snapshot = [...canvas.getObjects()];
  let changed = false;
  for (const obj of snapshot) {
    if (obj.type === "SAdjustment" || obj.isGuideLine) continue;
    if (obj.type === "activeSelection") continue;
    if (obj.type === "image" && !(obj as any).layerStyleJson) continue;
    if (RASTER_TYPES.has(obj.type) || (obj as any).layerStyleJson) {
      if (rasterizeLayerObject(canvas, obj, "Rasterized")) changed = true;
    }
  }
  if (changed) useEditorStore.getState().history?.push?.();
  return changed;
}

/** Render a set of objects into one raster (union bounding box). */
async function selectionRegionToRaster(canvas: any, objs: any[]) {
  const rects = objs.map((o) => o.getBoundingRect());
  const minL = Math.min(...rects.map((r) => r.left));
  const minT = Math.min(...rects.map((r) => r.top));
  const maxR = Math.max(...rects.map((r) => r.left + r.width));
  const maxB = Math.max(...rects.map((r) => r.top + r.height));
  const w = Math.max(1, Math.round(maxR - minL));
  const h = Math.max(1, Math.round(maxB - minT));
  const sc = new StaticCanvas(document.createElement("canvas"), {
    width: w,
    height: h,
    backgroundColor: "transparent",
  });
  for (const o of objs) {
    const cl = await o.clone();
    cl.set({ left: (o.left ?? 0) - minL, top: (o.top ?? 0) - minT, selectable: false, evented: false });
    cl.setCoords?.();
    sc.add(cl);
  }
  const url = sc.toDataURL({ format: "png", multiplier: 1 });
  sc.dispose();
  const el = await loadImageCanvas(url);
  return { el, left: minL, top: minT };
}

/** Add an image object to the canvas as a new layer and select it. */
function addImageLayer(canvas: any, el: HTMLCanvasElement, left: number, top: number, name: string): string {
  const objectId = nextObjectId();
  const img = new FabricImage(el, {
    left,
    top,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
  });
  img.set({ kaypaintId: objectId } as any);
  img.setCoords();
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
  useLayerStore.getState().addCanvasLayer(name, objectId);
  return objectId;
}

function removeObjectsAndLayers(canvas: any, objs: any[]): void {
  const removed = new Set(objs.map(objId).filter(Boolean));
  canvas.remove(...objs);
  const ls = useLayerStore.getState();
  const removedLayerIds = new Set(
    ls.layers.filter((l) => l.objectId && removed.has(l.objectId)).map((l) => l.id)
  );
  if (removedLayerIds.size) {
    useLayerStore.setState((state) => ({
      layers: state.layers.filter((l) => !removedLayerIds.has(l.id)),
      groups: state.groups.map((g) => ({
        ...g,
        children: g.children.filter((c) => !removedLayerIds.has(c)),
      })),
      activeLayer:
        state.activeLayer && removedLayerIds.has(state.activeLayer)
          ? state.layers.find((l) => !removedLayerIds.has(l.id))?.id ?? null
          : state.activeLayer,
    }));
  }
  canvas.requestRenderAll();
}

/**
 * Layer > Layer via Copy (Ctrl+J): duplicate the active object(s) in place as
 * a brand new layer.
 */
export async function layerViaCopy(canvas: any): Promise<boolean> {
  if (!canvas) return false;
  const objs: any[] = (canvas.getActiveObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment"
  );
  if (!objs.length) return false;
  if (objs.length === 1) {
    const obj = objs[0];
    const clone = await obj.clone();
    const objectId = nextObjectId();
    const src = layerForObject(objId(obj));
    clone.set({
      left: (obj.left ?? 0) + 20,
      top: (obj.top ?? 0) + 20,
      kaypaintId: objectId,
      selectable: true,
      evented: true,
    });
    clone.setCoords?.();
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    useLayerStore.getState().addCanvasLayer(src ? `${src.name} copy` : "Layer", objectId);
  } else {
    const region = await selectionRegionToRaster(canvas, objs);
    if (!region) return false;
    addImageLayer(canvas, region.el, region.left, region.top, "Selection Copy");
  }
  useEditorStore.getState().history?.push?.();
  return true;
}

/**
 * Layer > Layer via Cut (Shift+Ctrl+J): cut the active object(s) out of their
 * source layers and place them on a brand new layer.
 */
export async function layerViaCut(canvas: any): Promise<boolean> {
  if (!canvas) return false;
  const objs: any[] = (canvas.getActiveObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment"
  );
  if (!objs.length) return false;
  if (objs.length === 1) {
    const obj = objs[0];
    const src = layerForObject(objId(obj));
    const clone = await obj.clone();
    const objectId = nextObjectId();
    clone.set({
      left: obj.left ?? 0,
      top: obj.top ?? 0,
      kaypaintId: objectId,
      selectable: true,
      evented: true,
    });
    clone.setCoords?.();
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    useLayerStore.getState().addCanvasLayer(src?.name ?? "Layer", objectId);
    if (src) useLayerStore.getState().removeLayer(src.id);
    else canvas.remove(obj);
    canvas.requestRenderAll();
  } else {
    const region = await selectionRegionToRaster(canvas, objs);
    if (!region) return false;
    addImageLayer(canvas, region.el, region.left, region.top, "Selection Cut");
    removeObjectsAndLayers(canvas, objs);
  }
  useEditorStore.getState().history?.push?.();
  return true;
}

/**
 * Layer > Smart Objects > Group into New Smart Object: flatten the selected
 * layers into one image layer registered as a smart object.
 */
export async function groupLayersIntoSmartObject(canvas: any): Promise<boolean> {
  if (!canvas) return false;
  const objs: any[] = (canvas.getActiveObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment"
  );
  let targets = objs;
  if (!targets.length) {
    const ls = useLayerStore.getState();
    const active = ls.layers.find((l) => l.id === ls.activeLayer);
    const obj = active?.objectId
      ? canvas.getObjects().find((o: any) => o.kaypaintId === active.objectId)
      : null;
    if (obj) targets = [obj];
  }
  if (targets.length < 2) {
    window.alert("Select at least two layers to group into a smart object.");
    return false;
  }
  const region = await selectionRegionToRaster(canvas, targets);
  if (!region) return false;
  const indexes = targets.map((o) => canvas.getObjects().indexOf(o));
  const maxIndex = Math.max(...indexes);
  const objectId = addImageLayer(canvas, region.el, region.left, region.top, "Smart Object");
  canvas.remove(...targets);
  canvas.requestRenderAll();
  const smart = canvas.getObjects().find((o: any) => o.kaypaintId === objectId);
  if (smart) {
    canvas.remove(smart);
    canvas.insertAt(Math.max(0, maxIndex), smart);
    canvas.setActiveObject(smart);
    canvas.requestRenderAll();
  }

  const removed = new Set(targets.map(objId).filter(Boolean));
  const ls = useLayerStore.getState();
  const removedLayerIds = new Set(
    ls.layers.filter((l) => l.objectId && removed.has(l.objectId)).map((l) => l.id)
  );
  let smartLayerId = useLayerStore.getState().activeLayer ?? "";
  const canvasOrderIds = canvas.getObjects().map((o: any) => objId(o)).filter(Boolean);
  useLayerStore.setState((state) => {
    const layers = state.layers.filter((l) => !removedLayerIds.has(l.id));
    const layer = layers.find((l) => l.objectId === objectId);
    smartLayerId = layer?.id ?? smartLayerId;
    const ordered = [...layers].sort((a, b) => {
      const ia = a.objectId ? canvasOrderIds.indexOf(a.objectId) : -1;
      const ib = b.objectId ? canvasOrderIds.indexOf(b.objectId) : -1;
      return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
    });
    return {
      layers: ordered.map((l) => (l.id === smartLayerId ? { ...l, name: "Smart Object", type: "smart" as const } : l)),
      groups: state.groups.map((g) => ({
        ...g,
        children: g.children.filter((c) => !removedLayerIds.has(c)),
      })),
      activeLayer: smartLayerId,
    };
  });
  useFeaturesStore.getState().registerSO(smartLayerId, {
    layerId: smartLayerId,
    name: "Smart Object",
    json: {},
    linkedFile: null,
    linkedDataUrl: null,
    editing: false,
  });
  useEditorStore.getState().history?.push?.();
  return true;
}

/**
 * Layer > Select Linked Layers: select all layers linked to the active one
 * (link groups are tracked by object id in the settings store).
 */
export function selectLinkedLayers(canvas: any): void {
  if (!canvas) return;
  const ls = useLayerStore.getState();
  const active = ls.layers.find((l) => l.id === ls.activeLayer);
  const activeId = active?.objectId;
  const linked = useSettingsStore.getState().linkedIds;
  if (!activeId || !linked.includes(activeId)) return;
  const found = canvas
    .getObjects()
    .filter((o: any) => linked.includes(objId(o) ?? "") && o.visible !== false);
  if (!found.length) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(found.length === 1 ? found[0] : found);
  canvas.requestRenderAll();
}