/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToolCtx } from "@/types/editor";
import { nextObjectId } from "@/utils/imageUtils";
import * as MoveTool from "@/components/Tools/MoveTool";
import * as SelectTool from "@/components/Tools/SelectTool";
import * as MarqueeTool from "@/components/Tools/MarqueeTool";
import * as LassoTool from "@/components/Tools/LassoTool";
import * as PolygonalLassoTool from "@/components/Tools/PolygonalLassoTool";
import * as MagneticLassoTool from "@/components/Tools/MagneticLassoTool";
import * as WandTool from "@/components/Tools/WandTool";
import * as BrushTool from "@/components/Tools/BrushTool";
import * as PencilTool from "@/components/Tools/PencilTool";
import * as EraserTool from "@/components/Tools/EraserTool";
import * as HealTool from "@/components/Tools/HealTool";
import * as CloneTool from "@/components/Tools/CloneTool";
import * as SpotHealTool from "@/components/Tools/SpotHealTool";
import * as TextTool from "@/components/Tools/TextTool";
import * as VerticalTextTool from "@/components/Tools/VerticalTextTool";
import * as ShapeTool from "@/components/Tools/ShapeTool";
import * as PenTool from "@/components/Tools/PenTool";
import * as BucketTool from "@/components/Tools/BucketTool";
import * as GradientTool from "@/components/Tools/GradientToolPopup";
import * as CropTool from "@/components/Tools/CropTool";
import * as ZoomTool from "@/components/Tools/ZoomTool";
import * as HandTool from "@/components/Tools/HandTool";
import * as EyedropperTool from "@/components/Tools/EyedropperTool";
import * as DodgeTool from "@/components/Tools/DodgeTool";
import * as BurnTool from "@/components/Tools/BurnTool";
import * as SpongeTool from "@/components/Tools/SpongeTool";
import * as SmudgeTool from "@/components/Tools/SmudgeTool";
import * as SharpenTool from "@/components/Tools/SharpenTool";
import * as BlurTool from "@/components/Tools/BlurTool";
import * as BrightnessTool from "@/components/Tools/BrightnessTool";
import * as QuickMaskTool from "@/components/Tools/QuickMaskTool";
import * as MeasureTool from "@/components/Tools/MeasureTool";
import * as SliceTool from "@/components/Tools/SliceTool";
import * as FrameTool from "@/components/Tools/FrameTool";
import * as LiquifyTool from "@/components/Tools/LiquifyTool";
import * as TextOnPathTool from "@/components/Tools/TextOnPathTool";
import * as MagicEraserTool from "@/components/Tools/MagicEraserTool";
import * as BackgroundEraserTool from "@/components/Tools/BackgroundEraserTool";
import * as ColorReplacementTool from "@/components/Tools/ColorReplacementTool";
import * as HistoryBrushTool from "@/components/Tools/HistoryBrushTool";
import * as ArtHistoryBrushTool from "@/components/Tools/ArtHistoryBrushTool";
import * as MixerBrushTool from "@/components/Tools/MixerBrushTool";
import * as PatternStampTool from "@/components/Tools/PatternStampTool";
import * as PatchTool from "@/components/Tools/PatchTool";
import * as RedEyeTool from "@/components/Tools/RedEyeTool";
import * as QuickSelectionTool from "@/components/Tools/QuickSelectionTool";
import * as RefineEdgeTool from "@/components/Tools/RefineEdgeTool";
import * as ObjectSelectionTool from "@/components/Tools/ObjectSelectionTool";
import * as RotateViewTool from "@/components/Tools/RotateViewTool";
import * as NotesTool from "@/components/Tools/NotesTool";
import * as CountTool from "@/components/Tools/CountTool";

const registry: Record<string, any> = {
  move: MoveTool,
  select: SelectTool,
  marquee: MarqueeTool,
  lasso: LassoTool,
  polygonalLasso: PolygonalLassoTool,
  magneticLasso: MagneticLassoTool,
  wand: WandTool,
  brush: BrushTool,
  pencil: PencilTool,
  eraser: EraserTool,
  heal: HealTool,
  clone: CloneTool,
  spotHeal: SpotHealTool,
  text: TextTool,
  vText: VerticalTextTool,
  shape: ShapeTool,
  pen: PenTool,
  bucket: BucketTool,
  gradient: GradientTool,
  crop: CropTool,
  zoom: ZoomTool,
  hand: HandTool,
  color: EyedropperTool,
  dodge: DodgeTool,
  burn: BurnTool,
  sponge: SpongeTool,
  smudge: SmudgeTool,
  sharpen: SharpenTool,
  blur: BlurTool,
  brightness: BrightnessTool,
  quickMask: QuickMaskTool,
  measure: MeasureTool,
  slice: SliceTool,
  frame: FrameTool,
  liquify: LiquifyTool,
  textOnPath: TextOnPathTool,
  magicEraser: MagicEraserTool,
  backgroundEraser: BackgroundEraserTool,
  colorReplacement: ColorReplacementTool,
  historyBrush: HistoryBrushTool,
  artHistoryBrush: ArtHistoryBrushTool,
  mixerBrush: MixerBrushTool,
  patternStamp: PatternStampTool,
  patch: PatchTool,
  redEye: RedEyeTool,
  quickSelection: QuickSelectionTool,
  refineEdge: RefineEdgeTool,
  objectSelection: ObjectSelectionTool,
  rotateView: RotateViewTool,
  notes: NotesTool,
  count: CountTool,
};

