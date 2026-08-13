/* eslint-disable @typescript-eslint/no-explicit-any */

import { Image as FabricImage, filters } from "fabric";

type FilterMap = Record<string, any>;

const FILTERS: FilterMap = {
  blur: filters.Blur,
  brightness: filters.Brightness,
  grayscale: filters.Grayscale,
  sepia: filters.Sepia,
  invert: filters.Invert,
  pixelate: filters.Pixelate,
  noise: filters.Noise,
  vintage: filters.Vintage,
  kodachrome: filters.Kodachrome,
  polaroid: filters.Polaroid,
  brownie: filters.Brownie,
  saturation: filters.Saturation,
  contrast: filters.Contrast,
};

export function applyFilter(
  object: any,
  name: string,
  options: any = {}
) {
  if (!object || !object.filters) return;

  const FilterClass = FILTERS[name];
  if (!FilterClass) return;

  const applied: any[] = object.filters;
  applied.length = 0;
  applied.push(new FilterClass(options));

  if (typeof object.applyFilters === "function") {
    object.applyFilters();
  }

  object.setCoords?.();
  object.canvas?.requestRenderAll();
}

export function applyBlur(object: any, amount: number) {
  applyFilter(object, "blur", {
    blur: Math.max(0, Math.round(amount)),
  });
}

export function applyBrightness(object: any, value: number) {
  applyFilter(object, "brightness", {
    brightness: Math.max(-1, Math.min(1, value)),
  });
}

export function clearFilters(object: any) {
  if (!object || !object.filters) return;

  object.filters.length = 0;

  if (typeof object.applyFilters === "function") {
    object.applyFilters();
  }

  object.canvas?.requestRenderAll();
}

/** Apply a named filter to a plain canvas element and return the result. */
export function applyFilterToCanvas(
  src: HTMLCanvasElement,
  name: string,
  options: any = {}
): HTMLCanvasElement {
  const FilterClass = FILTERS[name];
  if (!FilterClass) return src;
  const img = new FabricImage(src);
  try {
    img.filters = [new FilterClass(options)];
    img.applyFilters();
  } catch {
    return src;
  }
  const el = (img.getElement?.() ?? (img as any)._element ?? src) as HTMLCanvasElement;
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")!.drawImage(el, 0, 0);
  return c;
}