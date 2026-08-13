/* eslint-disable @typescript-eslint/no-explicit-any */

import { useLayerStore, objectForLayer } from "@/store/layerStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { useEditorStore } from "@/store/editorStore";
import { FILTER_OPS } from "@/engine/filterOps";
import { showOptions, type OptionField } from "@/components/Menu/OptionDialog";

const baseCache = new Map<string, string>();
const stepFields = new Map<string, OptionField[]>();

interface CuratedFilterDef {
  filterId: string;
  label: string;
  fields: OptionField[];
}

const CURATED_FILTERS: CuratedFilterDef[] = [
  {
    filterId: "gaussianBlur",
    label: "Gaussian Blur",
    fields: [
      { key: "radius", label: "Radius", type: "slider", min: 0.5, max: 250, step: 0.5, value: 2, suffix: " px" },
    ],
  },
  { filterId: "sharpen", label: "Sharpen", fields: [] },
  {
    filterId: "addNoise",
    label: "Noise",
    fields: [
      { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, step: 1, value: 30 },
    ],
  },
  {
    filterId: "emboss",
    label: "Emboss",
    fields: [
      { key: "angle", label: "Angle", type: "slider", min: -360, max: 360, step: 1, value: 135, suffix: "°" },
      { key: "height", label: "Height", type: "slider", min: 1, max: 100, step: 1, value: 10 },
      { key: "amount", label: "Amount", type: "slider", min: 0, max: 500, step: 1, value: 100 },
    ],
  },
  {
    filterId: "pixelate",
    label: "Pixelate",
    fields: [
      { key: "blocksize", label: "Block Size", type: "slider", min: 1, max: 50, step: 1, value: 8 },
    ],
  },
  { filterId: "sepia", label: "Sepia", fields: [] },
  { filterId: "invert", label: "Invert", fields: [] },
];

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

function invertPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

function sepiaPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = Math.min(255, Math.max(0, 0.393 * r + 0.769 * g + 0.189 * b));
    data[i + 1] = Math.min(255, Math.max(0, 0.349 * r + 0.686 * g + 0.168 * b));
    data[i + 2] = Math.min(255, Math.max(0, 0.272 * r + 0.534 * g + 0.131 * b));
  }
}

function pixelatePixels(data: Uint8ClampedArray, w: number, h: number, block: number): void {
  const size = Math.max(1, Math.round(block));
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = 0; dy < size; dy++) {
        const yy = Math.min(h - 1, y + dy);
        for (let dx = 0; dx < size; dx++) {
          const xx = Math.min(w - 1, x + dx);
          const o = (yy * w + xx) * 4;
          r += data[o];
          g += data[o + 1];
          b += data[o + 2];
          a += data[o + 3];
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      a /= n;
      for (let dy = 0; dy < size; dy++) {
        const yy = Math.min(h - 1, y + dy);
        for (let dx = 0; dx < size; dx++) {
          const xx = Math.min(w - 1, x + dx);
          const o = (yy * w + xx) * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = a;
        }
      }
    }
  }
}

function runStep(step: any, data: Uint8ClampedArray, w: number, h: number): void {
  const fn = FILTER_OPS[step.filterId];
  if (fn) {
    fn(data, w, h, step.params ?? {});
    return;
  }
  if (step.filterId === "pixelate") {
    pixelatePixels(data, w, h, Number((step.params as any)?.blocksize ?? 8));
  } else if (step.filterId === "sepia") {
    sepiaPixels(data);
  } else if (step.filterId === "invert") {
    invertPixels(data);
  }
}

export function applySmartFilters(canvas: any, layerId: string, push = true): void {
  if (!canvas) return;
  const steps = useFeaturesStore.getState().smartFilters[layerId] ?? [];
  const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
  const obj = objectForLayer(canvas, layer);
  if (!obj) return;
  let base = baseCache.get(layerId);
  if (!base) {
    base = elementDataUrl(obj);
    if (!base) return;
    baseCache.set(layerId, base);
  }
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    if (!g) return;
    g.drawImage(img, 0, 0);
    if (steps.length) {
      let imageData = g.getImageData(0, 0, c.width, c.height);
      for (const step of steps) {
        const out = new Uint8ClampedArray(imageData.data);
        runStep(step, out, c.width, c.height);
        imageData = new ImageData(out, c.width, c.height);
      }
      g.putImageData(imageData, 0, 0);
    }
    const out = new Image();
    out.onload = () => {
      const prev = {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        opacity: obj.opacity,
        visible: obj.visible,
      };
      obj.setElement(out);
      obj.set(prev);
      obj.setCoords?.();
      canvas.requestRenderAll();
      if (push) useEditorStore.getState().history?.push?.();
    };
    out.src = c.toDataURL("image/png");
  };
  img.src = base;
}

