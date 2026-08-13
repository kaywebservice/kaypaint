import { Rect } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.selection = false;
  canvas.isDrawingMode = false;

  let start: any = null;
  let overlay: Rect | null = null;

  const makeOverlay = () => {
    if (overlay) canvas.remove(overlay);
    overlay = new Rect({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      fill: "rgba(80,150,255,0.15)",
      stroke: "rgba(80,150,255,0.9)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      isMarqueeOverlay: true,
    });
    canvas.add(overlay);
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    makeOverlay();
  };

  const move = (e: any) => {
    if (!start || !overlay) return;
    const p = getPointer(canvas, e.e);
    overlay.set({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
    overlay.setCoords();
    canvas.requestRenderAll();
  };

  const up = (e: any) => {
    if (!start) return;
    const p = getPointer(canvas, e.e);

    const left = Math.min(start.x, p.x);
    const top = Math.min(start.y, p.y);
    const width = Math.abs(p.x - start.x);
    const height = Math.abs(p.y - start.y);

    if (overlay) {
      canvas.remove(overlay);
      overlay = null;
    }

    if (width > 2 && height > 2) {
      const targets = (canvas.getObjects() as any[]).filter(
        (obj) => {
          if (obj === overlay) return false;
          const rect = obj.getBoundingRect();
          const intersects =
            rect.left + rect.width > left &&
            rect.left < left + width &&
            rect.top + rect.height > top &&
            rect.top < top + height;
          return intersects;
        }
      );

      if (targets.length > 0) {
        canvas.setActiveObject(
          targets.length === 1 ? targets[0] : targets
        );
      }
    }

    start = null;
    canvas.requestRenderAll();
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    if (overlay) {
      canvas.remove(overlay);
      overlay = null;
    }
    canvas.requestRenderAll();
  };
}