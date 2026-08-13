import { IText } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer, findObjectUnderPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let justCreated: any = null;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const target = findObjectUnderPointer(canvas, e.e);
    if (target || justCreated) return;

    const point = getPointer(canvas, e.e);

    const text = new IText("Vertical Text", {
      left: point.x,
      top: point.y,
      fill: ctx.get("color") ?? "#000000",
      fontSize: ctx.get("fontSize") ?? 28,
      fontFamily: "Arial",
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      textAlign: "center",
      direction: "rtl",
      writingMode: "vertical-rl",
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.setCoords();
    justCreated = text;
    canvas.requestRenderAll();

    try {
      text.enterEditing();
    } catch { }
  };

  const exit = () => {
    if (justCreated) {
      justCreated = null;
      canvas.requestRenderAll();
    }
  };

  canvas.on("mouse:down", down);
  canvas.on("text:editing:exited", exit);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("text:editing:exited", exit);
    if (justCreated) {
      justCreated.exitEditing?.();
      justCreated = null;
    }
    canvas.requestRenderAll();
  };
}