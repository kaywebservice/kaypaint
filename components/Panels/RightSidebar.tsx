"use client";

import { useState } from "react";
import PropertiesPanel from "@/components/Editor/PropertiesPanel";
import LayerPanel from "@/layers/LayerPanel";
import ChannelsPanel from "@/components/Panels/ChannelsPanel";
import PathsPanel from "@/components/Panels/PathsPanel";
import LibrariesPanel from "@/components/Panels/LibrariesPanel";
import AdjustmentsPanel from "@/components/Panels/AdjustmentsPanel";
import SwatchesPanel from "@/components/Panels/SwatchesPanel";
import GradientsPanel from "@/components/Panels/GradientsPanel";
import PatternsPanel from "@/components/Panels/PatternsPanel";
import CharacterPanel from "@/components/Panels/CharacterPanel";
import ParagraphPanel from "@/components/Panels/ParagraphPanel";
import ActionsPanel from "@/components/Panels/ActionsPanel";
import GlyphsPanel from "@/components/Panels/GlyphsPanel";
import LayerCompsPanel from "@/components/Panels/LayerCompsPanel";
import HistoryPanel from "@/components/Panels/HistoryPanel";
import { useSettingsStore } from "@/store/settingsStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { usePluginHostStore, type PluginPanelContribution } from "@/store/pluginHostStore";
import { getPluginManager } from "@/engine/pluginRuntime";
import { showOptions } from "@/components/Menu/OptionDialog";

function PluginPanel({ panel }: { panel: PluginPanelContribution }) {
  const manager = getPluginManager();

  const dispatch = (el: HTMLElement) => {
    const action = el.getAttribute("data-plugin-action");
    if (!action) return;
    const value =
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
        ? el.value
        : el.getAttribute("data-value") ?? "";
    manager.runPanelAction(panel.pluginId, panel.id, action, value);
  };

  return (
    <div
      className="text-xs leading-relaxed"
      dangerouslySetInnerHTML={{ __html: panel.content }}
      onClick={(e) => dispatch(e.target as HTMLElement)}
      onChange={(e) => dispatch(e.target as HTMLElement)}
    />
  );
}

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  component: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "properties", label: "Properties", component: <PropertiesPanel /> },
  { id: "layers", label: "Layers", component: <LayerPanel /> },
  { id: "channels", label: "Channels", component: <ChannelsPanel /> },
  { id: "paths", label: "Paths", component: <PathsPanel /> },
  { id: "adjustments", label: "Adjustments", component: <AdjustmentsPanel /> },
  { id: "character", label: "Character", component: <CharacterPanel /> },
  { id: "paragraph", label: "Paragraph", component: <ParagraphPanel /> },
  { id: "swatches", label: "Swatches", component: <SwatchesPanel /> },
  { id: "gradients", label: "Gradients", component: <GradientsPanel /> },
  { id: "patterns", label: "Patterns", component: <PatternsPanel /> },
  { id: "libraries", label: "Libraries", component: <LibrariesPanel /> },
  { id: "actions", label: "Actions", component: <ActionsPanel /> },
  { id: "glyphs", label: "Glyphs", component: <GlyphsPanel /> },
  { id: "comps", label: "Layer Comps", component: <LayerCompsPanel /> },
  { id: "history", label: "History", component: <HistoryPanel /> },
];

const PRIMARY_IDS = [
  "properties",
  "layers",
  "channels",
  "paths",
  "adjustments",
  "character",
  "paragraph",
  "history",
];

export default function RightSidebar() {
  const [activeTab, setActiveTab] = useState("layers");
  const panelVisible = useSettingsStore((s) => s.panelVisible);
  const panelVisibility = useFeaturesStore((s) => s.panelVisibility);
  const pluginPanels = usePluginHostStore((s) => s.panels);

  const pluginTabs: Tab[] = pluginPanels.map((p) => ({
    id: `plugin-${p.pluginId}-${p.id}`,
    label: p.title,
    component: <PluginPanel panel={p} />,
  }));

  const visibleTabs = [
    ...tabs.filter(
      (t) => panelVisible[t.id] !== false && panelVisibility[t.id] !== false
    ),
    ...pluginTabs,
  ];
  const primaryTabs = visibleTabs.filter((t) => PRIMARY_IDS.includes(t.id));
  const secondaryTabs = visibleTabs.filter((t) => !PRIMARY_IDS.includes(t.id));
  const hiddenTabs = tabs.filter(
    (t) => panelVisible[t.id] === false || panelVisibility[t.id] === false
  );
  const currentTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id ?? "layers";

  const addPanels = async () => {
    if (!hiddenTabs.length) return;
    const res = await showOptions({
      title: "Add Panels",
      fields: hiddenTabs.map((t) => ({
        key: t.id,
        label: t.label,
        type: "checkbox",
        value: true,
      })),
      okLabel: "Show",
    });
    if (!res) return;
    const st = useSettingsStore.getState();
    for (const t of hiddenTabs) {
      if (res[t.id]) st.setPanelVisible(t.id, true);
    }
  };

  return (
    <aside className="w-72 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
      {/* Primary Tab Bar */}
      <div className="border-b border-white/5 bg-gray-950/60">
        <div className="flex overflow-x-auto px-2 py-1.5 gap-1">
          {primaryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${
                currentTab === tab.id
                  ? "accent-active text-white shadow-lg shadow-indigo-500/25"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => void addPanels()}
            disabled={hiddenTabs.length === 0}
            title="Add hidden panels"
            className="ml-auto flex-shrink-0 w-7 h-7 flex items-center justify-center text-[13px] leading-none font-bold rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Secondary Tab Bar (collapsible) */}
      <div className="border-b border-white/5 bg-gray-950/60">
        <details className="group">
          <summary className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 hover:text-white cursor-pointer flex items-center gap-1 select-none">
            <span>More</span>
            <svg
              className="w-3 h-3 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="flex flex-wrap px-2 pb-2 gap-1">
            {secondaryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                  currentTab === tab.id
                    ? "accent-active text-white shadow-md shadow-indigo-500/25"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </details>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {visibleTabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 overflow-y-auto ${currentTab === tab.id ? "block" : "hidden"}`}
          >
            <div className="p-3">{tab.component}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}