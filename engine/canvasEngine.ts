export function getPointer(canvas: any, event: any) {
  if (typeof canvas.getScenePoint === "function") {
    return canvas.getScenePoint(event);
  }
  return canvas.getPointer(event);
}

export function setZoomAtPoint(
  canvas: any,
  event: any,
  factor: number
) {
  const point = getPointer(canvas, event);
  const current = canvas.getZoom() * factor;
  canvas.zoomToPoint(point, current);
  canvas.requestRenderAll();
}

export function applyInteractionDefaults(canvas: any) {
  canvas.uniScaleKey = "shiftKey";
  canvas.centeredKey = "altKey";
}

export function getViewportCenter(canvas: any) {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
  };
}

export function findObjectUnderPointer(canvas: any, event: any) {
  const info = canvas.findTarget?.(event);
  if (!info) return null;
  if (info.target) return info.target;
  return info;
}