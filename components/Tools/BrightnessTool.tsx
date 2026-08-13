import type { ToolCtx } from "@/types/editor";
import { applyBrightness } from "@/engine/filterEngine";

function brightnessValue(ctx: ToolCtx) {
  const amount = Number(ctx.get("filterAmount") ?? 50);
  return (amount - 50) / 50;
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const target = canvas.getActiveObject();

  if (target) {
    applyBrightness(target, brightnessValue(ctx));
    ctx.push();
  }

  return () => {
    canvas.requestRenderAll();
  };
}

export function reapplyBrightness(ctx: ToolCtx) {
  const target = ctx.canvas.getActiveObject();
  if (!target) return;
  applyBrightness(target, brightnessValue(ctx));
  ctx.push();
}