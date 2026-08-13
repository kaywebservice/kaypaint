const NORMAL = "source-over";

export function toComposite(mode: string) {
  if (!mode || mode === "normal" || mode === "source-over") {
    return NORMAL;
  }
  return mode;
}

export function applyBlendMode(object: any, mode: string) {
  if (!object) return;
  object.set({
    globalCompositeOperation: toComposite(mode),
  });
  object.canvas?.requestRenderAll();
}

export async function exportDataURL(
  canvas: any,
  type: string = "image/png",
  quality: number = 1
): Promise<string> {
  return canvas.toDataURL({ format: type.indexOf("image/") === 0 ? type.slice(6) : type, quality });
}