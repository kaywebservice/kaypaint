import { toComposite } from "@/engine/blendEngine";
import { nextObjectId } from "@/utils/imageUtils";

export function createCanvasObject(
  object: any,
  canvas: any,
  name: string
) {
  const objectId = nextObjectId();
  object.set({
    kaypaintId: objectId,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  });

  canvas.add(object);
  canvas.setActiveObject(object);
  canvas.requestRenderAll();

  return objectId;
}

export function attachObjectToLayer(
  object: any,
  canvasObjectId: string,
  layerId: string,
  store: any
) {
  const state = store.getState();

  store.setState({
    layers: state.layers.map((layer: any) =>
      layer.id === layerId
        ? { ...layer, objectId: canvasObjectId }
        : layer
    ),
  });
}

export function applyLayerToProps(
  object: any,
  layer: { visible: boolean; locked: boolean; opacity: number; blendMode: string }
) {
  if (!object) return;

  object.set({
    visible: layer.visible,
    selectable: !layer.locked,
    lockMovementX: !!layer.locked,
    lockMovementY: !!layer.locked,
    lockScalingX: !!layer.locked,
    lockScalingY: !!layer.locked,
    lockRotation: !!layer.locked,
    opacity: (layer.opacity ?? 100) / 100,
    globalCompositeOperation: toComposite(layer.blendMode),
  });
  object.canvas?.requestRenderAll();
}