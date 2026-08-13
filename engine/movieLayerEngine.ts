/* eslint-disable @typescript-eslint/no-explicit-any */
import { FabricImage } from "fabric";
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";
import { useAnimationStore } from "@/store/animationStore";
import { onFrame } from "@/engine/animationEngine";
import {
  frameToClipTime,
  normalizeClip,
  type VideoClip,
} from "@/engine/videoClipCore";
import { nextObjectId } from "@/utils/imageUtils";

let frameSyncRegistered = false;

function isMovieObject(o: any): boolean {
  return !!o?.element && o.element instanceof HTMLVideoElement;
}

function ensureFrameSync() {
  if (frameSyncRegistered) return;
  frameSyncRegistered = true;
  onFrame((frame) => syncMovieObjects(frame));
}

/** Advance every movie layer's <video> to match the timeline clock. */
export function syncMovieObjects(frame: number) {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const fps = useAnimationStore.getState().fps || 30;
  for (const o of canvas.getObjects() as any[]) {
    if (!isMovieObject(o)) continue;
    const clip = o.movieClip as VideoClip | undefined;
    if (!clip) continue;
    const video = o.element as HTMLVideoElement;
    const t = frameToClipTime(frame, fps, clip);
    if (Math.abs(video.currentTime - t) > 0.05) video.currentTime = t;
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }
  }
}

async function loadDuration(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: number) => {
      if (settled) return;
      settled = true;
      video.onloadedmetadata = null;
      video.onerror = null;
      resolve(v);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : 0);
    video.onerror = () => done(0);
    video.preload = "metadata";
  });
}

export async function placeVideoClip(file: File, canvas: any): Promise<boolean> {
  if (
    !file ||
    (!/^(video\/)/.test(file.type) && !/\.(mp4|webm|mov|ogv|m4v)$/i.test(file.name || ""))
  ) {
    window.alert("Please pick a video file (MP4/WebM/MOV).");
    return false;
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.loop = true;

  video.style.position = "fixed";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  const duration = await loadDuration(video);
  video.remove();

  if (duration <= 0) {
    URL.revokeObjectURL(url);
    window.alert("Could not read the video duration. The file may be unsupported.");
    return false;
  }

  const clip = normalizeClip({ in: 0, out: duration, speed: 1, duration });
  if (!clip) {
    URL.revokeObjectURL(url);
    return false;
  }

  const obj = new FabricImage(video, {
    left: canvas.width / 2,
    top: canvas.height / 2,
    originX: "center",
    originY: "center",
    selectable: true,
  });
  const id = nextObjectId();
  obj.set({ kaypaintId: id, movieClip: clip });
  canvas.add(obj);
  canvas.setActiveObject(obj);
  obj.setCoords();
  canvas.requestRenderAll();

  useLayerStore.getState().addCanvasLayer(file.name || "Video Layer", id);
  ensureFrameSync();
  return true;
}

export function placeVideoClipDialog(canvas: any): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*,.mp4,.webm,.mov,.ogv,.m4v";
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void placeVideoClip(f, canvas);
  };
  input.click();
}