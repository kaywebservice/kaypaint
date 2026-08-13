import type { ToolCtx } from "@/types/editor";
import { setZoomAtPoint } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const down = (e: any) => {
    if (e.e.shiftKey || e.e.altKey || e.e.button === 2) {
      setZoomAtPoint(canvas, e.e, 1 / 1.25);
    } else {
      setZoomAtPoint(canvas, e.e, 1.25);
    }
  };

  const dbl = (e: any) => {
    canvas.setZoom(1);
    canvas.requestRenderAll();
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:dblclick", dbl);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:dblclick", dbl);
    canvas.requestRenderAll();
  };
}