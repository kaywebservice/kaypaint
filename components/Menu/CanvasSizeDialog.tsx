"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { applyCanvasSize } from "@/engine/canvasSizeEngine";

const UNITS = [
  { id: "px", label: "pixels", factor: 1 },
  { id: "in", label: "inches", factor: 96 },
  { id: "cm", label: "centimeters", factor: 96 / 2.54 },
  { id: "mm", label: "millimeters", factor: 96 / 25.4 },
  { id: "pt", label: "points", factor: 96 / 72 },
  { id: "pc", label: "picas", factor: 16 },
  { id: "%", label: "percent", factor: 0 },
];

const toPx = (value: number, unit: string, cur: number) =>
  unit === "%" ? (cur * value) / 100 : value * (UNITS.find((u) => u.id === unit)?.factor ?? 1);

const toUnit = (px: number, unit: string, cur: number) =>
  unit === "%" ? (px / cur) * 100 : px / (UNITS.find((u) => u.id === unit)?.factor ?? 1);

function fmt(v: number) {
  return String(Math.round(v * 100) / 100);
}

export default function CanvasSizeDialog({ onClose }: { onClose: () => void }) {
  const canvas = useEditorStore((s) => s.canvas);
  const curW = canvas?.width ?? 1920;
  const curH = canvas?.height ?? 1080;

  const [unit, setUnit] = useState("px");
  const [wStr, setWStr] = useState(String(curW));
  const [hStr, setHStr] = useState(String(curH));
  const [anchor, setAnchor] = useState(4);
  const [relative, setRelative] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const wPx = toPx(parseFloat(wStr) || 0, unit, curW);
  const hPx = toPx(parseFloat(hStr) || 0, unit, curH);

  const newW = relative ? curW + wPx : wPx;
  const newH = relative ? curH + hPx : hPx;
  const okEnabled = newW >= 1 && newH >= 1 && Number.isFinite(newW) && Number.isFinite(newH);

  const changeUnit = (next: string) => {
    const wv = parseFloat(wStr) || 0;
    const hv = parseFloat(hStr) || 0;
    setUnit(next);
    setWStr(fmt(toUnit(toPx(wv, unit, curW), next, curW)));
    setHStr(fmt(toUnit(toPx(hv, unit, curH), next, curH)));
  };

  const apply = () => {
    if (!okEnabled) return;
    const ok = applyCanvasSize({
      width: newW,
      height: newH,
      anchor,
      extendColor: color,
    });
    if (ok) useEditorStore.getState().history?.push?.();
    onClose();
  };

  const anchors = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];

  const swatches = useMemo(() => {
    const base = ["#ffffff", "#000000", "#f0f0f0", "#cccccc", "#1a1a1a"];
    if (color && !base.includes(color)) base.splice(0, 0, color);
    return base;
  }, [color]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="w-[480px] rounded-2xl bg-[#161b26] border border-white/10 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-100 tracking-wide">
            Canvas Size
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-xs text-gray-400">
            <span className="text-gray-200 font-medium">Current Size:</span>{" "}
            {curW} px × {curH} px
          </div>

          <div>
            <div className="text-xs font-medium text-gray-300 mb-2">New Size</div>
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                Width
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={wStr}
                  onChange={(e) => setWStr(e.target.value)}
                  className="w-28 px-2.5 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                Height
                <input
                  type="text"
                  inputMode="decimal"
                  value={hStr}
                  onChange={(e) => setHStr(e.target.value)}
                  className="w-28 px-2.5 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-gray-400">
                Unit
                <select
                  value={unit}
                  onChange={(e) => changeUnit(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-gray-100 text-[13px] focus:outline-none focus:border-indigo-400"
                >
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-1.5 text-[11px] text-gray-500">
              New Pixel Dimensions: {Math.max(1, Math.round(newW))} ×{" "}
              {Math.max(1, Math.round(newH))} px
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-300 mb-2">Anchor</div>
            <div className="inline-grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0d121c] border border-white/10">
              {anchors.flat().map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAnchor(a)}
                  className={`w-9 h-7 rounded-md flex items-center justify-center transition-colors ${
                    anchor === a
                      ? "bg-indigo-500 text-white"
                      : "text-gray-500 hover:text-gray-200 hover:bg-white/10"
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm border border-current" />
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={relative}
              onChange={(e) => setRelative(e.target.checked)}
              className="accent-indigo-500"
            />
            Relative
          </label>

          <div className="relative">
            <div className="text-xs font-medium text-gray-300 mb-2">
              Canvas extension color
            </div>
            <div className="flex items-center gap-2">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setColorOpen(false);
                  }}
                  className={`w-7 h-7 rounded-md border transition-transform ${
                    color.toLowerCase() === c.toLowerCase()
                      ? "border-indigo-400 scale-110"
                      : "border-white/15 hover:scale-110"
                  }`}
                  style={{ background: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => setColorOpen((o) => !o)}
                className="px-2 py-1.5 rounded-lg bg-[#0d121c] border border-white/10 text-[11px] text-gray-300 hover:border-indigo-400"
              >
                Custom
              </button>
              {colorOpen && (
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-7 cursor-pointer bg-transparent border border-white/10 rounded"
                />
              )}
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
            disabled={!okEnabled}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white accent-gradient hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
}