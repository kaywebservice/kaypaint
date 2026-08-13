import { Gradient } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer, findObjectUnderPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;

  const color = () => ctx.get("color") ?? "#000000";
  const kind = () => ctx.get("gradientType") ?? "linear";

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
  };

  const up = (e: any) => {
    if (!start) return;
    const end = getPointer(canvas, e.e);

    const target =
      canvas.getActiveObject() ??
      findObjectUnderPointer(canvas, e as any);

    if (target && typeof target.fill !== "function") {
      const bounds = target.getBoundingRect();
      const gx1 = clamp01((start.x - bounds.left) / (bounds.width || 1));
      const gy1 = clamp01((start.y - bounds.top) / (bounds.height || 1));
      const gx2 = clamp01((end.x - bounds.left) / (bounds.width || 1));
      const gy2 = clamp01((end.y - bounds.top) / (bounds.height || 1));

      const stops = [
        { offset: 0, color: color() },
        { offset: 1, color: `${color()}00` },
      ];

      let fill: any;

      if (kind() === "radial") {
        fill = new Gradient({
          type: "radial",
          coords: {
            x1: gx1,
            y1: gy1,
            x2: gx2,
            y2: gy2,
            r1: 0,
            r2: 1,
          },
          colorStops: stops,
        });
      } else {
        fill = new Gradient({
          type: "linear",
          coords: { x1: gx1, y1: gy1, x2: gx2, y2: gy2 },
          colorStops: stops,
        });
      }

      target.set({ fill });
      target.setCoords();
      canvas.requestRenderAll();
      ctx.push();
    }

    start = null;
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:up", up);
    start = null;
    canvas.requestRenderAll();
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}