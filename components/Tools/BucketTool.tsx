import { Rect } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { findObjectUnderPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const color = () => ctx.get("color") ?? "#000000";

  const down = (e: any) => {
    const target = findObjectUnderPointer(canvas, e.e);

    if (
      target &&
      typeof target.fill === "string"
    ) {
      if (target.fill !== color()) {
        target.set({ fill: color() });
        target.setCoords();
        canvas.requestRenderAll();
        ctx.push();
      }
      return;
    }

    if (target) return;

    const bg = new Rect({
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
      fill: color(),
      selectable: false,
      evented: false,
      isPaintFill: true,
    });

    canvas.sendObjectToBack(bg);
    canvas.requestRenderAll();
    ctx.push();
  };

  canvas.on("mouse:down", down);

  return () => {
    canvas.off("mouse:down", down);
    canvas.requestRenderAll();
  };
}