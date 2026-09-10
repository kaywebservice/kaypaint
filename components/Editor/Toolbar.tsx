"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Move, MousePointer, Focus, Brush, Pencil, Eraser, Type, Square, PaintBucket, Blend, Crop, ZoomIn, Hand, Pipette, Eclipse, SunMedium, Lasso, Wand, PenTool, Droplet, Copy, Zap, Sparkles, Eye, Target, Frame, Scissors, Activity, RotateCw, Flame, WavesLadder, TextCursorInput } from "lucide-react";
import tools from "@/store/toolRegistry";
import { getBinding } from "@/engine/shortcuts";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { usePluginHostStore } from "@/store/pluginHostStore";
import { getPluginManager } from "@/engine/pluginRuntime";
import { toggleQuickMask } from "@/engine/selectOps";

const icons: Record<string, any> = {
  move: Move,
  select: MousePointer,
  marquee: Focus,
  lasso: Lasso,
  wand: Wand,
  brush: Brush,
  pencil: Pencil,
  eraser: Eraser,
  heal: Droplet,
  clone: Copy,
  spotHeal: Sparkles,
  text: Type,
  vText: Type,
  shape: Square,
  pen: PenTool,
  bucket: PaintBucket,
  gradient: Blend,
  crop: Crop,
  zoom: ZoomIn,
  hand: Hand,
  color: Pipette,
  dodge: Zap,
  burn: Flame,
  sponge: Droplet,
  smudge: Activity,
  sharpen: Zap,
  blur: Eclipse,
  brightness: SunMedium,
  quickMask: Eye,
  measure: Target,
  slice: Scissors,
  frame: Frame,
  liquify: WavesLadder,
  textOnPath: TextCursorInput,
  magicEraser: Eraser,
  backgroundEraser: Eraser,
  colorReplacement: Brush,
  historyBrush: Brush,
  artHistoryBrush: Brush,
  mixerBrush: Brush,
  patternStamp: Copy,
  patch: Droplet,
  redEye: Droplet,
  quickSelection: Wand,
  objectSelection: Wand,
  rotateView: RotateCw,
  notes: Type,
  count: Target,
};

/** Photoshop-style tool groups (each becomes a flyout). */
const TOOL_GROUPS: { label: string; tools: string[] }[] = [
  { label: "Move", tools: ["move"] },
  { label: "Marquee", tools: ["marquee"] },
  { label: "Lasso", tools: ["lasso", "polygonalLasso", "magneticLasso"] },
  { label: "Object Selection", tools: ["quickSelection", "objectSelection", "wand"] },
  { label: "Path Selection", tools: ["select"] },
  { label: "Crop", tools: ["crop", "slice"] },
  { label: "Frame", tools: ["frame"] },
  { label: "Eyedropper", tools: ["color", "measure", "notes", "count"] },
  { label: "Healing", tools: ["heal", "spotHeal", "patch", "redEye"] },
  { label: "Brush", tools: ["brush", "pencil", "mixerBrush", "colorReplacement"] },
  { label: "Clone Stamp", tools: ["clone", "patternStamp"] },
  { label: "History Brush", tools: ["historyBrush", "artHistoryBrush"] },
  { label: "Eraser", tools: ["eraser", "magicEraser", "backgroundEraser"] },
  { label: "Gradient", tools: ["gradient", "bucket"] },
  { label: "Blur / Sharpen / Smudge", tools: ["blur", "sharpen", "smudge"] },
  { label: "Dodge / Burn / Sponge", tools: ["dodge", "burn", "sponge"] },
  { label: "Pen", tools: ["pen"] },
  { label: "Type", tools: ["text", "vText"] },
  { label: "Text on Path", tools: ["textOnPath"] },
  { label: "Shape", tools: ["shape"] },
  { label: "Liquify", tools: ["liquify"] },
  { label: "Adjust", tools: ["brightness"] },
  { label: "Hand", tools: ["hand", "rotateView"] },
  { label: "Zoom", tools: ["zoom"] },
];

const toolById = (id: string) => tools.find((t) => t.id === id);

interface Flyout {
  groupLabel: string;
  x: number;
  y: number;
}

