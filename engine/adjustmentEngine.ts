/* eslint-disable @typescript-eslint/no-explicit-any */
import { Object as FabricObject, classRegistry } from "fabric";
import {
  applyLevels,
  applyCurves,
  applyHueSat,
} from "@/engine/adjustmentCore";

export { applyLevels, applyCurves, applyHueSat } from "@/engine/adjustmentCore";

export type AdjustmentType = "levels" | "curves" | "hueSat";

export interface AdjustmentParams {
  black: number;
  gamma: number;
  white: number;
  curve: { x: number; y: number }[];
  hue: number;
  saturation: number;
  lightness: number;
}

export function defaultAdjustmentParams(type: AdjustmentType): AdjustmentParams {
  return {
    black: 0,
    gamma: 1,
    white: 255,
    curve: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    hue: 0,
    saturation: 0,
    lightness: 0,
  };
}

const ADJUSTMENT_PROPS = ["adjustmentType", "params"];

export class SAdjustment extends FabricObject {
  static type = "SAdjustment";

  adjustmentType: AdjustmentType;
  params: AdjustmentParams;

  constructor(props: any = {}) {
    super(props);
    this.adjustmentType = props.adjustmentType ?? "levels";
    this.params = { ...defaultAdjustmentParams(this.adjustmentType), ...(props.params ?? {}) };
    this.width = props.width ?? 1920;
    this.height = props.height ?? 1080;
    this.left = props.left ?? 0;
    this.top = props.top ?? 0;
    this.originX = "left";
    this.originY = "top";
    this.selectable = true;
    this.evented = false;
    this.lockMovementX = true;
    this.lockMovementY = true;
    this.lockScalingX = true;
    this.lockScalingY = true;
    this.lockRotation = true;
    this.visible = props.visible ?? true;
  }

  static fromObject(object: any) {
    return Promise.resolve(new SAdjustment(object));
  }

  _render(ctx: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(138,149,251,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(30,36,53,0.35)";
    ctx.fillRect(10, 10, 44, 34);
    ctx.strokeStyle = "rgba(138,149,251,0.6)";
    ctx.strokeRect(10.5, 10.5, 43, 33);
    ctx.fillStyle = "#a7b1ff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const label = this.adjustmentType === "levels" ? "Levels" : this.adjustmentType === "curves" ? "Curves" : "Hue/Sat";
    ctx.fillText(label, 14, 27);
    ctx.restore();
  }

  toObject(propertiesToInclude: string[] = []) {
    return {
      ...super.toObject([...ADJUSTMENT_PROPS, ...propertiesToInclude]),
      params: this.params,
      adjustmentType: this.adjustmentType,
    };
  }
}

if (typeof window !== "undefined") {
  classRegistry.setClass(SAdjustment);
}

export function getAdjustments(canvas: any): any[] {
  if (!canvas) return [];
  return canvas
    .getObjects()
    .filter((o: any) => o.type === "SAdjustment" && o.visible && o.opacity > 0.01);
}

export function loadCanvasElement(src: HTMLCanvasElement | string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = typeof src === "string" ? src : src.toDataURL("image/png");
  });
}


export function applyAdjustmentToCanvas(src: HTMLCanvasElement, adj: any): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const params = adj.params ?? {};

  if (adj.adjustmentType === "levels") {
    applyLevels(img.data, params.black ?? 0, params.gamma ?? 1, params.white ?? 255);
  } else if (adj.adjustmentType === "curves") {
    applyCurves(img.data, params.curve ?? defaultAdjustmentParams("curves").curve);
  } else if (adj.adjustmentType === "hueSat") {
    applyHueSat(img.data, params.hue ?? 0, params.saturation ?? 0, params.lightness ?? 0);
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

export function bakeAdjustments(canvas: any): Promise<HTMLCanvasElement | null> {
  const adjustments = getAdjustments(canvas);
  if (adjustments.length === 0) return Promise.resolve(null);

  return loadCanvasElement(canvas.toDataURL({ format: "png", multiplier: 1 })).then((base) => {
    let current = base;
    for (const adj of adjustments) {
      current = applyAdjustmentToCanvas(current, adj);
    }
    return current;
  });
}

function schedulePreview() {
  let timer: number | null = null;
  return (draw: () => void) => {
    if (timer != null) return;
    timer = window.setTimeout(() => {
      timer = null;
      draw();
    }, 40);
  };
}

export const schedulePreviewDraw = schedulePreview();

export function drawAdjustmentPreview(ev: any, overlayCanvas: HTMLCanvasElement | null, canvas: any, zoom: number) {
  void ev;
  if (!overlayCanvas || !canvas) return;

  const adjustments = getAdjustments(canvas);
  if (adjustments.length === 0) {
    overlayCanvas.width = 0;
    overlayCanvas.height = 0;
    return;
  }

  schedulePreviewDraw(() => {
    const ow = Math.round(canvas.width * zoom);
    const oh = Math.round(canvas.height * zoom);
    if (overlayCanvas.width !== ow) overlayCanvas.width = ow;
    if (overlayCanvas.height !== oh) overlayCanvas.height = oh;
    const octx = overlayCanvas.getContext("2d")!;
    octx.clearRect(0, 0, ow, oh);

    canvas.toDataURL({ format: "png", multiplier: 1 });
    const img = new Image();
    img.onload = () => {
      const scale = 0.4;
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(canvas.width * scale));
      small.height = Math.max(1, Math.round(canvas.height * scale));
      const sctx = small.getContext("2d")!;
      sctx.drawImage(img, 0, 0, small.width, small.height);

      // Run the adjustment stack off the main thread when the worker is
      // available; otherwise fall back to the synchronous path.
      const steps = adjustments.map((adj) => ({
        type: adj.adjustmentType as "levels" | "curves" | "hueSat",
        params: adj.params ?? {},
      }));
      import("@/engine/pixelWorkerClient").then(({ px }) =>
        px.adjust(new Uint8ClampedArray(sctx.getImageData(0, 0, small.width, small.height).data), steps).then((out) => {
          const tmp = new ImageData(new Uint8ClampedArray(out), small.width, small.height);
          sctx.putImageData(tmp, 0, 0);
          octx.drawImage(small, 0, 0, ow, oh);
        })
      );
    };
    img.src = canvas.toDataURL({ format: "png", multiplier: 1 });
  });
}