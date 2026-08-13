"use client";

import { useEditorStore } from "@/store/editorStore";
import { addAdjustmentLayerMenu } from "@/engine/layerOps";
import { notify } from "@/utils/notify";

// Key -> the layer type handed to addAdjustmentLayerMenu. Entries without a
// layer type are not yet available as adjustment layers.
const ADJUSTMENTS: { key: string; label: string; layerType?: string }[] = [
  { key: "levels", label: "Levels", layerType: "levels" },
  { key: "curves", label: "Curves", layerType: "curves" },
  { key: "hueSaturation", label: "Hue/Saturation", layerType: "hueSat" },
  { key: "brightness", label: "Brightness/Contrast", layerType: "brightnessContrast" },
  { key: "exposure", label: "Exposure", layerType: "exposure" },
  { key: "invert", label: "Invert", layerType: "invert" },
  { key: "posterize", label: "Posterize", layerType: "posterize" },
  { key: "threshold", label: "Threshold", layerType: "threshold" },
  { key: "colorBalance", label: "Color Balance" },
  { key: "blackWhite", label: "Black & White" },
  { key: "vibrance", label: "Vibrance" },
  { key: "photoFilter", label: "Photo Filter" },
  { key: "channelMixer", label: "Channel Mixer" },
  { key: "selectiveColor", label: "Selective Color" },
  { key: "gradientMap", label: "Gradient Map" },
];

export default function AdjustmentsPanel() {
  const canvas = useEditorStore((state) => state.canvas);

  const add = (layerType?: string, label?: string) => {
    if (!canvas) return;
    if (layerType) {
      addAdjustmentLayerMenu(canvas, layerType);
      return;
    }
    notify(`${label} isn't available as an adjustment layer yet.`, "warning");
  };

  return (
    <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-xs">Adjustment Layers</span>
        <button
          onClick={() => add("levels", "Levels")}
          className="text-xs text-gray-400 hover:text-white px-1.5 rounded hover:bg-gray-700"
          title="Add a Levels adjustment layer"
        >
          +
        </button>
      </div>
      <p className="text-[10px] text-gray-600 mb-2">
        Click a tile to add a non-destructive adjustment layer. Select it on
        the canvas to tweak it.
      </p>
      <div className="grid grid-cols-2 gap-1">
        {ADJUSTMENTS.map((adj) => (
          <button
            key={adj.key}
            onClick={() => add(adj.layerType, adj.label)}
            className={`px-3 py-2 text-left text-xs rounded border text-white transition-colors ${
              adj.layerType
                ? "bg-gray-700 hover:bg-gray-600 border-gray-600"
                : "bg-gray-800/50 hover:bg-gray-700 border-gray-700 text-gray-500"
            }`}
            title={adj.layerType ? `Add ${adj.label}` : `${adj.label} — coming soon`}
          >
            {adj.label}
          </button>
        ))}
      </div>
    </div>
  );
}
