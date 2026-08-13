"use client";

import { useState } from "react";

const DEFAULT_SWATCHES = [
  "#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ff8800", "#8800ff",
  "#0088ff", "#ff4444", "#44ff44", "#4444ff", "#884400",
];

export default function SwatchesPanel() {
  const [swatches, setSwatches] = useState<string[]>(DEFAULT_SWATCHES);
  const [newColor, setNewColor] = useState("#ff0000");

  const pickColor = (color: string) => {
    const store = (window as any).__kaypaintStore;
    if (store?.getState?.()?.setColor) {
      store.getState().setColor(color);
    }
  };

  const addSwatch = () => {
    setSwatches([...swatches, newColor]);
  };

  const removeSwatch = (color: string) => {
    setSwatches(swatches.filter((c) => c !== color));
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 cursor-pointer"
        />
        <button
          onClick={addSwatch}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
        >
          Add
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {swatches.map((color) => (
          <button
            key={color}
            onClick={() => pickColor(color)}
            onContextMenu={(e) => {
              e.preventDefault();
              removeSwatch(color);
            }}
            className="w-8 h-8 rounded border border-gray-600 hover:scale-110 transition"
            style={{ backgroundColor: color }}
            title={`${color} (right-click to remove)`}
          />
        ))}
      </div>
    </div>
  );
}