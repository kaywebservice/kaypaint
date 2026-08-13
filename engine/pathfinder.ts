/* eslint-disable @typescript-eslint/no-explicit-any */
import { loopsToPath, type BooleanOp } from "@/engine/shapeBoolean";
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";
import { notify } from "@/utils/notify";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function rasterizeMask(
  obj: any,
  ox: number,
  oy: number,
  w: number,
  h: number
): Promise<Uint8ClampedArray> {
  const { StaticCanvas } = await import("fabric");
  const clone = await obj.clone();
  clone.set({ left: obj.left - ox, top: obj.top - oy });
  const sc = new StaticCanvas(document.createElement("canvas"), {
    width: w,
    height: h,
    backgroundColor: "transparent",
  });
  sc.add(clone);
  sc.renderAll();
  const url = sc.toDataURL({ format: "png", multiplier: 1 });
  sc.dispose();
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h).data;
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = data[i * 4 + 3] > 16 ? 255 : 0;
  }
  return mask;
}

/** Combine two selected shapes with a boolean operation (pathfinder). */
export async function applyPathfinder(canvas: any, op: BooleanOp): Promise<boolean> {
  if (!canvas) return false;
  const objs = (canvas.getActiveObjects?.() ?? []).filter(
    (o: any) => o.type !== "SAdjustment" && !o.isGuideLine
  );
  if (objs.length !== 2) {
    notify("Pathfinder: select exactly two shapes or layers.", "warning");
    return false;
  }
  const A = objs[0];
  const B = objs[1];

  const ra = A.getBoundingRect();
  const rb = B.getBoundingRect();
  const left = Math.min(ra.left, rb.left);
  const top = Math.min(ra.top, rb.top);
  const right = Math.max(ra.left + ra.width, rb.left + rb.width);
  const bottom = Math.max(ra.top + ra.height, rb.top + rb.height);
  const pad = 8;
  const W = Math.max(4, Math.ceil(right - left) + pad * 2);
  const H = Math.max(4, Math.ceil(bottom - top) + pad * 2);
  if (W > 4096 || H > 4096) {
    notify("Pathfinder: shapes are too large to combine.", "warning");
    return false;
  }

  const ox = left - pad;
  const oy = top - pad;
  const maskA = await rasterizeMask(A, ox, oy, W, H);
  const maskB = await rasterizeMask(B, ox, oy, W, H);
  const { px } = await import("@/engine/pixelWorkerClient");
  const result = await px.combineMasks(maskA, maskB, W, H, op);
  const loops = await px.trace(result, W, H);
  if (!loops.length) {
    notify("Pathfinder produced no result.", "warning");
    return false;
  }

  const { Path } = await import("fabric");
  const d = loopsToPath(loops);
  const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = new Path(d, {
    fill: A.fill ?? "#000000",
    stroke: A.stroke ?? "",
    strokeWidth: A.strokeWidth ?? 1,
    fillRule: "evenodd",
    left: ox,
    top: oy,
    selectable: true,
    evented: true,
    kaypaintId: objectId,
  });
  path.setCoords();

  canvas.discardActiveObject();
  canvas.remove(A, B);
  canvas.add(path);
  canvas.setActiveObject(path);
  canvas.requestRenderAll();
  useLayerStore.getState().addCanvasLayer("Pathfinder result", objectId);
  useEditorStore.getState().history?.push?.();
  return true;
}
