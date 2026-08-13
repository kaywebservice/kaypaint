"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

const FONTS = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Impact",
  "Comic Sans MS",
  "Palatino Linotype",
];

const label = "text-xs text-gray-500 block mb-1";
const input = "w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200";

export default function CharacterPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [tracking, setTracking] = useState(0);
  const [weight, setWeight] = useState("normal");
  const [style, setStyle] = useState("normal");
  const [color, setColor] = useState("#000000");

  useEffect(() => {
    if (!canvas) return;
    const sync = () => {
      const obj = canvas.getActiveObject() ?? null;
      if (obj && typeof obj.text === "string") {
        setFontFamily(obj.fontFamily ?? "Arial");
        setFontSize(obj.fontSize ?? 28);
        setLineHeight(obj.lineHeight ?? 1.2);
        setTracking(obj.charSpacing ?? 0);
        setWeight(obj.fontWeight ?? "normal");
        setStyle(obj.fontStyle ?? "normal");
        setColor(typeof obj.fill === "string" ? obj.fill : "#000000");
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
      <div className="text-xs text-gray-500">Select a text layer to edit its character properties.</div>
    );
  }

  const update = (props: Record<string, any>) => {
    obj.set(props);
    obj.setCoords?.();
    canvas.requestRenderAll();
  };

  return (
    <div className="space-y-3 text-sm text-gray-200">
      <div>
        <label className={label}>Font family</label>
        <select
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            update({ fontFamily: e.target.value });
          }}
          className={input}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Size</label>
          <input
            type="number"
            value={fontSize}
            onChange={(e) => {
              setFontSize(Number(e.target.value));
              update({ fontSize: Number(e.target.value) });
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Leading</label>
          <input
            type="number"
            step="0.1"
            value={lineHeight}
            onChange={(e) => {
              setLineHeight(Number(e.target.value));
              update({ lineHeight: Number(e.target.value) });
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Tracking (1/1000 em)</label>
          <input
            type="number"
            step="10"
            value={tracking}
            onChange={(e) => {
              setTracking(Number(e.target.value));
              update({ charSpacing: Number(e.target.value) });
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              update({ fill: e.target.value });
            }}
            className="w-full h-8 cursor-pointer bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Weight</label>
          <select
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              update({ fontWeight: e.target.value });
            }}
            className={input}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="600">Semi-Bold</option>
            <option value="300">Light</option>
          </select>
        </div>
        <div>
          <label className={label}>Style</label>
          <select
            value={style}
            onChange={(e) => {
              setStyle(e.target.value);
              update({ fontStyle: e.target.value });
            }}
            className={input}
          >
            <option value="normal">Regular</option>
            <option value="italic">Italic</option>
          </select>
        </div>
      </div>
    </div>
  );
}