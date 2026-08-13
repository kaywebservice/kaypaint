/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer, hexToRgb01 } from "@/engine/pixelOps";

const INK_DEFAULTS = ["#231f20", "#9b9b9b", "#8a8a8a", "#c2c2c2"];

const CURVES: Record<string, (x: number) => number> = {
  linear: (x) => x,
  warm: (x) => Math.pow(x, 1.15),
  cool: (x) => Math.pow(x, 0.9),
  punchy: (x) => x * x * (3 - 2 * x),
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export async function duotoneDialog(canvas: any) {
  const res = await showOptions({
    title: "Duotone",
    okLabel: "OK",
    text: "Converts the active layer to grayscale and prints it with the selected inks.",
    fields: [
      {
        key: "mode",
        label: "Type",
        type: "select",
        value: "duotone",
        options: [
          { value: "monotone", label: "Monotone" },
          { value: "duotone", label: "Duotone" },
          { value: "tritone", label: "Tritone" },
          { value: "quadtone", label: "Quadtone" },
        ],
      },
      { key: "ink1", label: "Ink 1", type: "color", value: INK_DEFAULTS[0] },
      { key: "ink2", label: "Ink 2", type: "color", value: INK_DEFAULTS[1] },
      { key: "ink3", label: "Ink 3", type: "color", value: INK_DEFAULTS[2] },
      { key: "ink4", label: "Ink 4", type: "color", value: INK_DEFAULTS[3] },
      {
        key: "curve",
        label: "Curve Preset",
        type: "select",
        value: "linear",
        options: [
          { value: "linear", label: "Linear" },
          { value: "warm", label: "Warm" },
          { value: "cool", label: "Cool" },
          { value: "punchy", label: "Punchy" },
        ],
      },
    ],
  });
  if (!res) return;

  const mode = String(res.mode ?? "duotone");
  const n = mode === "monotone" ? 1 : mode === "tritone" ? 3 : mode === "quadtone" ? 4 : 2;
  const inks = INK_DEFAULTS.map((_, k) =>
    hexToRgb01(String(res[`ink${k + 1}`] ?? INK_DEFAULTS[k]))
  );
  const curve = CURVES[String(res.curve ?? "linear")] ?? CURVES.linear;

  await applyPixelsToActiveLayer(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < n; k++) {
        const wgt = curve(lum) / n;
        r += inks[k][0] * wgt;
        g += inks[k][1] * wgt;
        b += inks[k][2] * wgt;
      }
      data[i] = Math.round(clamp01(r) * 255);
      data[i + 1] = Math.round(clamp01(g) * 255);
      data[i + 2] = Math.round(clamp01(b) * 255);
    }
  });
}
