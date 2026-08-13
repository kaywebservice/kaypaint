"use client";

import { useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { useDocStore } from "@/store/documentStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFeaturesStore } from "@/store/featuresStore";
import {
  applyWorkspace,
  arrangeWindows,
  consolidateToTabs,
  deleteWorkspaceDialog,
  docLabel,
  installExtensionDialog,
  loadExtensions,
  marketplaceDialog,
  matchAll,
  matchLocation,
  matchRotation,
  matchZoom,
  menusDialog,
  newWorkspaceDialog,
  panelsEqual,
  panelsEqualDefaults,
  toggleExtension,
  keyboardShortcutsDialog,
} from "@/engine/workspace";

const PANEL_TABS: { id: string; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "layers", label: "Layers" },
  { id: "channels", label: "Channels" },
  { id: "paths", label: "Paths" },
  { id: "adjustments", label: "Adjustments" },
  { id: "character", label: "Character" },
  { id: "paragraph", label: "Paragraph" },
  { id: "swatches", label: "Swatches" },
  { id: "gradients", label: "Gradients" },
  { id: "patterns", label: "Patterns" },
  { id: "libraries", label: "Libraries" },
  { id: "actions", label: "Actions" },
  { id: "glyphs", label: "Glyphs" },
  { id: "comps", label: "Layer Comps" },
  { id: "history", label: "History" },
];

export default function WindowMenu() {
  const docs = useDocStore((s) => s.docs);
  const activeDocId = useDocStore((s) => s.activeDocId);
  const panelVisible = useSettingsStore((s) => s.panelVisible);
  const workspaces = useSettingsStore((s) => s.workspaces);
  const [, setTick] = useState(0);

  const extensions = loadExtensions();

  const infoOpen = useFeaturesStore((s) => s.infoOpen);
  const aiAssistantOpen = useFeaturesStore((s) => s.aiAssistantOpen);
  const panelVisibility = useFeaturesStore((s) => s.panelVisibility);
  const actionsVisible = panelVisible["actions"] !== false;

  const arrange: MenuEntry[] = [
    { label: "Cascade", onClick: () => void arrangeWindows("cascade") },
    { label: "Tile", onClick: () => void arrangeWindows("tile") },
    {
      label: "Float in Window",
      onClick: () =>
        window.alert("Floating windows are not supported for a single window."),
    },
    {
      label: "Float All in Windows",
      onClick: () =>
        window.alert("Floating windows are not supported for a single window."),
    },
    { divider: true },
    { label: "Match Zoom", onClick: matchZoom },
    { label: "Match Location", onClick: matchLocation },
    { label: "Match Rotation", onClick: matchRotation },
    { label: "Match All", onClick: matchAll },
    { divider: true },
    { label: "Consolidate All to Tabs", onClick: consolidateToTabs },
  ];

  const workspace: MenuEntry[] = [
    {
      label: "Essentials",
      checked: panelsEqualDefaults(panelVisible),
      onClick: () => useSettingsStore.getState().resetWorkspace(),
    },
    ...Object.keys(workspaces).map((name) => ({
      label: name,
      checked: panelsEqual(panelVisible, workspaces[name]),
      onClick: () => applyWorkspace(name),
    })),
    {
      label: "Reset Essentials",
      onClick: () => useSettingsStore.getState().resetWorkspace(),
    },
    { divider: true },
    {
      label: "New Workspace…",
      onClick: () => void newWorkspaceDialog(),
    },
    {
      label: "Delete Workspace…",
      onClick: () => void deleteWorkspaceDialog(),
    },
    { divider: true },
    { label: "Keyboard Shortcuts…", onClick: keyboardShortcutsDialog },
    { label: "Menus…", onClick: menusDialog },
  ];

  const extensionChildren: MenuEntry[] = [
    { label: "Adobe Marketplace…", onClick: marketplaceDialog },
    { divider: true },
    {
      label: "Install…",
      onClick: async () => {
        if (await installExtensionDialog()) setTick((t) => t + 1);
      },
    },
  ];

  if (extensions.length) {
    extensionChildren.push({ divider: true });
    for (const ext of extensions) {
      extensionChildren.push({
        label: ext.name,
        checked: ext.installed,
        onClick: () => {
          toggleExtension(ext.name);
          setTick((t) => t + 1);
        },
      });
    }
  }

  const entries: MenuEntry[] = [
    { id: "window.arrange", label: "Arrange", children: arrange },
    { id: "window.workspace", label: "Workspace", children: workspace },
    { label: "Extensions", children: extensionChildren },
    { divider: true },
    {
      id: "window.panels",
      label: "Actions",
      checked: actionsVisible,
      onClick: () => useSettingsStore.getState().setPanelVisible("actions", !actionsVisible),
    },
    {
      id: "window.reset",
      label: "Info",
      checked: infoOpen,
      onClick: () => useFeaturesStore.getState().setInfoOpen(!infoOpen),
    },
    {
      id: "window.panels",
      label: "Panels",
      children: PANEL_TABS.map((t) => ({
        id: `window.panels.${t.id}`,
        label: t.label,
        checked: panelVisibility[t.id] !== false,
        onClick: () =>
          useFeaturesStore.getState().setPanelVisibility(t.id, !(panelVisibility[t.id] !== false)),
      })),
    },
    {
      id: "window.aiAssistant",
      label: "AI Assistant",
      checked: aiAssistantOpen,
      onClick: () => useFeaturesStore.getState().setAiAssistantOpen(!aiAssistantOpen),
    },
    { divider: true },
    ...docs.map((doc) => ({
      label: docLabel(doc),
      checked: doc.id === activeDocId,
      onClick: () => useDocStore.getState().setActiveDoc(doc.id),
    })),
  ];

  return <MenuButton title="Window" entries={entries} />;
}