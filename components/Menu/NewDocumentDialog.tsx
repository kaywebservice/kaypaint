"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { syncCanvasSizeStore } from "@/engine/canvasSizeEngine";

const PRESETS = [
  { label: "Web", w: 1920, h: 1080 },
  { label: "HD", w: 1280, h: 720 },
  { label: "Instagram", w: 1080, h: 1080 },
  { label: "Square", w: 1024, h: 1024 },
  { label: "A4", w: 2480, h: 3508 },
  { label: "Letter", w: 2550, h: 3300 },
];

export default function NewDocumentDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("Untitled-1");
  const [wStr, setWStr] = useState("1920");
  const [hStr, setHStr] = useState("1080");
  const [bg, setBg] = useState<"white" | "transparent" | "color">("white");
  const [bgColor, setBgColor] = useState("#ffffff");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const w = parseInt(wStr) || 0;
  const h = parseInt(hStr) || 0;
  const ok = w >= 1 && h >= 1 && w <= 20000 && h <= 20000;

  const create = () => {
    if (!ok) return;
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;

    canvas.getObjects().forEach((o: any) => canvas.remove(o));
    canvas.setDimensions({ width: w, height: h });
    canvas.backgroundColor = bg === "transparent" ? "transparent" : bg === "color" ? bgColor : "white";
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    syncCanvasSizeStore(canvas);
    useEditorStore.getState().history?.reset?.();
    useEditorStore.getState().clearGuides?.();
    useEditorStore.getState().history?.reset?.();

    import("@/store/layerStore").then(({ useLayerStore: ls }) => {
      ls.setState({ layers: [], activeLayer: null, groups: [] });
    });
    import("@/store/documentStore").then(({ useDocStore }) => {
      useDocStore.getState().renameDoc(useDocStore.getState().activeDocId, name.trim() || "Untitled-1");
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="w-[440px] rounded-2xl bg-[#161b26] border border-white/10 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-100 tracking-wide">New Document</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="flex flex-col gap-1 text-[11px] text-gray-400">
            Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
            />
          </label>

          <div>
            <div className="text-xs font-medium text-gray-300 mb-2">Presets</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setWStr(String(p.w));
                    setHStr(String(p.h));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                    w === p.w && h === p.h
                      ? "bg-indigo-500/20 border-indigo-400 text-white"
                      : "bg-[#0d121c] border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/25"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-gray-400">
              Width (px)
              <input
                type="number"
                value={wStr}
                onChange={(e) => setWStr(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-gray-400">
              Height (px)
              <input
                type="number"
                value={hStr}
                onChange={(e) => setHStr(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-300 mb-2">Background Contents</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  ["white", "White", "#ffffff"],
                  ["transparent", "Transparent", null],
                ] as const
              ).map(([val, label, color]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBg(val)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                    bg === val
                      ? "bg-indigo-500/20 border-indigo-400 text-white"
                      : "bg-[#0d121c] border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/25"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded border border-white/20"
                    style={{ background: color ?? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0/8px 8px" }}
                  />
                  {label}
                </button>
              ))}
              {bg === "color" && (
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 cursor-pointer bg-transparent border border-white/10 rounded"
                />
              )}
              <button
                type="button"
                onClick={() => setBg("color")}
                className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                  bg === "color"
                    ? "bg-indigo-500/20 border-indigo-400 text-white"
                    : "bg-[#0d121c] border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/25"
                }`}
              >
                Color…
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] text-gray-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ok}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white accent-gradient hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}