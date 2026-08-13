/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";

async function loadOpenCVFromCDN(timeoutMs = 8000): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("OpenCV only available in browser");
  }
  if ((window as any).cv) {
    return (window as any).cv;
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Timed out loading OpenCV from CDN")),
      timeoutMs
    );
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.onload = () => {
      const cv = (window as any).cv;
      if (cv) {
        window.clearTimeout(timer);
        resolve(cv);
      } else reject(new Error("OpenCV failed to load"));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Could not load OpenCV from CDN"));
    };
    document.head.appendChild(script);
  });
}

/**
 * Pure-JS inpaint path (offline / no OpenCV). Fills the masked region from
 * surrounding pixels. Runs in a Web Worker when available so the UI never
 * blocks on large canvases.
 */
async function inpaintLocally(
  fullCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const cw = fullCanvas.width;
  const ch = fullCanvas.height;
  const fg = fullCanvas.getContext("2d")!;
  const src = fg.getImageData(0, 0, cw, ch);
  const mg = maskCanvas.getContext("2d")!;
  const maskImg = mg.getImageData(0, 0, cw, ch);
  const mask = new Uint8ClampedArray(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    mask[i] = maskImg.data[i * 4] > 16 ? 255 : 0;
  }
  const { px } = await import("@/engine/pixelWorkerClient");
  const filled = await px.inpaint(src.data, mask, cw, ch);
  const out = new ImageData(new Uint8ClampedArray(filled), cw, ch);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  c.getContext("2d")!.putImageData(out, 0, 0);
  return c;
}

/**
 * Photoshop-style Content-Aware Fill using OpenCV Telea inpainting.
 * The active object (lasso / marquee / pen / shape) is used as the fill region.
 */
export async function contentAwareFill(
  canvas: any,
  radius = 10
): Promise<boolean> {
  if (!canvas) throw new Error("Canvas not ready");

  const region = canvas.getActiveObject();
  if (!region) throw new Error("Select a region first (lasso / marquee / shape)");

  const cv = await loadOpenCVFromCDN().catch(() => null);

  const cw = canvas.width;
  const ch = canvas.height;

  const maskRender = region.toCanvasElement({
    multiplier: 1,
    width: Math.max(1, Math.round(region.getBoundingRect().width)),
    height: Math.max(1, Math.round(region.getBoundingRect().height)),
  });

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = cw;
  maskCanvas.height = ch;
  const mg = maskCanvas.getContext("2d")!;
  const bb = region.getBoundingRect();
  mg.drawImage(maskRender, bb.left, bb.top);

  const flatCanvas = canvas.toCanvasElement({ multiplier: 1 });
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = cw;
  fullCanvas.height = ch;
  const fg = fullCanvas.getContext("2d")!;
  fg.drawImage(flatCanvas, 0, 0);

  let outCanvas: HTMLCanvasElement;
  if (cv) {
    const src = cv.imread(fullCanvas);
    const mask = cv.imread(maskCanvas);
    const gray = new cv.Mat();
    cv.cvtColor(mask, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(gray, gray, 16, 255, cv.THRESH_BINARY);

    const dst = new cv.Mat();
    cv.inpaint(src, gray, dst, radius, cv.INPAINT_TELEA);

    outCanvas = document.createElement("canvas");
    outCanvas.width = cw;
    outCanvas.height = ch;
    cv.imshow(outCanvas, dst);

    src.delete();
    mask.delete();
    gray.delete();
    dst.delete();
  } else {
    // Offline / OpenCV unavailable: use the pure-JS inpaint fallback.
    outCanvas = await inpaintLocally(fullCanvas, maskCanvas);
  }

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = cw;
  resultCanvas.height = ch;
  const rg = resultCanvas.getContext("2d")!;
  rg.drawImage(fullCanvas, 0, 0);
  rg.drawImage(outCanvas, 0, 0);
  rg.globalCompositeOperation = "destination-in";
  rg.drawImage(maskCanvas, 0, 0);
  rg.globalCompositeOperation = "source-over";

  const url = resultCanvas.toDataURL("image/png");
  if (url.length < 5000) {
    throw new Error("Content-aware fill produced no result");
  }

  const { Image: FabricImage } = await import("fabric");
  const img = await new Promise<any>((resolve, reject) => {
    FabricImage.fromURL(url, {}, {})
      .then((i: any) => resolve(i))
      .catch(reject);
  });

  const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
    kaypaintId: objectId,
  });
  img.setCoords();
  canvas.insertAt(0, img);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  useLayerStore.getState().addCanvasLayer("Content-Aware Fill", objectId);
  useEditorStore.getState().history?.push?.();
  return true;
}