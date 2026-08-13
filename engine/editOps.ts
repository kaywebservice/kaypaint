/* eslint-disable @typescript-eslint/no-explicit-any */
import { Rect, Image as FabricImage } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { pasteClipboard } from "@/engine/toolEngine";
import {
  readActivePixels,
  applyPixelsToActiveLayer,
  compositeCanvas,
  blendPixel,
  hexToRgb01,
  notifyNoLayer,
  BLEND_MODES,
} from "@/engine/pixelOps";
import { toggleFreeTransform, exitAllFreeTransforms } from "@/engine/freeTransform";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { commands } from "@/store/commandStore";
import { showOptions } from "@/components/Menu/OptionDialog";

function requireActive(canvas: any): any | null {
  const obj = canvas?.getActiveObject?.();
  if (!obj) window.alert("Select an object first.");
  return obj ?? null;
}

function toRgb255(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb01(hex);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export async function copyMerged(canvas: any): Promise<void> {
  const composite = await compositeCanvas(canvas);
  if (!composite) {
    window.alert("Could not composite the canvas.");
    return;
  }
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      composite.toBlob(resolve, "image/png")
    );
    if (!blob) {
      window.alert("Could not generate the composite image.");
      return;
    }
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      window.alert("Copying images to the clipboard is not supported in this browser.");
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    window.alert("Could not copy the merged image to the clipboard.");
  }
}

export async function pasteInto(canvas: any, ctx: ToolCtx): Promise<void> {
  const anchor = canvas?.getActiveObject?.();
  await pasteClipboard(canvas, ctx);
  const pasted = canvas?.getActiveObject?.();
  if (!pasted || !anchor || pasted === anchor) return;
  const bb = anchor.getBoundingRect?.() ?? {
    left: anchor.left ?? 0,
    top: anchor.top ?? 0,
    width: anchor.width ?? 0,
    height: anchor.height ?? 0,
  };
  const clip = new Rect({
    left: bb.left,
    top: bb.top,
    width: bb.width,
    height: bb.height,
    fill: "white",
    absolutePositioned: true,
    selectable: false,
    evented: false,
  } as any);
  pasted.set({ clipPath: clip });
  pasted.setCoords();
  canvas.requestRenderAll();
}

export async function fillSelection(canvas: any): Promise<void> {
  if (!canvas?.getActiveObject?.()) {
    window.alert("Select a layer to fill first.");
    return;
  }
  const res = await showOptions({
    title: "Fill",
    fields: [
      {
        key: "contents",
        label: "Contents",
        type: "select",
        value: "foreground",
        options: [
          { value: "foreground", label: "Foreground Color" },
          { value: "background", label: "Background Color" },
          { value: "white", label: "White" },
          { value: "gray", label: "50% Gray" },
          { value: "black", label: "Black" },
          { value: "custom", label: "Custom Color" },
        ],
      },
      { key: "color", label: "Custom Color", type: "color", value: "#000000" },
      {
        key: "mode",
        label: "Blend Mode",
        type: "select",
        value: "normal",
        options: BLEND_MODES.map((m) => ({ value: m, label: m })),
      },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, value: 100, suffix: "%" },
    ],
  });
  if (!res) return;
  const contents = String(res.contents ?? "foreground");
  const hex =
    contents === "foreground"
      ? useEditorStore.getState().color
      : contents === "background" || contents === "white"
        ? "#ffffff"
        : contents === "gray"
          ? "#808080"
          : contents === "black"
            ? "#000000"
            : String(res.color ?? "#000000") || "#000000";
  const [r, g, b] = toRgb255(hex);
  const mode = String(res.mode ?? "normal");
  const opacity = Math.max(0, Math.min(1, Number(res.opacity ?? 100) / 100));
  await applyPixelsToActiveLayer(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const out = blendPixel(
        [data[i], data[i + 1], data[i + 2], data[i + 3]],
        [r, g, b, 255],
        mode,
        opacity
      );
      data[i] = out[0];
      data[i + 1] = out[1];
      data[i + 2] = out[2];
      data[i + 3] = out[3];
    }
  });
}

