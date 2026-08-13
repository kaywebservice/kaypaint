"use client";

import { useEffect, useState } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { applyBlendMode } from "@/engine/blendEngine";

export default function OptionsBar() {
  const state = useEditorStore;
  const activeTool = state((s) => s.activeTool);
  const canvas = state((s) => s.canvas);
  const history = state((s) => s.history);

  const color = state((s) => s.color);
  const size = state((s) => s.size);
  const shape = state((s) => s.shape);
  const fontSize = state((s) => s.fontSize);
  const gradientType = state((s) => s.gradientType);
  const filterAmount = state((s) => s.filterAmount);
  const liquifyStrength = state((s) => s.liquifyStrength);
  const tolerance = state((s) => s.tolerance);
  const feather = state((s) => s.feather);

  const setColor = state((s) => s.setColor);
  const setSize = state((s) => s.setSize);
  const setShape = state((s) => s.setShape);
  const setFontSize = state((s) => s.setFontSize);
  const setGradientType = state((s) => s.setGradientType);
  const setFilterAmount = state((s) => s.setFilterAmount);
  const setLiquifyStrength = state((s) => s.setLiquifyStrength);
  const setTolerance = state((s) => s.setTolerance);
  const setFeather = state((s) => s.setFeather);

  const { layers, activeLayer, setOpacity, setBlendMode } = useLayerStore();
  const currentLayer = layers.find((layer) => layer.id === activeLayer);

  const [opacity, setLocalOpacity] = useState(currentLayer?.opacity ?? 100);
  const [blendMode, setLocalBlendMode] = useState(
    currentLayer?.blendMode ?? "normal"
  );

  useEffect(() => {
    setLocalOpacity(currentLayer?.opacity ?? 100);
    setLocalBlendMode(currentLayer?.blendMode ?? "normal");
  }, [currentLayer?.id, currentLayer?.opacity, currentLayer?.blendMode]);

  const applyLayerCanvas = (op: "opacity" | "blend") => {
    if (!canvas || !activeLayer) return;
    const layer = useLayerStore.getState().layers.find((l) => l.id === activeLayer);
    if (!layer?.objectId) return;

    const object = canvas.getObjects().find((o: any) => o.kaypaintId === layer.objectId);
    if (!object) return;

    if (op === "opacity") {
      object.set({ opacity: (layer.opacity ?? 100) / 100 });
    } else {
      applyBlendMode(object, layer.blendMode);
    }
    canvas.requestRenderAll();
  };

  const handleOpacity = (value: number) => {
    setLocalOpacity(value);
    if (activeLayer) {
      setOpacity(activeLayer, value);
      setTimeout(() => applyLayerCanvas("opacity"), 0);
    }
  };

  const handleBlend = (value: string) => {
    setLocalBlendMode(value);
    if (activeLayer) {
      setBlendMode(activeLayer, value);
      setTimeout(() => applyLayerCanvas("blend"), 0);
    }
  };

  const target = canvas?.getActiveObject?.();

  const sizeTools = [
    "brush", "pencil", "eraser", "heal", "clone", "spotHeal",
    "dodge", "burn", "sponge", "smudge", "sharpen", "quickMask",
    "quickSelection", "backgroundEraser", "colorReplacement",
    "historyBrush", "artHistoryBrush", "redeye", "line", "pen",
    "mixerBrush", "patternStamp", "shape",
  ];
  const SIZE_MAX = 120;

  return (
    <div className="h-12 bg-gray-900/80 border-b border-white/5 px-4 flex items-center gap-4 text-sm text-gray-200 overflow-x-auto">
      <span className="font-extrabold tracking-widest text-xs text-gradient whitespace-nowrap uppercase">
        {activeTool}
      </span>

      {sizeTools.includes(activeTool) && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Size:</span>
          <input
            type="range"
            min="1"
            max={SIZE_MAX}
            value={Math.min(SIZE_MAX, size)}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-28"
          />
          <span className="w-8">{size}</span>
        </div>
      )}

      {activeTool === "clone" && (
        <span className="text-gray-400 whitespace-nowrap">Alt-click to pick source</span>
      )}
      {activeTool === "heal" && (
        <span className="text-gray-400 whitespace-nowrap">drag over blemishes to blend surrounding texture</span>
      )}
      {activeTool === "spotHeal" && (
        <span className="text-gray-400 whitespace-nowrap">click blemishes to remove</span>
      )}
      {activeTool === "quickMask" && (
        <span className="text-gray-400 whitespace-nowrap">paint the selection mask · Alt erases</span>
      )}
      {(activeTool === "dodge" || activeTool === "burn" || activeTool === "sponge" || activeTool === "smudge" || activeTool === "sharpen") && (
        <span className="text-gray-400 whitespace-nowrap">drag over the image to apply</span>
      )}

      {activeTool === "shape" && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Shape:</span>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as any)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1"
          >
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
            <option value="triangle">Triangle</option>
            <option value="polygon">Polygon (click points)</option>
          </select>
        </div>
      )}

      {activeTool === "text" && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Font size:</span>
          <input
            type="number"
            min="8"
            max="300"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
      )}

      {activeTool === "gradient" && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Style:</span>
          <select
            value={gradientType}
            onChange={(e) => setGradientType(e.target.value as any)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1"
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
          <span className="text-gray-400">drag on a shape</span>
        </div>
      )}

      {(activeTool === "blur" || activeTool === "brightness" || activeTool === "magicEraser") && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{activeTool === "blur" ? "Amount:" : activeTool === "magicEraser" ? "Tolerance:" : "Level:"}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={filterAmount}
            onChange={(e) => setFilterAmount(Number(e.target.value))}
            className="w-28"
          />
          <span className="w-8">{filterAmount}</span>
          <span className="text-gray-400">
            {activeTool === "magicEraser" ? "click to erase matching color" : "applies to selected image"}
          </span>
        </div>
      )}

      {(activeTool === "wand" || activeTool === "quickSelection" || activeTool === "quickMask") && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Tolerance:</span>
          <input
            type="range"
            min="1"
            max="150"
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-8">{tolerance}</span>
          {(activeTool === "wand" || activeTool === "quickSelection") && (
            <>
              <span>Feather:</span>
              <input
                type="range"
                min="0"
                max="16"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="w-24"
              />
              <span className="w-8">{feather}</span>
            </>
          )}
          <span className="text-gray-400">
            {activeTool === "wand" ? "click to erase similar colors" : activeTool === "quickSelection" ? "drag to grow the selection" : "paint the selection mask"}
          </span>
        </div>
      )}

      {activeTool === "liquify" && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Brush:</span>
          <input
            type="range"
            min="4"
            max="160"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-8">{size}</span>
          <span>Strength:</span>
          <input
            type="range"
            min="1"
            max="100"
            value={liquifyStrength}
            onChange={(e) => setLiquifyStrength(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-8">{liquifyStrength}</span>
          <span className="text-gray-400">drag over an object to warp it</span>
        </div>
      )}

      <div className="flex items-center gap-2 whitespace-nowrap">
        <span>Color:</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 cursor-pointer"
        />
        <span className="font-mono text-xs">{color}</span>
      </div>

      <button
        title="Undo (Ctrl+Z)"
        onClick={() => history?.undo?.()}
        disabled={!history?.canUndo}
        className="p-1.5 rounded-lg bg-gray-800 border border-white/5 hover:bg-gray-700 hover:border-white/10 disabled:opacity-40"
      >
        <Undo2 size={16} />
      </button>

      <button
        title="Redo (Ctrl+Shift+Z)"
        onClick={() => history?.redo?.()}
        disabled={!history?.canRedo}
        className="p-1.5 rounded-lg bg-gray-800 border border-white/5 hover:bg-gray-700 hover:border-white/10 disabled:opacity-40"
      >
        <Redo2 size={16} />
      </button>

      <div className="ml-auto flex items-center gap-4 whitespace-nowrap">
        <span className="text-gray-400">{target ? `${(target as any).type}` : "Nothing selected"}</span>
      </div>

      <div className="flex items-center gap-2">
        <span>Layer opacity:</span>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => handleOpacity(Number(e.target.value))}
          className="w-20"
        />
        <span className="w-8">{opacity}%</span>
      </div>

      <div className="flex items-center gap-2">
        <span>Blend:</span>
        <select
          value={blendMode}
          onChange={(e) => handleBlend(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-1 py-1"
        >
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="darken">Darken</option>
          <option value="lighten">Lighten</option>
          <option value="color-dodge">Color Dodge</option>
          <option value="color-burn">Color Burn</option>
          <option value="difference">Difference</option>
          <option value="exclusion">Exclusion</option>
          <option value="hue">Hue</option>
          <option value="saturation">Saturation</option>
          <option value="color">Color</option>
          <option value="luminosity">Luminosity</option>
        </select>
      </div>
    </div>
  );
}