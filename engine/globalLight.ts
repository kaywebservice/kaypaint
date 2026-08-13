/* eslint-disable @typescript-eslint/no-explicit-any */

import { useFeaturesStore } from "@/store/featuresStore";
import { useEditorStore } from "@/store/editorStore";
import { showOptions } from "@/components/Menu/OptionDialog";

function walkAngles(obj: any, delta: number): boolean {
  let changed = false;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v && typeof v === "object") {
      if (walkAngles(v, delta)) changed = true;
    } else if (/angle|direction/i.test(key) && typeof v === "number") {
      obj[key] = v + delta;
      changed = true;
    }
  }
  return changed;
}

export async function globalLightDialog(canvas: any): Promise<void> {
  if (!canvas) return;
  const old = useFeaturesStore.getState().globalLight;
  const res = await showOptions({
    title: "Global Light",
    fields: [
      { key: "angle", label: "Angle", type: "slider", min: -180, max: 180, step: 1, value: old, suffix: "°" },
    ],
    okLabel: "OK",
  });
  if (!res) return;
  const next = Number(res.angle ?? old);
  if (!Number.isFinite(next) || next === old) return;
  const delta = next - old;
  useFeaturesStore.getState().setGlobalLight(next);
  for (const obj of canvas.getObjects() as any[]) {
    const s = obj.layerStyleJson;
    if (typeof s !== "string" || !s) continue;
    try {
      const styles = JSON.parse(s);
      if (!styles || typeof styles !== "object" || Array.isArray(styles)) continue;
      if (walkAngles(styles, delta)) {
        obj.set({ layerStyleJson: JSON.stringify(styles) });
      }
    } catch {
      // keep malformed styles untouched
    }
  }
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}
