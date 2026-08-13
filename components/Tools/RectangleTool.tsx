import { Rect } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let rect: any = null;

  const style = () => ({
    fill: ctx.get("color") ?? "#000000",
    stroke: ctx.get("color") ?? "#000000",
    strokeWidth: 0,
  });

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
rect = new Rect({
      left: start.x,
      top: start.y,
      width: 0,
      height: 0,
      ...style(),
    });
    canvas.add(rect);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !rect) return;
    const p = getPointer(canvas, e.e);
    rect.set({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
    rect.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (!start || !rect) return;
    if (rect.width < 2 || rect.height < 2) {
      canvas.remove(rect);
    }
    rect = null;
    start = null;
    ctx.push();
    canvas.requestRenderAll();
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    if (rect) canvas.remove(rect);
    rect = null;
    start = null;
    canvas.setActiveObject(canvas.getActiveObject());
    canvas.requestRenderAll();
  };
}