import { Triangle } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let triangle: any = null;

  const color = () => ctx.get("color") ?? "#000000";

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    triangle = new Triangle({
      left: start.x,
      top: start.y,
      width: 100,
      height: 100,
      fill: color(),
      originX: "center",
      originY: "center",
    });
    canvas.add(triangle);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !triangle) return;
    const p = getPointer(canvas, e.e);
    triangle.set({
      width: Math.abs(p.x - start.x) * 2,
      height: Math.abs(p.y - start.y) * 2,
    });
    triangle.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (!start || !triangle) return;
    if (triangle.width < 4 || triangle.height < 4) {
      canvas.remove(triangle);
    }
    triangle = null;
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
    if (triangle) canvas.remove(triangle);
    triangle = null;
    start = null;
    canvas.requestRenderAll();
  };
}