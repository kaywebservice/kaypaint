/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";

let workerConfigured = false;

/**
 * Import a PDF into the document: renders each page (up to `maxPages`) as an
 * image layer. Returns the number of pages imported.
 * pdfjs is loaded dynamically so it never runs during SSR/prerender.
 */
export async function importPDF(file: File, canvas: any, maxPages = 20): Promise<number> {
  if (!canvas) throw new Error("Canvas not ready");
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }

  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  const pageCount = Math.min(doc.numPages, maxPages);

  const { Image: FabricImage } = await import("fabric");
  let imported = 0;
  let maxW = 0;
  let maxH = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const out = document.createElement("canvas");
    out.width = Math.ceil(viewport.width);
    out.height = Math.ceil(viewport.height);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    await page.render({ canvas: out, viewport }).promise;

    const url = out.toDataURL("image/png");
    const img = await new Promise<any>((resolve, reject) => {
      FabricImage.fromURL(url)
        .then((i: any) => resolve(i))
        .catch(reject);
    });

    const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pageW = out.width;
    const pageH = out.height;
    img.set({
      left: i === 1 ? 0 : maxW + 40,
      top: 0,
      selectable: true,
      evented: true,
      kaypaintId: objectId,
    });
    img.setCoords();
    canvas.add(img);
    useLayerStore.getState().addCanvasLayer(`PDF p${i}`, objectId);

    maxW += pageW + 40;
    maxH = Math.max(maxH, pageH);
    imported++;
  }

  await loadingTask.destroy();
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
  return imported;
}
