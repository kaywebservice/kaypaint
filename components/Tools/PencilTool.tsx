import { PencilBrush } from "fabric";
import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  const brush = new PencilBrush(canvas);

  brush.color = ctx.get("color") ?? "#000000";
  brush.width = Math.max(1, ctx.get("size") ?? 4);
  brush.decimate = 1;

  canvas.freeDrawingBrush = brush;
  canvas.isDrawingMode = true;
  canvas.selection = false;
  canvas.requestRenderAll();

  return () => {
    canvas.isDrawingMode = false;
    canvas.requestRenderAll();
  };
}