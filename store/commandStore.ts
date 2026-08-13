import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { useDocStore } from "@/store/documentStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { usePluginStore } from "@/store/pluginStore";
import { getCtx, canvasNow, histNow } from "@/utils/menuUtils";
import { tools } from "@/store/toolRegistry";
import { exportPNG, exportJPEG, exportSVG, exportJSON, clearCanvas } from "@/engine/exportEngine";
import { exportPSD, openPSDFile } from "@/engine/psdEngine";
import { applyFilter, clearFilters } from "@/engine/filterEngine";
import { copyActiveSelection, pasteClipboard, cutActiveSelection, duplicateActiveSelection, applyToolOnce } from "@/engine/toolEngine";
import { applyPathfinder } from "@/engine/pathfinder";
import { toggleQuickMask, grow, similar } from "@/engine/selectOps";
import { refineEdges } from "@/engine/refineEdge";
import { playAction } from "@/engine/actionsEngine";
import { REAL_PLUGINS } from "@/engine/pluginRuntime";
import { PLUGIN_CATALOG } from "@/engine/pluginCatalog";
import type { ToolId } from "@/types/editor";

export interface CommandDef {
  id: string;
  label: string;
  group: string;
  hint: string;
  run: () => void;
}

export const commands: CommandDef[] = [
  ...tools.map((t) => ({
    id: `tool-${t.id}`,
    label: t.name,
    group: "Tools",
    hint: t.shortcut,
    run: () => useEditorStore.getState().setTool(t.id as ToolId),
  })),
  {
    id: "file-new",
    label: "New Document",
    group: "File",
    hint: "Ctrl+Shift+N",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      if (!window.confirm("Start a new blank document?")) return;
      clearCanvas(canvas);
      useLayerStore.setState({ layers: [], activeLayer: null });
      histNow()?.reset?.();
    },
  },
  {
    id: "file-open-image",
    label: "Open Image…",
    group: "File",
    hint: "Ctrl+O",
    run: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          import("@/components/Tools/ImageTool").then(({ importImageFile }) =>
            importImageFile(file, getCtx()).catch(() => {})
          );
        }
        input.remove();
      };
      input.click();
    },
  },
  {
    id: "file-open-psd",
    label: "Open PSD…",
    group: "File",
    hint: "",
    run: () => {
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
    },
  },
  {
    id: "export-png",
    label: "Export as PNG",
    group: "File",
    hint: "",
    run: () => exportPNG(canvasNow()),
  },
  {
    id: "export-jpeg",
    label: "Export as JPEG",
    group: "File",
    hint: "",
    run: () => exportJPEG(canvasNow()),
  },
  {
    id: "export-svg",
    label: "Export as SVG",
    group: "File",
    hint: "",
    run: () => exportSVG(canvasNow()),
  },
  {
    id: "export-psd",
    label: "Save as PSD",
    group: "File",
    hint: "",
    run: () => exportPSD(canvasNow(), "kaypaint.psd"),
  },
  {
    id: "export-json",
    label: "Export Project (JSON)",
    group: "File",
    hint: "",
    run: () => exportJSON(canvasNow()),
  },
  {
    id: "edit-undo",
    label: "Undo",
    group: "Edit",
    hint: "Ctrl+Z",
    run: () => histNow()?.undo?.(),
  },
  {
    id: "edit-redo",
    label: "Redo",
    group: "Edit",
    hint: "Ctrl+Shift+Z",
    run: () => histNow()?.redo?.(),
  },
  {
    id: "edit-copy",
    label: "Copy Selection",
    group: "Edit",
    hint: "Ctrl+C",
    run: () => copyActiveSelection(canvasNow()),
  },
  {
    id: "edit-paste",
    label: "Paste",
    group: "Edit",
    hint: "Ctrl+V",
    run: () => pasteClipboard(canvasNow(), getCtx()),
  },
  {
    id: "edit-cut",
    label: "Cut Selection",
    group: "Edit",
    hint: "Ctrl+X",
    run: () => cutActiveSelection(canvasNow(), getCtx()),
  },
  {
    id: "edit-duplicate",
    label: "Duplicate Selection",
    group: "Edit",
    hint: "Ctrl+J",
    run: () => duplicateActiveSelection(canvasNow(), getCtx()),
  },
  {
    id: "edit-delete",
    label: "Delete Selection",
    group: "Edit",
    hint: "Del",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      const objs = canvas.getActiveObjects();
      if (objs.length) {
        objs.forEach((o: any) => canvas.remove(o));
        canvas.discardActiveObject();
        getCtx().push();
      }
    },
  },
  {
    id: "edit-select-all",
    label: "Select All",
    group: "Edit",
    hint: "Ctrl+A",
    run: () => {
      const canvas = canvasNow();
      const objects = canvas?.getObjects?.() ?? [];
      if (objects.length) canvas?.setActiveObject(objects);
    },
  },
  {
    id: "view-zoom-in",
    label: "Zoom In",
    group: "View",
    hint: "Ctrl+wheel",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      const c = canvas.getCenter();
      canvas.zoomToPoint(c, canvas.getZoom() * 1.25);
      canvas.requestRenderAll();
    },
  },
  {
    id: "view-zoom-out",
    label: "Zoom Out",
    group: "View",
    hint: "",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      const c = canvas.getCenter();
      canvas.zoomToPoint(c, canvas.getZoom() * 0.8);
      canvas.requestRenderAll();
    },
  },
  {
    id: "view-zoom-100",
    label: "Actual Pixels (100%)",
    group: "View",
    hint: "",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.requestRenderAll();
    },
  },
  {
    id: "view-fit",
    label: "Fit on Screen",
    group: "View",
    hint: "",
    run: () => {
      const canvas = canvasNow();
      if (!canvas) return;
      const z = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height) * 0.9;
      canvas.setViewportTransform([z, 0, 0, z, 0, 0]);
      canvas.requestRenderAll();
    },
  },
  {
    id: "view-guides",
    label: "Show / Hide Guides",
    group: "View",
    hint: "Ctrl+;",
    run: () => useEditorStore.getState().toggleGuides(),
  },
  {
    id: "view-guides-clear",
    label: "Clear All Guides",
    group: "View",
    hint: "",
    run: () => useEditorStore.getState().clearGuides(),
  },
  {
    id: "filter-grayscale",
    label: "Grayscale Filter",
    group: "Image",
    hint: "",
    run: () => {
      const obj = canvasNow()?.getActiveObject();
      if (obj) {
        applyFilter(obj, "grayscale");
        getCtx().push();
      }
    },
  },
  {
    id: "filter-sepia",
    label: "Sepia Filter",
    group: "Image",
    hint: "",
    run: () => {
      const obj = canvasNow()?.getActiveObject();
      if (obj) {
        applyFilter(obj, "sepia");
        getCtx().push();
      }
    },
  },
  {
    id: "filter-invert",
    label: "Invert Filter",
    group: "Image",
    hint: "",
    run: () => {
      const obj = canvasNow()?.getActiveObject();
      if (obj) {
        applyFilter(obj, "invert");
        getCtx().push();
      }
    },
  },
  {
    id: "filter-pixelate",
    label: "Pixelate Filter",
    group: "Image",
    hint: "",
    run: () => {
      const obj = canvasNow()?.getActiveObject();
      if (obj) {
        applyFilter(obj, "pixelate", { blocksize: 6 });
        getCtx().push();
      }
    },
  },
  {
    id: "filter-clear",
    label: "Clear Filters",
    group: "Image",
    hint: "",
    run: () => {
      const obj = canvasNow()?.getActiveObject();
      if (obj) {
        clearFilters(obj);
        getCtx().push();
      }
    },
  },
  {
    id: "layer-new",
    label: "New Layer",
    group: "Layer",
    hint: "",
    run: () => useLayerStore.getState().addLayer(),
  },
  {
    id: "layer-new-group",
    label: "New Group from Layer",
    group: "Layer",
    hint: "Ctrl+G",
    run: () => {
      const id = useLayerStore.getState().activeLayer;
      if (id) useLayerStore.getState().createGroup([id]);
    },
  },
  {
    id: "layer-ungroup",
    label: "Ungroup Layers",
    group: "Layer",
    hint: "Ctrl+Shift+G",
    run: () => {
      const { activeLayer, groups } = useLayerStore.getState();
      const group = groups.find((g) => g.children.includes(activeLayer ?? ""));
      if (group) useLayerStore.getState().deleteGroup(group.id);
    },
  },
  {
    id: "layer-duplicate",
    label: "Duplicate Layer",
    group: "Layer",
    hint: "",
    run: () => {
      const id = useLayerStore.getState().activeLayer;
      if (id) useLayerStore.getState().duplicateLayer(id);
    },
  },
  {
    id: "layer-delete",
    label: "Delete Layer",
    group: "Layer",
    hint: "",
    run: () => {
      const id = useLayerStore.getState().activeLayer;
      if (id) useLayerStore.getState().removeLayer(id);
    },
  },
  {
    id: "layer-front",
    label: "Bring Layer to Front",
    group: "Layer",
    hint: "",
    run: () => {
      const id = useLayerStore.getState().activeLayer;
      if (id) useLayerStore.getState().bringLayerToFront(id);
    },
  },
  {
    id: "layer-back",
    label: "Send Layer to Back",
    group: "Layer",
    hint: "",
    run: () => {
      const id = useLayerStore.getState().activeLayer;
      if (id) useLayerStore.getState().sendLayerToBack(id);
    },
  },
  {
    id: "adjustment-levels",
    label: "Add Levels Adjustment Layer",
    group: "Adjustment",
    hint: "",
    run: () => useLayerStore.getState().addAdjustmentLayer("levels"),
  },
  {
    id: "adjustment-curves",
    label: "Add Curves Adjustment Layer",
    group: "Adjustment",
    hint: "",
    run: () => useLayerStore.getState().addAdjustmentLayer("curves"),
  },
  {
    id: "adjustment-huesat",
    label: "Add Hue/Saturation Adjustment Layer",
    group: "Adjustment",
    hint: "",
    run: () => useLayerStore.getState().addAdjustmentLayer("hueSat"),
  },
  {
    id: "doc-new",
    label: "New Document Tab",
    group: "Document",
    hint: "Ctrl+Shift+N",
    run: () => useDocStore.getState().createDoc(),
  },
  {
    id: "liquify-tool",
    label: "Liquify",
    group: "Tools",
    hint: "Warp brush",
    run: () => applyToolOnce("liquify", getCtx()),
  },
  {
    id: "select-quickmask",
    label: "Toggle Quick Mask",
    group: "Selection",
    hint: "Q",
    run: () => toggleQuickMask(),
  },
  {
    id: "select-grow",
    label: "Grow Selection",
    group: "Selection",
    hint: "",
    run: () => void grow(),
  },
  {
    id: "select-similar",
    label: "Select Similar Color",
    group: "Selection",
    hint: "",
    run: () => void similar(),
  },
  {
    id: "select-refine-edge",
    label: "Refine Edge…",
    group: "Selection",
    hint: "",
    run: () => void refineEdges(canvasNow()),
  },
  {
    id: "pathfinder-unite",
    label: "Pathfinder: Unite",
    group: "Vector",
    hint: "2 shapes selected",
    run: () => void applyPathfinder(canvasNow(), "union"),
  },
  {
    id: "pathfinder-intersect",
    label: "Pathfinder: Intersect",
    group: "Vector",
    hint: "2 shapes selected",
    run: () => void applyPathfinder(canvasNow(), "intersect"),
  },
  {
    id: "pathfinder-subtract",
    label: "Pathfinder: Subtract Front",
    group: "Vector",
    hint: "2 shapes selected",
    run: () => void applyPathfinder(canvasNow(), "subtract"),
  },
];

