/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import {
  blurAlpha,
  edgeFeatherAlpha,
  morphAlpha,
  applyContrast,
  decontaminateColors,
} from "@/engine/refineEdgeCore";

export { blurAlpha, edgeFeatherAlpha, morphAlpha, applyContrast, decontaminateColors } from "@/engine/refineEdgeCore";

export interface RefineEdgeOptions {
  smooth?: number;
  feather?: number;
  contract?: number;
  contrast?: number;
  decontaminate?: boolean;
}

export async function refineEdges(canvas: any, opts?: RefineEdgeOptions): Promise<void> {
  let o = opts;
  if (!o) {
    const res = await showOptions({
      title: "Refine Edge",
      okLabel: "OK",
      fields: [
        { key: "smooth", label: "Smooth", type: "slider", min: 0, max: 100, step: 1, value: 0 },
        { key: "feather", label: "Feather", type: "slider", min: 0, max: 100, step: 1, value: 0 },
        { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, step: 1, value: 50 },
        { key: "contract", label: "Contract/Expand", type: "slider", min: -100, max: 100, step: 1, value: 0 },
        { key: "decontaminate", label: "Decontaminate Colors", type: "checkbox", value: false },
      ],
    });
    if (!res) return;
    o = {
      smooth: Number(res.smooth ?? 0),
      feather: Number(res.feather ?? 0),
      contrast: Number(res.contrast ?? 50),
      contract: Number(res.contract ?? 0),
      decontaminate: !!res.decontaminate,
    };
  }

  const smooth = Math.max(0, Number(o.smooth ?? 0));
  const feather = Math.max(0, Number(o.feather ?? 0));
  const contrast = Math.max(0, Number(o.contrast ?? 50));
  const contract = Number(o.contract ?? 0);
  const decontaminate = !!o.decontaminate;

  await applyPixelsToActiveLayer(canvas, (data, w, h) => {
    if (smooth > 0) blurAlpha(data, w, h, Math.max(1, Math.round(smooth / 10)));
    if (feather > 0) {
      // Edge-aware feather: softens within similar tones but stays sharp
      // across color edges, so it doesn't bleed into the subject.
      const passes = Math.max(1, Math.min(6, Math.round(feather / 16)));
      edgeFeatherAlpha(data, w, h, Math.max(1, Math.round(feather / 4)), passes);
    }
    if (contract !== 0) {
      morphAlpha(data, w, h, Math.max(1, Math.round(Math.abs(contract) / 10)), contract < 0 ? "erode" : "dilate");
    }
    applyContrast(data, w, h, contrast);
    if (decontaminate) decontaminateColors(data, w, h);
  });
}