export default function Toolbar() {
  const setTool = useEditorStore((state) => state.setTool);
  const activeTool = useEditorStore((state) => state.activeTool);
  const hiddenTools = useSettingsStore((state) => state.hiddenTools);
  const pluginButtons = usePluginHostStore((state) => state.toolbarButtons);

  // The last-selected tool per group (defaults to the group's first tool).
  const [shown, setShown] = useState<Record<string, string>>(() =>
    Object.fromEntries(TOOL_GROUPS.map((g) => [g.label, g.tools[0]]))
  );
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close the flyout on outside click / Escape.
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setFlyout(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyout(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  const openFlyout = (group: { label: string; tools: string[] }, anchor: HTMLButtonElement) => {
    const rect = anchor.getBoundingClientRect();
    const visible = group.tools.filter((id) => !hiddenTools.includes(id));
    const height = Math.min(320, 40 + visible.length * 34);
    const y = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - height - 8));
    setFlyout({ groupLabel: group.label, x: rect.left, y });
  };

  const select = (id: string) => {
    setTool(id as any);
    const group = TOOL_GROUPS.find((g) => g.tools.includes(id));
    if (group) {
      setShown((prev) => (prev[group.label] === id ? prev : { ...prev, [group.label]: id }));
    }
    setFlyout(null);
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-1">
      {TOOL_GROUPS.map((group) => {
        const visibleTools = group.tools.filter((id) => !hiddenTools.includes(id));
        if (visibleTools.length === 0) return null;
        // Show the active tool when this group owns it (covers keyboard
        // switches), otherwise the last tool chosen from this group.
        const shownId =
          activeTool && group.tools.includes(activeTool)
            ? activeTool
            : visibleTools.includes(shown[group.label])
              ? shown[group.label]
              : visibleTools[0];
        const Icon = icons[shownId];
        const active = activeTool === shownId;
        const multi = visibleTools.length > 1;

        return (
          <div key={group.label} className="relative w-full">
            <button
              onClick={(e) => {
                if (multi) {
                  if (flyout?.groupLabel === group.label) setFlyout(null);
                  else openFlyout(group, e.currentTarget);
                } else {
                  select(shownId);
                }
              }}
              title={`${toolById(shownId)?.name ?? shownId}${multi ? ` (${group.label})` : ""} · ${getBinding(shownId) || ""}`}
              className={
                "relative w-full h-9 px-2 rounded-lg flex items-center gap-2 border transition-all duration-150 " +
                (active
                  ? "accent-active text-white border-transparent"
                  : "bg-gray-800 text-gray-300 border-transparent hover:bg-gray-700 hover:text-white hover:border-white/5")
              }
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-gradient-to-b from-indigo-300 to-fuchsia-400 shadow-[0_0_8px_rgba(139,92,246,0.9)]" />
              )}
              {Icon && <Icon size={17} className={active ? "text-white shrink-0" : "text-gray-400 shrink-0"} />}
              <span className="flex-1 truncate text-left">{toolById(shownId)?.name ?? shownId}</span>
              {multi && (
                <ChevronDown
                  size={12}
                  className={"shrink-0 " + (active ? "text-indigo-200" : "text-gray-500")}
                />
              )}
            </button>
          </div>
        );
      })}

      {pluginButtons.length > 0 && (
        <>
          <div className="my-1 w-8 h-px bg-white/10" />
          {pluginButtons.map(({ pluginId, config }) => {
            const Icon = icons[config.icon as string] ?? Sparkles;
            return (
              <button
                key={`${pluginId}-${config.id}`}
                title={config.tooltip}
                onClick={() => {
                  const ctx = getPluginManager().getContext(pluginId);
                  if (ctx) config.onClick(ctx);
                }}
                className="w-full h-9 px-2 rounded-lg flex items-center gap-2 bg-gray-800 text-indigo-300 border border-transparent hover:bg-gray-700 hover:text-indigo-200 hover:border-white/5"
              >
                <Icon size={17} className="text-indigo-400 shrink-0" />
                <span className="flex-1 truncate text-left">{config.tooltip}</span>
              </button>
            );
          })}
        </>
      )}

      {/* Quick Mask mode toggle — Photoshop keeps this at the toolbar footer. */}
      <div className="mt-auto pt-1">
        <div className="my-1 w-8 h-px bg-white/10 mx-auto" />
        <button
          title="Edit in Quick Mask Mode (Q)"
          onClick={() => toggleQuickMask()}
          className={
            "w-full h-9 px-2 rounded-lg flex items-center gap-2 border transition-all duration-150 " +
            (activeTool === "quickMask"
              ? "accent-active text-white border-transparent"
              : "bg-gray-800 text-gray-400 border-transparent hover:bg-gray-700 hover:text-white hover:border-white/5")
          }
        >
          <Eye size={17} className={activeTool === "quickMask" ? "text-white shrink-0" : "shrink-0"} />
          <span className="flex-1 truncate text-left">Quick Mask</span>
        </button>
      </div>

      {flyout && (
        <div
          ref={panelRef}
          className="fixed w-52 rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur shadow-2xl shadow-black/60 py-1 z-[150]"
          style={{ left: flyout.x, top: flyout.y }}
        >
          {(() => {
            const group = TOOL_GROUPS.find((g) => g.label === flyout.groupLabel);
            if (!group) return null;
            return group.tools
              .filter((id) => !hiddenTools.includes(id))
              .map((id) => {
                const t = toolById(id);
                const Icon = icons[id];
                const isActive = activeTool === id;
                return (
                  <button
                    key={id}
                    onClick={() => select(id)}
                    className={
                      "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors " +
                      (isActive
                        ? "bg-indigo-500/20 text-white border-l-2 border-indigo-400"
                        : "text-gray-300 border-l-2 border-transparent hover:bg-white/5 hover:text-white")
                    }
                  >
                    {Icon && <Icon size={15} className={isActive ? "text-white" : "text-gray-400"} />}
                    <span className="flex-1 truncate">{t?.name ?? id}</span>
                    <span className="text-[10px] text-gray-500">{getBinding(id)}</span>
                  </button>
                );
              });
          })()}
        </div>
      )}
    </div>
  );
}
