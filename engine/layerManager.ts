import { Canvas, FabricObject } from "fabric";


export function createCanvasLayer(
  canvas: Canvas,
  object: FabricObject,
  name: string
) {

  object.set({
    selectable: true,
    evented: true,
  });


  canvas.add(object);
 
  object.canvas = canvas;
  canvas.setActiveObject(object);

  canvas.renderAll();


  return {
    id: Date.now().toString(),
    name,
    object,
  };
}



export function removeCanvasObject(
  canvas: Canvas,
  object: FabricObject
) {

  canvas.remove(object);

  canvas.renderAll();

}



export function toggleObjectVisibility(
  object: FabricObject,
  visible: boolean
) {

  object.set({
    visible,
  });

}



export function lockCanvasObject(
  object: FabricObject,
  locked: boolean
) {

  object.set({
    selectable: !locked,
    evented: !locked,
  });

}