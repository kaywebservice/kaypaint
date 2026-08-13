import { PencilBrush } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { applyFilter } from "@/engine/filterEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  const brush = new PencilBrush(canvas);

  brush.color = ctx.get("color") ?? "#ffffff";
  brush.width = ctx.get("size") ?? 12;
  (brush as any).globalCompositeOperation = "normal";
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