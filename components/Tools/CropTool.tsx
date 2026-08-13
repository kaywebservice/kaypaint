import { Rect } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { syncCanvasSizeStore } from "@/engine/canvasSizeEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let dim: any = null;
  let hole: any = null;

  const clearOverlay = () => {
    if (dim) {
      canvas.remove(dim);
      dim = null;
    }
    if (hole) {
      canvas.remove(hole);
      hole = null;
    }
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);

    dim = new Rect({
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
      fill: "rgba(0,0,0,0.45)",
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    hole = new Rect({
      left: start.x,
      top: start.y,
      width: 0,
      height: 0,
      fill: "white",
      globalCompositeOperation: "destination-out",
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    canvas.add(dim);
    canvas.add(hole);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !hole) return;
    const p = getPointer(canvas, e.e);
    hole.set({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
    hole.setCoords();
    canvas.requestRenderAll();
  };

  const up = () => {
    if (!start) return;

    const left = Math.min(start.x, hole?.left ?? start.x);
    const top = Math.min(start.y, hole?.top ?? start.y);
    const width = hole?.width ?? 0;
    const height = hole?.height ?? 0;

    clearOverlay();
    start = null;

    if (width < 8 || height < 8) return;

    const objects = [...canvas.getObjects()];

    objects.forEach((obj: any) => {
      const r = obj.getBoundingRect();
      const newLeft = r.left - left;
      const newTop = r.top - top;

      const stillVisible =
        newLeft + r.width >= 0 &&
        newLeft <= width &&
        newTop + r.height >= 0 &&
        newTop <= height;

      if (stillVisible) {
        obj.set({ left: newLeft, top: newTop });
        obj.setCoords();
      } else {
        canvas.remove(obj);
      }
    });

    canvas.setDimensions({ width, height });
    canvas.backgroundColor = "white";
    canvas.discardActiveObject();
    syncCanvasSizeStore(canvas);
    canvas.requestRenderAll();
    ctx.push();
  };

  const cancel = (e: any) => {
    if (e.key === "Escape") {
      clearOverlay();
      start = null;
    }
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);
  document.addEventListener("keydown", cancel);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    document.removeEventListener("keydown", cancel);
    clearOverlay();
    start = null;
  };
}