/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  applyPixelOp,
  BUILTIN_ACTIONS,
  pickImages,
  fileToDataURL,
} from "@/engine/actionsEngine";
import { loadImageCanvas } from "@/engine/pixelOps";
import { showOptions } from "@/components/Menu/OptionDialog";
import { useFeaturesStore } from "@/store/featuresStore";
import type { PSOAction, PSOActionStep } from "@/store/featuresStore";
import {
  resolveTemplate,
  normalizeOptions,
  extForFormat,
  type BatchOptions,
  type BatchResult,
  type BatchOutputFormat,
} from "@/engine/batchEngineCore";

export interface CanvasStep {
  cmd: string;
  params: Record<string, unknown>;
}

function scaleCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function applyStepToCanvas(
  src: HTMLCanvasElement,
  step: CanvasStep
): HTMLCanvasElement {
  const p = step.params;
  switch (step.cmd) {
    case "resize":
      return scaleCanvas(src, Number(p.width ?? src.width), Number(p.height ?? src.height));
    case "rotate90": {
      const out = document.createElement("canvas");
      out.width = src.height;
      out.height = src.width;
      const g = out.getContext("2d")!;
      g.save();
      g.translate(out.width / 2, out.height / 2);
      g.rotate(Math.PI / 2);
      g.drawImage(src, -src.width / 2, -src.height / 2);
      g.restore();
      return out;
    }
    case "rotate180": {
      const out = document.createElement("canvas");
      out.width = src.width;
      out.height = src.height;
      const g = out.getContext("2d")!;
      g.save();
      g.translate(out.width / 2, out.height / 2);
      g.rotate(Math.PI);
      g.drawImage(src, -src.width / 2, -src.height / 2);
      g.restore();
      return out;
    }
    case "flatten":
    case "exportPng":
      return src;
    default: {
      const g = src.getContext("2d")!;
      const imgData = g.getImageData(0, 0, src.width, src.height);
      applyPixelOp(imgData.data, src.width, src.height, step.cmd, p);
      g.putImageData(imgData, 0, 0);
      return src;
    }
  }
}

export function applyStepsToCanvas(
  src: HTMLCanvasElement,
  steps: PSOActionStep[]
): HTMLCanvasElement {
  let cur = src;
  for (const s of steps) {
    cur = applyStepToCanvas(cur, { cmd: s.cmd, params: s.params });
  }
  return cur;
}

export function allActions(): PSOAction[] {
  const saved = Object.values(useFeaturesStore.getState().actions);
  return [...BUILTIN_ACTIONS, ...saved];
}

function nameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, "");
}

export async function runBatch(options: BatchOptions, canvas?: any): Promise<BatchResult> {
  const actions = allActions();
  const action = actions.find((a) => a.id === options.actionId) ?? actions[0];
  if (!action) throw new Error("Action not found");

  let files: File[] = [];
  if (options.source === "open") {
    files = await pickImages(true);
  } else if (canvas) {
    const { compositeCanvas } = await import("@/engine/pixelOps");
    const composite = await compositeCanvas(canvas);
    if (composite) {
      const dataUrl = composite.toDataURL("image/png");
      files = [new File([await (await fetch(dataUrl)).blob()], "document.png", { type: "image/png" })];
    }
  }
  if (!files.length) throw new Error("No images selected");

  const outputs: { name: string; blob: Blob }[] = [];
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options.onProgress?.(i, files.length, file.name);
    try {
      const src = await loadImageCanvas(await fileToDataURL(file));
      const out = applyStepsToCanvas(src, action.steps);
      const mime = options.format === "jpeg" ? "image/jpeg" :
                   options.format === "webp" ? "image/webp" :
                   options.format === "tiff" ? "image/tiff" : "image/png";
      const quality = options.format === "png" || options.format === "tiff" ? undefined : options.quality;
      const blob = await new Promise<Blob>((resolve, reject) =>
        out.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), mime, quality)
      );
      const ctx = { name: nameFromFile(file), action: action.name, ext: options.format, date: new Date().toISOString().slice(0,10) };
      const outName = resolveTemplate(options.namingTemplate, ctx);
      outputs.push({ name: outName, blob });
      processed++;
    } catch {
      failed++;
    }
    options.onProgress?.(i + 1, files.length, file.name);
  }
  return { processed, failed, outputs };
}

export async function runBatchDialog(canvas: any): Promise<void> {
  const actions = allActions();
  if (!actions.length) {
    window.alert("No actions available. Record one first.");
    return;
  }
  const res = await showOptions({
    title: "Batch",
    text: "Choose an action, source, output format, and naming. After OK you'll pick images.",
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: actions[0].id,
        options: actions.map((a) => ({ value: a.id, label: a.name })),
      },
      {
        key: "source",
        label: "Source",
        type: "select",
        value: "open",
        options: [
          { value: "open", label: "Open images…" },
          { value: "document", label: "Current open document" },
        ],
      },
      {
        key: "format",
        label: "Output format",
        type: "select",
        value: "png",
        options: [
          { value: "png", label: "PNG (lossless)" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
          { value: "tiff", label: "TIFF" },
        ],
      },
      {
        key: "quality",
        label: "JPEG/WebP quality (0.1–1.0)",
        type: "number",
        value: 0.92,
        min: 0.1,
        max: 1,
        step: 0.05,
      },
      {
        key: "namingTemplate",
        label: "Output filename template",
        type: "text",
        value: "{name}-{action}.{ext}",
      },
      {
        key: "saveToFolder",
        label: "Save to folder (File System Access API)",
        type: "checkbox",
        value: false,
      },
    ],
    okLabel: "OK",
  });
  if (!res) return;

  const options: BatchOptions = {
    actionId: String(res.action),
    source: String(res.source ?? "open") as "open" | "document",
    format: String(res.format ?? "png") as BatchOutputFormat,
    quality: Number(res.quality ?? 0.92),
    namingTemplate: String(res.namingTemplate ?? "{name}-{action}.{ext}"),
    saveToFolder: Boolean(res.saveToFolder),
  };

  let files: File[] = [];
  if (options.source === "open") {
    files = await pickImages(true);
  } else if (canvas) {
    const { compositeCanvas } = await import("@/engine/pixelOps");
    const composite = await compositeCanvas(canvas);
    if (composite) {
      const dataUrl = composite.toDataURL("image/png");
      files = [new File([await (await fetch(dataUrl)).blob()], "document.png", { type: "image/png" })];
    }
  }
  if (!files.length) {
    window.alert("No images selected.");
    return;
  }

  let dirHandle: FileSystemDirectoryHandle | null = null;
  if (options.saveToFolder && "showDirectoryPicker" in window) {
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    } catch {
      window.alert("Folder picker cancelled; falling back to downloads.");
      options.saveToFolder = false;
    }
  }

  const result = await runBatch({ ...options, onProgress: (done, total, name) => {
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.title = `Batch: ${pct}% (${done}/${total})`;
  } }, canvas);

  for (const out of result.outputs) {
    if (options.saveToFolder && dirHandle) {
      const fileHandle = await dirHandle.getFileHandle(out.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(out.blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
  document.title = document.title.replace(/^Batch: .*/, "");
  window.alert(`Processed ${result.processed} image${result.processed === 1 ? "" : "s"}${result.failed ? `, ${result.failed} failed` : ""}.`);
}
