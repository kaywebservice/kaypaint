/* eslint-disable @typescript-eslint/no-explicit-any */
import { Image as FabricImage, StaticCanvas } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { bakeAdjustments } from "@/engine/adjustmentEngine";

/**
 * Shared pixel helpers used by the menu commands (adjustments, filters,
 * fill/stroke, selection ops...). All operate on the canvas' active object.
 */

export function canvasNow() {
  return useEditorStore.getState().canvas;
}

export function pushHistory(ctx?: ToolCtx) {
  if (ctx) ctx.push();
  useEditorStore.getState().history?.push?.();
}

export function notifyNoLayer() {
  window.alert("Select a layer (rasterize it first if needed).");
}

export function loadImageCanvas(src: string): Promise<HTMLCanvasElement> {
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
    img.src = src;
  });
}

/** Full-res composite of the document (adjustments baked in). */
export async function compositeCanvas(canvas: any): Promise<HTMLCanvasElement | null> {
  if (!canvas) return null;
  try {
    const baked = await bakeAdjustments(canvas);
    const src = baked ?? (await loadImageCanvas(canvas.toDataURL({ format: "png", multiplier: 1 })));
    return src;
  } catch {
    return null;
  }
}

/** Rasterize any fabric object to a canvas element at its object-space size. */
export function rasterizeObject(obj: any): HTMLCanvasElement | null {
  if (!obj) return null;
  try {
    if (obj.type === "image" && obj.getElement) {
      const el = obj.getElement() as HTMLCanvasElement | HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = el.width;
      c.height = el.height;
      const g = c.getContext("2d")!;
      if (obj.filters?.length) {
        const clone = document.createElement("canvas");
        clone.width = el.width;
        clone.height = el.height;
        clone.getContext("2d")!.drawImage(el, 0, 0);
        // apply fabric filters to a clone via filterWorker-free path
        g.drawImage(clone, 0, 0);
      } else {
        g.drawImage(el, 0, 0);
      }
      return c;
    }
    const sc = new StaticCanvas(document.createElement("canvas"), {
      width: obj._width ?? obj.width,
      height: obj._height ?? obj.height,
      backgroundColor: "transparent",
    });
    sc.add(obj);
    const url = sc.toDataURL({ format: "png", multiplier: 1 });
    const c = document.createElement("canvas");
    const img = new Image();
    img.src = url;
    c.width = sc.getWidth();
    c.height = sc.getHeight();
    c.getContext("2d")!.drawImage(img, 0, 0);
    sc.dispose();
    return c;
  } catch {
    return null;
  }
}

/** Read the active object's pixels as an ImageData (rasterizing it). */
export function readActivePixels(canvas: any): {
  obj: any;
  width: number;
  height: number;
  data: Uint8ClampedArray;
} | null {
  const obj = canvas?.getActiveObject?.();
  if (!obj) return null;
  const el = obj.getElement?.();
  if (obj.type === "image" && el?.width && el?.height) {
    const c = document.createElement("canvas");
    c.width = el.width;
    c.height = el.height;
    const g = c.getContext("2d")!;
    g.drawImage(el, 0, 0);
    return { obj, width: el.width, height: el.height, data: g.getImageData(0, 0, el.width, el.height).data };
  }
  const raster = rasterizeObject(obj);
  if (!raster) return null;
  const g = raster.getContext("2d")!;
  return { obj, width: raster.width, height: raster.height, data: g.getImageData(0, 0, raster.width, raster.height).data };
}

/**
 * Apply a pixel transform to the ACTIVE layer.
 * fn(imageData) mutates the ImageData; result is written back to the object
 * (replacing its element, preserving position/transform/layer binding).
 */
