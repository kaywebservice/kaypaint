import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { STextOnPath } from "@/engine/textOnPathEngine";
import { nextObjectId } from "@/utils/imageUtils";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = "crosshair";

  let start: { x: number; y: number } | null = null;
  let preview: any = null;

  const onDown = (e: any) => {
    if (e.e.button !== 0) return;
    const pt = getPointer(canvas, e.e);
    start = { x: pt.x, y: pt.y };
  };

  const onMove = (e: any) => {
    if (!start) return;
    const pt = getPointer(canvas, e.e);
    const len = Math.max(20, Math.hypot(pt.x - start.x, pt.y - start.y));
    const angle = (Math.atan2(pt.y - start.y, pt.x - start.x) * 180) / Math.PI;

    if (!preview) {
      preview = new STextOnPath({
        left: start.x,
        top: start.y,
        angle,
        length: len,
        text: "",
        fill: ctx.get("color") ?? "#000000",
        fontSize: ctx.get("fontSize") ?? 28,
        selectable: false,
        evented: false,
      });
      canvas.add(preview);
    } else {
      preview.set({ angle, length: len });
    }
    preview.setCoords?.();
    canvas.requestRenderAll();
  };

  const onUp = (e: any) => {
    if (!start) return;
    const pt = getPointer(canvas, e.e);
    const len = Math.max(20, Math.hypot(pt.x - start.x, pt.y - start.y));
    const angle = (Math.atan2(pt.y - start.y, pt.x - start.x) * 180) / Math.PI;

    const obj = new STextOnPath({
      left: start.x,
      top: start.y,
      angle,
      length: len,
      text: "Type on path",
      fill: ctx.get("color") ?? "#000000",
      fontSize: ctx.get("fontSize") ?? 28,
    });
    obj.set({ kaypaintId: nextObjectId() });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    obj.setCoords?.();
    canvas.requestRenderAll();

    if (preview) {
      canvas.remove(preview);
      preview = null;
    }
    start = null;
    ctx.push();
  };

  canvas.on("mouse:down", onDown);
  canvas.on("mouse:move", onMove);
  canvas.on("mouse:up", onUp);

  return () => {
    canvas.off("mouse:down", onDown);
    canvas.off("mouse:move", onMove);
    canvas.off("mouse:up", onUp);
    if (preview) {
      canvas.remove(preview);
      preview = null;
    }
    start = null;
    canvas.defaultCursor = "default";
    canvas.requestRenderAll();
  };
}