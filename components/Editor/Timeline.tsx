"use client";

import { useEffect, useRef } from "react";
import {
  SkipBack,
  Play,
  Pause,
  Repeat,
  Plus,
  Minus,
  Film,
} from "lucide-react";
import {
  useAnimationStore,
  ALL_PROPS,
  trackKey,
  type Track,
} from "@/store/animationStore";
import { useLayerStore } from "@/store/layerStore";
import { useEditorStore } from "@/store/editorStore";
import type { EaseName } from "@/engine/keyframes";
import { startPlayback, seekAndApply, applyAll } from "@/engine/animationEngine";
import { exportGIF } from "@/engine/gifExport";
import { exportVideo } from "@/engine/videoExport";
import { useState } from "react";

const PX = 8;

export default function Timeline() {
  const playing = useAnimationStore((s) => s.playing);
  const loop = useAnimationStore((s) => s.loop);
  const time = useAnimationStore((s) => s.time);
  const fps = useAnimationStore((s) => s.fps);
  const duration = useAnimationStore((s) => s.duration);
  const tracks = useAnimationStore((s) => s.tracks);
  const selectedKey = useAnimationStore((s) => s.selectedKey);
  const mutedLayers = useAnimationStore((s) => s.mutedLayers);

  const selectedEase = (() => {
    if (!selectedKey) return "linear";
    const [trackId, timeStr] = selectedKey.split("@");
    const kf = tracks[trackId]?.keyframes.find(
      (k) => Math.abs(k.t - Number(timeStr)) < 0.001
    );
    return kf?.ease ?? "linear";
  })();

  const layers = useLayerStore((s) => s.layers);
  const activeLayer = useLayerStore((s) => s.activeLayer);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [videoExporting, setVideoExporting] = useState(false);

  useEffect(() => {
    if (playing) startPlayback();
  }, [playing]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, time * PX - 150);
    }
  }, [time]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName)) return;
      const hasSelection = !!useAnimationStore.getState().selectedKey;
      if ((e.key === "Delete" || e.key === "Backspace") && hasSelection) {
        useAnimationStore.getState().removeSelectedKey();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = layers.filter((l) => l.objectId);
  const activeObjectId = layers.find((l) => l.id === activeLayer)?.objectId;

  const addKeyframes = () => {
    if (!activeObjectId) return;
    useAnimationStore.getState().addKeyframes(activeObjectId);
    applyAll();
  };

  const removeSelected = () => {
    useAnimationStore.getState().removeSelectedKey();
  };

  const handleExportGIF = async () => {
    setExporting(true);
    try {
      await exportGIF(useEditorStore?.getState?.()?.canvas);
    } catch (err) {
      console.error(err);
      window.alert("GIF export failed: " + String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleExportVideo = async () => {
    setVideoExporting(true);
    try {
      await exportVideo(useEditorStore?.getState?.()?.canvas);
    } catch (err) {
      console.error(err);
      window.alert("Video export failed: " + String(err));
    } finally {
      setVideoExporting(false);
    }
  };

  const beginDrag = (
    e: React.PointerEvent<HTMLElement>,
    trackId?: string,
    t?: number
  ) => {
    if (trackId != null && t != null) {
      useAnimationStore.getState().selectKey(`${trackId}@${t}`);
      seekAndApply(t);
      return;
    }
    dragRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const c = scrollRef.current;
    if (!c) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekAndApply(Math.round((e.clientX - rect.left + c.scrollLeft) / PX));
  };

  const dragMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const c = scrollRef.current;
    if (!c) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekAndApply(Math.round((e.clientX - rect.left + c.scrollLeft) / PX));
  };

  const endDrag = () => {
    dragRef.current = false;
  };

  const cells = (t: number) => Math.round(t / 10) * 10 === t;

  return (
    <div className="flex flex-col min-h-40 bg-gray-900 shrink-0 border-t border-white/5">
      {/* Controls */}
      <div className="h-10 flex items-center gap-1 px-2 border-b border-white/5 bg-gray-950/70 flex-shrink-0">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-gradient uppercase tracking-wider pr-2">
          <Film size={13} /> Timeline
        </span>

        <button
          title="Back to start"
          onClick={() => seekAndApply(0)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300"
        >
          <SkipBack size={14} />
        </button>

        <button
          title={playing ? "Pause" : "Play"}
          onClick={() => useAnimationStore.getState().togglePlay()}
          className={
            "p-1.5 rounded-lg " +
            (playing
              ? "bg-indigo-500/30 text-white ring-1 ring-indigo-400/50"
              : "hover:bg-white/10 text-gray-200")
          }
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          title="Loop"
          onClick={() =>
            useAnimationStore.getState().setLoop(!loop)
          }
          className={
            "p-1.5 rounded-lg " +
            (loop
              ? "accent-active text-white shadow-md shadow-indigo-500/25"
              : "hover:bg-white/10 text-gray-400")
          }
        >
          <Repeat size={14} />
        </button>

        <span className="text-[11px] font-mono text-gray-300 px-2 whitespace-nowrap">
          {Math.floor(time)}f / {duration}f
          <span className="text-gray-500"> · {(time / fps).toFixed(2)}s</span>
        </span>

        <div className="flex items-center gap-1 ml-1">
          <span className="text-[10px] text-gray-500 uppercase">FPS</span>
          <select
            value={fps}
            onChange={(e) =>
              useAnimationStore.getState().setFps(Number(e.target.value))
            }
            className="text-[11px] px-1.5 py-0.5"
          >
            {[12, 24, 30, 60].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 uppercase">Dur</span>
          <select
            value={duration}
            onChange={(e) => {
              useAnimationStore.getState().setDuration(Number(e.target.value));
              seekAndApply(0);
            }}
            className="text-[11px] px-1.5 py-0.5"
          >
            {[30, 60, 120, 240, 480].map((v) => (
              <option key={v} value={v}>
                {v}f
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button
          title="Add keyframe at playhead (current values)"
          onClick={addKeyframes}
          disabled={!activeObjectId}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5"
        >
          <Plus size={12} />
          Keyframe
        </button>

        <button
          title="Delete selected keyframe"
          onClick={removeSelected}
          disabled={!selectedKey}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5"
        >
          <Minus size={12} />
          Del
        </button>

        {selectedKey && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500 uppercase">Ease</span>
            <select
              value={selectedEase}
              onChange={(e) => {
                const [trackId, timeStr] = selectedKey.split("@");
                useAnimationStore
                  .getState()
                  .setKeyframeEase(trackId, Number(timeStr), e.target.value as EaseName);
              }}
              className="text-[11px] px-1.5 py-0.5"
            >
              <option value="linear">Linear</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
              <option value="easeInOut">Ease In/Out</option>
            </select>
          </div>
        )}

        <span className="ml-auto text-[10px] text-gray-500 hidden xl:block">
          Drag on timeline to scrub · click ✦ to jump
        </span>

        <button
          title="Export the animation as a GIF"
          onClick={handleExportGIF}
          disabled={exporting || videoExporting}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold accent-gradient text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 disabled:opacity-50"
        >
          {exporting ? "Rendering…" : "Export GIF"}
        </button>

        <button
          title="Export the animation as an MP4/WebM video"
          onClick={handleExportVideo}
          disabled={videoExporting || exporting}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold accent-gradient text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 disabled:opacity-50"
        >
          {videoExporting ? "Rendering…" : "Export Video"}
        </button>
      </div>

      {/* Tracks */}
      <div className="flex-1 min-h-0 flex">
        {/* Labels */}
        <div
          ref={labelsRef}
          className="w-44 shrink-0 overflow-y-auto border-r border-white/5 bg-gray-900/60 scrollbar-thin"
        >
          {rows.map((layer) => (
            <div
              key={layer.id}
              className="h-7 flex items-center gap-2 px-2 border-b border-white/5 text-[11px] text-gray-300 truncate"
            >
              <button
                title={mutedLayers[layer.objectId!] ? "Unmute layer animation" : "Mute layer animation"}
                onClick={() => useAnimationStore.getState().toggleMuteLayer(layer.objectId!)}
                className={`shrink-0 w-4 text-center text-xs ${
                  mutedLayers[layer.objectId!] ? "text-gray-600" : "text-gray-400 hover:text-white"
                }`}
              >
                {mutedLayers[layer.objectId!] ? "×" : "◉"}
              </button>
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400 shrink-0" />
              <span className={`truncate ${mutedLayers[layer.objectId!] ? "text-gray-600" : ""}`}>
                {layer.name || "Layer"}
              </span>
            </div>
          ))}
        </div>

        {/* Lanes + ruler (share scroll) */}
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-auto scrollbar-thin"
          onScroll={(e) => {
            if (labelsRef.current) {
              labelsRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
        >
          <div
            style={{
              width: `${duration * PX}px`,
              minWidth: "100%",
              position: "relative",
            }}
          >
            {/* Ruler */}
            <div className="sticky top-0 z-10 bg-gray-900 h-7 relative border-b border-white/5 flex-shrink-0">
              {Array.from({ length: duration + 1 }).map((_, i) => (
                <div key={i} className="absolute" style={{ left: i * PX }}>
                  <div
                    className={
                      cells(i)
                        ? "w-px h-2 bg-gray-500"
                        : "w-px h-1 bg-gray-700"
                    }
                  />
                  {cells(i) && i > 0 && (
                    <span className="absolute top-1.5 left-0.5 text-[8px] text-gray-500">
                      {i}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Lanes */}
            {rows.map((layer) => {
              const objTracks = ALL_PROPS.map((prop) => {
                const tr: Track | undefined = tracks[trackKey(layer.objectId!, prop)];
                return { prop, track: tr, kfs: tr?.keyframes ?? [] };
              });
              const anyKfs = objTracks.some((o) => o.kfs.length > 0);

              return (
                <div
                  key={layer.id}
                  className="h-7 relative border-b border-white/5 group"
                  onPointerDown={(e) => beginDrag(e)}
                  onPointerMove={(e) => dragMove(e)}
                  onPointerUp={endDrag}
                >
                  {objTracks.map(
                    ({ prop, kfs }) =>
                      kfs.length > 0 &&
                      kfs.map((k) => {
                        const selected =
                          selectedKey === `${trackKey(layer.objectId!, prop)}@${k.t}`;
                        return (
                          <button
                            key={`${prop}:${k.t}`}
                            className={`kf-diamond absolute w-2 h-2 rotate-45 rounded-[1px] border pointer-events-auto ${
                              selected
                                ? "bg-amber-400 border-amber-200 shadow-[0_0_6px_rgba(251,191,36,0.9)]"
                                : "bg-indigo-400 border-indigo-200/70 hover:bg-indigo-300"
                            }`}
                            style={{
                              left: k.t * PX - 4,
                              top: 10,
                            }}
                            title={`${prop} @ ${Math.floor(k.t)}f = ${
                              Math.round(k.v * 100) / 100
                            }`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              beginDrag(e, trackKey(layer.objectId!, prop), k.t);
                            }}
                          />
                        );
                      })
                  )}

                  {!anyKfs && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      ✦ click + to add keyframes
                    </span>
                  )}
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-gray-500">
                Add an object to the canvas, select it, then press
                <span className="px-1 font-semibold text-indigo-300">+ Keyframe</span>
                to animate
              </div>
            )}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#f0435c] z-20 pointer-events-none shadow-[0_0_6px_rgba(240,67,92,0.8)]"
              style={{ left: time * PX }}
            >
              <div className="absolute top-0 -left-[4px] w-[10px] h-[10px] bg-[#f0435c] rounded-[1px] rotate-45" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}