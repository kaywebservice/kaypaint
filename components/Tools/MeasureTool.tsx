import { Line, Text } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let line: any = null;
  let label: any = null;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);

    line = new Line([start.x, start.y, start.x, start.y], {
      stroke: "#ff6b6b",
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: false,
      evented: false,
      isMeasureLine: true,
    });

    label = new Text("0 px", {
      left: start.x,
      top: start.y - 20,
      fill: "#ff6b6b",
      fontSize: 12,
      fontFamily: "monospace",
      selectable: false,
      evented: false,
      isMeasureLabel: true,
    });

    canvas.add(line);
    canvas.add(label);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !line || !label) return;
    const p = getPointer(canvas, e.e);

    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const dist = Math.hypot(dx, dy);

    line.set({ x1: start.x, y1: start.y, x2: p.x, y2: p.y });
    label.set({ left: (start.x + p.x) / 2, top: (start.y + p.y) / 2 - 20, text: `${Math.round(dist)} px` });

    line.setCoords();
    label.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (line && label) {
      line.set({ selectable: true, evented: true, isMeasureLine: false });
      label.set({ selectable: true, evented: true, isMeasureLabel: false });
      canvas.setActiveObject(line);
      ctx.push();
    }
    start = null;
    line = null;
    label = null;
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    if (line) canvas.remove(line);
    if (label) canvas.remove(label);
    start = null;
    canvas.requestRenderAll();
  };
}