/* eslint-disable @typescript-eslint/no-explicit-any */

import { Image as FabricImage, Path, Rect } from "fabric";
import { canvasNow, histNow } from "@/utils/menuUtils";
import { useSettingsStore } from "@/store/settingsStore";
import tools from "@/store/toolRegistry";
import { showOptions } from "@/components/Menu/OptionDialog";
import { compositeCanvas } from "@/engine/pixelOps";
import { nextObjectId } from "@/utils/imageUtils";

const TEXT_TYPES = new Set(["i-text", "text", "textbox", "i-textbox", "STextOnPath"]);

function isTextObject(obj: any): boolean {
  return !!obj && typeof obj === "object" && (TEXT_TYPES.has(obj.type as string) || typeof obj.text === "string");
}

function activeTextObject(): any | null {
  const canvas = canvasNow();
  if (!canvas) return null;
  const obj = canvas.getActiveObject?.();
  if (!isTextObject(obj)) return null;
  return obj;
}

function pushHistory() {
  histNow()?.push?.();
}

/**
 * Render the active text object to a full-resolution raster `FabricImage`,
 * preserving position/size/transform, and replace the text layer with it.
 * The resulting image is tagged `outlined: true`.
 */
export async function createOutlines(): Promise<boolean> {
  const canvas = canvasNow();
  const obj = activeTextObject();
  if (!canvas || !obj) {
    window.alert("Select a text layer to create outlines.");
    return false;
  }

  let el: HTMLCanvasElement | HTMLImageElement | null = null;
  try {
    el = obj.toCanvasElement ? obj.toCanvasElement() : null;
  } catch {
    el = null;
  }
  if (!el) {
    window.alert("Could not rasterize the text layer.");
    return false;
  }

  const img = new FabricImage(el as any, {
    left: obj.left,
    top: obj.top,
    angle: obj.angle,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    originX: obj.originX,
    originY: obj.originY,
    flipX: obj.flipX,
    flipY: obj.flipY,
    opacity: obj.opacity,
    visible: obj.visible,
    kaypaintId: obj.kaypaintId ?? obj.id ?? nextObjectId(),
    outlined: true,
  });

  canvas.remove(obj);
  canvas.add(img);
  canvas.setActiveObject(img);
  img.setCoords?.();
  canvas.requestRenderAll?.();
  pushHistory();
  return true;
}

/**
 * Derive a rectangular work path (`fabric.Path`) around the active object's
 * bounding rect and set it as the active object (marching-ants style).
 * There is no central paths store in this build (PathsPanel holds local UI
 * state), so the path is materialized as a `fabric.Path` on the canvas, which
 * PathsPanel already reads via `createPathFromSelection`.
 */
export function createWorkPath(): boolean {
  const canvas = canvasNow();
  const obj = canvas?.getActiveObject?.();
  if (!canvas || !obj) {
    window.alert("Select a layer to create a work path.");
    return false;
  }

  const br = obj.getBoundingRect();
  const { left, top, width, height } = br;
  const d = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;

  const zoom = Math.max(canvas.getZoom?.() || 1, 0.01);
  const path = new Path(d, {
    left,
    top,
    originX: "left",
    originY: "top",
    fill: "rgba(17,134,239,0.08)",
    stroke: "#0066ff",
    strokeWidth: Math.max(1, Math.round(1 / zoom)),
    strokeUniform: true,
    strokeDashArray: [6, 4],
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    kaypaintId: nextObjectId(),
    workPath: true,
  });

  canvas.add(path);
  canvas.setActiveObject(path);
  path.setCoords?.();
  canvas.requestRenderAll?.();
  pushHistory();
  return true;
}

/**
 * Toggle an OpenType font feature on the active text object. Records the
 * feature flags in an `opentype` object on the text and attempts to apply a
 * `fontFeatureSettings` declaration on the fabric text (canvas 2D does not
 * natively render CSS font features, so this records intent and redraws).
 */
