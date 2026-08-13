import { useFeaturesStore } from "@/store/featuresStore";
import { showOptions } from "@/components/Menu/OptionDialog";

export interface MenuItemDef {
  id: string;
  menu: string;
  label: string;
}

export const MENU_ITEMS: MenuItemDef[] = [
  { id: "file.new", menu: "File", label: "New…" },
  { id: "file.open", menu: "File", label: "Open…" },
  { id: "file.openRecent", menu: "File", label: "Open Recent" },
  { id: "file.save", menu: "File", label: "Save" },
  { id: "file.saveAs", menu: "File", label: "Save As…" },
  { id: "file.export", menu: "File", label: "Export" },
  { id: "file.share", menu: "File", label: "Share" },
  { id: "file.close", menu: "File", label: "Close" },

  { id: "edit.undo", menu: "Edit", label: "Undo" },
  { id: "edit.redo", menu: "Edit", label: "Redo" },
  { id: "edit.cut", menu: "Edit", label: "Cut" },
  { id: "edit.copy", menu: "Edit", label: "Copy" },
  { id: "edit.paste", menu: "Edit", label: "Paste" },
  { id: "edit.fill", menu: "Edit", label: "Fill…" },
  { id: "edit.stroke", menu: "Edit", label: "Stroke…" },
  { id: "edit.keyboardShortcuts", menu: "Edit", label: "Keyboard Shortcuts…" },

  { id: "image.mode", menu: "Image", label: "Mode" },
  { id: "image.adjustments", menu: "Image", label: "Adjustments" },
  { id: "image.autoTone", menu: "Image", label: "Auto Tone" },
  { id: "image.autoContrast", menu: "Image", label: "Auto Contrast" },
  { id: "image.autoColor", menu: "Image", label: "Auto Color" },
  { id: "image.imageSize", menu: "Image", label: "Image Size…" },
  { id: "image.canvasSize", menu: "Image", label: "Canvas Size…" },
  { id: "image.rotate", menu: "Image", label: "Image Rotation" },

  { id: "layer.new", menu: "Layer", label: "New Layer" },
  { id: "layer.duplicate", menu: "Layer", label: "Duplicate Layer" },
  { id: "layer.delete", menu: "Layer", label: "Delete Layer" },
  { id: "layer.rename", menu: "Layer", label: "Rename Layer" },
  { id: "layer.newGroup", menu: "Layer", label: "New Group" },
  { id: "layer.arrange", menu: "Layer", label: "Arrange" },
  { id: "layer.align", menu: "Layer", label: "Align" },
  { id: "layer.mergeDown", menu: "Layer", label: "Merge Down" },

  { id: "select.all", menu: "Select", label: "All" },
  { id: "select.deselect", menu: "Select", label: "Deselect" },
  { id: "select.inverse", menu: "Select", label: "Inverse" },
  { id: "select.subject", menu: "Select", label: "Subject" },
  { id: "select.colorRange", menu: "Select", label: "Color Range…" },
  { id: "select.modify", menu: "Select", label: "Modify" },

  { id: "filter.gallery", menu: "Filter", label: "Filter Gallery…" },
  { id: "filter.blur", menu: "Filter", label: "Blur" },
  { id: "filter.sharp", menu: "Filter", label: "Sharpen" },
  { id: "filter.noise", menu: "Filter", label: "Noise" },
  { id: "filter.render", menu: "Filter", label: "Render" },
  { id: "filter.other", menu: "Filter", label: "Other" },

  { id: "view.zoomIn", menu: "View", label: "Zoom In" },
  { id: "view.zoomOut", menu: "View", label: "Zoom Out" },
  { id: "view.fitOnScreen", menu: "View", label: "Fit on Screen" },
  { id: "view.actualPixels", menu: "View", label: "Actual Pixels" },
  { id: "view.printSize", menu: "View", label: "Print Size" },
  { id: "view.guides", menu: "View", label: "Guides" },
  { id: "view.grid", menu: "View", label: "Grid" },
  { id: "view.rulers", menu: "View", label: "Rulers" },

  { id: "plugins.marketplace", menu: "Plugins", label: "Browse Marketplace…" },
  { id: "plugins.installed", menu: "Plugins", label: "Installed Plugins" },
  { id: "plugins.reload", menu: "Plugins", label: "Reload All" },
  { id: "plugins.developer", menu: "Plugins", label: "Developer Mode" },

  { id: "window.panels", menu: "Window", label: "Panels" },
  { id: "window.workspace", menu: "Window", label: "Workspace" },
  { id: "window.arrange", menu: "Window", label: "Arrange" },
  { id: "window.reset", menu: "Window", label: "Reset Workspace" },

  { id: "help.home", menu: "Help", label: "KayPaint Help" },
  { id: "help.search", menu: "Help", label: "Search" },
  { id: "help.docs", menu: "Help", label: "Documentation" },
  { id: "help.about", menu: "Help", label: "About KayPaint" },
];

const COLOR_OPTIONS = [
  { value: "none", label: "None" },
  { value: "#ef4444", label: "Red" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#f97316", label: "Orange" },
];

export function isMenuHidden(id: string): boolean {
  return useFeaturesStore.getState().menuCustom[id]?.hidden ?? false;
}

export function menuColor(id: string): string | null {
  return useFeaturesStore.getState().menuCustom[id]?.color ?? null;
}

export async function openMenusEditor() {
  const menus = Array.from(new Set(MENU_ITEMS.map((m) => m.menu)));
  const first = MENU_ITEMS[0];
  const res = await showOptions({
    title: "Customize Menus",
    okLabel: "Save",
    text:
      "Pick a menu item, then hide it or mark it with a color for quick recognition.\n" +
      "Ticking “Reset all” restores the default menus.",
    fields: [
      {
        key: "menu",
        label: "Menu",
        type: "select",
        value: menus[0] ?? "File",
        options: menus.map((m) => ({ value: m, label: m })),
      },
      {
        key: "item",
        label: "Item",
        type: "select",
        value: first?.id ?? "",
        options: MENU_ITEMS.map((m) => ({ value: m.id, label: `${m.menu} › ${m.label}` })),
      },
      { key: "hidden", label: "Hide item", type: "checkbox", value: isMenuHidden(first?.id ?? "") },
      { key: "color", label: "Color", type: "select", value: menuColor(first?.id ?? "") ?? "none", options: COLOR_OPTIONS },
      { key: "reset", label: "Reset all menu customizations", type: "checkbox", value: false },
    ],
  });
  if (!res) return;
  if (res.reset) {
    useFeaturesStore.getState().resetMenus();
    return;
  }
  const id = String(res.item ?? "");
  if (!id) return;
  const color = String(res.color ?? "none");
  useFeaturesStore.getState().setMenuCustom(id, {
    hidden: !!res.hidden,
    color: color === "none" ? null : color,
  });
}
