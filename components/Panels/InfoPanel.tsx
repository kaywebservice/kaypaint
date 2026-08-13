"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { useSettingsStore } from "@/store/settingsStore";
import { subscribeCursorInfo, getDocumentInfo, type CursorInfo } from "@/engine/infoOps";

const EMPTY_INFO: CursorInfo = {
  x: 0,
  y: 0,
  r: 0,
  g: 0,
  b: 0,
  hex: "#000000",
  docW: 0,
  docH: 0,
  zoom: 1,
  layerName: "—",
  selW: 0,
  selH: 0,
};

export default function InfoPanel() {
  const canvas = useEditorStore((s) => s.canvas);
  const infoOpen = useFeaturesStore((s) => s.infoOpen);
  const dpi = useSettingsStore((s) => s.dpi);
  const bitDepth = useFeaturesStore((s) => s.bitDepth);
  const assignedProfile = useFeaturesStore((s) => s.assignedProfile);
  const [info, setInfo] = useState<CursorInfo>(EMPTY_INFO);

  useEffect(() => {
    if (!canvas) return;
    return subscribeCursorInfo(canvas, setInfo);
  }, [canvas]);

  if (!infoOpen) return null;

  const doc = canvas ? getDocumentInfo(canvas) : null;

  const rows: { label: string; value: string }[] = [
    { label: "X", value: String(info.x) },
    { label: "Y", value: String(info.y) },
    { label: "W", value: `${info.docW} px` },
    { label: "H", value: `${info.docH} px` },
    { label: "Zoom", value: `${Math.round(info.zoom * 100)}%` },
    { label: "Layer", value: info.layerName },
    { label: "Sel W", value: info.selW ? `${info.selW} px` : "—" },
    { label: "Sel H", value: info.selH ? `${info.selH} px` : "—" },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-40 w-56 select-none rounded-xl border border-white/10 bg-gray-900/95 p-3 text-xs shadow-2xl shadow-black/60 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Info</span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border border-white/20"
            style={{ backgroundColor: info.hex }}
          />
          <span className="font-mono text-gray-200">{info.hex}</span>
        </span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-gray-500">{r.label}</span>
            <span className="truncate font-mono text-gray-200">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: "R", v: info.r, cls: "text-red-400" },
          { label: "G", v: info.g, cls: "text-green-400" },
          { label: "B", v: info.b, cls: "text-blue-400" },
        ].map((c) => (
          <div key={c.label} className={`rounded-md bg-white/5 px-1.5 py-1 text-center font-mono ${c.cls}`}>
            {c.label} {c.v}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2">
        <div className="flex justify-between gap-2">
          <span className="shrink-0 text-gray-500">Profile</span>
          <span className="truncate font-mono text-gray-200">{doc?.profile ?? assignedProfile ?? "sRGB IEC61966-2.1"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Depth</span>
          <span className="font-mono text-gray-200">{bitDepth} bits/ch</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">DPI</span>
          <span className="font-mono text-gray-200">{doc?.dpi ?? dpi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Mode</span>
          <span className="font-mono uppercase text-gray-200">{doc?.mode ?? "rgb"}</span>
        </div>
      </div>
    </div>
  );
}
