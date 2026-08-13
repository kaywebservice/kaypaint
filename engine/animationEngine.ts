/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useAnimationStore,
  type Track,
  type Keyframe,
  type TimingProp,
} from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { interpolate } from "@/engine/keyframes";

let rafId: number | null = null;
let lastTs = 0;

export type FrameListener = (frame: number) => void;
const frameListeners: FrameListener[] = [];
export function onFrame(fn: FrameListener): void {
  frameListeners.push(fn);
}

function emitFrame() {
  if (frameListeners.length === 0) return;
  const t = useAnimationStore.getState().time;
  for (const fn of frameListeners.slice()) fn(t);
}

function interp(keyframes: Keyframe[], time: number): number | null {
  return interpolate(keyframes, time);
}

export function applyTrack(canvas: any, track: Track, time: number) {
  const value = interp(track.keyframes, time);
  if (value == null || !canvas) return;
  const obj = canvas
    .getObjects()
    .find((o: any) => o.kaypaintId === track.objectId);
  if (!obj) return;

  switch (track.prop) {
    case "left":
      obj.set({ left: value });
      obj.setCoords?.();
      break;
    case "top":
      obj.set({ top: value });
      obj.setCoords?.();
      break;
    case "opacity":
      obj.set({ opacity: value });
      break;
    case "scaleX":
      obj.set({ scaleX: value, scaleY: value });
      break;
    case "angle":
      obj.set({ angle: value });
      obj.setCoords?.();
      break;
  }
}

export function applyAll() {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const { tracks, time, mutedLayers } = useAnimationStore.getState();
  for (const track of Object.values(tracks)) {
    if (mutedLayers?.[track.objectId]) continue;
    applyTrack(canvas, track, time);
  }
  canvas.requestRenderAll();
  emitFrame();
}

export function seekAndApply(frame: number) {
  const { duration } = useAnimationStore.getState();
  const t = Math.max(0, Math.min(frame, duration));
  useAnimationStore.setState({ time: t });
  applyAll();
}

export function startPlayback() {
  if (rafId != null) return;
  lastTs = performance.now();

  const frame = () => {
    const state = useAnimationStore.getState();
    if (!state.playing) {
      rafId = null;
      return;
    }

    const now = performance.now();
    const deltaFrames = ((now - lastTs) / 1000) * state.fps;
    lastTs = now;

    let t = state.time + deltaFrames;
    if (t >= state.duration) {
      if (state.loop) {
        t = t % state.duration;
      } else {
        useAnimationStore.setState({ playing: false, time: state.duration });
        applyAll();
        rafId = null;
        return;
      }
    }

    useAnimationStore.setState({ time: Math.min(t, state.duration) });
    applyAll();
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
}

export function stopPlayback() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function trackHasKeyframes(
  tracks: Record<string, Track>,
  objectId: string,
  prop: TimingProp
): Track | undefined {
  return tracks[`${objectId}:${prop}`];
}