/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { showOptions } from "@/components/Menu/OptionDialog";
import type { OptionField } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer, canvasNow } from "@/engine/pixelOps";
import { getCtx } from "@/utils/menuUtils";
import tools from "@/store/toolRegistry";
import { downloadDataURL } from "@/utils/imageUtils";

let fadeOriginal: ImageData | null = null;

function getCanvasPixels(canvas: any): ImageData | null {
  if (!canvas) return null;
  try {
    const url = canvas.toDataURL({ format: "png", multiplier: 1 });
    const img = new Image();
    img.src = url;
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, c.width, c.height);
  } catch {
    return null;
  }
}

function blendModeFunc(mode: string): ((src: number, dst: number) => number) | null {
  const m = mode.toLowerCase();
  if (m === "normal") return null;
  if (m === "multiply") return (s: number, d: number) => s * d / 255;
  if (m === "screen") return (s: number, d: number) => 255 - ((255 - s) * (255 - d)) / 255;
  if (m === "overlay") return (s: number, d: number) => (d < 128 ? (2 * s * d) / 255 : 255 - (2 * (255 - s) * (255 - d)) / 255);
  if (m === "soft light") {
    return (s: number, d: number) => {
      const s2 = (s * s) / 255;
      return d < 128 ? s - ((255 - 2 * s) * (d - s)) / 255 : s + s2 * (d - 128) / 255;
    };
  }
  if (m === "dissolve") return (s: number, d: number) => (Math.random() * 255 < s ? s : d);
  return null;
}

const MODES = ["Normal", "Dissolve", "Multiply", "Screen", "Overlay", "Soft Light"];

export function fadeLastEdit(opacity: number, mode: string): void {
  const canvas = canvasNow();
  if (!canvas) {
    window.alert("Fade: no active canvas.");
    return;
  }
  const current = getCanvasPixels(canvas);
  if (!current) return;
  if (!fadeOriginal) fadeOriginal = current;
  if (fadeOriginal.width !== current.width || fadeOriginal.height !== current.height) {
    fadeOriginal = current;
  }
  const t = opacity / 100;
  const bf = blendModeFunc(mode);
  const src = current.data;
  const orig = fadeOriginal.data;
  if (bf) {
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const s = src[i + c];
        const d = orig[i + c];
        src[i + c] = s * (1 - t) + bf(s, d) * t;
      }
    }
  } else {
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        src[i + c] = src[i + c] * (1 - t) + orig[i + c] * t;
      }
    }
  }
  applyPixelsToActiveLayer(getCtx(), (data: Uint8ClampedArray) => {
    if (data.length !== src.length) return;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) data[i + c] = src[i + c];
    }
  });
  canvas.requestRenderAll();
  getCtx().push();
}

export async function startFade(): Promise<void> {
  const canvas = canvasNow();
  if (!canvas) {
    window.alert("Fade: no active canvas.");
    return;
  }
  if (!fadeOriginal) fadeOriginal = getCanvasPixels(canvas);
  const res = await showOptions({
    title: "Fade",
    fields: [
      { key: "opacity", label: "Opacity", type: "slider", value: 50, min: 0, max: 100, step: 1, suffix: "%" },
      { key: "mode", label: "Mode", type: "select", value: "Normal", options: MODES.map((m) => ({ value: m, label: m })) },
    ] as OptionField[],
    okLabel: "OK",
  });
  if (!res) return;
  fadeLastEdit(Number(res.opacity), String(res.mode));
}

function historyReset(hist: any) {
  if (!hist) return;
  try { hist.clear?.(); } catch {}
  try { hist.reset?.(); } catch {}
  try { if (Array.isArray(hist.undoStack)) hist.undoStack = []; } catch {}
  try { if (Array.isArray(hist.redoStack)) hist.redoStack = []; } catch {}
}

export function purgeUndo(): void {
  const state = useEditorStore.getState() as any;
  historyReset(state.history);
  try { state.undoStack = []; state.redoStack = []; } catch {}
}

export function purgeClipboard(): void {
  const state = useEditorStore.getState() as any;
  try { state.clipboard = null; } catch {}
  useSettingsStore.getState().setLastFilter(null);
}

export function purgeHistory(): void {
  const hist = useEditorStore.getState().history;
  historyReset(hist);
}

export function purgeAll(): void {
  if (!window.confirm("Discard all undo history, clipboard, and snapshots?")) return;
  purgeUndo();
  purgeClipboard();
  purgeHistory();
}

export interface ToolbarResult { name: string; id: string; }

export async function openToolbarEditor(): Promise<void> {
  const hidden = useSettingsStore.getState().hiddenTools ?? [];
  const fields: OptionField[] = (tools as any[]).map((t: any) => ({
    key: t.id,
    label: t.name,
    type: "checkbox",
    value: !hidden.includes(t.id),
  }));
  const res = await showOptions({
    title: "Customize Toolbar",
    text: "Checked tools are visible in the toolbar.",
    fields,
    okLabel: "OK",
  });
  if (!res) return;
  const newList = (tools as any[])
    .filter((t: any) => !res[t.id])
    .map((t: any) => t.id);
  useSettingsStore.getState().setHiddenTools(newList);
}

export function downloadCurrent(canvas: any, format: "png" | "jpg", quality: number) {
  if (!canvas) return;
  const url = canvas.toDataURL({ format, quality });
  downloadDataURL(url, `kaypaint-quick.${format}`);
}
