import { showOptions } from "@/components/Menu/OptionDialog";
import { importImageFile } from "@/components/Tools/ImageTool";
import { importCanvasJSON } from "@/engine/exportEngine";
import { compositeCanvas } from "@/engine/pixelOps";
import { openPSDFile } from "@/engine/psdEngine";
import { useDocStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { KayLayer } from "@/types/layer";
import { loadJSONFile } from "@/utils/imageUtils";
import { canvasNow, getCtx, histNow } from "@/utils/menuUtils";

function activeDoc() {
  const st = useDocStore.getState();
  return st.docs.find((d) => d.id === st.activeDocId) ?? null;
}

export function openImagePicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  if (!document.body) return;
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      importImageFile(file, getCtx()).catch(() => {});
    }
    input.remove();
  };
  input.click();
}

export function openPsdPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".psd,application/photoshop";
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      openPSDFile(file, canvasNow()).catch((err) =>
        window.alert("Could not open PSD: " + err)
      );
    }
    input.remove();
  };
  input.click();
}

interface CanvasLike {
  getObjects?: () => unknown[];
  requestRenderAll?: () => void;
  toJSON?: () => unknown;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function rebuildLayersFromCanvas(canvas: CanvasLike | null) {
  const layers: KayLayer[] = [];
  const objects = canvas?.getObjects?.() ?? [];
  for (const o of objects) {
    const obj = (o ?? {}) as Record<string, unknown>;
    const rawId = obj.kaypaintId ?? obj.id;
    if (!rawId) continue;
    const t = asString(obj.type, "");
    let type: KayLayer["type"] = "shape";
    if (t === "image") type = "image";
    else if (t === "i-text" || t === "textbox" || t === "text") type = "text";
    else if (t === "adjustment") type = "adjustment";
    else if (t === "group" || t === "activeSelection") type = "group";
    layers.push({
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: asString(obj.name, t || "Layer"),
      type,
      visible: asBoolean(obj.visible, true),
      locked: asBoolean(obj.lockMovementX, false),
      opacity: Math.round(asNumber(obj.opacity, 1) * 100),
      blendMode: "normal",
      hasMask: false,
      objectId: String(rawId),
    });
  }
  useLayerStore.setState({
    layers,
    activeLayer: layers.length ? layers[layers.length - 1].id : null,
    groups: [],
  });
}

export async function applyProjectData(
  canvas: CanvasLike | null,
  data: unknown,
  docName: string
): Promise<void> {
  if (!canvas) throw new Error("No canvas available.");
  const json = (data as { canvas?: unknown } | null)?.canvas ?? data;
  await importCanvasJSON(canvas, json);
  const payload = (data ?? {}) as Record<string, unknown>;
  if (Array.isArray(payload.layers) || Array.isArray(payload.groups)) {
    useLayerStore.setState({
      layers: Array.isArray(payload.layers) ? payload.layers : [],
      activeLayer: null,
      groups: Array.isArray(payload.groups) ? payload.groups : [],
    });
  } else {
    rebuildLayersFromCanvas(canvas);
  }
  if (Array.isArray(payload.guides)) {
    useEditorStore.setState({ guides: payload.guides });
  }
  const st = useDocStore.getState();
  const finalName =
    (docName ?? "Untitled-1").replace(/\.kps?$/i, "").trim() || "Untitled-1";
  st.renameDoc(st.activeDocId, finalName);
  st.updateDocData(
    st.activeDocId,
    JSON.stringify(canvas.toJSON?.()),
    JSON.stringify(useLayerStore.getState().groups)
  );
  canvas.requestRenderAll?.();
}

export function openProjectPicker(renameTo: string | null) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json,.kp";
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    loadJSONFile(
      file,
      (data) => {
        applyProjectData(canvasNow(), data, renameTo ?? file.name)
          .then(() => {
            useSettingsStore.getState().addRecent(
              (renameTo ?? file.name).replace(/\.kps?$/i, "")
            );
          })
          .catch((err) => window.alert("Could not open project file: " + err));
      },
      (error) => window.alert("Could not read project file: " + error)
    );
    input.remove();
  };
  input.click();
}