export async function strokeSelection(canvas: any, ctx: ToolCtx): Promise<void> {
  if (!canvas?.getActiveObject?.()) {
    window.alert("Select a layer to stroke first.");
    return;
  }
  const res = await showOptions({
    title: "Stroke",
    fields: [
      { key: "color", label: "Color", type: "color", value: "#000000" },
      { key: "width", label: "Width", type: "number", min: 1, max: 999, step: 1, value: 10, suffix: " px" },
      {
        key: "position",
        label: "Position",
        type: "select",
        value: "inside",
        options: [
          { value: "inside", label: "Inside" },
          { value: "center", label: "Center" },
          { value: "outside", label: "Outside" },
        ],
      },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, value: 100, suffix: "%" },
    ],
  });
  if (!res) return;
  const read = readActivePixels(canvas);
  if (!read) {
    notifyNoLayer();
    return;
  }
  const obj = read.obj;
  const w = read.width;
  const h = read.height;
  const position = String(res.position ?? "inside");
  const wd = Math.max(1, Math.round(Number(res.width ?? 10)));
  const pad = position === "inside" ? 0 : position === "center" ? Math.ceil(wd / 2) : wd;
  const W = w + pad * 2;
  const H = h + pad * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < h; y++) {
    const start = y * w * 4;
    out.set(read.data.subarray(start, start + w * 4), ((y + pad) * W + pad) * 4);
  }
  const [r, g, b] = toRgb255(String(res.color ?? "#000000"));
  const opacity = Math.max(0, Math.min(1, Number(res.opacity ?? 100) / 100));
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + w - 1;
  const y1 = pad + h - 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const outside = x < x0 || x > x1 || y < y0 || y > y1;
      let hit = false;
      if (outside) {
        const d = Math.max(x0 - x, x - x1, y0 - y, y - y1);
        hit = position === "center" ? d <= wd / 2 : d <= wd;
      } else {
        const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
        hit = position === "outside" ? false : position === "center" ? d <= wd / 2 : d <= wd;
      }
      if (!hit) continue;
      const i = (y * W + x) * 4;
      const outPx = blendPixel([out[i], out[i + 1], out[i + 2], out[i + 3]], [r, g, b, 255], "normal", opacity);
      out[i] = outPx[0];
      out[i + 1] = outPx[1];
      out[i + 2] = outPx[2];
      out[i + 3] = outPx[3];
    }
  }
  try {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d")!.putImageData(new ImageData(out, W, H), 0, 0);
    const shiftX = pad * (obj.scaleX ?? 1);
    const shiftY = pad * (obj.scaleY ?? 1);
    if (obj.type === "image") {
      const newEl = document.createElement("img");
      newEl.src = c.toDataURL("image/png");
      await new Promise<void>((resolve) => {
        newEl.onload = () => resolve();
        newEl.onerror = () => resolve();
      });
      obj.setElement(newEl as any);
      obj.set({
        left: obj.left - shiftX,
        top: obj.top - shiftY,
      });
      obj.setCoords();
    } else {
      const replaced = new FabricImage(c, {
        left: obj.left - shiftX,
        top: obj.top - shiftY,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        opacity: obj.opacity,
        visible: obj.visible,
        kaypaintId: obj.kaypaintId ?? obj.id,
      } as any);
      replaced.setCoords();
      canvas.remove(obj);
      canvas.add(replaced);
      canvas.setActiveObject(replaced);
      replaced.setCoords();
    }
    canvas.requestRenderAll();
    ctx.push();
  } catch {
    window.alert("Could not apply the stroke.");
  }
}

export function freeTransformSelection(canvas: any): void {
  const obj = canvas?.getActiveObject?.();
  if (!obj) {
    window.alert("Select an object to transform.");
    return;
  }
  if (!obj.freeTransformOn) {
    const transforming = (canvas.getObjects?.() ?? []).filter((o: any) => o.freeTransformOn);
    if (transforming.length) exitAllFreeTransforms(canvas);
  }
  toggleFreeTransform(canvas, obj);
}

