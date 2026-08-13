import { Shadow, classRegistry } from "fabric";

export interface ShadowEffect {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface GlowEffect {
  enabled: boolean;
  color: string;
  blur: number;
  opacity: number;
}

export interface LayerEffects {
  shadow: ShadowEffect;
  glow: GlowEffect;
}

export function defaultEffects(): LayerEffects {
  return {
    shadow: {
      enabled: false,
      color: "#000000",
      blur: 8,
      offsetX: 4,
      offsetY: 4,
      opacity: 60,
    },
    glow: { enabled: false, color: "#8a95fb", blur: 16, opacity: 70 },
  };
}

function ensureSerialization(obj: any) {
  const ctor = obj?.constructor;
  if (!ctor) return;
  const list: string[] = ctor.customProperties ?? [];
  if (!list.includes("effects")) {
    ctor.customProperties = [...list, "effects"];
  }
}

export function applyEffects(obj: any) {
  ensureSerialization(obj);
  const effects: LayerEffects = obj.effects ?? defaultEffects();
  const shadow = effects.shadow;
  const glow = effects.glow;

  let next: any = null;
  if (shadow.enabled) {
    const alpha = Math.round((shadow.opacity / 100) * 255);
    next = new Shadow({
      color: shadow.color + alpha.toString(16).padStart(2, "0"),
      blur: shadow.blur,
      offsetX: shadow.offsetX,
      offsetY: shadow.offsetY,
    });
  } else if (glow.enabled) {
    const alpha = Math.round((glow.opacity / 100) * 255);
    next = new Shadow({
      color: glow.color + alpha.toString(16).padStart(2, "0"),
      blur: glow.blur,
      offsetX: 0,
      offsetY: 0,
    });
  }

  if (obj.shadow !== next) {
    obj.set({ shadow: next });
  }
}

export function setEffects(obj: any, partial: Partial<LayerEffects>) {
  const effects: LayerEffects = {
    ...(obj.effects ?? defaultEffects()),
    ...partial,
  };
  obj.set({ effects });
  applyEffects(obj);
  obj.setCoords?.();
}

export function syncAllEffects(canvas: any) {
  if (!canvas) return;
  canvas
    .getObjects()
    .forEach((obj: any) => applyEffects(obj));
}

export function isAdjustmentLayer(obj: any) {
  return !!obj && obj.type === "SAdjustment";
}

function registerBuiltinEffectsProp() {
  const types = [
    "Rect",
    "Circle",
    "Triangle",
    "Polygon",
    "Line",
    "Path",
    "Ellipse",
    "Text",
    "IText",
    "Textbox",
  ];
  for (const t of types) {
    const cls = classRegistry.getClass(t) as any;
    if (cls && !(cls.customProperties ?? []).includes("effects")) {
      cls.customProperties = [...(cls.customProperties ?? []), "effects"];
    }
  }
}

export function ensureEffectsRegistered() {
  registerBuiltinEffectsProp();
}