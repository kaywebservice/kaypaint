import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import type { ToolCtx } from "@/types/editor";

export function getCtx(): ToolCtx {
  const state = useEditorStore.getState();
  return {
    canvas: state.canvas,
    get: (key: string) => (state as any)[key],
    push: () => state.history?.push?.(),
  };
}

export function canvasNow() {
  return useEditorStore.getState().canvas;
}

export function histNow() {
  return useEditorStore.getState().history;
}

export function layersNow() {
  return useLayerStore.getState();
}