export async function transformScale(canvas: any, ctx: ToolCtx): Promise<void> {
  const obj = requireActive(canvas);
  if (!obj) return;
  const res = await showOptions({
    title: "Scale",
    fields: [
      { key: "width", label: "Width", type: "number", min: 0.1, max: 10000, step: 1, value: Math.round((obj.scaleX ?? 1) * 100), suffix: "%" },
      { key: "height", label: "Height", type: "number", min: 0.1, max: 10000, step: 1, value: Math.round((obj.scaleY ?? 1) * 100), suffix: "%" },
    ],
  });
  if (!res) return;
  obj.scaleX = (obj.scaleX ?? 1) * (Number(res.width) / 100);
  obj.scaleY = (obj.scaleY ?? 1) * (Number(res.height) / 100);
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function transformRotate(canvas: any, ctx: ToolCtx): Promise<void> {
  const obj = requireActive(canvas);
  if (!obj) return;
  const res = await showOptions({
    title: "Rotate",
    fields: [
      { key: "angle", label: "Angle", type: "number", min: -3600, max: 3600, step: 0.1, value: 0, suffix: "°" },
    ],
  });
  if (!res) return;
  obj.rotate(Number(res.angle ?? 0));
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export function transformRotateStep(canvas: any, ctx: ToolCtx, degrees: number): void {
  const obj = requireActive(canvas);
  if (!obj) return;
  obj.rotate((obj.angle ?? 0) + degrees);
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export function transformFlip(canvas: any, ctx: ToolCtx, axis: "x" | "y"): void {
  const obj = requireActive(canvas);
  if (!obj) return;
  obj.set(axis === "x" ? { flipX: !obj.flipX } : { flipY: !obj.flipY });
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function transformSkew(canvas: any, ctx: ToolCtx): Promise<void> {
  const obj = requireActive(canvas);
  if (!obj) return;
  const res = await showOptions({
    title: "Skew",
    fields: [
      { key: "skewX", label: "Skew X", type: "number", min: -89, max: 89, step: 1, value: obj.skewX ?? 0, suffix: "°" },
      { key: "skewY", label: "Skew Y", type: "number", min: -89, max: 89, step: 1, value: obj.skewY ?? 0, suffix: "°" },
    ],
  });
  if (!res) return;
  obj.set({ skewX: Number(res.skewX), skewY: Number(res.skewY) });
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function transformDistort(canvas: any, ctx: ToolCtx): Promise<void> {
  const obj = requireActive(canvas);
  if (!obj) return;
  const res = await showOptions({
    title: "Distort",
    fields: [
      { key: "tl", label: "Top-left offset", type: "number", min: -1000, max: 1000, step: 1, value: 0, suffix: " px" },
      { key: "tr", label: "Top-right offset", type: "number", min: -1000, max: 1000, step: 1, value: 0, suffix: " px" },
      { key: "bl", label: "Bottom-left offset", type: "number", min: -1000, max: 1000, step: 1, value: 0, suffix: " px" },
      { key: "br", label: "Bottom-right offset", type: "number", min: -1000, max: 1000, step: 1, value: 0, suffix: " px" },
    ],
  });
  if (!res) return;
  const tl = Number(res.tl ?? 0);
  const tr = Number(res.tr ?? 0);
  const bl = Number(res.bl ?? 0);
  const br = Number(res.br ?? 0);
  const skewX = (tl + tr - bl - br) / 2;
  const skewY = (bl + br - tl - tr) / 2;
  obj.set({
    skewX: (obj.skewX ?? 0) + skewX,
    skewY: (obj.skewY ?? 0) + skewY,
    scaleX: (obj.scaleX ?? 1) * (1 + Math.abs(skewX) / 360),
  });
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function transformPerspective(canvas: any, ctx: ToolCtx): Promise<void> {
  const obj = requireActive(canvas);
  if (!obj) return;
  const res = await showOptions({
    title: "Perspective",
    fields: [
      { key: "skew", label: "Horizontal Skew", type: "number", min: -89, max: 89, step: 1, value: obj.skewX ?? 0, suffix: "°" },
    ],
  });
  if (!res) return;
  const skew = Number(res.skew ?? 0);
  obj.set({
    skewX: skew,
    scaleX: (obj.scaleX ?? 1) * (1 + Math.abs(skew) / 360),
  });
  obj.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function defineBrushPreset(): Promise<void> {
  const res = await showOptions({
    title: "Define Brush Preset",
    fields: [{ key: "name", label: "Preset Name", type: "text", value: "Preset 1" }],
  });
  if (!res) return;
  const name = String(res.name ?? "").trim();
  if (!name) return;
  const { color, size } = useEditorStore.getState();
  useSettingsStore.getState().addBrushPreset({ name, color, size });
}

export async function manageBrushPresets(): Promise<void> {
  const presets = useSettingsStore.getState().brushPresets;
  if (!presets.length) {
    window.alert("No brush presets defined yet.");
    return;
  }
  const res = await showOptions({
    title: "Brush Presets",
    fields: [
      {
        key: "preset",
        label: "Preset to remove",
        type: "select",
        value: presets[0].name,
        options: presets.map((p) => ({ value: p.name, label: p.name })),
      },
    ],
  });
  if (!res?.preset) return;
  const name = String(res.preset);
  if (window.confirm(`Remove brush preset "${name}"?`)) {
    useSettingsStore.getState().removeBrushPreset(name);
  }
}

export function openColorSettings(): void {
  document.dispatchEvent(new Event("kaypaint:open-color-settings"));
}

export async function showKeyboardShortcuts(): Promise<void> {
  const lines: string[] = [];
  let lastGroup = "";
  for (const cmd of commands) {
    if (cmd.group !== lastGroup) {
      lastGroup = cmd.group;
      lines.push("", cmd.group.toUpperCase());
    }
    lines.push(`${cmd.hint ? `${cmd.hint}   ` : "       "}${cmd.label}`);
  }
  await showOptions({
    title: "Keyboard Shortcuts",
    text: lines.join("\n").trim(),
    fields: [],
  });
}

export async function showMenusHelp(): Promise<void> {
  await showOptions({
    title: "Menus",
    text: "Menu customization is not available in KayPaint yet.\n\nPhotoshop lets you show, hide and recolor menu items via Edit > Menus…. This build uses the classic Photoshop-style menu layout with every item enabled.",
    fields: [],
  });
}

const RULER_UNITS = ["px", "in", "cm", "mm", "pt", "pc"].map((u) => ({
  value: u,
  label: u,
}));

export async function prefsUnitsAndRulers(): Promise<void> {
  const st = useSettingsStore.getState();
  const res = await showOptions({
    title: "Preferences — Units & Rulers",
    fields: [
      { key: "unit", label: "Ruler Units", type: "select", value: st.rulerUnit, options: RULER_UNITS },
      { key: "dpi", label: "Resolution", type: "number", min: 1, max: 1200, step: 1, value: st.dpi, suffix: " ppi" },
    ],
  });
  if (!res) return;
  st.set({ rulerUnit: String(res.unit), dpi: Number(res.dpi) });
}

export async function prefsGuidesAndGrid(): Promise<void> {
  const st = useSettingsStore.getState();
  let tolerance = 8;
  try {
    tolerance = Number(localStorage.getItem("kaypaint:snap-tolerance") ?? 8) || 8;
  } catch {
    tolerance = 8;
  }
  const res = await showOptions({
    title: "Preferences — Guides & Grid",
    fields: [
      { key: "gridSize", label: "Grid Size", type: "number", min: 1, max: 500, step: 1, value: st.gridSize, suffix: " px" },
      { key: "gridColor", label: "Grid Color", type: "color", value: st.gridColor },
      { key: "guideColor", label: "Guide Color", type: "color", value: st.guideColor },
      { key: "tolerance", label: "Snap Tolerance", type: "number", min: 0, max: 100, step: 1, value: tolerance, suffix: " px" },
    ],
  });
  if (!res) return;
  st.set({
    gridSize: Number(res.gridSize),
    gridColor: String(res.gridColor),
    guideColor: String(res.guideColor),
  });
  localStorage.setItem("kaypaint:snap-tolerance", String(res.tolerance));
}

export async function prefsInterface(): Promise<void> {
  const st = useSettingsStore.getState();
  let tooltips = true;
  try {
    tooltips = localStorage.getItem("kaypaint:show-tooltips") !== "0";
  } catch {
    tooltips = true;
  }
  const res = await showOptions({
    title: "Preferences — Interface",
    fields: [
      { key: "unit", label: "Ruler Unit", type: "select", value: st.rulerUnit, options: RULER_UNITS },
      { key: "tooltips", label: "Show Tooltips", type: "checkbox", value: tooltips },
    ],
  });
  if (!res) return;
  st.set({ rulerUnit: String(res.unit) });
  localStorage.setItem("kaypaint:show-tooltips", res.tooltips ? "1" : "0");
}