/* eslint-disable @typescript-eslint/no-explicit-any */

import { useLayerStore, objectForLayer } from "@/store/layerStore";
import { useFeaturesStore } from "@/store/featuresStore";
import {
  BLEND_MODES,
  blendPixel,
  rasterizeObject,
  flattenToLayer,
} from "@/engine/pixelOps";
import { showOptions } from "@/components/Menu/OptionDialog";

export async function setBlendIfDialog(canvas: any, layerId: string): Promise<void> {
  void canvas;
  const res = await showOptions({
    title: "Blend If",
    fields: [
      {
        key: "channel",
        label: "Channel",
        type: "select",
        value: "gray",
        options: [
          { value: "gray", label: "Gray" },
          { value: "r", label: "Red" },
          { value: "g", label: "Green" },
          { value: "b", label: "Blue" },
        ],
      },
      { key: "thisLo", label: "This Layer (low)", type: "slider", min: 0, max: 255, value: 0 },
      { key: "thisHi", label: "This Layer (high)", type: "slider", min: 0, max: 255, value: 255 },
      { key: "underLo", label: "Underlying (low)", type: "slider", min: 0, max: 255, value: 0 },
      { key: "underHi", label: "Underlying (high)", type: "slider", min: 0, max: 255, value: 255 },
    ],
    okLabel: "OK",
  });
  if (!res) return;
  useFeaturesStore.getState().setBlendIf(layerId, [
    {
      channel: (res.channel === "r" || res.channel === "g" || res.channel === "b" ? res.channel : "gray"),
      thisLo: Number(res.thisLo),
      thisHi: Number(res.thisHi),
      underLo: Number(res.underLo),
      underHi: Number(res.underHi),
    },
  ]);
}

export function clearBlendIfForLayer(layerId: string): void {
  useFeaturesStore.getState().clearBlendIf(layerId);
}

export async function knockoutDialog(canvas: any, layerId: string): Promise<void> {
  void canvas;
  const current = useFeaturesStore.getState().knockout[layerId] ?? "none";
  const res = await showOptions({
    title: "Knockout",
    fields: [
      {
        key: "mode",
        label: "Knockout",
        type: "select",
        value: current,
        options: [
          { value: "none", label: "None" },
          { value: "shallow", label: "Shallow" },
          { value: "deep", label: "Deep" },
        ],
      },
    ],
  });
  if (!res) return;
  useFeaturesStore.getState().setKnockout(
    layerId,
    res.mode === "shallow" || res.mode === "deep" ? res.mode : "none"
  );
}

function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function rangeWeight(v: number, lo: number, hi: number): number {
  if (v <= lo) {
    const d = lo - v;
    if (d >= 8) return 1;
    return smoothstep(d / 8);
  }
  if (v >= hi) {
    const d = v - hi;
    if (d >= 8) return 1;
    return smoothstep(d / 8);
  }
  return 0;
}

function blendIfWeight(bi: any, layerPx: number[], underPx: number[]): number {
  const channel = bi.channel === "r" || bi.channel === "g" || bi.channel === "b" ? bi.channel : "gray";
  const own =
    channel === "r"
      ? layerPx[0]
      : channel === "g"
        ? layerPx[1]
        : channel === "b"
          ? layerPx[2]
          : 0.299 * layerPx[0] + 0.587 * layerPx[1] + 0.114 * layerPx[2];
  const under =
    channel === "r"
      ? underPx[0]
      : channel === "g"
        ? underPx[1]
        : channel === "b"
          ? underPx[2]
          : 0.299 * underPx[0] + 0.587 * underPx[1] + 0.114 * underPx[2];
  return rangeWeight(own, Number(bi.thisLo), Number(bi.thisHi)) *
    rangeWeight(under, Number(bi.underLo), Number(bi.underHi));
}

export async function flattenWithAdvanced(canvas: any): Promise<void> {
  if (!canvas) return;
  const W = canvas.width ?? 1920;
  const H = canvas.height ?? 1080;
  const ls = useLayerStore.getState();
  const blendIfMap = useFeaturesStore.getState().blendIf;
  const knockoutMap = useFeaturesStore.getState().knockout;

  const visible = ls.layers.filter((l) => l.visible);
  const placed: { layer: any; c: HTMLCanvasElement }[] = [];
  for (const layer of visible) {
    const obj = objectForLayer(canvas, layer);
    if (!obj) continue;
    const raster = rasterizeObject(obj);
    if (!raster) continue;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cg = c.getContext("2d")!;
    cg.save();
    cg.translate(obj.left ?? 0, obj.top ?? 0);
    cg.rotate(((obj.angle ?? 0) * Math.PI) / 180);
    cg.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
    cg.drawImage(raster, 0, 0);
    cg.restore();
    placed.push({ layer, c });
  }
  if (!placed.length) return;

  const groupBottomIdx = new Map<string, number>();
  for (let i = 0; i < placed.length; i++) {
    const grp = ls.groupForLayer(placed[i].layer.id);
    if (grp && !groupBottomIdx.has(grp.id)) groupBottomIdx.set(grp.id, i);
  }

  const acc = document.createElement("canvas");
  acc.width = W;
  acc.height = H;
  const g = acc.getContext("2d")!;

  for (let i = 0; i < placed.length; i++) {
    const { layer, c } = placed[i];
    const bi = blendIfMap[layer.id]?.[0];
    const ko = knockoutMap[layer.id] ?? "none";
    const mode =
      typeof layer.blendMode === "string" && BLEND_MODES.includes(layer.blendMode as any)
        ? layer.blendMode
        : "normal";
    const opacity = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100));

    if (!bi && ko === "none") {
      g.save();
      g.globalCompositeOperation = mode as GlobalCompositeOperation;
      g.globalAlpha = opacity;
      g.drawImage(c, 0, 0);
      g.restore();
      continue;
    }

    let baseCanvas: HTMLCanvasElement = acc;
    if (ko !== "none") {
      let baseIdx = 0;
      if (ko === "shallow") {
        const grp = ls.groupForLayer(layer.id);
        if (grp && groupBottomIdx.has(grp.id)) baseIdx = groupBottomIdx.get(grp.id)!;
      }
      baseCanvas = placed[baseIdx]?.c ?? acc;
    }

    const layerData = c.getContext("2d")!.getImageData(0, 0, W, H).data;
    const baseData = baseCanvas.getContext("2d")!.getImageData(0, 0, W, H).data;
    const accData = g.getImageData(0, 0, W, H);
    const out = new Uint8ClampedArray(accData.data);
    const knock = ko !== "none";
    for (let p = 0; p < W * H; p++) {
      const o = p * 4;
      const la = layerData[o + 3];
      if (la <= 0) continue;
      const basePx = knock
        ? [baseData[o], baseData[o + 1], baseData[o + 2], baseData[o + 3]]
        : [accData.data[o], accData.data[o + 1], accData.data[o + 2], accData.data[o + 3]];
      const layerPx = [layerData[o], layerData[o + 1], layerData[o + 2], la];
      let eff = opacity;
      if (bi) eff *= blendIfWeight(bi, layerPx, basePx);
      if (eff <= 0) continue;
      const blended = blendPixel(basePx, layerPx, mode, eff);
      out[o] = blended[0];
      out[o + 1] = blended[1];
      out[o + 2] = blended[2];
      out[o + 3] = blended[3];
    }
    g.putImageData(new ImageData(out, W, H), 0, 0);
  }

  await flattenToLayer(canvas, acc, "Merged (Advanced)");
}
