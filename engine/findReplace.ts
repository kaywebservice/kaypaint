/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findReplaceText(canvas: any) {
  if (!canvas) {
    window.alert("No canvas available.");
    return;
  }
  const res = await showOptions({
    title: "Find and Replace Text",
    okLabel: "Replace",
    fields: [
      { key: "find", label: "Find", type: "text", value: "" },
      { key: "replace", label: "Replace with", type: "text", value: "" },
      { key: "matchCase", label: "Match case", type: "checkbox", value: false },
      { key: "wholeWord", label: "Whole word", type: "checkbox", value: false },
      { key: "renameLayers", label: "Rename matching layers", type: "checkbox", value: false },
    ],
  });
  if (!res) return;
  const find = String(res.find ?? "");
  const replace = String(res.replace ?? "");
  if (!find) {
    window.alert("Enter text to find.");
    return;
  }
  const matchCase = !!res.matchCase;
  const wholeWord = !!res.wholeWord;
  const renameLayers = !!res.renameLayers;

  const pattern = wholeWord ? `\\b${escapeRegex(find)}\\b` : escapeRegex(find);
  const flags = matchCase ? "g" : "gi";
  const re = new RegExp(pattern, flags);
  const findLower = find.toLowerCase();

  const textObjects = canvas.getObjects().filter((o: any) => typeof o.text === "string");
  let count = 0;
  for (const obj of textObjects) {
    const matches = obj.text.match(re);
    if (matches) count += matches.length;
    const newText = obj.text.replace(re, () => replace);
    if (newText !== obj.text) {
      obj.set("text", newText);
    }
    if (renameLayers && obj.kaypaintId) {
      const contains = matchCase
        ? newText.includes(find)
        : newText.toLowerCase().includes(findLower);
      if (contains) {
        const layer = useLayerStore
          .getState()
          .layers.find((l) => l.objectId === obj.kaypaintId);
        if (layer) {
          useLayerStore.getState().renameLayer(layer.id, newText.slice(0, 24));
        }
      }
    }
  }
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
  window.alert(`Replaced ${count} occurrence(s).`);
}