export async function addSmartFilter(canvas: any): Promise<void> {
  if (!canvas) return;
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === ls.activeLayer);
  const obj = objectForLayer(canvas, layer);
  if (!layer || !obj) return;
  const res = await showOptions({
    title: "Add Smart Filter",
    fields: [
      {
        key: "filter",
        label: "Filter",
        type: "select",
        value: CURATED_FILTERS[0].filterId,
        options: CURATED_FILTERS.map((f) => ({ value: f.filterId, label: f.label })),
      },
    ],
  });
  if (!res) return;
  const def = CURATED_FILTERS.find((f) => f.filterId === res.filter) ?? CURATED_FILTERS[0];
  let params: Record<string, any> = {};
  if (def.fields.length) {
    const p = await showOptions({ title: def.label, fields: def.fields.map((f) => ({ ...f })) });
    if (!p) return;
    params = p;
  }
  const current = useFeaturesStore.getState().smartFilters[layer.id] ?? [];
  if (current.length === 0) {
    const dataUrl = elementDataUrl(obj);
    if (dataUrl) baseCache.set(layer.id, dataUrl);
  }
  const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  stepFields.set(stepId, def.fields);
  useFeaturesStore.getState().setSmartFilters(layer.id, [
    ...current,
    { id: stepId, filterId: def.filterId, label: def.label, params },
  ]);
  applySmartFilters(canvas, layer.id, true);
}

export async function editSmartFilter(canvas: any, layerId: string, stepId: string): Promise<void> {
  const steps = useFeaturesStore.getState().smartFilters[layerId] ?? [];
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;
  const fields = stepFields.get(stepId);
  if (!fields?.length) return;
  const prefilled = fields.map((f) => ({
    ...f,
    value: (step.params as any)?.[f.key] ?? f.value,
  }));
  const res = await showOptions({ title: step.label, fields: prefilled });
  if (!res) return;
  useFeaturesStore.getState().setSmartFilters(
    layerId,
    steps.map((s) => (s.id === stepId ? { ...s, params: res } : s))
  );
  applySmartFilters(canvas, layerId, true);
}

export function removeSmartFilter(canvas: any, layerId: string, stepId: string): void {
  const steps = useFeaturesStore.getState().smartFilters[layerId] ?? [];
  const updated = steps.filter((s) => s.id !== stepId);
  stepFields.delete(stepId);
  if (updated.length) {
    useFeaturesStore.getState().setSmartFilters(layerId, updated);
  } else {
    useFeaturesStore.getState().clearSmartFilters(layerId);
  }
  applySmartFilters(canvas, layerId, true);
}

export async function openSmartFilterManager(canvas: any): Promise<void> {
  if (!canvas) return;
  const ls = useLayerStore.getState();
  const layer = ls.layers.find((l) => l.id === ls.activeLayer);
  if (!layer) return;
  const steps = useFeaturesStore.getState().smartFilters[layer.id] ?? [];
  if (!steps.length) {
    window.alert("No smart filters on this layer.");
    return;
  }
  const res = await showOptions({
    title: "Smart Filters",
    fields: [
      {
        key: "step",
        label: "Filter",
        type: "select",
        value: steps[0].id,
        options: steps.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.label}` })),
      },
    ],
  });
  if (!res) return;
  const action = await showOptions({
    title: "Smart Filter Action",
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: "edit",
        options: [
          { value: "edit", label: "Edit…" },
          { value: "remove", label: "Remove" },
          { value: "add", label: "Add…" },
          { value: "close", label: "Close" },
        ],
      },
    ],
  });
  if (!action) return;
  const stepId = String(res.step);
  switch (action.action) {
    case "edit":
      await editSmartFilter(canvas, layer.id, stepId);
      break;
    case "remove":
      removeSmartFilter(canvas, layer.id, stepId);
      break;
    case "add":
      await addSmartFilter(canvas);
      break;
    default:
      break;
  }
}
