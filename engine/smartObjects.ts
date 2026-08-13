/* eslint-disable @typescript-eslint/no-explicit-any */

import { useLayerStore, objectForLayer } from "@/store/layerStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { useEditorStore } from "@/store/editorStore";

const baseCache = new Map<string, string>();

function elementDataUrl(obj: any): string {
  const el = obj?.getElement?.();
  if (!el) return "";
  const w = el.width || el.naturalWidth || 1;
  const h = el.height || el.naturalHeight || 1;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return "";
  g.drawImage(el, 0, 0);
  return c.toDataURL("image/png");
}

function loadElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function isSmartObject(layerId: string): boolean {
  return !!useFeaturesStore.getState().smartObjects[layerId];
}

export function convertToSmartObject(canvas: any): void {
  if (!canvas) return;
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === ls.activeLayer);
  const obj = objectForLayer(canvas, layer);
  if (!layer || !obj) return;
  const dataUrl = elementDataUrl(obj);
  if (dataUrl) baseCache.set(layer.id, dataUrl);
  useFeaturesStore.getState().registerSO(layer.id, {
    layerId: layer.id,
    name: layer.name,
    json: obj.toJSON ? obj.toJSON() : {},
    linkedFile: null,
    linkedDataUrl: null,
    editing: false,
  });
  window.alert("Converted to Smart Object (non-destructive).");
}

export async function openSmartObjectEdit(canvas: any, layerId: string): Promise<void> {
  if (!isSmartObject(layerId)) return;
  const so = useFeaturesStore.getState().smartObjects[layerId];
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === layerId);
  const obj = objectForLayer(canvas, layer);
  if (!obj) return;
  const json: any = so.json ?? {};
  let img: HTMLImageElement | null = null;
  const el = json.element;
  if (el && (el.src || el.currentSrc)) {
    img = await loadElement(el.currentSrc ?? el.src);
  }
  if (!img) {
    const dataUrl = baseCache.get(layerId) ?? so.linkedDataUrl ?? json.src;
    if (dataUrl) img = await loadElement(dataUrl);
  }
  if (img && img.width) obj.setElement(img as any);
  obj.set({
    left: json.left ?? obj.left,
    top: json.top ?? obj.top,
    scaleX: json.scaleX ?? obj.scaleX,
    scaleY: json.scaleY ?? obj.scaleY,
    angle: json.angle ?? obj.angle,
    opacity: json.opacity ?? obj.opacity,
    visible: json.visible ?? obj.visible,
  });
  obj.setCoords?.();
  useFeaturesStore.getState().updateSO(layerId, { editing: true });
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}

export function closeSmartObjectEdit(canvas: any, layerId: string): void {
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === layerId);
  const obj = objectForLayer(canvas, layer);
  if (!obj) return;
  const dataUrl = elementDataUrl(obj);
  if (dataUrl) baseCache.set(layerId, dataUrl);
  useFeaturesStore.getState().updateSO(layerId, {
    json: obj.toJSON ? obj.toJSON() : {},
    editing: false,
  });
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}

export function linkSmartObject(canvas: any, layerId: string): void {
  void canvas;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      useFeaturesStore.getState().updateSO(layerId, {
        linkedFile: file.name,
        linkedDataUrl: String(reader.result ?? ""),
      });
      window.alert("Linked to external file.");
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function updateLinkedSmartObject(canvas: any, layerId: string): void {
  if (!isSmartObject(layerId)) return;
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === layerId);
  const obj = objectForLayer(canvas, layer);
  if (!obj) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => {
        const prev = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          opacity: obj.opacity,
          visible: obj.visible,
        };
        obj.setElement(img);
        obj.set(prev);
        obj.setCoords?.();
        baseCache.set(layerId, dataUrl);
        useFeaturesStore.getState().updateSO(layerId, {
          linkedDataUrl: dataUrl,
          linkedFile: file.name,
        });
        canvas.requestRenderAll();
        useEditorStore.getState().history?.push?.();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

export function rasterizeSmartObject(canvas: any, layerId: string): void {
  void canvas;
  useFeaturesStore.getState().removeSO(layerId);
  baseCache.delete(layerId);
}
