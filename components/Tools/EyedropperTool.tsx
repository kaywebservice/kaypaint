import type { ToolCtx } from "@/types/editor";
import { getPixelColor } from "@/utils/imageUtils";
import { useEditorStore } from "@/store/editorStore";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const down = (e: any) => {
    const color = getPixelColor(canvas, e.e.clientX, e.e.clientY);
    if (!color) return;

    useEditorStore.getState().setColor(color);
    useEditorStore.getState().setTool("brush");
  };

  canvas.on("mouse:down", down);

  return () => {
    canvas.off("mouse:down", down);
    canvas.requestRenderAll();
  };
}