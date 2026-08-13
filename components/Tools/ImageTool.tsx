import { FabricImage } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { fileToDataURL, nextObjectId } from "@/utils/imageUtils";
import { useLayerStore } from "@/store/layerStore";

export async function importImageFile(
  file: File,
  ctx?: ToolCtx | null
) {
  if (!file || !file.type.startsWith("image/")) return;
  const dataUrl = await fileToDataURL(file);
  await importImageDataURL(dataUrl, ctx);
}

export function importImageDataURL(
  dataUrl: string,
  ctx?: ToolCtx | null
): Promise<string | null> {
  return new Promise((resolve) => {
    const canvas = ctx?.canvas;
    if (!canvas) {
      resolve(null);
      return;
    }

    const el = new window.Image();

    el.onload = () => {
      const img = new FabricImage(el, {
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });

      const maxWidth = canvas.width - 40;
      const maxHeight = canvas.height - 40;

      if (img.width > maxWidth) img.scaleToWidth(maxWidth);
      if (img.height > maxHeight) img.scaleToHeight(maxHeight);

      const objectId = nextObjectId();
      img.set({ kaypaintId: objectId, left: 20, top: 20 });

      canvas.add(img);
      canvas.setActiveObject(img);
      img.setCoords();
      canvas.requestRenderAll();

      useLayerStore.getState().addCanvasLayer("Image", objectId);
      ctx?.push();
      resolve(objectId);
    };

    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      importImageFile(file, ctx).catch(() => {});
    }
    input.remove();
  };

  input.click();

  return () => {
    input.remove();
    canvas.requestRenderAll();
  };
}