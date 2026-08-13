import { Rect, FabricImage } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let start: any = null;
  let frame: any = null;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    start = getPointer(canvas, e.e);
    frame = new Rect({
      left: start.x,
      top: start.y,
      width: 0,
      height: 0,
      fill: "rgba(97, 218, 251, 0.1)",
      stroke: "#61dafb",
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: false,
      evented: false,
      isFrameRect: true,
    });
    canvas.add(frame);
    canvas.requestRenderAll();
  };

  const move = (e: any) => {
    if (!start || !frame) return;
    const p = getPointer(canvas, e.e);
    frame.set({
      left: Math.min(start.x, p.x),
      top: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    });
    frame.setCoords();
    canvas.requestRenderAll();
  };

  const up = async () => {
    if (!start || !frame) return;
    if (frame.width > 20 && frame.height > 20) {
      const img = new FabricImage(new window.Image());
      img.setSrc(frame.toDataURL({ format: "png" })).then(() => {
        img.set({
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          isFrameImage: true,
        });
        canvas.remove(frame);
        canvas.add(img);
        canvas.setActiveObject(img);
        ctx.push();
      });
    } else {
      canvas.remove(frame);
    }
    start = null;
    frame = null;
    canvas.requestRenderAll();
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    if (frame) canvas.remove(frame);
    start = null;
    canvas.requestRenderAll();
  };
}