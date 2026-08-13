"use client";

import { useState } from "react";
import { Gradient } from "fabric";

const PRESET_GRADIENTS = [
  { name: "Black → White", stops: [{ offset: 0, color: "#000000" }, { offset: 1, color: "#ffffff" }] },
  { name: "Red → Yellow", stops: [{ offset: 0, color: "#ff0000" }, { offset: 1, color: "#ffff00" }] },
  { name: "Blue → Cyan", stops: [{ offset: 0, color: "#0000ff" }, { offset: 1, color: "#00ffff" }] },
  { name: "Purple → Pink", stops: [{ offset: 0, color: "#8800ff" }, { offset: 1, color: "#ff00ff" }] },
  { name: "Sunset", stops: [{ offset: 0, color: "#ff4444" }, { offset: 0.5, color: "#ff8800" }, { offset: 1, color: "#ffff00" }] },
  { name: "Ocean", stops: [{ offset: 0, color: "#000088" }, { offset: 0.5, color: "#0088ff" }, { offset: 1, color: "#00ffff" }] },
  { name: "Forest", stops: [{ offset: 0, color: "#004400" }, { offset: 0.5, color: "#00aa00" }, { offset: 1, color: "#88ff88" }] },
  { name: "Transparent", stops: [{ offset: 0, color: "#ff0000" }, { offset: 1, color: "#ff000000" }] },
];

export default function GradientsPanel() {
  const [type, setType] = useState<"linear" | "radial">("linear");
  const [customStops, setCustomStops] = useState([
    { offset: 0, color: "#ff0000" },
    { offset: 1, color: "#0000ff" },
  ]);

  const applyGradient = (stops: any[]) => {
    const store = (window as any).__kaypaintStore;
    if (!store?.getState?.()?.canvas) return;

    const canvas = store.getState().canvas;
    const target = canvas.getActiveObject();
    if (!target) return;

    const fill = new Gradient({
      type,
      coords: type === "radial"
        ? { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.5, r1: 0, r2: 0.5 }
        : { x1: 0, y1: 0, x2: 1, y2: 1 },
      colorStops: stops,
    });

    target.set({ fill });
    target.setCoords();
    canvas.requestRenderAll();
    store.getState().history?.push?.();
  };

  const handlePresetClick = (preset: any) => {
    applyGradient(preset.stops);
    setCustomStops(preset.stops);
  };

  const addStop = () => {
    if (customStops.length >= 10) return;
    const last = customStops[customStops.length - 1];
    setCustomStops([...customStops, { offset: Math.min(1, last.offset + 0.2), color: last.color }]);
  };

  const removeStop = (index: number) => {
    if (customStops.length <= 2) return;
    setCustomStops(customStops.filter((_, i) => i !== index));
  };

  const updateStop = (index: number, field: "offset" | "color", value: string | number) => {
    setCustomStops(customStops.map((s, i) => i === index ? { ...s, [field]: field === "offset" ? Number(value) : value } : s));
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Type:</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </div>

      <div className="space-y-2">
        {PRESET_GRADIENTS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset)}
            className="w-full h-8 rounded border border-gray-600 overflow-hidden"
            style={{
              background: `linear-gradient(90deg, ${preset.stops.map(s => `${s.color} ${s.offset * 100}%`).join(", ")})`
            }}
            title={preset.name}
          />
        ))}
      </div>

      <div className="border-t border-gray-700 pt-3 space-y-2">
        <span className="text-xs text-gray-400">Custom Gradient</span>
        <div className="space-y-1">
          {customStops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(i, "color", e.target.value)}
                className="w-6 h-6 cursor-pointer"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={stop.offset * 100}
                onChange={(e) => updateStop(i, "offset", Number(e.target.value) / 100)}
                className="flex-1"
              />
              <span className="w-8 text-xs">{Math.round(stop.offset * 100)}%</span>
              {customStops.length > 2 && (
                <button
                  onClick={() => removeStop(i)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={addStop}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
          >
            Add Stop
          </button>
          <button
            onClick={() => applyGradient(customStops)}
            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}