export async function openRecent(selectedName?: string) {
  const recents = useSettingsStore.getState().recentFiles;
  if (!recents.length) {
    openProjectPicker(null);
    return;
  }
  const initial = recents.some((r) => r.name === selectedName)
    ? (selectedName as string)
    : recents[0].name;
  const res = await showOptions({
    title: "Open Recent",
    text: "Downloaded project files are not accessible from the browser. Choose a recent file, then pick the matching .kp file from disk.",
    fields: [
      {
        key: "name",
        label: "Recent file",
        type: "select",
        value: initial,
        options: recents.map((r) => ({ value: r.name, label: r.name })),
      },
    ],
    okLabel: "Open File…",
  });
  if (!res) return;
  openProjectPicker(String(res.name));
}

export function clearRecentFiles() {
  useSettingsStore.getState().set({ recentFiles: [] });
}

export async function revertDocument() {
  const canvas = canvasNow();
  const doc = activeDoc();
  if (!canvas || !doc?.data) {
    window.alert("Nothing to revert.");
    return;
  }
  try {
    await canvas.loadFromJSON(JSON.parse(doc.data));
    canvas.requestRenderAll();
    if (doc.groups) {
      try {
        useLayerStore.setState({ groups: JSON.parse(doc.groups) });
      } catch {
        useLayerStore.setState({ groups: [] });
      }
    }
    useDocStore.getState().clearDirty();
    histNow()?.reset?.();
  } catch {
    window.alert("Nothing to revert.");
  }
}

export function closeDocument() {
  const st = useDocStore.getState();
  const doc = st.docs.find((d) => d.id === st.activeDocId);
  if (!doc) return;
  if (
    doc.dirty &&
    !window.confirm("Close the document and discard unsaved changes?")
  ) {
    return;
  }
  st.closeDoc(st.activeDocId);
}

export async function saveCopy() {
  const st = useDocStore.getState();
  const doc = st.docs.find((d) => d.id === st.activeDocId);
  if (!doc) return;
  const res = await showOptions({
    title: "Save a Copy",
    fields: [{ key: "name", label: "File name", type: "text", value: doc.name }],
    okLabel: "Save",
  });
  if (!res) return;
  const name = String(res.name).trim() || doc.name;
  const originalName = doc.name;
  st.saveDocAs({ name, download: true });
  st.renameDoc(st.activeDocId, originalName);
  useSettingsStore.getState().addRecent(name);
}

export async function fileInfo() {
  const doc = activeDoc();
  const canvas = canvasNow();
  if (!doc || !canvas) return;
  const w = Math.round(canvas.width ?? canvas.getWidth?.() ?? 0);
  const h = Math.round(canvas.height ?? canvas.getHeight?.() ?? 0);
  const dpi = useSettingsStore.getState().dpi;
  await showOptions({
    title: "File Info",
    fields: [
      { key: "name", label: "Name", type: "text", value: doc.name },
      {
        key: "dimensions",
        label: "Dimensions",
        type: "text",
        value: `${w} x ${h} px`,
      },
      {
        key: "mode",
        label: "Color Mode",
        type: "select",
        value: "RGB",
        options: [
          { value: "RGB", label: "RGB" },
          { value: "CMYK", label: "CMYK" },
          { value: "Lab", label: "Lab" },
        ],
      },
      {
        key: "dpi",
        label: "Resolution",
        type: "number",
        value: dpi,
        min: 1,
        max: 1000,
        suffix: " ppi",
      },
      { key: "author", label: "Author", type: "text", value: "" },
    ],
  });
}

export async function printDocument() {
  const canvas = canvasNow();
  const composite = await compositeCanvas(canvas);
  if (!composite) {
    window.alert("Nothing to print.");
    return;
  }
  const src = composite.toDataURL("image/png");
  const win = window.open("", "_blank", "width=860,height=640");
  if (!win) return;
  win.document.open();
  win.document.write(
    "<!doctype html><html><head><title>Print</title></head>" +
      '<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">' +
      '<img id="kaypaint-print" src="' +
      src +
      '" style="max-width:100%;max-height:100%;object-fit:contain" />' +
      "</body></html>"
  );
  win.document.close();
  const triggerPrint = () => {
    win.focus();
    win.print();
  };
  const img = win.document.getElementById("kaypaint-print");
  if (img && "complete" in img && (img as HTMLImageElement).complete) {
    triggerPrint();
  } else if (img) {
    (img as HTMLImageElement).addEventListener("load", triggerPrint);
  }
  window.setTimeout(triggerPrint, 1200);
}