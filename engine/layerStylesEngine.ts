import { Shadow, Gradient } from "fabric";
import type { KayLayer } from "@/types/layer";

export interface DropShadow {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  size: number;
}

export interface SolidOverlay {
  enabled: boolean;
  color: string;
  originalFill?: string;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientOverlay {
  enabled: boolean;
  angle: number;
  type: "linear" | "radial";
  stops: GradientStop[];
}

export interface LayerStyles {
  dropShadow?: DropShadow;
  outerStroke?: StrokeStyle;
  colorOverlay?: SolidOverlay;
  gradientOverlay?: GradientOverlay;
}

export const DEFAULT_STYLE: LayerStyles = {
  dropShadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 5, color: "#000000", opacity: 75 },
  outerStroke: { enabled: false, color: "#000000", size: 2 },
  colorOverlay: { enabled: false, color: "#000000" },
  gradientOverlay: {
    enabled: false,
    angle: 90,
    type: "linear",
    stops: [
      { offset: 0, color: "#000000" },
      { offset: 1, color: "#ffffff" },
    ],
  },
};

export function parseLayerStyles(json?: string): LayerStyles {
  if (!json) return { ...DEFAULT_STYLE };
  try {
    const parsed = JSON.parse(json);
    return {
      dropShadow: { ...DEFAULT_STYLE.dropShadow!, ...(parsed.dropShadow ?? {}) },
      outerStroke: { ...DEFAULT_STYLE.outerStroke!, ...(parsed.outerStroke ?? {}) },
      colorOverlay: { ...DEFAULT_STYLE.colorOverlay!, ...(parsed.colorOverlay ?? {}) },
      gradientOverlay: { ...DEFAULT_STYLE.gradientOverlay!, ...(parsed.gradientOverlay ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

function rgba(color: string, opacity: number) {
  const alpha = Math.max(0, Math.min(100, opacity)) / 100;
  if (color.length === 4 || color.length === 7) {
    const n = parseInt(color.replace("#", ""), color.length === 4 ? 3 : 6);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export function applyLayerStyles(obj: any, styles: LayerStyles | string) {
  if (!obj) return;
  const s = typeof styles === "string" ? parseLayerStyles(styles) : styles;

  if (s.dropShadow?.enabled) {
    const ds = s.dropShadow;
    obj.set({
      shadow: new Shadow({
        color: rgba(ds.color, ds.opacity),
        blur: Math.max(0, ds.blur),
        offsetX: ds.offsetX,
        offsetY: ds.offsetY,
        affectStroke: true,
      }),
    });
  } else {
    obj.set({ shadow: null });
  }

  const stroke = s.outerStroke?.enabled ? s.outerStroke.color : null;
  obj.set({
    stroke: stroke,
    strokeWidth: s.outerStroke?.enabled ? s.outerStroke.size : 0,
  });

  let fill: any = obj.layerOriginalFill ?? null;
  if (s.colorOverlay?.enabled) {
    fill = s.colorOverlay.color;
  } else if (fill) {
    obj.set({ fill });
  }

  if (s.gradientOverlay?.enabled) {
    const g = s.gradientOverlay;
    const rad = (g.angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const coords = {
      x1: 0.5 - dx * 0.5,
      y1: 0.5 - dy * 0.5,
      x2: 0.5 + dx * 0.5,
      y2: 0.5 + dy * 0.5,
    };
    const colorStops = (g.stops ?? []).map((st) => ({ offset: st.offset, color: st.color }));
    try {
      fill = new Gradient({ type: g.type, coords, colorStops });
    } catch {
      fill = null;
    }
  }

  if (fill) {
    obj.set({ fill });
  }
  obj.setCoords?.();
}

export function applyStylesToLayer(
  canvas: any,
  layer: KayLayer | undefined
) {
  if (!canvas || !layer?.objectId) return;
  const obj = canvas
    .getObjects()
    .find((o: any) => o.kaypaintId === layer.objectId);
  if (obj) {
    applyLayerStyles(obj, layer.layerStyles ?? "");
  }
}

export function stringifyStyles(styles: LayerStyles): string {
  return JSON.stringify(styles);
}