/** Commands generated from live state: user actions + shipped plugins. */
function dynamicCommands(): CommandDef[] {
  const out: CommandDef[] = [];
  for (const a of Object.values(useFeaturesStore.getState().actions)) {
    if (!a || !a.id) continue;
    out.push({
      id: `action-${a.id}`,
      label: `Run Action: ${a.name}`,
      group: "Action",
      hint: a.steps?.length ? `${a.steps.length} steps` : "",
      run: () => void playAction(canvasNow(), a as any, false),
    });
  }
  const catalog = PLUGIN_CATALOG;
  for (const id of Object.keys(REAL_PLUGINS)) {
    const def = catalog.find((p) => p.id === id);
    out.push({
      id: `plugin-${id}`,
      label: `Open Plugin: ${def?.name ?? id}`,
      group: "Plugin",
      hint: id,
      run: () => {
        const st = usePluginStore.getState();
        if (!st.enabled[id]) st.purchase(id);
      },
    });
  }
  return out;
}

const RECENT_KEY = "kaypaint:recentCommands";
let recentIds: string[] = [];
try {
  if (typeof window !== "undefined") {
    recentIds = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  }
} catch {
  recentIds = [];
}

function persistRecents() {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds.slice(0, 6)));
  } catch {
    /* ignore */
  }
}

