"use client";

import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { PLUGIN_CATALOG } from "@/engine/pluginCatalog";
import { usePluginStore } from "@/store/pluginStore";
import { isPluginShipped } from "@/engine/pluginRuntime";

export default function PluginMenu() {
  const openMarket = usePluginStore((s) => s.openMarket);
  const state = usePluginStore();

  const checkUpdates = () => {
    window.alert(`All ${PLUGIN_CATALOG.length} plugins are up to date.`);
  };

  const installed: MenuEntry[] = PLUGIN_CATALOG.filter((p) => state.owns(p.id)).map((p) => {
    const shipped = isPluginShipped(p.id);
    return {
      label: shipped ? p.name : `${p.name} (coming soon)`,
      checked: shipped && !!state.enabled[p.id],
      disabled: !shipped,
      onClick: () => {
        if (shipped) state.toggleEnabled(p.id);
      },
    };
  });

  const entries: MenuEntry[] = [
    {
      label: "Plugin Market…",
      onClick: () => openMarket(false),
    },
    {
      label: "All-Access Bundle…",
      onClick: () => openMarket(true),
    },
    { divider: true },
    {
      label: `Installed (${installed.length})`,
      children:
        installed.length > 0
          ? [...installed, { divider: true }, { label: "Manage in Market…", onClick: () => openMarket(false) }]
          : [{ label: "Nothing installed yet — visit the market", disabled: true, onClick: () => openMarket(false) }],
    },
    { divider: true },
    {
      label: "Check for Updates…",
      disabled: !state.bundleOwned && installed.length === 0,
      onClick: checkUpdates,
    },
    {
      label: "Plugin Help",
      onClick: () => window.open("https://github.com/anomalyco/kaypaint/issues", "_blank"),
    },
  ];

  return <MenuButton title="Plugins" entries={entries} />;
}