export function toggleOpenTypeFeature(feature: string): boolean {
  const canvas = canvasNow();
  const obj = canvas?.getActiveObject?.();
  if (!canvas || !isTextObject(obj)) {
    window.alert("Select a text layer to toggle an OpenType feature.");
    return false;
  }

  const current: Record<string, boolean> = (obj.opentype as Record<string, boolean>) ?? {};
  const next: Record<string, boolean> = { ...current, [feature]: !current[feature] };
  obj.set({ opentype: next });

  const active = Object.entries(next)
    .filter(([, v]) => v)
    .map(([k]) => `'${k}' on`);
  const settings = active.length ? active.join(", ") : "normal";
  obj.set({ fontFeatureSettings: settings });

  obj.setCoords?.();
  canvas.requestRenderAll?.();
  pushHistory();
  return true;
}

/**
 * Switch the active text object between horizontal and vertical orientation.
 * Mirrors the VerticalTextTool (`direction` + `writingMode`) and rotates the
 * text 90° when vertical so it reads top-to-bottom.
 */
export function setTextOrientation(dir: "horizontal" | "vertical"): boolean {
  const canvas = canvasNow();
  const obj = activeTextObject();
  if (!canvas || !obj) {
    window.alert("Select a text layer to change its orientation.");
    return false;
  }

  const vertical = dir === "vertical";
  obj.set({
    angle: vertical ? 90 : 0,
    direction: vertical ? "rtl" : "ltr",
    writingMode: vertical ? "vertical-rl" : "",
    textOrientation: vertical ? "vertical" : "horizontal",
  });
  obj.setCoords?.();
  canvas.requestRenderAll?.();
  pushHistory();
  return true;
}

/**
 * Prompt the user for an edge threshold, then build a marching-ants selection
 * rectangle around the document's central high-contrast region (computed via a
 * Sobel edge magnitude over the flattened canvas) and set it as the active
 * object.
 */
export async function focusArea(threshold: number): Promise<boolean> {
  const canvas = canvasNow();
  if (!canvas) return false;

  const composite = await compositeCanvas(canvas);
  if (!composite) {
    window.alert("No document pixels to analyze.");
    return false;
  }
  const g = composite.getContext("2d");
  if (!g) return false;
  const { width: w, height: h } = composite;
  const { data } = g.getImageData(0, 0, w, h);
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    luma[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0,
    count = 0;
  const t = Math.max(0, threshold);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -luma[i - w - 1] +
        luma[i - w + 1] -
        2 * luma[i - 1] +
        2 * luma[i + 1] -
        luma[i + w - 1] +
        luma[i + w + 1];
      const gy =
        -luma[i - w - 1] -
        2 * luma[i - w] -
        luma[i - w + 1] +
        luma[i + w - 1] +
        2 * luma[i + w] +
        luma[i + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > t) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count === 0) {
    window.alert("Focus area not found — try a lower edge sensitivity.");
    return false;
  }

  const left = minX;
  const top = minY;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const zoom = Math.max(canvas.getZoom?.() || 1, 0.01);

  const rect = new Rect({
    left,
    top,
    width,
    height,
    originX: "left",
    originY: "top",
    fill: "rgba(17,134,239,0.08)",
    stroke: "#0066ff",
    strokeWidth: Math.max(1, Math.round(1 / zoom)),
    strokeUniform: true,
    strokeDashArray: [6, 4],
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    kaypaintId: nextObjectId(),
    selectionType: "focusArea",
  });

  canvas.add(rect);
  canvas.setActiveObject(rect);
  rect.setCoords?.();
  canvas.requestRenderAll?.();
  pushHistory();
  return true;
}

/**
 * Open the Toolbar editor (Photoshop: Edit ▸ Toolbar…). Lists every
 * registered tool with a checkbox tied to `settingsStore.hiddenTools`;
 * unchecked tools are hidden from the left toolbar.
 */
export async function openToolbarEditor(): Promise<void> {
  const hiddenSet = new Set(useSettingsStore.getState().hiddenTools);
  const res = await showOptions({
    title: "Edit Toolbar…",
    text: "Check tools to show them in the toolbar.\nUncheck a tool to hide it.",
    fields: tools.map((t) => ({
      key: t.id,
      label: `${t.name} (${t.shortcut})`,
      type: "checkbox" as const,
      value: !hiddenSet.has(t.id),
    })),
    okLabel: "Done",
  });
  if (!res) return;
  const nextHidden = tools.filter((t) => res[t.id] !== true).map((t) => t.id);
  useSettingsStore.getState().setHiddenTools(nextHidden);
}
