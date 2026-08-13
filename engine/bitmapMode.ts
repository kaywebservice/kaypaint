/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { useSettingsStore } from "@/store/settingsStore";

const MODE_KEY = "kaypaint:imageMode";

function setBitmapMode() {
  try {
    localStorage.setItem(MODE_KEY, "bitmap");
    window.dispatchEvent(new Event("kaypaint:image-mode-changed"));
  } catch {
    /* ignore */
  }
}

function halftonePixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  shape: string,
  dpi: number,
  frequency: number,
  angle: number
) {
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const spacing = Math.max(1, dpi / Math.max(1, frequency));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const u = (x * ca + y * sa) / spacing;
      const v = (y * ca - x * sa) / spacing;
      let t: number;
      if (shape === "line") {
        t = 0.5 + 0.5 * Math.sin(2 * Math.PI * u);
      } else if (shape === "ellipse") {
        t = 0.5 + 0.5 * Math.sin(2 * Math.PI * u) * Math.sin(2 * Math.PI * v * 1.4);
      } else {
        t = 0.5 + 0.5 * Math.sin(2 * Math.PI * u) * Math.sin(2 * Math.PI * v);
      }
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const out = lum < t * 255 ? 0 : 255;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
    }
  }
}

function diffusionPixels(data: Uint8ClampedArray, w: number, h: number) {
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      lum[y * w + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const yi = y * w + x;
      const i = yi * 4;
      const old = lum[yi];
      const nv = old < 128 ? 0 : 255;
      const err = old - nv;
      data[i] = nv;
      data[i + 1] = nv;
      data[i + 2] = nv;
      if (x + 1 < w) lum[yi + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) lum[yi - 1 + w] += (err * 3) / 16;
        lum[yi + w] += (err * 5) / 16;
        if (x + 1 < w) lum[yi + 1 + w] += err / 16;
      }
    }
  }
}

function patternPixels(data: Uint8ClampedArray, w: number, h: number, pattern: string, dpi: number) {
  const cell = Math.max(4, Math.round(dpi / 53));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let black = false;
      if (pattern === "checkerboard") {
        black = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      } else if (pattern === "dots") {
        const dx = (x % cell) - cell / 2;
        const dy = (y % cell) - cell / 2;
        black = dx * dx + dy * dy <= cell * cell * 0.1225;
      } else {
        black = ((x + y) % cell) < cell / 2;
      }
      const out = black ? 0 : 255;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
    }
  }
}

export async function bitmapDialog(canvas: any) {
  const res = await showOptions({
    title: "Bitmap",
    okLabel: "OK",
    text: "Converts the active layer to pure black and white.",
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        value: "halftone",
        options: [
          { value: "halftone", label: "Halftone Screen" },
          { value: "diffusion", label: "Diffusion Dither" },
          { value: "pattern", label: "Pattern" },
        ],
      },
      {
        key: "shape",
        label: "Halftone Shape",
        type: "select",
        value: "round",
        options: [
          { value: "round", label: "Round" },
          { value: "line", label: "Line" },
          { value: "ellipse", label: "Ellipse" },
        ],
      },
      { key: "frequency", label: "Frequency", type: "slider", value: 53, min: 1, max: 100, suffix: " lpi" },
      { key: "angle", label: "Angle", type: "slider", value: 45, min: -180, max: 180, suffix: "°" },
      {
        key: "pattern",
        label: "Pattern",
        type: "select",
        value: "checkerboard",
        options: [
          { value: "checkerboard", label: "Checkerboard" },
          { value: "dots", label: "Dots" },
          { value: "diagonal", label: "Diagonal" },
        ],
      },
    ],
  });
  if (!res) return;

  const method = String(res.method ?? "halftone");
  const shape = String(res.shape ?? "round");
  const frequency = Math.max(1, Math.min(100, Number(res.frequency ?? 53) || 53));
  const angle = Number(res.angle ?? 45) || 0;
  const pattern = String(res.pattern ?? "checkerboard");
  const dpi = useSettingsStore.getState().dpi || 96;

  const ok = await applyPixelsToActiveLayer(canvas, (data, w, h) => {
    if (method === "diffusion") diffusionPixels(data, w, h);
    else if (method === "pattern") patternPixels(data, w, h, pattern, dpi);
    else halftonePixels(data, w, h, shape, dpi, frequency, angle);
  });
  if (ok) setBitmapMode();
}
