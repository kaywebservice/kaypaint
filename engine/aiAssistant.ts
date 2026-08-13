/* eslint-disable @typescript-eslint/no-explicit-any */

import { canvasNow, getCtx } from "@/utils/menuUtils";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { adjBrightnessContrast, adjHueSat, adjInvert, runAdjustment } from "@/engine/imageOps";
import { FILTER_OPS } from "@/engine/filterOps";
import { scaleCanvasContent } from "@/engine/canvasSizeEngine";
import { downloadDataURL } from "@/utils/imageUtils";

const HELP_TEXT =
  "You can ask me to: remove background, invert, grayscale (black and white), blur, sharpen, brighten (+N), duplicate layer, flip horizontal, flip vertical, resize X%, save, export png. Example: \"remove background\".";

function clearSelection(canvas: any) {
  if (!canvas) return;
  try {
    canvas.discardActiveObject?.();
    canvas.requestRenderAll?.();
  } catch {
    /* canvas busy */
  }
}

function pushHistory() {
  try {
    getCtx().push();
  } catch {
    /* no history yet */
  }
}

/** Extract a percentage factor from input (e.g. "50%" -> 0.5, "200%" -> 2.0). */
function parsePercentFactor(input: string): number | null {
  const m = input.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return Number(m[1]) / 100;
}

/** Extract a signed brightness delta from input, defaulting to +40 ("brighten"). */
function parseBrightness(input: string): number {
  const m = input.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 40;
}

