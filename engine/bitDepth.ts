/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { useFeaturesStore } from "@/store/featuresStore";
import { useSettingsStore } from "@/store/settingsStore";
import { applyPixelsToActiveLayer, compositeCanvas } from "@/engine/pixelOps";
import { buildTiff16 } from "@/engine/tiffWriter";
import { sRgbProfile } from "@/engine/iccEngine";

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export async function setBitDepthDialog(canvas: any) {
  const res = await showOptions({
    title: "Bit Depth",
    okLabel: "OK",
    text: "8 Bits/Channel is normal. 16 Bits/Channel applies subtle ordered dithering to the active layer to simulate reduced banding. 32 Bits/Channel enables HDR Exposure adjustments.",
    fields: [
      {
        key: "depth",
        label: "Bit Depth",
        type: "select",
        value: "8",
        options: [
          { value: "8", label: "8 Bits/Channel" },
          { value: "16", label: "16 Bits/Channel" },
          { value: "32", label: "32 Bits/Channel" },
        ],
      },
    ],
  });
  if (!res) return;
  const depth = (Number(res.depth ?? 8) as 8 | 16 | 32) ?? 8;
  useFeaturesStore.getState().setBitDepth(depth);
  if (depth === 16) {
    await applyPixelsToActiveLayer(canvas, (data, w, h) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const d = (BAYER4[y % 4][x % 4] + 0.5) / 16 - 0.5;
          for (let c = 0; c < 3; c++) {
            data[i + c] = Math.max(0, Math.min(255, Math.round(data[i + c] + d * 8)));
          }
        }
      }
    });
  }
}

export async function hdrExposure(canvas: any, ev: number): Promise<boolean> {
  if (useFeaturesStore.getState().bitDepth !== 32) {
    window.alert("HDR Exposure requires 32 Bits/Channel mode (Image ▸ Mode ▸ 32 Bits/Channel).");
    return false;
  }
  const f = Math.pow(2, ev);
  return applyPixelsToActiveLayer(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = (data[i + c] / 255) * f;
        const toned = Math.pow(1 - Math.exp(-v), 1 / 1.8);
        data[i + c] = Math.round(clamp01(toned) * 255);
      }
    }
  });
}

export function bitDepthLabel(): string {
  return `${useFeaturesStore.getState().bitDepth} Bits/Channel`;
}

export async function exportTiff16(canvas: any) {
  const composite = await compositeCanvas(canvas);
  if (!composite) return;
  const w = composite.width;
  const h = composite.height;
  if (!w || !h) return;
  const g = composite.getContext("2d");
  if (!g) return;
  const img = g.getImageData(0, 0, w, h);
  const dpi = useSettingsStore.getState().dpi || 96;
  const bytes = buildTiff16(w, h, dpi, img.data, sRgbProfile());
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/tiff" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export-16bit.tif";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
