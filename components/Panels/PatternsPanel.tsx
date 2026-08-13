"use client";

import { useState, useEffect } from "react";
import { Pattern } from "fabric";

const PRESET_PATTERNS = [
  { name: "Checkerboard", generate: (ctx: CanvasRenderingContext2D, size: number) => {
    const tile = 16;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#cccccc";
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        if ((x / tile + y / tile) % 2 === 0) {
          ctx.fillRect(x, y, tile, tile);
        }
      }
    }
  }},
  { name: "Diagonal Lines", generate: (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  }},
  { name: "Dots", generate: (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#cccccc";
    for (let y = 10; y < size; y += 20) {
      for (let x = 10; x < size; x += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }},
  { name: "Crosshatch", generate: (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < size; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  }},
];

export default function PatternsPanel() {
  const [patterns, setPatterns] = useState<{ name: string; dataUrl: string }[]>([]);

  const applyPattern = (dataUrl: string) => {
    const store = (window as any).__kaypaintStore;
    if (!store?.getState?.()?.canvas) return;

    const canvas = store.getState().canvas;
    const target = canvas.getActiveObject();
    if (!target) return;

    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => {
      const pattern = new Pattern({
        source: img,
        repeat: "repeat",
      });
      target.set({ fill: pattern });
      target.setCoords();
      canvas.requestRenderAll();
      store.getState().history?.push?.();
    };
  };

  const loadPresets = () => {
    const loaded = PRESET_PATTERNS.map((preset) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      preset.generate(ctx, 64);
      return { name: preset.name, dataUrl: canvas.toDataURL() };
    });
    setPatterns(loaded);
  };

  useEffect(() => {
    loadPresets();
  }, []);

  return (
    <div className="p-3 space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {patterns.map((pattern) => (
          <button
            key={pattern.name}
            onClick={() => applyPattern(pattern.dataUrl)}
            className="aspect-square rounded border border-gray-600 hover:scale-105 transition p-1"
            style={{ backgroundImage: `url(${pattern.dataUrl})`, backgroundSize: "64px 64px" }}
            title={pattern.name}
          />
        ))}
      </div>
      <div className="border-t border-gray-700 pt-3">
        <label className="text-xs text-gray-400 block mb-1">Load Image Pattern</label>
        <input
          type="file"
          accept="image/*"
          className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              applyPattern(reader.result as string);
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </div>
  );
}