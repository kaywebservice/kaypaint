import { Line } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let line: any = null;

  const color = () => ctx.get("color") ?? "#000000";
  const strokeWidth = () => Math.max(1, ctx.get("size") ?? 4);

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    line = new Line([start.x, start.y, start.x, start.y], {
      stroke: color(),
      strokeWidth: strokeWidth(),
      fill: "",
    });
    canvas.add(line);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !line) return;
    const p = getPointer(canvas, e.e);
    line.set({
      x1: start.x,
      y1: start.y,
      x2: p.x,
      y2: p.y,
    });
    line.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (!start || !line) return;
    if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < 3) {
      canvas.remove(line);
    }
    line = null;
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
    if (line) canvas.remove(line);
    line = null;
    start = null;
    canvas.requestRenderAll();
  };
}