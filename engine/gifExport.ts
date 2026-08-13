import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { applyTrack, seekAndApply } from "@/engine/animationEngine";
import { useAnimationStore } from "@/store/animationStore";
import { downloadDataURL } from "@/utils/imageUtils";

export async function exportGIF(
  canvas: any,
  options: { fps?: number; duration?: number; scale?: number } = {}
) {
  const fps = options.fps ?? useAnimationStore.getState().fps;
  const duration = options.duration ?? useAnimationStore.getState().duration;
  const scale = options.scale ?? 0.5;

  const state = useAnimationStore.getState();
  const tracks = state.tracks;
  if (!canvas || Object.keys(tracks).length === 0) {
    window.alert("Add keyframes in the Timeline first (select an object → + Keyframe).");
    return;
  }

  const width = Math.round(canvas.width * scale);
  const height = Math.round(canvas.height * scale);

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const octx = offscreen.getContext("2d")!;

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const frames = Math.max(2, duration);

  const prevTime = useAnimationStore.getState().time;

  for (let f = 0; f < frames; f++) {
    seekAndApply(f);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    const dataURL = canvas.toDataURL({
      format: "png",
      multiplier: scale,
    });

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("frame render failed"));
      img.src = dataURL;
    });

    octx.clearRect(0, 0, width, height);
    octx.drawImage(img, 0, 0, width, height);

    const { data } = octx.getImageData(0, 0, width, height);
    const rgba = new Uint8Array(data);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  }

  gif.finish();
  const bytes = gif.bytes();
  const bytesCopy = new Uint8Array(bytes);
  const blob = new Blob([bytesCopy], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, "kaypaint-animation.gif");
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  seekAndApply(prevTime);
  if (useAnimationStore.getState().playing) {
    (await import("@/engine/animationEngine")).startPlayback();
  }
}