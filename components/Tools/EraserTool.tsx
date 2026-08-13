import { PencilBrush } from "fabric";
import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  const brush = new PencilBrush(canvas);

  brush.color = "#ffffff";
  brush.width = ctx.get("size") ?? 12;
  (brush as any).globalCompositeOperation = "destination-out";
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

export function syncEraser(ctx: ToolCtx) {
  const brush = ctx.canvas.freeDrawingBrush;
  if (!brush) return;

  brush.width = ctx.get("size") ?? 12;
  ctx.canvas.requestRenderAll();
}