/* eslint-disable @typescript-eslint/no-explicit-any */

import { useLayerStore } from "@/store/layerStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { useEditorStore } from "@/store/editorStore";
import { showOptions } from "@/components/Menu/OptionDialog";

function makeThumb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(96 / (img.width || 1), 96 / (img.height || 1), 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((img.width || 1) * scale));
      c.height = Math.max(1, Math.round((img.height || 1) * scale));
      const g = c.getContext("2d");
      if (!g) return resolve("");
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

export async function captureComp(canvas: any): Promise<void> {
  if (!canvas) return;
  const count = useFeaturesStore.getState().layerComps.length;
  const res = await showOptions({
    title: "New Layer Comp",
    fields: [{ key: "name", label: "Name", type: "text", value: `Comp ${count + 1}` }],
    okLabel: "Capture",
  });
  if (!res) return;
  const name = String(res.name ?? `Comp ${count + 1}`).trim() || `Comp ${count + 1}`;
  const thumb = await makeThumb(canvas.toDataURL({ format: "png", multiplier: 1 }));
  const ls = useLayerStore.getState();
  useFeaturesStore.getState().addComp(name, canvas.toJSON(), {
    layers: ls.layers,
    activeLayer: ls.activeLayer,
    groups: ls.groups,
  }, thumb);
}

export async function applyComp(canvas: any, compId: string): Promise<void> {
  if (!canvas) return;
  const comp = useFeaturesStore.getState().layerComps.find((c) => c.id === compId);
  if (!comp) return;
  await canvas.loadFromJSON(comp.canvasJson as any);
  useLayerStore.setState(comp.layerJson as any);
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}

export async function manageComps(canvas: any): Promise<void> {
  if (!canvas) return;
  const comps = useFeaturesStore.getState().layerComps;
  if (!comps.length) {
    window.alert("No layer comps yet.");
    return;
  }
  const res = await showOptions({
    title: "Layer Comps",
    fields: [
      {
        key: "comp",
        label: "Comp",
        type: "select",
        value: comps[0].id,
        options: comps.map((c) => ({ value: c.id, label: c.name })),
      },
    ],
  });
  if (!res) return;
  const action = await showOptions({
    title: "Layer Comp Action",
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: "apply",
        options: [
          { value: "apply", label: "Apply" },
          { value: "delete", label: "Delete" },
          { value: "close", label: "Close" },
        ],
      },
    ],
  });
  if (!action) return;
  const compId = String(res.comp);
  if (action.action === "apply") {
    await applyComp(canvas, compId);
  } else if (action.action === "delete") {
    useFeaturesStore.getState().removeComp(compId);
  }
}
