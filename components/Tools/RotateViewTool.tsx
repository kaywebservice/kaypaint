/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToolCtx } from "@/types/editor";
import { useFeaturesStore } from "@/store/featuresStore";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let center: { x: number; y: number } | null = null;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    center = {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2,
    };
  };

  const move = (e: any) => {
    if (!center || !e.e.buttons) return;
    const p = canvas.getPointer(e.e);
    const angle = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
    useFeaturesStore.getState().setViewRotate(angle);
  };

  const up = () => {
    center = null;
  };

  const dbl = () => {
    useFeaturesStore.getState().setViewRotate(0);
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);
  canvas.on("mouse:dblclick", dbl);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    canvas.off("mouse:dblclick", dbl);
    center = null;
  };
}