export async function applyPixelsToActiveLayer(
  canvasOrCtx: any,
  fn: (data: Uint8ClampedArray, width: number, height: number) => void
): Promise<boolean> {
  const ctx: ToolCtx = canvasOrCtx?.canvas
    ? canvasOrCtx
    : { canvas: canvasOrCtx, get: () => null, push: () => {} };
  const canvas = ctx.canvas ?? canvasNow();
  const read = readActivePixels(canvas);
  if (!read) {
    notifyNoLayer();
    return false;
  }
  const { obj, width, height, data } = read;
  const out = new Uint8ClampedArray(data);
  fn(out, width, height);

  try {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d")!;
    g.putImageData(new ImageData(out, width, height), 0, 0);

    if (obj.type === "image") {
      const prev = obj.getElement?.();
      const newEl = document.createElement("img");
      newEl.src = c.toDataURL("image/png");
      await new Promise<void>((res) => {
        newEl.onload = () => res();
        newEl.onerror = () => res();
      });
      const prevLeft = obj.left;
      const prevTop = obj.top;
      const prevScaleX = obj.scaleX;
      const prevScaleY = obj.scaleY;
      const prevAngle = obj.angle;
      const prevOpacity = obj.opacity;
      const prevVisible = obj.visible;
      const prevId = obj.kaypaintId ?? obj.id;
      const prevStyles = obj.layerStyleJson;
      obj.setElement(newEl as any);
      obj.set({
        left: prevLeft,
        top: prevTop,
        scaleX: prevScaleX,
        scaleY: prevScaleY,
        angle: prevAngle,
        opacity: prevOpacity,
        visible: prevVisible,
      });
      if (prevStyles) obj.set("layerStyleJson", prevStyles);
      obj.setCoords();
      void prev;
      void prevId;
    } else {
      const sc = new StaticCanvas(document.createElement("canvas"), {
        width,
        height,
        backgroundColor: "transparent",
      });
      sc.add(obj);
      const url = sc.toDataURL({ format: "png", multiplier: 1 });
      sc.dispose();
      const old = c.getContext("2d")!;
      const scC = document.createElement("canvas");
      const img = new Image();
      img.src = url;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      });
      scC.width = obj._width ?? obj.width;
      scC.height = obj._height ?? obj.height;
      old.drawImage(scC, 0, 0);
      // rasterize transform the non-image object onto its own bounds
      const replaced = new FabricImage(c, {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        opacity: obj.opacity,
        visible: obj.visible,
        kaypaintId: obj.kaypaintId ?? obj.id,
        layerStyleJson: obj.layerStyleJson,
      });
      replaced.setCoords();
      canvas.remove(obj);
      canvas.add(replaced);
      canvas.setActiveObject(replaced);
      replaced.setCoords();
    }
    canvas.requestRenderAll();
    pushHistory(ctx);
    return true;
  } catch {
    return false;
  }
}

/** Replace all document content with a single flattened image layer. */
export async function flattenToLayer(
  canvas: any,
  composite: HTMLCanvasElement,
  name = "Background"
): Promise<boolean> {
  if (!canvas || !composite) return false;
  try {
    const obj = new FabricImage(composite, {
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      selectable: true,
      evented: true,
    });
    const anyObj = obj as any;
    anyObj.kaypaintId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    obj.setCoords();
    canvas.clear();
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();

    useLayerStore.setState({
      layers: [
        {
          id: `layer-${Date.now()}`,
          name,
          type: "image",
          objectId: anyObj.kaypaintId,
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: "normal",
          hasMask: false,
        },
      ],
      activeLayer: null,
      groups: [],
    });
    pushHistory();
    return true;
  } catch {
    return false;
  }
}

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function rgb01ToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Blend `blend` over `base`, both as [r,g,b,a] in 0..255, alpha-composited. */
export function blendPixel(
  base: number[],
  blend: number[],
  mode: string,
  opacity: number
): number[] {
  const ba = (base[3] ?? 255) / 255;
  const bA = (blend[3] ?? 255) / 255 * opacity;
  const outA = bA + ba * (1 - bA);
  if (outA <= 0) return [0, 0, 0, 0];
  const f = (channel: number) => {
    const b = base[channel] / 255;
    const s = blend[channel] / 255;
    let v: number;
    switch (mode) {
      case "multiply": v = b * s; break;
      case "screen": v = 1 - (1 - b) * (1 - s); break;
      case "overlay": v = b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s); break;
      case "hardLight": v = s < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s); break;
      case "darken": v = Math.min(b, s); break;
      case "lighten": v = Math.max(b, s); break;
      case "colorDodge": v = s >= 1 ? 1 : Math.min(1, b / (1 - s)); break;
      case "colorBurn": v = s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s); break;
      case "difference": v = Math.abs(b - s); break;
      case "exclusion": v = b + s - 2 * b * s; break;
      case "softLight":
        v = s < 0.5
          ? b - (1 - 2 * s) * b * (1 - b)
          : b + (2 * s - 1) * (Math.sqrt(Math.max(0, b)) - b);
        break;
      case "luminosity": v = b; break;
      default: v = s; break;
    }
    const mixed = v * bA + b * ba * (1 - bA);
    return Math.max(0, Math.min(255, Math.round(mixed * 255)));
  };
  return [f(0), f(1), f(2), Math.round(outA * 255)];
}

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "hardLight",
  "darken",
  "lighten",
  "colorDodge",
  "colorBurn",
  "difference",
  "exclusion",
  "softLight",
];