/* eslint-disable @typescript-eslint/no-explicit-any */
import { seekAndApply } from "@/engine/animationEngine";
import { useAnimationStore } from "@/store/animationStore";
import { downloadDataURL } from "@/utils/imageUtils";
import {
  extForMime,
  normalizeVideoOpts,
  pickVideoMime,
  videoFileName,
  type VideoExportOpts,
} from "@/engine/videoExportCore";

async function captureFrameTo(
  canvas: any,
  octx: CanvasRenderingContext2D,
  scale: number,
  width: number,
  height: number
) {
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
}

export async function exportVideo(
  canvas: any,
  options: VideoExportOpts = {}
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    !window.MediaRecorder
  ) {
    window.alert("Video export is not supported in this browser.");
    return false;
  }

  const state = useAnimationStore.getState();
  const tracks = state.tracks;
  if (!canvas || Object.keys(tracks).length === 0) {
    window.alert("Add keyframes in the Timeline first (select an object → + Keyframe).");
    return false;
  }

  const opts = normalizeVideoOpts(options);
  const mime = pickVideoMime((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) {
    window.alert("No supported video encoding found in this browser.");
    return false;
  }

  const width = Math.round(canvas.width * opts.scale);
  const height = Math.round(canvas.height * opts.scale);

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const octx = offscreen.getContext("2d")!;

  let stream: MediaStream;
  try {
    stream = offscreen.captureStream(opts.fps);
  } catch {
    window.alert("Frame capture is not supported in this browser.");
    return false;
  }

  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const prevTime = useAnimationStore.getState().time;

  try {
    recorder.start(250);
    for (let f = 0; f < opts.frameCount; f++) {
      seekAndApply(f);
      await captureFrameTo(canvas, octx, opts.scale, width, height);
    }
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
  } catch (err) {
    if (recorder.state !== "inactive") recorder.stop();
    seekAndApply(prevTime);
    throw err;
  }

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, videoFileName(extForMime(mime)));
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  seekAndApply(prevTime);
  if (useAnimationStore.getState().playing) {
    (await import("@/engine/animationEngine")).startPlayback();
  }
  return true;
}