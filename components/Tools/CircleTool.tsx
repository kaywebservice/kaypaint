import { Circle } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let circle: any = null;

  const color = () => ctx.get("color") ?? "#000000";

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    circle = new Circle({
      left: start.x,
      top: start.y,
      radius: 0,
      fill: color(),
      originX: "center",
      originY: "center",
    });
    canvas.add(circle);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !circle) return;
    const p = getPointer(canvas, e.e);
    const radius = Math.max(
      0,
      Math.hypot(p.x - start.x, p.y - start.y)
    );
    circle.set({ radius });
    circle.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (!start || !circle) return;
    if (circle.radius < 2) {
      canvas.remove(circle);
    }
    circle = null;
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
    if (circle) canvas.remove(circle);
    circle = null;
    start = null;
    canvas.requestRenderAll();
  };
}