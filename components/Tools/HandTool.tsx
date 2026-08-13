import type { ToolCtx } from "@/types/editor";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let transform: number[] | null = null;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    dragging = true;
    startX = e.e.clientX;
    startY = e.e.clientY;
    transform = [...(canvas.viewportTransform as number[])];
  };

  const move = (e: any) => {
    if (!dragging || !transform) return;
    const dx = e.e.clientX - startX;
    const dy = e.e.clientY - startY;

    const vpt = (canvas.viewportTransform as number[]).slice();
    vpt[4] = transform[4] + dx;
    vpt[5] = transform[5] + dy;

    canvas.viewportTransform = vpt;
    canvas.requestRenderAll();
  };

  const up = () => {
    dragging = false;
    transform = null;
  };

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    dragging = false;
    canvas.requestRenderAll();
  };
}