/* eslint-disable @typescript-eslint/no-explicit-any */
import { FILTER_OPS } from "@/engine/filterOps";
import {
  applyPixelsToActiveLayer,
  canvasNow,
  compositeCanvas,
  flattenToLayer,
} from "@/engine/pixelOps";
import { showOptions } from "@/components/Menu/OptionDialog";
import type { OptionField } from "@/components/Menu/OptionDialog";
import { useFeaturesStore } from "@/store/featuresStore";
import type { PSOAction, PSOActionStep } from "@/store/featuresStore";
import { downloadDataURL } from "@/utils/imageUtils";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function pickImages(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = multiple;
    let settled = false;
    const done = (files: File[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      input.remove();
      resolve(files);
    };
    const onFocus = () => {
      if (input.files?.length) return;
      done([]);
    };
    input.onchange = () => done(Array.from(input.files ?? []));
    window.addEventListener("focus", onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function invertPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

export function grayscalePixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

export function sepiaPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = clamp(0.393 * r + 0.769 * g + 0.189 * b, 0, 255);
    data[i + 1] = clamp(0.349 * r + 0.686 * g + 0.168 * b, 0, 255);
    data[i + 2] = clamp(0.272 * r + 0.534 * g + 0.131 * b, 0, 255);
  }
}

export function pixelatePixels(data: Uint8ClampedArray, w: number, h: number, block: number): void {
  const size = Math.max(1, Math.round(block));
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
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
      r /= n; g /= n; b /= n; a /= n;
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

export function flipHPixels(data: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.floor(w / 2); x++) {
      const a = (y * w + x) * 4;
      const b = (y * w + (w - 1 - x)) * 4;
      for (let c = 0; c < 4; c++) {
        const t = data[a + c];
        data[a + c] = data[b + c];
        data[b + c] = t;
      }
    }
  }
}

export function flipVPixels(data: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < Math.floor(h / 2); y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4;
      const b = ((h - 1 - y) * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const t = data[a + c];
        data[a + c] = data[b + c];
        data[b + c] = t;
      }
    }
  }
}

export function applyPixelOp(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  op: string,
  params: Record<string, unknown>
): void {
  switch (op) {
    case "invert": invertPixels(data); break;
    case "grayscale": grayscalePixels(data); break;
    case "sepia": sepiaPixels(data); break;
    case "pixelate": pixelatePixels(data, w, h, Number(params.blocksize ?? 8)); break;
    case "sharpen": FILTER_OPS.sharpen(data, w, h, {}); break;
    case "blur": FILTER_OPS.gaussianBlur(data, w, h, { radius: Number(params.radius ?? 2) }); break;
    case "flipH": flipHPixels(data, w, h); break;
    case "flipV": flipVPixels(data, w, h); break;
    default: break;
  }
}

function rotateCanvasContent(canvas: any, quarterTurns: number): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (!canvas) return resolve(false);
    const composite = await compositeCanvas(canvas);
    if (!composite) return resolve(false);
    const t = ((quarterTurns % 4) + 4) % 4;
    let w = composite.width;
    let h = composite.height;
    if (t % 2 === 1) [w, h] = [h, w];
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const g = out.getContext("2d")!;
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate((t * Math.PI) / 2);
    g.drawImage(composite, -composite.width / 2, -composite.height / 2);
    g.restore();
    await flattenToLayer(canvas, out, "Rotated");
    resolve(true);
  });
}

