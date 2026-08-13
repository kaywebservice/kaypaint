import { Polygon } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let points: any[] = [];
  let preview: any = null;

  const color = () => ctx.get("color") ?? "#000000";

  const clearPreview = () => {
    if (preview) {
      canvas.remove(preview);
      preview = null;
    }
  };

  const renderPreview = () => {
    clearPreview();

    if (points.length < 2) return;

    const scaled = points.map((p) => ({ x: p.x, y: p.y }));

    preview = new Polygon(scaled, {
      fill: "rgba(120,120,120,0.001)",
      stroke: color(),
      strokeWidth: 2,
      objectCaching: false,
    });
    canvas.add(preview);
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.shiftKey) {
      finish();
      return;
    }
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
      const polygon = new Polygon(
        points.map((p) => ({ x: p.x, y: p.y })),
        {
          fill: color(),
          stroke: color(),
          strokeWidth: 0,
        }
      );
      canvas.add(polygon);
      canvas.setActiveObject(polygon);
      ctx.push();
    }

    points = [];
    canvas.requestRenderAll();
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      finish();
    }
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:dblclick", finish);
  document.addEventListener("keydown", key);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:dblclick", finish);
    document.removeEventListener("keydown", key);
    clearPreview();
    points = [];
    canvas.requestRenderAll();
  };
}