export function runCommand(id: string) {
  const cmd = [...commands, ...dynamicCommands()].find((c) => c.id === id);
  if (cmd) {
    cmd.run();
    recentIds = [id, ...recentIds.filter((r) => r !== id)].slice(0, 6);
    persistRecents();
  }
}

export function searchCommands(query: string): CommandDef[] {
  const all = [...commands, ...dynamicCommands()];
  const q = query.trim().toLowerCase();
  if (!q) {
    // Show recently used commands first.
    const byId = new Map(all.map((c) => [c.id, c]));
    const recents = recentIds.map((id) => byId.get(id)).filter(Boolean) as CommandDef[];
    const rest = all.filter((c) => !recentIds.includes(c.id));
    return [...recents, ...rest];
  }
  const scored: { cmd: CommandDef; score: number }[] = [];
  for (const cmd of all) {
    const label = cmd.label.toLowerCase();
    const group = cmd.group.toLowerCase();
    const hint = (cmd.hint ?? "").toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = 100;
    else if (label.includes(q)) score = 60;
    else if (group.includes(q)) score = 40;
    else if (hint.includes(q)) score = 35;
    else {
      const parts = q.split(/\s+/);
      const allP = parts.every((p) => label.includes(p) || group.includes(p) || hint.includes(p));
      if (allP) score = 30;
    }
    if (score > 0) scored.push({ cmd, score });
  }
  scored.sort((a, b) => b.score - a.score || a.cmd.label.localeCompare(b.cmd.label));
  return scored.map((s) => s.cmd);
}