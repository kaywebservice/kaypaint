/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { useEditorStore } from "@/store/editorStore";

export interface CharStyle {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  fill: string;
  italic?: boolean;
}

export interface ParaStyle {
  name: string;
  textAlign: string;
  lineHeight: number;
  charSpacing?: number;
}

const charStyles = new Map<string, CharStyle>();
const paraStyles = new Map<string, ParaStyle>();

function isTextObject(obj: any): boolean {
  return !!obj && (obj.type === "i-text" || obj.type === "i-textbox");
}

export function applyCharStyleToActive(obj: any, style: CharStyle) {
  if (!obj) return;
  const props: Record<string, any> = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    fill: style.fill,
  };
  if (style.italic !== undefined) {
    props.italic = style.italic;
    props.fontStyle = style.italic ? "italic" : "normal";
  }
  obj.set(props);
  obj.setCoords?.();
  useEditorStore.getState().canvas?.requestRenderAll?.();
}

function applyParaStyleToActive(obj: any, style: ParaStyle) {
  if (!obj) return;
  const props: Record<string, any> = {
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
  };
  if (style.charSpacing !== undefined) props.charSpacing = style.charSpacing;
  obj.set(props);
  obj.setCoords?.();
  useEditorStore.getState().canvas?.requestRenderAll?.();
}

async function editCharStyleDialog(initial: CharStyle | null): Promise<CharStyle | null> {
  const res = await showOptions({
    title: initial ? "Edit Character Style" : "New Character Style",
    okLabel: "Save",
    fields: [
      { key: "name", label: "Style Name", type: "text", value: initial?.name ?? "" },
      { key: "fontFamily", label: "Font Family", type: "text", value: initial?.fontFamily ?? "Arial" },
      { key: "fontSize", label: "Font Size", type: "number", min: 1, max: 400, value: initial?.fontSize ?? 28 },
      {
        key: "fontWeight",
        label: "Font Weight",
        type: "select",
        value: initial?.fontWeight ?? "normal",
        options: [
          { value: "normal", label: "Normal" },
          { value: "bold", label: "Bold" },
        ],
      },
      {
        key: "letterSpacing",
        label: "Letter Spacing",
        type: "slider",
        min: -10,
        max: 50,
        step: 1,
        value: initial?.letterSpacing ?? 0,
      },
      { key: "fill", label: "Color", type: "color", value: initial?.fill ?? "#000000" },
      { key: "italic", label: "Italic", type: "checkbox", value: initial?.italic ?? false },
    ],
  });
  if (!res) return null;
  const name = String(res.name ?? "").trim();
  if (!name) {
    window.alert("Style name is required.");
    return null;
  }
  return {
    name,
    fontFamily: String(res.fontFamily ?? "Arial"),
    fontSize: Number(res.fontSize ?? 28),
    fontWeight: String(res.fontWeight ?? "normal"),
    letterSpacing: Number(res.letterSpacing ?? 0),
    fill: String(res.fill ?? "#000000"),
    italic: !!res.italic,
  };
}

async function editParaStyleDialog(initial: ParaStyle | null): Promise<ParaStyle | null> {
  const res = await showOptions({
    title: initial ? "Edit Paragraph Style" : "New Paragraph Style",
    okLabel: "Save",
    fields: [
      { key: "name", label: "Style Name", type: "text", value: initial?.name ?? "" },
      {
        key: "textAlign",
        label: "Alignment",
        type: "select",
        value: initial?.textAlign ?? "left",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
          { value: "justify", label: "Justify" },
        ],
      },
      {
        key: "lineHeight",
        label: "Line Height",
        type: "slider",
        min: 0.5,
        max: 3,
        step: 0.05,
        value: initial?.lineHeight ?? 1.2,
      },
    ],
  });
  if (!res) return null;
  const name = String(res.name ?? "").trim();
  if (!name) {
    window.alert("Style name is required.");
    return null;
  }
  return {
    name,
    textAlign: String(res.textAlign ?? "left"),
    lineHeight: Number(res.lineHeight ?? 1.2),
  };
}

