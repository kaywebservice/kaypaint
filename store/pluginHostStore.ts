import { create } from "zustand";
import { getPluginManager } from "@/engine/pluginRuntime";
import type { ToolbarButtonConfig } from "@/engine/pluginRuntimeCore";

export interface PluginPanelContribution {
  pluginId: string;
  id: string;
  title: string;
  content: string;
}

export interface PluginToolbarContribution {
  pluginId: string;
  config: ToolbarButtonConfig;
}

interface PluginHostState {
  toolbarButtons: PluginToolbarContribution[];
  panels: PluginPanelContribution[];
  activePlugins: string[];
  refresh: () => void;
}

function snapshot() {
  const manager = getPluginManager();
  const toolbarButtons: PluginToolbarContribution[] = [];
  const panels: PluginPanelContribution[] = [];
  for (const pluginId of manager.activePlugins()) {
    for (const config of manager.getToolbarButtons(pluginId)) {
      toolbarButtons.push({ pluginId, config });
    }
    for (const panel of manager.getPanels(pluginId)) {
      panels.push({ pluginId, ...panel });
    }
  }
  return {
    toolbarButtons,
    panels,
    activePlugins: manager.activePlugins(),
  };
}

export const usePluginHostStore = create<PluginHostState>((set) => ({
  ...snapshot(),
  refresh: () => set(snapshot()),
}));

let started = false;

/**
 * Subscribe the reactive host store to the plugin manager so enabling /
 * disabling a plugin (or a plugin adding a toolbar button / panel) is
 * reflected in the UI automatically. Call once on the client.
 */
export function startPluginHostStore() {
  if (started) return;
  started = true;
  const manager = getPluginManager();
  manager.on(() => usePluginHostStore.getState().refresh());
  usePluginHostStore.getState().refresh();
}