function resizeCanvas(canvas: any, width: number, height: number): void {
  if (!canvas) return;
  const newW = Math.max(1, Math.round(width));
  const newH = Math.max(1, Math.round(height));
  const curW = canvas.width;
  const curH = canvas.height;
  if (!curW || !curH) return;
  const sx = newW / curW;
  const sy = newH / curH;
  canvas.getObjects().forEach((obj: any) => {
    obj.set({
      left: (obj.left ?? 0) * sx,
      top: (obj.top ?? 0) * sy,
      scaleX: (obj.scaleX ?? 1) * sx,
      scaleY: (obj.scaleY ?? 1) * sy,
    });
    obj.setCoords?.();
  });
  canvas.setDimensions({ width: newW, height: newH });
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

function exportCurrent(canvas: any, name: string): Promise<void> {
  return new Promise(async (resolve) => {
    const composite = await compositeCanvas(canvas);
    if (!composite) return resolve();
    downloadDataURL(composite.toDataURL("image/png"), name || "export.png");
    resolve();
  });
}

export interface ActionCommand {
  label: string;
  run: (canvas: any, params: Record<string, unknown>) => Promise<unknown> | void;
  fields?: OptionField[];
}

export const ACTION_COMMANDS: Record<string, ActionCommand> = {
  invert: {
    label: "Invert",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d) => invertPixels(d)),
  },
  grayscale: {
    label: "Grayscale",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d) => grayscalePixels(d)),
  },
  sepia: {
    label: "Sepia",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d) => sepiaPixels(d)),
  },
  pixelate: {
    label: "Pixelate",
    fields: [
      { key: "blocksize", label: "Block Size", type: "slider", min: 1, max: 64, step: 1, value: 8, suffix: " px" },
    ],
    run: (canvas, p) =>
      applyPixelsToActiveLayer(canvas, (d, w, h) =>
        pixelatePixels(d, w, h, Number(p.blocksize ?? 8))
      ),
  },
  resize: {
    label: "Resize Document",
    fields: [
      { key: "width", label: "Width", type: "number", min: 1, max: 10000, step: 1, value: 1920, suffix: " px" },
      { key: "height", label: "Height", type: "number", min: 1, max: 10000, step: 1, value: 1080, suffix: " px" },
    ],
    run: (canvas, p) => resizeCanvas(canvas, Number(p.width ?? 1920), Number(p.height ?? 1080)),
  },
  rotate90: {
    label: "Rotate 90° CW",
    run: (canvas) => rotateCanvasContent(canvas, 1),
  },
  rotate180: {
    label: "Rotate 180°",
    run: (canvas) => rotateCanvasContent(canvas, 2),
  },
  flipH: {
    label: "Flip Horizontal",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d, w, h) => flipHPixels(d, w, h)),
  },
  flipV: {
    label: "Flip Vertical",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d, w, h) => flipVPixels(d, w, h)),
  },
  sharpen: {
    label: "Sharpen",
    run: (canvas) => applyPixelsToActiveLayer(canvas, (d, w, h) => FILTER_OPS.sharpen(d, w, h, {})),
  },
  blur: {
    label: "Blur",
    fields: [
      { key: "radius", label: "Radius", type: "slider", min: 0.5, max: 250, step: 0.5, value: 2, suffix: " px" },
    ],
    run: (canvas, p) =>
      applyPixelsToActiveLayer(canvas, (d, w, h) =>
        FILTER_OPS.gaussianBlur(d, w, h, { radius: Number(p.radius ?? 2) })
      ),
  },
  flatten: {
    label: "Flatten Image",
    run: (canvas) =>
      new Promise<void>(async (resolve) => {
        const composite = await compositeCanvas(canvas);
        if (composite) await flattenToLayer(canvas, composite, "Background");
        resolve();
      }),
  },
  exportPng: {
    label: "Export PNG",
    fields: [
      { key: "name", label: "File Name", type: "text", value: "export.png" },
    ],
    run: (canvas, p) => exportCurrent(canvas, String(p.name ?? "export.png")),
  },
};

