import { create } from "zustand";
import { KayLayer } from "@/types/layer";
import { useEditorStore } from "@/store/editorStore";
import { nextObjectId } from "@/utils/imageUtils";
import { SAdjustment, AdjustmentType } from "@/engine/adjustmentEngine";

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  collapsed: boolean;
  children: string[];
}

export function objectForLayer(canvas: any, layer: KayLayer | undefined) {
  if (!canvas || !layer?.objectId) return null;
  return (
    canvas
      .getObjects()
      .find((obj: any) => obj.kaypaintId === layer.objectId) ?? null
  );
}

export function syncVisibility(canvas: any, layers: KayLayer[], groups: LayerGroup[]) {
  if (!canvas) return;
  for (const layer of layers) {
    const obj = objectForLayer(canvas, layer);
    if (!obj) continue;
    let visible = layer.visible;
    for (const g of groups) {
      if (g.children.includes(layer.id) && !g.visible) visible = false;
    }
    obj.set({ visible });
  }
  canvas.requestRenderAll();
}

function newId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface LayerState {
  layers: KayLayer[];
  activeLayer: string | null;
  groups: LayerGroup[];

  addLayer: () => void;
  addCanvasLayer: (name: string, objectId: string) => void;
  addAdjustmentLayer: (type: AdjustmentType) => void;
  updateLayerStyles: (id: string, stylesJson: string) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;

  setOpacity: (id: string, opacity: number) => void;
  setBlendMode: (id: string, blendMode: string) => void;

  renameLayer: (id: string, name: string) => void;
  duplicateLayer: (id: string) => void;

  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;

  bringLayerToFront: (id: string) => void;
  sendLayerToBack: (id: string) => void;

  createGroup: (ids: string[]) => void;
  addToGroup: (layerId: string, groupId: string) => void;
  removeFromGroup: (layerId: string) => void;
  deleteGroup: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  toggleGroupVisibility: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  groupForLayer: (layerId: string) => LayerGroup | undefined;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [],
  activeLayer: null,
  groups: [],

  addLayer: () =>
    set((state) => {
      const newLayer: KayLayer = {
        id: newId(),
        name: "New Layer",
        type: "image",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        hasMask: false,
      };

      return {
        layers: [...state.layers, newLayer],
        activeLayer: newLayer.id,
      };
    }),

  addCanvasLayer: (name, objectId) =>
    set((state) => {
      const newLayer: KayLayer = {
        id: newId(),
        name,
        type: "image",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        hasMask: false,
        objectId,
      };

      return {
        layers: [...state.layers, newLayer],
        activeLayer: newLayer.id,
      };
    }),

  addAdjustmentLayer: (type) => {
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;

    const adj = new SAdjustment({
      adjustmentType: type,
      width: canvas.width,
      height: canvas.height,
      left: 0,
      top: 0,
    });
    adj.set({ kaypaintId: nextObjectId() });
    canvas.add(adj);
    canvas.setActiveObject(adj);
    adj.setCoords();
    canvas.requestRenderAll();

    const layer: KayLayer = {
      id: newId(),
      name: type === "levels" ? "Levels" : type === "curves" ? "Curves" : "Hue/Saturation",
      type: "adjustment",
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      hasMask: false,
      objectId: (adj as any).kaypaintId,
    };

    set((state) => ({
      layers: [...state.layers, layer],
      activeLayer: layer.id,
    }));
    useEditorStore.getState().history?.push?.();
  },

  removeLayer: (id) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === id);
      const canvas = useEditorStore.getState().canvas;

      if (layer?.objectId && canvas) {
        const object = objectForLayer(canvas, layer);
        if (object) {
          canvas.remove(object);
          canvas.requestRenderAll();
        }
      }

      return {
        layers: state.layers.filter((l) => l.id !== id),
        groups: state.groups.map((g) => ({
          ...g,
          children: g.children.filter((c) => c !== id),
        })),
        activeLayer:
          state.activeLayer === id
            ? (state.layers.find((l) => l.id !== id)?.id ?? null)
            : state.activeLayer,
      };
    }),

  setActiveLayer: (id) => set({ activeLayer: id }),

  updateLayerStyles: (id, stylesJson) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, layerStyles: stylesJson } : l
      ),
    })),

  toggleVisibility: (id) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      );
      syncVisibility(useEditorStore.getState().canvas, layers, state.groups);
      return { layers };
    }),

  toggleLock: (id) =>
    set((state) => {
      const layer = state.layers.find((l) => l.id === id);
      const canvas = useEditorStore.getState().canvas;
      const obj = layer ? objectForLayer(canvas, layer) : null;
      if (obj) {
        const newLocked = !layer!.locked;
        obj.set({
          selectable: !newLocked,
          evented: !newLocked,
          lockMovementX: newLocked,
          lockMovementY: newLocked,
          lockScalingX: newLocked,
          lockScalingY: newLocked,
          lockRotation: newLocked,
        });
        if (newLocked && canvas.getActiveObject() === obj) canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      return {
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, locked: !l.locked } : l
        ),
      };
    }),

  setOpacity: (id, opacity) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, opacity } : layer
      ),
    })),

  setBlendMode: (id, blendMode) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, blendMode } : layer
      ),
    })),

  renameLayer: (id, name) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, name } : layer
      ),
    })),

  duplicateLayer: (id) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === id);
      if (!layer) return state;

      const newLayer: KayLayer = {
        ...layer,
        id: newId(),
        name: `${layer.name} Copy`,
      };

      const index = state.layers.findIndex((item) => item.id === id);
      const layers = [...state.layers];
      layers.splice(index + 1, 0, newLayer);

      const canvas = useEditorStore.getState().canvas;

      if (layer.objectId && canvas) {
        const object = objectForLayer(canvas, layer);
        if (object && typeof object.clone === "function") {
          object.clone().then((cloned: any) => {
            const objectId = nextObjectId();
            cloned.set({
              kaypaintId: objectId,
              left: (cloned.left ?? 0) + 20,
              top: (cloned.top ?? 0) + 20,
              selectable: true,
              evented: true,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            cloned.setCoords();
            canvas.requestRenderAll();

            useLayerStore.setState({
              layers: useLayerStore.getState().layers.map((l: KayLayer) =>
                l.id === newLayer.id ? { ...l, objectId } : l
              ),
            });
          });
        }
      }

      return {
        layers,
        activeLayer: newLayer.id,
      };
    }),

  moveLayerUp: (id) =>
    set((state) => {
      const index = state.layers.findIndex((layer) => layer.id === id);
      if (index < 0 || index >= state.layers.length - 1) return state;
      const layers = [...state.layers];
      [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
      return { layers };
    }),

  moveLayerDown: (id) =>
    set((state) => {
      const index = state.layers.findIndex((layer) => layer.id === id);
      if (index <= 0) return state;
      const layers = [...state.layers];
      [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
      return { layers };
    }),

  bringLayerToFront: (id) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === id);
      if (!layer) return state;
      return {
        layers: [
          ...state.layers.filter((item) => item.id !== id),
          layer,
        ],
      };
    }),

  sendLayerToBack: (id) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === id);
      if (!layer) return state;
      return {
        layers: [
          layer,
          ...state.layers.filter((item) => item.id !== id),
        ],
      };
    }),

  createGroup: (ids) =>
    set((state) => {
      const id = newId();
      const group: LayerGroup = {
        id,
        name: "Group",
        visible: true,
        collapsed: false,
        children: ids.filter((x) => state.layers.some((l) => l.id === x)),
      };
      return {
        groups: [...state.groups, group],
        activeLayer: ids[0] ?? state.activeLayer,
      };
    }),

  addToGroup: (layerId, groupId) =>
    set((state) => {
      const groups = state.groups.map((g) => {
        let children = g.children.filter((c) => c !== layerId);
        if (g.id === groupId && !children.includes(layerId)) {
          children = [...children, layerId];
        }
        return { ...g, children };
      });
      syncVisibility(useEditorStore.getState().canvas, state.layers, groups);
      return { groups };
    }),

  removeFromGroup: (layerId) =>
    set((state) => {
      const groups = state.groups.map((g) => ({
        ...g,
        children: g.children.filter((c) => c !== layerId),
      }));
      syncVisibility(useEditorStore.getState().canvas, state.layers, groups);
      return { groups };
    }),

  deleteGroup: (groupId) =>
    set((state) => {
      const groups = state.groups.filter((g) => g.id !== groupId);
      syncVisibility(useEditorStore.getState().canvas, state.layers, groups);
      return { groups };
    }),

  toggleGroupCollapsed: (groupId) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      ),
    })),

  toggleGroupVisibility: (groupId) =>
    set((state) => {
      const groups = state.groups.map((g) =>
        g.id === groupId ? { ...g, visible: !g.visible } : g
      );
      syncVisibility(useEditorStore.getState().canvas, state.layers, groups);
      return { groups };
    }),

  renameGroup: (groupId, name) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, name } : g
      ),
    })),

  groupForLayer: (layerId) => {
    return get().groups.find((g) => g.children.includes(layerId));
  },
}));