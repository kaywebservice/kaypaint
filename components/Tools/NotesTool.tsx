/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";
import { useFeaturesStore } from "@/store/featuresStore";
import { showOptions } from "@/components/Menu/OptionDialog";

async function promptNote(id: string, initial: string, removeOnCancel: boolean) {
  const fs = useFeaturesStore.getState();
  const res = await showOptions({
    title: removeOnCancel ? "New Note" : "Edit Note",
    okLabel: "Save",
    fields: [{ key: "text", label: "Note text", type: "text", value: initial }],
  });
  if (!res) {
    if (removeOnCancel) fs.removeNote(id);
    return;
  }
  const text = String(res.text ?? "").trim();
  if (text) fs.updateNoteText(id, text);
  else if (removeOnCancel) fs.removeNote(id);
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const p = getPointer(canvas, e.e);
    const fs = useFeaturesStore.getState();
    fs.addNote(p.x, p.y, "");
    const note = fs.notes[fs.notes.length - 1];
    if (note) void promptNote(note.id, "", true);
  };

  canvas.on("mouse:down", down);

  return () => {
    canvas.off("mouse:down", down);
  };
}

export async function editNote(id: string): Promise<void> {
  const note = useFeaturesStore.getState().notes.find((n) => n.id === id);
  if (!note) return;
  await promptNote(id, note.text, false);
}
