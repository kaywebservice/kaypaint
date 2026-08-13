import { Group, Image as FabricImage } from "fabric";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";

interface IsolationState {
  groupId: string;
  index: number;
  group: any;
  objectIds: string[];
}

const isolationMap = new Map<string, IsolationState>();

function isBakeable(obj: any) {
  return !obj.isGuideLine && obj.type !== "SAdjustment";
}

function localToScene(group: any, localX: number, localY: number) {
  const sx = (group.scaleX ?? 1) * (group.flipX ? -1 : 1);
  const sy = (group.scaleY ?? 1) * (group.flipY ? -1 : 1);
  const rad = (((group.angle ?? 0) * Math.PI) / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = localX * sx;
  const y = localY * sy;
  return {
    x: x * cos - y * sin + group.left,
    y: x * sin + y * cos + group.top,
  };
}

export function convertToSmartObject(canvas: any) {
  if (!canvas) return;
  const objects = canvas
    .getActiveObjects()
    .filter((o: any) => isBakeable(o));
  if (objects.length === 0) return;

  const group = new Group(objects as any);
  group.set({
    kaypaintId: objects[0].kaypaintId ?? `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    selectable: true,
    evented: true,
  } as any);
  group.setCoords();

  const index = canvas.getObjects().indexOf(objects[0]);
  canvas.remove(...objects);
  if (index >= 0) canvas.insertAt(index, group);
  else canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();

  const ls = useLayerStore.getState();
  const ids = new Set(objects.map((o: any) => o.kaypaintId).filter(Boolean));
  const keptId = (group as any).kaypaintId;
  let renamed = false;
  const layers = ls.layers
    .filter((l) => !ids.has(l.objectId) || l.objectId === keptId)
    .map((l) => {
      if (l.objectId === keptId && !renamed) {
        renamed = true;
        return { ...l, name: "Smart Object", type: "smart" as const };
      }
      return l;
    });
  if (!renamed) {
    layers.push({
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "Smart Object",
      type: "smart",
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      hasMask: false,
      objectId: keptId,
    });
  }
  useLayerStore.setState({ layers, activeLayer: layers[layers.length - 1]?.id ?? null });
  useEditorStore.getState().history?.push?.();
  return group;
}

export function rasterizeActiveLayer(canvas: any) {
  if (!canvas) return;
  const obj = canvas.getActiveObject();
  if (!obj || !isBakeable(obj) || obj.type === "image" || obj.type === "SAdjustment") return;

  const el = obj.toCanvasElement({ multiplier: 1 });
  const id = obj.kaypaintId ?? `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const index = canvas.getObjects().indexOf(obj);

  const img = new FabricImage(el, {
    left: obj.left,
    top: obj.top,
    angle: 0,
    opacity: obj.opacity ?? 1,
    visible: obj.visible ?? true,
    selectable: true,
    evented: true,
    kaypaintId: id,
  });
  img.setCoords();

  canvas.remove(obj);
  if (index >= 0) canvas.insertAt(index, img);
  else canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();

  useLayerStore.setState((state) => ({
    layers: state.layers.map((l) =>
      l.objectId === id ? { ...l, name: "Rasterized", type: "image" as const } : l
    ),
  }));
  useEditorStore.getState().history?.push?.();
  return img;
}

export function enterSmartObjectIsolation(canvas: any) {
  if (!canvas) return;
  if (useEditorStore.getState().soIsolation) return;

  const group = canvas.getActiveObject();
  if (!group || !(group instanceof Group)) return;

  const objectIds: string[] = [];
  const children = group.getObjects().filter((c: any) => isBakeable(c));

  const sx = (group.scaleX ?? 1) * (group.flipX ? -1 : 1);
  const sy = (group.scaleY ?? 1) * (group.flipY ? -1 : 1);
  const angle = group.angle ?? 0;

  for (const child of children) {
    const scene = localToScene(group, child.left, child.top);
    child.set({
      left: scene.x,
      top: scene.y,
      scaleX: (child.scaleX ?? 1) * sx,
      scaleY: (child.scaleY ?? 1) * sy,
      angle: ((child.angle ?? 0) + angle) % 360,
      opacity: (child.opacity ?? 1) * (group.opacity ?? 1),
      visible: (group.visible ?? true) && (child.visible ?? true),
    });
    child.setCoords?.();
    objectIds.push(
      (child as any).kaypaintId ??
        (child as any).id ??
        `child-${Math.random().toString(36).slice(2, 8)}`
    );
  }

  const index = canvas.getObjects().indexOf(group);

  canvas.remove(group);
  for (const child of children) {
    canvas.add(child);
    child.setCoords?.();
  }

  useEditorStore.getState().setSoIsolation({ groupId: (group as any).kaypaintId ?? (group as any).id });
  isolationMap.set((group as any).kaypaintId ?? (group as any).id, {
    groupId: (group as any).kaypaintId ?? (group as any).id,
    index,
    group,
    objectIds,
  });

  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function exitSmartObjectIsolation(canvas: any, discard = false) {
  if (!canvas) return;
  const so = useEditorStore.getState().soIsolation;
  if (!so) return;

  const state = isolationMap.get(so.groupId);
  if (!state) {
    useEditorStore.getState().setSoIsolation(null);
    return;
  }

  const live = canvas.getObjects().filter((o: any) =>
    state.objectIds.includes((o as any).kaypaintId ?? (o as any).id)
  );
  live.forEach((o: any) => canvas.remove(o));

  if (!discard) {
    const group = state.group;
    group.set({
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      opacity: 1,
      visible: true,
      flipX: false,
      flipY: false,
    });
    group.setCoords?.();
    if (state.index >= 0 && state.index <= canvas.getObjects().length) {
      canvas.insertAt(state.index, group);
    } else {
      canvas.add(group);
    }
    canvas.setActiveObject(group);
  }

  isolationMap.delete(so.groupId);
  useEditorStore.getState().setSoIsolation(null);
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}

export function isSmartObject(obj: any) {
  return !!obj && obj instanceof Group;
}