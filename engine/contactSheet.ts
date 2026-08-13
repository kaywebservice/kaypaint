import {
  fileToDataURL,
  pickImages,
  downloadBlob,
} from "@/engine/actionsEngine";
import { canvasNow, flattenToLayer, loadImageCanvas } from "@/engine/pixelOps";
import { showOptions } from "@/components/Menu/OptionDialog";

const MARGIN = 16;
const LABEL_H = 20;

export async function contactSheetDialog(): Promise<void> {
  const res = await showOptions({
    title: "Contact Sheet II",
    text: "Build a labeled thumbnail grid from the images you pick after OK.",
    fields: [
      { key: "columns", label: "Columns", type: "slider", min: 1, max: 8, step: 1, value: 4 },
      { key: "thumb", label: "Thumbnail Size", type: "slider", min: 64, max: 400, step: 8, value: 200, suffix: " px" },
      { key: "background", label: "Background", type: "color", value: "#2b2b2b" },
      { key: "labels", label: "File Name Labels", type: "checkbox", value: true },
    ],
    okLabel: "OK",
  });
  if (!res) return;

  const columns = Math.max(1, Math.round(Number(res.columns ?? 4)));
  const thumb = Math.max(64, Math.round(Number(res.thumb ?? 200)));
  const background = String(res.background ?? "#2b2b2b");
  const labels = !!res.labels;

  const files = await pickImages(true);
  if (!files.length) {
    window.alert("No files selected.");
    return;
  }

  const items: { canvas: HTMLCanvasElement; name: string }[] = [];
  for (const file of files) {
    try {
      const c = await loadImageCanvas(await fileToDataURL(file));
      const scale = Math.min(1, thumb / c.width, thumb / c.height);
      const w = Math.max(1, Math.round(c.width * scale));
      const h = Math.max(1, Math.round(c.height * scale));
      const fit = document.createElement("canvas");
      fit.width = w;
      fit.height = h;
      const g = fit.getContext("2d")!;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(c, 0, 0, w, h);
      items.push({ canvas: fit, name: file.name.replace(/\.[^.]+$/, "") });
    } catch {
      window.alert(`Skipped unreadable file "${file.name}".`);
    }
  }
  if (!items.length) return;

  const rows = Math.ceil(items.length / columns);
  const cellW = thumb;
  const cellH = thumb + (labels ? LABEL_H : 0);
  const sheetW = MARGIN * 2 + cellW * columns;
  const sheetH = MARGIN * 2 + cellH * rows;

  const sheet = document.createElement("canvas");
  sheet.width = sheetW;
  sheet.height = sheetH;
  const g = sheet.getContext("2d")!;
  g.fillStyle = background;
  g.fillRect(0, 0, sheetW, sheetH);
  g.font = "16px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "top";
  g.fillStyle = "#e5e5e5";

  items.forEach((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = MARGIN + col * cellW;
    const y = MARGIN + row * cellH;
    const ox = x + (cellW - item.canvas.width) / 2;
    const oy = y + (thumb - item.canvas.height) / 2;
    g.drawImage(item.canvas, ox, oy);
    if (labels) {
      const label = item.name.length > 24 ? `${item.name.slice(0, 23)}…` : item.name;
      g.fillText(label, x + cellW / 2, y + thumb + 2, cellW);
    }
  });

  downloadBlob(
    await new Promise<Blob>((r) => sheet.toBlob((b) => r(b ?? new Blob()), "image/png")),
    "contact-sheet.png"
  );

  const canvas = canvasNow();
  if (!canvas) return;
  const addRes = await showOptions({
    title: "Contact Sheet",
    fields: [{ key: "add", label: "Add contact sheet to the open document", type: "checkbox", value: true }],
    okLabel: "OK",
  });
  if (addRes?.add) {
    await flattenToLayer(canvas, sheet, "Contact Sheet");
  }
}
