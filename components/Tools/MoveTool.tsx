import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.selection = false;
  canvas.skipTargetFind = false;
  canvas.isDrawingMode = false;
  canvas.requestRenderAll();
}

export function deactivateTool(ctx: ToolCtx) {
  ctx.canvas.selection = true;
}