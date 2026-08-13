import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";

export const DEFAULT_CANVAS_W = 1920;
export const DEFAULT_CANVAS_H = 1080;

export function syncCanvasSizeStore(canvas: any) {
  if (!canvas) return;
  useEditorStore
    .getState()
    .setCanvasSize(canvas.width ?? DEFAULT_CANVAS_W, canvas.height ?? DEFAULT_CANVAS_H);
}

export interface CanvasSizeOptions {
  width: number;
  height: number;
  anchor?: number;
  extendColor?: string;
}

export function scaleCanvasContent(width: number, height: number) {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return false;

  const curW = canvas.width;
  const curH = canvas.height;
  if (!curW || !curH) return false;

  const newW = Math.max(1, Math.round(width));
  const newH = Math.max(1, Math.round(height));
  const sx = newW / curW;
  const sy = newH / curH;

  canvas.getObjects().forEach((obj: any) => {
    if (obj.type === "SAdjustment") {
      obj.set({
        left: obj.left * sx,
        top: obj.top * sy,
        width: newW,
        height: newH,
      });
      obj.setCoords?.();
      return;
    }
    obj.set({
      left: obj.left * sx,
      top: obj.top * sy,
      scaleX: (obj.scaleX ?? 1) * sx,
      scaleY: (obj.scaleY ?? 1) * sy,
    });
    obj.setCoords?.();
  });

  canvas.setDimensions({ width: newW, height: newH });
  canvas.discardActiveObject();

  const st = useEditorStore.getState();
  const guides = st.guides
    .map((g) => ({ ...g, pos: g.pos * (g.axis === "v" ? sx : sy) }))
    .filter((g) =>
      g.axis === "v" ? g.pos >= 0 && g.pos <= newW : g.pos >= 0 && g.pos <= newH
    );
  useEditorStore.setState({ guides });

  syncCanvasSizeStore(canvas);
  canvas.requestRenderAll();
  return true;
}

export function applyCanvasSize(opts: CanvasSizeOptions) {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return false;

  const curW = canvas.width;
  const curH = canvas.height;
  if (!curW || !curH) return false;

  const newW = Math.max(1, Math.round(opts.width));
  const newH = Math.max(1, Math.round(opts.height));
  const anchor = Math.max(0, Math.min(8, opts.anchor ?? 4));

  const ax = anchor % 3;
  const ay = Math.floor(anchor / 3);
  const dx = ax === 0 ? 0 : ax === 1 ? (newW - curW) / 2 : newW - curW;
  const dy = ay === 0 ? 0 : ay === 1 ? (newH - curH) / 2 : newH - curH;

  const removedIds = new Set<string>();
  const objects = [...canvas.getObjects()];

  for (const obj of objects) {
    if (obj.type === "SAdjustment") {
      obj.set({
        left: obj.left + dx,
        top: obj.top + dy,
        width: newW,
        height: newH,
      });
      obj.setCoords?.();
      continue;
    }
    obj.left += dx;
    obj.top += dy;
    obj.setCoords?.();

    const r = obj.getBoundingRect();
    const overlap =
      r.left + r.width >= 0 && r.left <= newW && r.top + r.height >= 0 && r.top <= newH;
    if (!overlap) {
      const id = obj.kaypaintId ?? obj.id;
      if (id !== undefined) removedIds.add(id);
    }
  }

  if (removedIds.size) {
    objects.forEach((obj: any) => {
      const id = obj.kaypaintId ?? obj.id;
      if (id !== undefined && removedIds.has(id)) canvas.remove(obj);
    });
    useLayerStore.setState((state) => ({
      layers: state.layers.filter((l) => l.objectId !== undefined && !removedIds.has(l.objectId)),
    }));
  }

  if (newW > curW || newH > curH) {
    canvas.backgroundColor = opts.extendColor ?? canvas.backgroundColor ?? "white";
  }

  canvas.setDimensions({ width: newW, height: newH });
  canvas.discardActiveObject();

  const st = useEditorStore.getState();
  const guides = st.guides
    .map((g) => ({ ...g, pos: g.pos + (g.axis === "v" ? dx : dy) }))
    .filter((g) =>
      g.axis === "v" ? g.pos >= 0 && g.pos <= newW : g.pos >= 0 && g.pos <= newH
    );
  useEditorStore.setState({ guides });

  syncCanvasSizeStore(canvas);
  canvas.requestRenderAll();
  return true;
}