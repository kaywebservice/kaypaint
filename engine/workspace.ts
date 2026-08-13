import { showOptions } from "@/components/Menu/OptionDialog";
import { useDocStore } from "@/store/documentStore";
import { useSettingsStore } from "@/store/settingsStore";
import { canvasNow } from "@/utils/menuUtils";

const EXTENSIONS_KEY = "kaypaint:extensions";

const DEFAULT_PANEL_KEYS: Record<string, boolean> = {
  layers: true,
  properties: true,
  adjustments: true,
  channels: true,
  paths: true,
  swatches: true,
  patterns: true,
  gradients: true,
  libraries: true,
  color: true,
  history: true,
  timeline: true,
  character: true,
  paragraph: true,
  navigator: true,
};

export interface InstalledExtension {
  name: string;
  installed: boolean;
}

export function panelsEqualDefaults(pv: Record<string, boolean>) {
  return Object.keys(DEFAULT_PANEL_KEYS).every((k) => pv[k] !== false);
}

export function panelsEqual(
  pv: Record<string, boolean>,
  other: Record<string, boolean>
) {
  const keys = new Set([...Object.keys(pv), ...Object.keys(other)]);
  for (const k of keys) {
    if ((pv[k] ?? true) !== (other[k] ?? true)) return false;
  }
  return true;
}

export function applyWorkspace(name: string) {
  const saved = useSettingsStore.getState().workspaces[name];
  if (!saved) return;
  useSettingsStore.getState().set({ panelVisible: { ...saved } });
}

export async function newWorkspaceDialog() {
  const res = await showOptions({
    title: "New Workspace",
    fields: [
      { key: "name", label: "Workspace Name", type: "text", value: "My Workspace" },
    ],
    okLabel: "Save",
  });
  const name = res?.name;
  if (name && String(name).trim()) {
    useSettingsStore.getState().saveWorkspace(String(name).trim());
  }
}

export async function deleteWorkspaceDialog() {
  const names = Object.keys(useSettingsStore.getState().workspaces);
  if (!names.length) {
    window.alert("There are no saved workspaces to delete.");
    return;
  }
  const res = await showOptions({
    title: "Delete Workspace",
    fields: [
      {
        key: "name",
        label: "Workspace",
        type: "select",
        value: names[0],
        options: names.map((n) => ({ value: n, label: n })),
      },
    ],
    okLabel: "Delete",
  });
  if (res?.name) {
    useSettingsStore.getState().deleteWorkspace(String(res.name));
  }
}

export function matchZoom() {
  const canvas = canvasNow();
  if (!canvas) return;
  canvas.setZoom(1);
  canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
  canvas.requestRenderAll?.();
}

export function matchLocation() {
  const canvas = canvasNow();
  if (!canvas) return;
  const active = canvas.getActiveObject?.();
  const target =
    active ??
    (canvas.getObjects?.() ?? []).find((o: { visible?: boolean }) => o.visible !== false);
  if (!target) return;
  target.setCoords?.();
  const bb = target.getBoundingRect?.();
  if (!bb) return;
  const vpt: number[] = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const zoom = vpt[0] || 1;
  canvas.viewportTransform = [
    vpt[0],
    vpt[1],
    vpt[2],
    vpt[3],
    canvas.width / 2 - (bb.left + bb.width / 2) * zoom,
    canvas.height / 2 - (bb.top + bb.height / 2) * zoom,
  ];
  canvas.requestRenderAll?.();
}

export function matchRotation() {
  window.alert("Viewport rotation is not supported for a single window.");
}

export function matchAll() {
  matchZoom();
}

export function consolidateToTabs() {
  const st = useDocStore.getState();
  st.setActiveDoc(st.activeDocId);
}

export const docLabel = (d: { name: string; dirty: boolean }) =>
  d.name + (d.dirty ? " *" : "");

export async function arrangeWindows(kind: "cascade" | "tile") {
  const st = useDocStore.getState();
  const docs = st.docs;
  if (!docs.length) return;
  const res = await showOptions({
    title: kind === "cascade" ? "Cascade Windows" : "Tile Windows",
    text:
      kind === "cascade"
        ? "Cascade overlapping windows for the open documents."
        : "Tile the open documents in a grid.",
    fields: [
      {
        key: "doc",
        label: "Window",
        type: "select",
        value: st.activeDocId,
        options: docs.map((d) => ({ value: d.id, label: docLabel(d) })),
      },
    ],
    okLabel: "Activate",
  });
  if (res?.doc) {
    st.setActiveDoc(String(res.doc));
  }
}

export function loadExtensions(): InstalledExtension[] {
  try {
    const raw = localStorage.getItem(EXTENSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as InstalledExtension[];
  } catch {
    /* ignore */
  }
  return [];
}

function persistExtensions(list: InstalledExtension[]) {
  try {
    localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(list));
  } catch {
    /* storage full */
  }
}

export function installExtension(name: string): InstalledExtension[] {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return loadExtensions();
  const list = loadExtensions().filter((e) => e.name !== trimmed);
  const next = [{ name: trimmed, installed: true }, ...list];
  persistExtensions(next);
  return next;
}

export function toggleExtension(name: string): InstalledExtension[] {
  const list = loadExtensions().map((e) =>
    e.name === name ? { ...e, installed: !e.installed } : e
  );
  persistExtensions(list);
  return list;
}

export async function installExtensionDialog(): Promise<boolean> {
  const res = await showOptions({
    title: "Install Extension",
    fields: [{ key: "name", label: "Extension Name", type: "text", value: "" }],
    okLabel: "Install",
  });
  const name = res?.name;
  if (!name || !String(name).trim()) return false;
  installExtension(String(name).trim());
  return true;
}

export function marketplaceDialog() {
  void showOptions({
    title: "Adobe Marketplace",
    text: "Open the extensions marketplace — coming soon",
    okLabel: "OK",
    fields: [],
  });
}

export function keyboardShortcutsDialog() {
  void showOptions({
    title: "Keyboard Shortcuts",
    text:
      "Shortcuts are managed by the editor and can be customized here in a future release.\n\nCurrent shortcuts:\n" +
      [
        "Ctrl+Z Undo · Ctrl+Shift+Z Redo",
        "Ctrl+S Save · Ctrl+Shift+S Save As",
        "Ctrl+N New Document · Ctrl+O Open",
        "Ctrl+C Copy · Ctrl+X Cut · Ctrl+V Paste",
        "Ctrl+A Select All · Ctrl+D Deselect",
        "Ctrl+J Duplicate Layer",
        "Ctrl+Plus Zoom In · Ctrl+Minus Zoom Out",
        "Ctrl+; Toggle Guides",
        "B Brush · E Eraser · T Text · M Marquee",
        "H Hand · Z Zoom · I Eyedropper",
      ].join("\n"),
    okLabel: "Close",
    fields: [],
  });
}

export function menusDialog() {
  void showOptions({
    title: "Menus",
    text:
      "Customize which menu commands are visible in each workspace. Menu customization is not available yet — this dialog is a placeholder.",
    okLabel: "Close",
    fields: [],
  });
}