/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { useFeaturesStore } from "@/store/featuresStore";

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const p = getPointer(canvas, e.e);
    const fs = useFeaturesStore.getState();
    if (e.e.altKey) {
      let best: { id: string; d: number } | null = null;
      for (const c of fs.counts) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d <= 15 && (!best || d < best.d)) best = { id: c.id, d };
      }
      if (best) fs.removeCount(best.id);
    } else {
      fs.addCount(p.x, p.y);
    }
  };

  canvas.on("mouse:down", down);

  return () => {
    canvas.off("mouse:down", down);
  };
}
