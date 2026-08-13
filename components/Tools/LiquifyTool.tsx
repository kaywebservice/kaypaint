import { Image as FabricImage } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer, findObjectUnderPointer } from "@/engine/canvasEngine";
import { warpCanvas } from "@/engine/liquifyEngine";
import { nextObjectId } from "@/utils/imageUtils";

function rasterize(obj: any): HTMLCanvasElement | null {
  try {
    return obj.toCanvasElement({ multiplier: 1 }) as HTMLCanvasElement;
  } catch {
    return null;
  }
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = "crosshair";

  let state: {
    obj: any;
    work: HTMLCanvasElement;
    isImage: boolean;
    lastX: number;
    lastY: number;
    moved: boolean;
    index: number;
  } | null = null;

  const getStrength = () => Number(ctx.get("liquifyStrength") ?? 60);
  const getRadius = () => Number(ctx.get("size") ?? 24);

  const sceneApply = (e: any, isLast: boolean) => {
    if (!state) return;
    const { obj, work, lastX, lastY } = state;
    const pt = getPointer(canvas, e);
    const scale = Math.abs(obj.scaleX || 1);

    const local = obj.toLocalPoint(pt, "left", "top");

    const px = local.x;
    const py = local.y;
    const radiusEl = Math.max(2, getRadius() / scale);
    const strengthEl = getStrength() * 1.2;
    const dx = (pt.x - lastX) / scale;
    const dy = (pt.y - lastY) / scale;

    warpCanvas(work, px, py, dx, dy, radiusEl, strengthEl);
    state.lastX = pt.x;
    state.lastY = pt.y;
    state.moved = true;

    if (obj.type === "image") {
      try {
        obj.setElement(work);
        obj.setCoords?.();
      } catch {
        obj._element = work;
        obj._originalElement = work;
      }
    }
    canvas.requestRenderAll();

    if (isLast) {
      const s = state;
      state = null;
      if (s.moved) {
        ctx.push();
        s.obj.setCoords?.();
        canvas.setActiveObject(s.obj);
        canvas.requestRenderAll();
      }
    }
  };

  const onDown = (e: any) => {
    if (e.e.button !== 0) return;
    const target = findObjectUnderPointer(canvas, e.e);
    if (!target) return;

    const obj = target;
    const el = obj.getElement?.();
    let work: HTMLCanvasElement;
    let isImage = false;

    if (obj.type === "image" && el) {
      const ew = el.naturalWidth || el.width;
      const eh = el.naturalHeight || el.height;
      if (!ew || !eh) return;
      work = document.createElement("canvas");
      work.width = ew;
      work.height = eh;
      const g = work.getContext("2d")!;
      g.drawImage(el, 0, 0);
      isImage = true;
    } else {
      const flat = rasterize(obj);
      if (!flat) return;
      const img = new FabricImage(flat, {
        left: obj.left,
        top: obj.top,
        angle: obj.angle,
        scaleX: 1,
        scaleY: 1,
        originX: obj.originX,
        originY: obj.originY,
        opacity: obj.opacity ?? 1,
        selectable: true,
        evented: true,
      });
      img.set({ kaypaintId: obj.kaypaintId ?? nextObjectId() });

      const index = canvas.getObjects().indexOf(obj);
      canvas.remove(obj);
      if (index >= 0) {
        canvas.insertAt(index, img);
      } else {
        canvas.add(img);
      }
      work = flat;
      state = {
        obj: img,
        work,
        isImage: false,
        lastX: 0,
        lastY: 0,
        moved: false,
        index,
      };
      const pt = getPointer(canvas, e.e);
      state.lastX = pt.x;
      state.lastY = pt.y;
      state.obj.setCoords?.();
      canvas.requestRenderAll();
      return;
    }

    const pt = getPointer(canvas, e.e);
    state = {
      obj,
      work,
      isImage,
      lastX: pt.x,
      lastY: pt.y,
      moved: false,
      index: -1,
    };
  };

  const onMove = (e: any) => {
    if (!state || !e.e.buttons) return;
    sceneApply(e.e, false);
  };

  const onUp = (e: any) => {
    if (!state) return;
    sceneApply(e.e, true);
  };

  canvas.on("mouse:down", onDown);
  canvas.on("mouse:move", onMove);
  canvas.on("mouse:up", onUp);

  return () => {
    canvas.off("mouse:down", onDown);
    canvas.off("mouse:move", onMove);
    canvas.off("mouse:up", onUp);
    state = null;
    canvas.defaultCursor = "default";
    canvas.requestRenderAll();
  };
}