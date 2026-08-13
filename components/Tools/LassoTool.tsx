import { Polygon } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let points: any[] = [];
  let preview: any = null;

  const clearPreview = () => {
    if (preview) {
      canvas.remove(preview);
      preview = null;
    }
  };

  const renderPreview = () => {
    clearPreview();
    if (points.length < 2) return;
    preview = new Polygon(points.map((p) => ({ x: p.x, y: p.y })), {
      fill: "rgba(80,150,255,0.15)",
      stroke: "rgba(80,150,255,0.9)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    });
    canvas.add(preview);
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const point = getPointer(canvas, e.e);
    points.push(point);
    renderPreview();
  };

  const move = (e: any) => {
    if (points.length < 2) return;
    const point = getPointer(canvas, e.e);
    if (preview) {
      const pts = [...points, point];
      preview.set({ points: pts.map((p) => ({ x: p.x, y: p.y })) });
      preview.setCoords();
      canvas.requestRenderAll();
    }
  };

  const finish = () => {
    clearPreview();
    if (points.length >= 3) {
      const selection = new Polygon(points.map((p) => ({ x: p.x, y: p.y })), {
        fill: "rgba(80,150,255,0.25)",
        stroke: "rgba(80,150,255,0.9)",
        strokeWidth: 1,
        selectable: false,
        evented: false,
      } as any);
      (selection as any).isLassoSelection = true;
      canvas.add(selection);
      canvas.requestRenderAll();
    }
    points = [];
  };

  const dblClick = () => {
    finish();
    const lasso = canvas.getObjects().find((o: any) => o.isLassoSelection);
    if (lasso) {
      const targets = canvas.getObjects().filter((obj: any) => {
        if (obj.isLassoSelection) return false;
        const rect = obj.getBoundingRect();
        const lassoRect = lasso.getBoundingRect();
        return (
          rect.left + rect.width > lassoRect.left &&
          rect.left < lassoRect.left + lassoRect.width &&
          rect.top + rect.height > lassoRect.top &&
          rect.top < lassoRect.top + lassoRect.height
        );
      });
      if (targets.length) canvas.setActiveObject(targets.length === 1 ? targets[0] : targets);
      canvas.remove(lasso);
      canvas.requestRenderAll();
    }
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      clearPreview();
      points = [];
      canvas.requestRenderAll();
    }
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:dblclick", dblClick);
  document.addEventListener("keydown", key);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:dblclick", dblClick);
    document.removeEventListener("keydown", key);
    clearPreview();
    points = [];
  };
}