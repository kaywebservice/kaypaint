import type { ToolCtx } from "@/types/editor";
import * as RectModule from "./RectangleTool";
import * as CircleModule from "./CircleTool";
import * as LineModule from "./LineTool";
import * as TriangleModule from "./TriangleTool";
import * as PolygonModule from "./PolygonTool";

const SHAPES: Record<string, any> = {
  rect: RectModule,
  circle: CircleModule,
  line: LineModule,
  triangle: TriangleModule,
  polygon: PolygonModule,
};

let currentCleanup: (() => void) | undefined;

function apply(ctx: ToolCtx) {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = undefined;
  }

  const kind = ctx.get("shape") ?? "rect";
  const mod = SHAPES[kind] ?? RectModule;
  currentCleanup = mod.activateTool(ctx);
}

export function activateTool(ctx: ToolCtx) {
  apply(ctx);

  return () => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = undefined;
    }
    ctx.canvas.requestRenderAll();
  };
}

export function reapplyShape(ctx: ToolCtx) {
  apply(ctx);
}