let currentId: string | null = null;
let currentCleanup: (() => void) | null = null;

export function getCurrentToolId() {
  return currentId;
}

export function switchTool(id: string, ctx: ToolCtx) {
  if (currentId === id) {
    return;
  }

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  currentId = id;

  const mod = registry[id];

  if (mod && typeof mod.activateTool === "function") {
    const cleanup = mod.activateTool(ctx);

    if (typeof cleanup === "function") {
      currentCleanup = cleanup;
    }
  }
}

export function deactivateTool(ctx: ToolCtx) {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  currentId = null;
  ctx.canvas.isDrawingMode = false;
  ctx.canvas.requestRenderAll();
}

export function syncBrushParams(ctx: ToolCtx) {
  const id = currentId;

  if (id === "brush") {
    BrushTool.syncBrush?.(ctx);
  }

  if (id === "eraser") {
    EraserTool.syncEraser?.(ctx);
  }

  if (id === "pencil") {
    const brush = ctx.canvas.freeDrawingBrush;
    if (brush) {
      brush.width = ctx.get("size") ?? 4;
      ctx.canvas.requestRenderAll();
    }
  }

  if (id === "heal") {
    HealTool.syncHeal?.(ctx);
  }

  if (id === "clone") {
    const brush = ctx.canvas.freeDrawingBrush;
    if (brush) {
      brush.width = ctx.get("size") ?? 20;
      ctx.canvas.requestRenderAll();
    }
  }

  if (id === "spotHeal") {
    const brush = ctx.canvas.freeDrawingBrush;
    if (brush) {
      brush.width = ctx.get("size") ?? 12;
      ctx.canvas.requestRenderAll();
    }
  }

  if (id === "dodge" || id === "burn" || id === "sponge" || id === "smudge" || id === "sharpen") {
    const brush = ctx.canvas.freeDrawingBrush;
    if (brush) {
      brush.width = ctx.get("size") ?? 12;
      ctx.canvas.requestRenderAll();
    }
  }
}

export function syncShapeKind(ctx: ToolCtx) {
  if (currentId === "shape") {
    ShapeTool.reapplyShape(ctx);
  }
}

export function syncFilterValue(ctx: ToolCtx) {
  if (currentId === "blur") {
    BlurTool.reapplyBlur?.(ctx);
  }

  if (currentId === "brightness") {
    BrightnessTool.reapplyBrightness?.(ctx);
  }
}

export function applyToolOnce(id: string, ctx: ToolCtx) {
  registry[id]?.activateTool?.(ctx);
}

let clipboard: any = null;

export async function copyActiveSelection(canvas: any) {
  const obj = canvas.getActiveObject();
  clipboard = obj ? await obj.clone() : null;
  return !!clipboard;
}

export function hasClipboard() {
  return !!clipboard;
}

export async function pasteClipboard(canvas: any, ctx: ToolCtx) {
  if (!clipboard) return;
  const cloned = await clipboard.clone();
  cloned.set({
    left: (cloned.left || 0) + 20,
    top: (cloned.top || 0) + 20,
    kaypaintId: nextObjectId(),
  });
  canvas.add(cloned);
  canvas.setActiveObject(cloned);
  cloned.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}

export async function cutActiveSelection(canvas: any, ctx: ToolCtx) {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  clipboard = await obj.clone();
  canvas.remove(obj);
  ctx.push();
}

export async function duplicateActiveSelection(canvas: any, ctx: ToolCtx) {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  const dup = await obj.clone();
  dup.set({
    left: (obj.left || 0) + 20,
    top: (obj.top || 0) + 20,
    kaypaintId: nextObjectId(),
  });
  canvas.add(dup);
  canvas.setActiveObject(dup);
  dup.setCoords();
  canvas.requestRenderAll();
  ctx.push();
}