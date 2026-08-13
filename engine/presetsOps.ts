/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSettingsStore } from "@/store/settingsStore";
import { showOptions } from "@/components/Menu/OptionDialog";
import { canvasNow } from "@/engine/pixelOps";

export async function definePatternPreset(): Promise<void> {
  const canvas = canvasNow();
  if (!canvas) {
    window.alert("Define Pattern: no active canvas.");
    return;
  }
  const res = await showOptions({
    title: "Define Pattern Preset",
    fields: [
      { key: "name", label: "Name", type: "text", value: "Pattern" },
    ],
  });
  if (!res) return;
  let dataUrl: string;
  const active: any = canvas.getActiveObject?.();
  if (active && active.type !== "activeSelection") {
    dataUrl = active.toDataURL?.({ format: "png", multiplier: 1 });
  } else {
    dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
  }
  useSettingsStore.getState().addPatternPreset({ name: String(res.name) || "Pattern", dataUrl });
}

export async function defineCustomShape(): Promise<void> {
  const canvas = canvasNow() as any;
  if (!canvas) {
    window.alert("Define Custom Shape: no active canvas.");
    return;
  }
  const res = await showOptions({
    title: "Define Custom Shape",
    fields: [{ key: "name", label: "Name", type: "text", value: "Shape" }],
  });
  if (!res) return;
  const active: any = canvas.getActiveObject?.();
  let path: any[];
  if (active && (active.type === "path" || active.type === "rect" || active.type === "circle" || active.type === "ellipse" || active.type === "polygon" || active.type === "triangle" || active.type === "line")) {
    const d = active.path || active.getPathString?.();
    path = Array.isArray(d) ? d : d ? String(d).split(" ").filter(Boolean) : [];
  } else {
    const r = active ? active.getBoundingRect?.() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const x = r.left, y = r.top, w = Math.max(1, r.width), h = Math.max(1, r.height);
    path = [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
  }
  useSettingsStore.getState().addCustomShape({ name: String(res.name) || "Shape", path });
}
