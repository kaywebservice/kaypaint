import { Polygon } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let points: any[] = [];
  let preview: any = null;
  let frequency = 57;
  let contrast = 1;
  let width = 10;

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
      fill: "rgba(255, 255, 0, 0.15)",
      stroke: "rgba(255, 255, 0, 0.9)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    });
    canvas.add(preview);
    canvas.requestRenderAll();
  };

  const detectEdge = (point: { x: number; y: number }) => {
    const el = canvas.getElement?.();
    if (!el) return point;
    const ctx = el.getContext("2d");
    if (!ctx) return point;
    const imgData = ctx.getImageData(0, 0, el.width, el.height);
    const data = imgData.data;
    const w = el.width;
    const h = el.height;

    let bestX = point.x;
    let bestY = point.y;
    let bestContrast = 0;

    for (let dx = -width; dx <= width; dx++) {
      for (let dy = -width; dy <= width; dy++) {
        const x = Math.floor(point.x + dx);
        const y = Math.floor(point.y + dy);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;

        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const gray = (r + g + b) / 3;

        const idx2 = (Math.min(y + 1, h - 1) * w + x) * 4;
        const gray2 = (data[idx2] + data[idx2 + 1] + data[idx2 + 2]) / 3;

        const edge = Math.abs(gray - gray2);
        if (edge > bestContrast) {
          bestContrast = edge;
          bestX = x;
          bestY = y;
        }
      }
    }

    return { x: bestX, y: bestY };
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const point = getPointer(canvas, e.e);
    const snapped = detectEdge(point);
    points.push(snapped);
    renderPreview();
  };

  const move = (e: any) => {
    if (points.length < 2) return;
    const point = getPointer(canvas, e.e);
    const snapped = detectEdge(point);
    if (preview) {
      const pts = [...points, snapped];
      preview.set({ points: pts.map((p) => ({ x: p.x, y: p.y })) });
      preview.setCoords();
      canvas.requestRenderAll();
    }
  };

  const finish = () => {
    clearPreview();
    if (points.length >= 3) {
      const selection = new Polygon(points.map((p) => ({ x: p.x, y: p.y })), {
        fill: "rgba(255, 255, 0, 0.25)",
        stroke: "rgba(255, 255, 0, 0.9)",
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