export const BUILTIN_ACTIONS: PSOAction[] = [
  {
    id: "builtin-invert-grayscale",
    name: "Invert + Grayscale",
    steps: [
      { cmd: "invert", label: "Invert", params: {} },
      { cmd: "grayscale", label: "Grayscale", params: {} },
    ],
    createdAt: 0,
  },
  {
    id: "builtin-sepia-vintage",
    name: "Sepia Vintage",
    steps: [
      { cmd: "sepia", label: "Sepia", params: {} },
      { cmd: "blur", label: "Blur", params: { radius: 0.8 } },
    ],
    createdAt: 0,
  },
  {
    id: "builtin-pixelate",
    name: "Pixelate Art",
    steps: [
      { cmd: "pixelate", label: "Pixelate", params: { blocksize: 12 } },
    ],
    createdAt: 0,
  },
  {
    id: "builtin-sharpen-export",
    name: "Sharpen + Export",
    steps: [
      { cmd: "sharpen", label: "Sharpen", params: {} },
      { cmd: "exportPng", label: "Export PNG", params: { name: "sharpened.png" } },
    ],
    createdAt: 0,
  },
];

let recording = false;
let currentSteps: PSOActionStep[] = [];

export function isRecording(): boolean {
  return recording;
}

export function startRecording(): void {
  recording = true;
  currentSteps = [];
}

export async function stopRecording(canvas: any): Promise<string | null> {
  void canvas;
  recording = false;
  const steps = currentSteps;
  currentSteps = [];
  if (steps.length === 0) {
    window.alert("Nothing was recorded — no steps captured.");
    return null;
  }
  const res = await showOptions({
    title: "Save Action",
    fields: [{ key: "name", label: "Action Name", type: "text", value: "Action 1" }],
    okLabel: "Save",
  });
  if (!res) return null;
  const name = String(res.name ?? "Action 1") || "Action 1";
  const action: PSOAction = {
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    steps,
    createdAt: Date.now(),
  };
  useFeaturesStore.getState().saveAction(action);
  return action.id;
}

export function cancelRecording(): void {
  recording = false;
  currentSteps = [];
}

export async function runActionCommand(
  canvas: any,
  cmd: string,
  params: Record<string, unknown>
): Promise<void> {
  const def = ACTION_COMMANDS[cmd];
  if (!def) return;
  if (recording) {
    currentSteps.push({ cmd, label: def.label, params: { ...params } });
  }
  await def.run(canvas ?? canvasNow(), params);
}

function fillDefaults(cmd: string, params: Record<string, unknown>): Record<string, unknown> {
  const def = ACTION_COMMANDS[cmd];
  const out: Record<string, unknown> = { ...params };
  for (const f of def?.fields ?? []) {
    if (out[f.key] === undefined) out[f.key] = f.value;
  }
  return out;
}

export async function playAction(
  canvas: any,
  action: PSOAction,
  askDialogs = true
): Promise<boolean> {
  if (!action?.steps?.length) return false;
  const wasRecording = recording;
  recording = false;
  try {
    for (const step of action.steps) {
      const def = ACTION_COMMANDS[step.cmd];
      if (!def) continue;
      let params = fillDefaults(step.cmd, step.params);
      if (askDialogs && def.fields?.length) {
        const fields: OptionField[] = def.fields.map((f) => ({
          ...f,
          value: params[f.key] !== undefined ? (params[f.key] as never) : f.value,
        }));
        const res = await showOptions({ title: `${action.name} — ${def.label}`, fields, okLabel: "OK" });
        if (!res) return false;
        params = { ...params, ...res };
      }
      await def.run(canvas ?? canvasNow(), params);
    }
    return true;
  } finally {
    recording = wasRecording;
  }
}

export async function playActionDialog(canvas: any): Promise<void> {
  const actions = Object.values(useFeaturesStore.getState().actions);
  if (!actions.length) {
    window.alert("No saved actions. Record one first (Window ▸ Actions ▸ Record).");
    return;
  }
  const res = await showOptions({
    title: "Play Action",
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: actions[0].id,
        options: actions.map((a) => ({ value: a.id, label: a.name })),
      },
      { key: "ask", label: "Ask for parameter values", type: "checkbox", value: true },
    ],
    okLabel: "Play",
  });
  if (!res) return;
  const action = actions.find((a) => a.id === res.action) ?? actions[0];
  await playAction(canvas, action, !!res.ask);
}

export function deleteActionAction(id: string): void {
  useFeaturesStore.getState().deleteAction(id);
}