export async function manageCharStyles(canvas: any) {
  const obj = canvas?.getActiveObject?.();
  if (!isTextObject(obj)) {
    window.alert("Select a text layer to manage character styles.");
    return;
  }
  const res = await showOptions({
    title: "Character Styles",
    fields: [
      {
        key: "style",
        label: "Style",
        type: "select",
        value: "+ New\u2026",
        options: [
          { value: "+ New\u2026", label: "+ New\u2026" },
          ...[...charStyles.keys()].map((n) => ({ value: n, label: n })),
        ],
      },
    ],
  });
  if (!res) return;
  const name = String(res.style);
  if (name === "+ New\u2026") {
    const style = await editCharStyleDialog(null);
    if (!style) return;
    charStyles.set(style.name, style);
    applyCharStyleToActive(obj, style);
    useEditorStore.getState().history?.push?.();
    return;
  }
  const existing = charStyles.get(name);
  if (!existing) return;
  const actionRes = await showOptions({
    title: `Character Style: ${name}`,
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: "apply",
        options: [
          { value: "apply", label: "Apply to Selected Text" },
          { value: "edit", label: "Edit" },
          { value: "delete", label: "Delete" },
        ],
      },
    ],
  });
  if (!actionRes) return;
  const action = String(actionRes.action);
  if (action === "apply") {
    applyCharStyleToActive(obj, existing);
    useEditorStore.getState().history?.push?.();
  } else if (action === "edit") {
    const edited = await editCharStyleDialog({ ...existing });
    if (edited) {
      charStyles.delete(name);
      charStyles.set(edited.name, edited);
    }
  } else if (action === "delete") {
    charStyles.delete(name);
  }
}

export async function manageParaStyles(canvas: any) {
  const obj = canvas?.getActiveObject?.();
  if (!isTextObject(obj)) {
    window.alert("Select a text layer to manage paragraph styles.");
    return;
  }
  const res = await showOptions({
    title: "Paragraph Styles",
    fields: [
      {
        key: "style",
        label: "Style",
        type: "select",
        value: "+ New\u2026",
        options: [
          { value: "+ New\u2026", label: "+ New\u2026" },
          ...[...paraStyles.keys()].map((n) => ({ value: n, label: n })),
        ],
      },
    ],
  });
  if (!res) return;
  const name = String(res.style);
  if (name === "+ New\u2026") {
    const style = await editParaStyleDialog(null);
    if (!style) return;
    paraStyles.set(style.name, style);
    applyParaStyleToActive(obj, style);
    useEditorStore.getState().history?.push?.();
    return;
  }
  const existing = paraStyles.get(name);
  if (!existing) return;
  const actionRes = await showOptions({
    title: `Paragraph Style: ${name}`,
    fields: [
      {
        key: "action",
        label: "Action",
        type: "select",
        value: "apply",
        options: [
          { value: "apply", label: "Apply to Selected Text" },
          { value: "edit", label: "Edit" },
          { value: "delete", label: "Delete" },
        ],
      },
    ],
  });
  if (!actionRes) return;
  const action = String(actionRes.action);
  if (action === "apply") {
    applyParaStyleToActive(obj, existing);
    useEditorStore.getState().history?.push?.();
  } else if (action === "edit") {
    const edited = await editParaStyleDialog({ ...existing });
    if (edited) {
      paraStyles.delete(name);
      paraStyles.set(edited.name, edited);
    }
  } else if (action === "delete") {
    paraStyles.delete(name);
  }
}

export async function styleFromSelection(canvas: any) {
  const obj = canvas?.getActiveObject?.();
  if (!isTextObject(obj)) {
    window.alert("Select a text layer to capture its style.");
    return;
  }
  const res = await showOptions({
    title: "Capture Character Style from Selection",
    fields: [{ key: "name", label: "Style Name", type: "text", value: "" }],
    okLabel: "Save",
  });
  if (!res) return;
  const name = String(res.name ?? "").trim();
  if (!name) {
    window.alert("Style name is required.");
    return;
  }
  const style: CharStyle = {
    name,
    fontFamily: obj.fontFamily ?? "Arial",
    fontSize: obj.fontSize ?? 28,
    fontWeight: obj.fontWeight ?? "normal",
    letterSpacing: obj.charSpacing ?? 0,
    fill: typeof obj.fill === "string" ? obj.fill : "#000000",
    italic: obj.fontStyle === "italic",
  };
  charStyles.set(name, style);
}
