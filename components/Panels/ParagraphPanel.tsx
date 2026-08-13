"use client";

import { useEffect, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, MoveRight, MoveLeft } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

const label = "text-xs text-gray-500 block mb-1";

const ALIGNMENTS = [
  { id: "left", icon: AlignLeft, title: "Align left" },
  { id: "center", icon: AlignCenter, title: "Align center" },
  { id: "right", icon: AlignRight, title: "Align right" },
  { id: "justify", icon: AlignJustify, title: "Justify" },
];

const DIRECTIONS = [
  { id: "ltr", icon: MoveRight, title: "Left to right" },
  { id: "rtl", icon: MoveLeft, title: "Right to left" },
];

export default function ParagraphPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const [align, setAlign] = useState("left");
  const [direction, setDirection] = useState("ltr");

  useEffect(() => {
    if (!canvas) return;
    const sync = () => {
      const obj = canvas.getActiveObject() ?? null;
      if (obj && typeof obj.text === "string") {
        setAlign(obj.textAlign ?? "left");
        setDirection(obj.direction ?? "ltr");
      }
    };
    canvas.on("selection:created", sync);
    canvas.on("selection:updated", sync);
    canvas.on("selection:cleared", sync);
    canvas.on("object:modified", sync);
    return () => {
      canvas.off("selection:created", sync);
      canvas.off("selection:updated", sync);
      canvas.off("selection:cleared", sync);
      canvas.off("object:modified", sync);
    };
  }, [canvas]);

  const obj = canvas?.getActiveObject();
  if (!obj || typeof obj.text !== "string") {
    return (
      <div className="text-xs text-gray-500">Select a text layer to edit paragraph properties.</div>
    );
  }

  const update = (props: Record<string, any>) => {
    obj.set(props);
    obj.setCoords?.();
    canvas.requestRenderAll();
  };

  return (
    <div className="space-y-4 text-sm text-gray-200">
      <div>
        <label className={label}>Alignment</label>
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-gray-800 border border-gray-600">
          {ALIGNMENTS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                title={a.title}
                onClick={() => {
                  setAlign(a.id);
                  update({ textAlign: a.id });
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  align === a.id
                    ? "bg-indigo-500 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={label}>Text direction</label>
        <div className="inline-grid grid-cols-2 gap-1 p-1 rounded-lg bg-gray-800 border border-gray-600">
          {DIRECTIONS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                title={d.title}
                onClick={() => {
                  setDirection(d.id);
                  update({ direction: d.id });
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  direction === d.id
                    ? "bg-indigo-500 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] leading-relaxed text-gray-500">
        Indent and spacing presets will require a full paragraph text model — coming with the text
        engine upgrade.
      </div>
    </div>
  );
}