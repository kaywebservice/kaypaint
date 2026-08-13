import {
  fileToDataURL,
  pickImages,
  downloadBlob,
} from "@/engine/actionsEngine";
import { loadImageCanvas } from "@/engine/pixelOps";
import { applyStepsToCanvas, allActions } from "@/engine/batchEngine";
import { showOptions } from "@/components/Menu/OptionDialog";

const MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EXT: Record<string, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
};

function fitBox(
  src: HTMLCanvasElement,
  maxW: number,
  maxH: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxW / src.width, maxH / src.height);
  if (scale >= 1) return src;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(src.width * scale));
  out.height = Math.max(1, Math.round(src.height * scale));
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

function nameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, "");
}

export async function imageProcessorDialog(): Promise<void> {
  const actions = allActions();
  const res = await showOptions({
    title: "Image Processor",
    text: "After OK you'll be asked to pick one or more image files. Each is resized to fit the max box, optionally processed by an action, converted and downloaded.",
    fields: [
      { key: "resize", label: "Resize to Fit", type: "checkbox", value: true },
      { key: "maxWidth", label: "Max Width", type: "number", min: 1, max: 10000, step: 1, value: 1920, suffix: " px" },
      { key: "maxHeight", label: "Max Height", type: "number", min: 1, max: 10000, step: 1, value: 1440, suffix: " px" },
      {
        key: "format",
        label: "Format",
        type: "select",
        value: "png",
        options: [
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
        ],
      },
      { key: "quality", label: "Quality", type: "slider", min: 1, max: 100, step: 1, value: 90, suffix: "%" },
      {
        key: "action",
        label: "Apply Action",
        type: "select",
        value: "none",
        options: [{ value: "none", label: "None" }, ...actions.map((a) => ({ value: a.id, label: a.name }))],
      },
    ],
    okLabel: "OK",
  });
  if (!res) return;

  const files = await pickImages(true);
  if (!files.length) {
    window.alert("No files selected.");
    return;
  }

  const format = String(res.format ?? "png");
  const quality = Number(res.quality ?? 90) / 100;
  const doResize = !!res.resize;
  const maxW = Number(res.maxWidth ?? 1920);
  const maxH = Number(res.maxHeight ?? 1440);
  const action = actions.find((a) => a.id === res.action) ?? null;

  let processed = 0;
  for (const file of files) {
    try {
      let canvas = await loadImageCanvas(await fileToDataURL(file));
      if (doResize) canvas = fitBox(canvas, maxW, maxH);
      if (action && action.steps.length) canvas = applyStepsToCanvas(canvas, action.steps);
      let output: HTMLCanvasElement = canvas;
      if (format !== "png") {
        output = document.createElement("canvas");
        output.width = canvas.width;
        output.height = canvas.height;
        const g = output.getContext("2d")!;
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, output.width, output.height);
        g.drawImage(canvas, 0, 0);
      }
      const blob = await new Promise<Blob | null>((r) => output.toBlob(r, MIME[format], quality));
      if (blob) {
        downloadBlob(blob, `${nameFromFile(file)}${EXT[format]}`);
        processed++;
      }
    } catch {
      window.alert(`Failed to process "${file.name}".`);
    }
  }
  window.alert(`Processed ${processed} image${processed === 1 ? "" : "s"}.`);
}
