import { PencilBrush } from "fabric";
import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  const brush = new PencilBrush(canvas);

  brush.color = ctx.get("color") ?? "#ffffff";
  brush.width = ctx.get("size") ?? 12;
  (brush as any).globalCompositeOperation = "screen";
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