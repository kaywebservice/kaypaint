import { PencilBrush } from "fabric";
import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  const brush = new PencilBrush(canvas);

  brush.color = ctx.get("color") ?? "#000000";
  brush.width = ctx.get("size") ?? 12;
  brush.decimate = 2;

  canvas.freeDrawingBrush = brush;
  canvas.isDrawingMode = true;
  canvas.selection = false;
  canvas.requestRenderAll();

  return () => {
    canvas.isDrawingMode = false;
    canvas.requestRenderAll();
  };
}

export function syncBrush(ctx: ToolCtx) {
  const brush = ctx.canvas.freeDrawingBrush;
  if (!brush) return;

  brush.color = ctx.get("color") ?? "#000000";
  brush.width = ctx.get("size") ?? 12;
  ctx.canvas.requestRenderAll();
}