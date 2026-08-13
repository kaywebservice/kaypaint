import { useFeaturesStore } from "@/store/featuresStore";
import { tools } from "@/store/toolRegistry";
import { commands } from "@/store/commandStore";
import { showOptions } from "@/components/Menu/OptionDialog";

const CANONICAL_DEFAULTS: Record<string, string> = {
  "edit-fill": "Shift+F5",
  "edit-stroke": "",
  "file-save": "Ctrl+S",
  "file-save-as": "Ctrl+Shift+S",
  "view-zoom-in": "Ctrl+Plus",
  "view-zoom-out": "Ctrl+Minus",
  "view-fit": "Ctrl+0",
  "view-zoom-100": "Ctrl+Alt+0",
  "help-search": "Ctrl+K",
};

const EDIT_IDS = [
  "edit-copy",
  "edit-paste",
  "edit-cut",
  "edit-duplicate",
  "edit-undo",
  "edit-redo",
  "edit-fill",
  "edit-stroke",
];

const FILE_IDS = ["file-new", "file-open-image", "file-save", "file-save-as"];

const VIEW_IDS = ["view-zoom-in", "view-zoom-out", "view-fit", "view-zoom-100"];

const HELP_IDS = ["help-search"];

export interface CommandInfo {
  group: string;
  id: string;
  label: string;
  defaultKey: string;
}

export function getBinding(toolId: string): string {
  const bound = useFeaturesStore.getState().keyBindings[toolId];
  if (bound) return bound;
  const tool = tools.find((t) => t.id === toolId);
  if (tool?.shortcut) return tool.shortcut;
  return "";
}

export function getAllCommands(): CommandInfo[] {
  const list: CommandInfo[] = [];
  const push = (group: string, ids: string[], defaults: Record<string, string>) => {
    for (const id of ids) {
      const cmd = commands.find((c) => c.id === id);
      list.push({
        group,
        id,
        label: cmd?.label ?? id,
        defaultKey: defaults[id] ?? cmd?.hint ?? "",
      });
    }
  };
  push("Tools", tools.map((t) => `tool-${t.id}`), {});
  push("Edit", EDIT_IDS, CANONICAL_DEFAULTS);
  push("File", FILE_IDS, CANONICAL_DEFAULTS);
  push("View", VIEW_IDS, CANONICAL_DEFAULTS);
  push("Help", HELP_IDS, CANONICAL_DEFAULTS);
  return list;
}

export async function openShortcutEditor() {
  const all = getAllCommands();
  const groups = Array.from(new Set(all.map((c) => c.group)));
  const first = all[0];
  const res = await showOptions({
    title: "Keyboard Shortcuts",
    okLabel: "Save",
    text:
      "Pick a command, type the new key (e.g. B or Ctrl+Shift+K), then press Save.\n" +
      "Ticking “Reset all bindings” restores every default shortcut.",
    fields: [
      {
        key: "group",
        label: "Group",
        type: "select",
        value: "all",
        options: [{ value: "all", label: "All Groups" }, ...groups.map((g) => ({ value: g, label: g }))],
      },
      {
        key: "command",
        label: "Command",
        type: "select",
        value: first?.id ?? "",
        options: all.map((c) => ({ value: c.id, label: `${c.label}  (${c.group})` })),
      },
      { key: "key", label: "New key", type: "text", value: getBinding(first?.id ?? "") },
      { key: "reset", label: "Reset all bindings", type: "checkbox", value: false },
    ],
  });
  if (!res) return;
  if (res.reset) {
    useFeaturesStore.getState().resetBindings();
    return;
  }
  const id = String(res.command ?? "");
  const key = String(res.key ?? "").trim();
  if (id && key) useFeaturesStore.getState().setKeyBinding(id, key);
}

export function applyBindingsToToolbar() {
  // No-op marker: the ToolManager integrator should render each tool's shortcut
  // by calling getBinding(toolId) so custom keys show up on tool buttons.
}
