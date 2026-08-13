import type { ToolCtx } from "@/types/editor";
import { applyBlur } from "@/engine/filterEngine";

function blurValue(ctx: ToolCtx) {
  const amount = Number(ctx.get("filterAmount") ?? 50);
  return Math.max(0, Math.round((amount - 20) / 20));
}

export function activateTool(ctx: ToolCtx, options?: any) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const target =
    options?.object ??
    canvas.getActiveObject();

  if (!target) return undefined;

  applyBlur(target, options?.value ?? blurValue(ctx));
  ctx.push();

  return () => {
    canvas.requestRenderAll();
  };
}

export function reapplyBlur(ctx: ToolCtx) {
  const target = ctx.canvas.getActiveObject();
  if (!target) return;
  applyBlur(target, blurValue(ctx));
  ctx.push();
}