"use client";

import { useEditorStore } from "@/store/editorStore";

export default function ChannelsPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const [activeChannel, setActiveChannel] = useState<"RGB" | "R" | "G" | "B" | "Alpha">("RGB");

  const channels = [
    { id: "RGB", label: "RGB", color: "text-white" },
    { id: "R", label: "Red", color: "text-red-400" },
    { id: "G", label: "Green", color: "text-green-400" },
    { id: "B", label: "Blue", color: "text-blue-400" },
    { id: "Alpha", label: "Alpha", color: "text-gray-400" },
  ];

  const selectChannel = (channel: typeof activeChannel) => {
    setActiveChannel(channel);
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target || target.type !== "image") return;

    // Apply channel isolation via filter
    const el = target.getElement?.();
    if (!el) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = el.width;
    tempCanvas.height = el.height;
    const ctx = tempCanvas.getContext("2d")!;
    ctx.drawImage(el, 0, 0);
    const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (channel === "R") {
        data[i + 1] = 0; data[i + 2] = 0;
      } else if (channel === "G") {
        data[i] = 0; data[i + 2] = 0;
      } else if (channel === "B") {
        data[i] = 0; data[i + 1] = 0;
      } else if (channel === "Alpha") {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    target.setSrc(tempCanvas.toDataURL()).then(() => {
      target.setCoords();
      canvas.requestRenderAll();
    });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-xs">Channels</span>
        <button className="text-xs text-gray-400 hover:text-white">+</button>
      </div>
      <div className="space-y-1">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => selectChannel(ch.id as any)}
            className={`w-full px-3 py-2 text-left text-xs rounded border ${
              activeChannel === ch.id
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
            }`}
          >
            <span className={`${ch.color} font-mono`}>{ch.label}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-gray-700 pt-2 text-xs text-gray-500">
        Click a channel to isolate it. RGB shows full color.
      </div>
    </div>
  );
}

import { useState } from "react";