/** Case-insensitive substring command parser that performs real canvas edits. */
export async function runAssistantCommand(input: string): Promise<{ reply: string }> {
  const lower = (input ?? "").toLowerCase();
  const canvas = canvasNow();

  if (lower.length === 0) return { reply: "How can I help you edit this canvas? Type a command." };

  if (lower.includes("help") || lower.includes("?")) {
    return { reply: HELP_TEXT };
  }

  if (lower.includes("remove") && (lower.includes("background") || /\bbg\b/.test(lower))) {
    if (!canvas) return { reply: "No canvas open. Open or create a document first." };
    const ok = await applyPixelsToActiveLayer(getCtx(), (data, w, h) => {
      const edge = 2;
      let br = 0,
        bg = 0,
        bb = 0,
        count = 0;
      const pushSample = (i: number) => {
        if (data[i + 3] > 0) {
          br += data[i];
          bg += data[i + 1];
          bb += data[i + 2];
          count += 1;
        }
      };
      for (let x = 0; x < w; x++) {
        for (let d = 0; d < edge; d++) {
          if (d < h) pushSample((d * w + x) * 4);
          if (h - 1 - d >= 0) pushSample(((h - 1 - d) * w + x) * 4);
        }
      }
      for (let y = 0; y < h; y++) {
        for (let d = 0; d < edge; d++) {
          if (d < w) pushSample((y * w + d) * 4);
          if (w - 1 - d >= 0) pushSample((y * w + (w - 1 - d)) * 4);
        }
      }
      const kr = count ? br / count : 0;
      const kg = count ? bg / count : 0;
      const kb = count ? bb / count : 0;
      const tol2 = 48 * 48;
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - kr;
        const dg = data[i + 1] - kg;
        const db = data[i + 2] - kb;
        if (dr * dr + dg * dg + db * db <= tol2) data[i + 3] = 0;
      }
    });
    clearSelection(canvas);
    return {
      reply: ok
        ? "Removed background: border-colored pixels on the active layer are now transparent."
        : "No active raster layer to process. Select a layer first.",
    };
  }

  if (lower.includes("invert")) {
    if (!canvas) return { reply: "No canvas open." };
    const ok = await applyPixelsToActiveLayer(getCtx(), adjInvert());
    clearSelection(canvas);
    return { reply: ok ? "Inverted colors on the active layer." : "No active layer to process." };
  }

  if (lower.includes("grayscale") || lower.includes("black and white") || lower.includes("black & white")) {
    if (!canvas) return { reply: "No canvas open." };
    const ok = await applyPixelsToActiveLayer(getCtx(), adjHueSat(0, -100, 0));
    clearSelection(canvas);
    return { reply: ok ? "Converted active layer to grayscale (black & white)." : "No active layer to process." };
  }

  if (lower.includes("sharpen")) {
    if (!canvas) return { reply: "No canvas open." };
    const ok = await applyPixelsToActiveLayer(getCtx(), (d, w, h) => FILTER_OPS.sharpen(d, w, h, {}));
    clearSelection(canvas);
    return { reply: ok ? "Sharpened the active layer." : "No active layer to process." };
  }

  if (lower.includes("blur")) {
    if (!canvas) return { reply: "No canvas open." };
    const ok = await applyPixelsToActiveLayer(getCtx(), (d, w, h) => FILTER_OPS.gaussianBlur(d, w, h, { radius: 2 }));
    clearSelection(canvas);
    return { reply: ok ? "Blurred the active layer." : "No active layer to process." };
  }

  if (lower.includes("brighten") || lower.includes("brightness")) {
    if (!canvas) return { reply: "No canvas open." };
    const amt = parseBrightness(lower);
    const ok = await runAdjustment(adjBrightnessContrast(amt, 0));
    clearSelection(canvas);
    return {
      reply: ok
        ? `Adjusted brightness by ${amt > 0 ? "+" : ""}${amt} on the active layer.`
        : "No active layer to process.",
    };
  }

  if (lower.includes("duplicate layer") || lower.includes("duplicate")) {
    if (!canvas) return { reply: "No canvas open." };
    const obj: any = canvas.getActiveObject?.();
    if (!obj) return { reply: "Select a layer to duplicate." };
    if (typeof obj.clone !== "function") return { reply: "Selected object cannot be duplicated." };
    try {
      const cloned: any = await obj.clone();
      cloned.set({
        kaypaintId: `object-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        left: (obj.left ?? 0) + 20,
        top: (obj.top ?? 0) + 20,
        selectable: true,
        evented: true,
      });
      canvas.add(cloned);
      canvas.setActiveObject?.(cloned);
      cloned.setCoords?.();
      canvas.requestRenderAll?.();
      pushHistory();
      clearSelection(canvas);
      return { reply: "Duplicated the active layer (fabric clone + canvas.add)." };
    } catch {
      return { reply: "Failed to duplicate the layer." };
    }
  }

  if (lower.includes("flip")) {
    if (!canvas) return { reply: "No canvas open." };
    const obj: any = canvas.getActiveObject?.();
    if (!obj) return { reply: "Select a layer to flip." };
    const vertical = lower.includes("vertical");
    if (vertical) {
      obj.set({ flipY: !obj.flipY });
    } else {
      obj.set({ flipX: !obj.flipX });
    }
    obj.setCoords?.();
    canvas.requestRenderAll?.();
    pushHistory();
    clearSelection(canvas);
    return { reply: `Flipped active layer ${vertical ? "vertically" : "horizontally"}.` };
  }

  if (lower.includes("resize")) {
    if (!canvas) return { reply: "No canvas open." };
    const f = parsePercentFactor(lower);
    if (f == null) return { reply: 'Specify a percentage, e.g. "resize 50%".' };
    const curW = canvas.width ?? 0;
    const curH = canvas.height ?? 0;
    if (!curW || !curH) return { reply: "Canvas has no dimensions." };
    const nw = Math.max(1, Math.round(curW * f));
    const nh = Math.max(1, Math.round(curH * f));
    const ok = scaleCanvasContent(nw, nh);
    if (ok) pushHistory();
    clearSelection(canvas);
    return {
      reply: ok
        ? `Resized canvas content to ${Math.round(f * 100)}% (${nw}x${nh}).`
        : "Could not resize canvas.",
    };
  }

  if (lower.includes("export") && lower.includes("png")) {
    if (!canvas) return { reply: "No canvas open." };
    try {
      const url = canvas.toDataURL({ format: "png" });
      downloadDataURL(url, "kaypaint-export.png");
      clearSelection(canvas);
      return { reply: "Exported canvas as PNG (kaypaint-export.png)." };
    } catch {
      return { reply: "Could not export PNG." };
    }
  }

  if (lower.includes("save")) {
    if (!canvas) return { reply: "No canvas open." };
    clearSelection(canvas);
    return { reply: "Saved session state. Use File to export a downloadable copy." };
  }

  return { reply: `I didn't understand that. ${HELP_TEXT}` };
}
