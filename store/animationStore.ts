/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { useEditorStore } from "@/store/editorStore";
import type { EaseName } from "@/engine/keyframes";

export type TimingProp = "left" | "top" | "opacity" | "scaleX" | "angle";

export interface Keyframe {
  t: number;
  v: number;
  ease?: EaseName;
}

export interface Track {
  objectId: string;
  prop: TimingProp;
  keyframes: Keyframe[];
}

export const ALL_PROPS: TimingProp[] = ["left", "top", "opacity", "scaleX", "angle"];

export const trackKey = (objectId: string, prop: TimingProp) =>
  `${objectId}:${prop}`;

interface AnimationState {
  playing: boolean;
  loop: boolean;
  time: number;
  fps: number;
  duration: number;
  tracks: Record<string, Track>;
  selectedKey: string | null;
  mutedLayers: Record<string, boolean>;

  togglePlay: () => void;
  stop: () => void;
  seekTo: (frame: number) => void;
  setLoop: (value: boolean) => void;
  setFps: (value: number) => void;
  setDuration: (value: number) => void;
  addKeyframes: (objectId: string) => void;
  removeSelectedKey: () => void;
  setKeyframeEase: (trackId: string, time: number, ease: EaseName) => void;
  toggleMuteLayer: (objectId: string) => void;
  selectKey: (id: string | null) => void;
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  playing: false,
  loop: false,
  time: 0,
  fps: 24,
  duration: 120,
  tracks: {},
  selectedKey: null,
  mutedLayers: {},

  togglePlay: () => {
    const { playing } = get();
    set({ playing: !playing });
  },

  stop: () => {
    set({ playing: false, time: 0, selectedKey: null });
  },

  seekTo: (frame) => {
    const { duration } = get();
    set({ time: Math.max(0, Math.min(frame, duration)) });
  },

  setLoop: (loop) => set({ loop }),

  setFps: (fps) => set({ fps }),

  setDuration: (duration) => {
    const { time } = get();
    set({
      duration,
      time: Math.min(time, duration),
      selectedKey: null,
    });
  },

  addKeyframes: (objectId) => {
    const state = get();
    const canvas = useEditorStore.getState().canvas;
    const obj = canvas
      ?.getObjects()
      .find((o: any) => o.kaypaintId === objectId);
    if (!obj) return;

    const valueOf = (prop: TimingProp): number =>
      prop === "left"
        ? obj.left ?? 0
        : prop === "top"
          ? obj.top ?? 0
          : prop === "opacity"
            ? (obj.opacity ?? 1)
            : prop === "scaleX"
              ? (obj.scaleX ?? 1)
              : (obj.angle ?? 0);

    const tracks = { ...state.tracks };
    for (const prop of ALL_PROPS) {
      const id = trackKey(objectId, prop);
      const current = state.time;
      const existing = tracks[id]?.keyframes.some(
        (k) => Math.abs(k.t - current) < 0.001
      );
      if (existing) continue;
      const kf: Keyframe = { t: current, v: valueOf(prop) };
      if (tracks[id]) {
        tracks[id] = {
          ...tracks[id],
          keyframes: [...tracks[id].keyframes, kf].sort(
            (a, b) => a.t - b.t
          ),
        };
      } else {
        tracks[id] = { objectId, prop, keyframes: [kf] };
      }
    }

    set({ tracks });
  },

  removeSelectedKey: () => {
    const state = get();
    if (!state.selectedKey) return;
    const [id, timeStr] = state.selectedKey.split("@");
    const t = Number(timeStr);
    const track = state.tracks[id];
    if (!track) {
      set({ selectedKey: null });
      return;
    }
    const tracks = {
      ...state.tracks,
      [id]: {
        ...track,
        keyframes: track.keyframes.filter(
          (k) => Math.abs(k.t - t) > 0.001
        ),
      },
    };
    set({ tracks, selectedKey: null });
  },

  selectKey: (id) => set({ selectedKey: id }),

  toggleMuteLayer: (objectId) => {
    const mutedLayers = { ...get().mutedLayers, [objectId]: !get().mutedLayers[objectId] };
    set({ mutedLayers });
  },

  setKeyframeEase: (trackId, time, ease) => {
    const state = get();
    const track = state.tracks[trackId];
    if (!track) return;
    set({
      tracks: {
        ...state.tracks,
        [trackId]: {
          ...track,
          keyframes: track.keyframes.map((k) =>
            Math.abs(k.t - time) < 0.001 ? { ...k, ease } : k
          ),
        },
      },
    });
  },
}));