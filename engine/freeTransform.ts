import { useEditorStore } from "@/store/editorStore";

function rotatePoint(p: { x: number; y: number }, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad),
  };
}

export function applyTransformStyle(obj: any, on: boolean) {
  if (on) {
    obj.set({
      cornerColor: "#8a95fb",
      cornerStrokeColor: "#c7cdff",
      cornerStyle: "circle",
      transparentCorners: false,
      borderColor: "#6366f1",
      borderScaleFactor: 2,
      borderDashArray: [6, 4],
      lockUniScaling: false,
      hoverCursor: "move",
    });
  } else {
    obj.set({
      cornerColor: undefined,
      cornerStrokeColor: undefined,
      cornerStyle: "circle",
      transparentCorners: true,
      borderColor: "rgba(102,153,255,0.75)",
      borderScaleFactor: 1,
      borderDashArray: null,
    });
  }
}

export function toggleFreeTransform(canvas: any, object: any) {
  if (!canvas || !object) return;
  object.freeTransformOn = !object.freeTransformOn;
  applyTransformStyle(object, object.freeTransformOn);
  useEditorStore.getState().setTransformObject(
    object.freeTransformOn ? object.kaypaintId ?? object.id ?? null : null
  );
  canvas.requestRenderAll();
}

export function exitAllFreeTransforms(canvas: any) {
  if (!canvas) return;
  for (const obj of canvas.getObjects()) {
    if (obj.freeTransformOn) {
      applyTransformStyle(obj, false);
      obj.freeTransformOn = false;
    }
  }
  useEditorStore.getState().setTransformObject(null);
  canvas.requestRenderAll();
}

export function getPivotScene(obj: any) {
  if (obj?.freePivotScene) return obj.freePivotScene;
  return obj?.getCenterPoint?.() ?? { x: 0, y: 0 };
}

export function handleTransformStart(canvas: any, event: any) {
  const obj = event.target;
  if (!obj?.freeTransformOn || !obj.freePivotScene) return;
  obj.__transformStart = {
    center: obj.getCenterPoint(),
    angle: obj.angle ?? 0,
    pivot: { x: obj.freePivotScene.x, y: obj.freePivotScene.y },
  };
}

export function handleTransformRotate(canvas: any, event: any) {
  const obj = event.target;
  if (!obj?.freeTransformOn) return;
  const start = obj.__transformStart;
  if (!start) return;

  const dAngle = (obj.angle ?? 0) - start.angle;
  const delta = rotatePoint(
    { x: start.center.x - start.pivot.x, y: start.center.y - start.pivot.y },
    dAngle
  );
  obj.setPositionByOrigin(
    { x: start.pivot.x + delta.x, y: start.pivot.y + delta.y },
    "center",
    "center"
  );
  obj.setCoords();
}

export function handleTransformEnd(canvas: any, event: any) {
  const obj = event.target;
  if (!obj) return;
  delete obj.__transformStart;
  obj.setCoords?.();
}