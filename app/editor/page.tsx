"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/immutability */

import { useEffect } from "react";
import KayCanvas from "@/components/Editor/CanvasViewport";
import Toolbar from "@/components/Editor/Toolbar";
import ToolManager from "@/components/Editor/ToolManager";
import MainMenu from "@/components/Menu/MainMenu";
import OptionsBar from "@/components/Editor/OptionsBar";
import Timeline from "@/components/Editor/Timeline";
import DocumentTabs from "@/components/Editor/DocumentTabs";
import CanvasContextMenu from "@/components/Editor/CanvasContextMenu";
import RightSidebar from "@/components/Panels/RightSidebar";
import InfoPanel from "@/components/Panels/InfoPanel";
import AIAssistantPanel from "@/components/Panels/AIAssistantPanel";
import ToastHost from "@/components/ToastHost";
import ShortcutEditorDialog from "@/components/ShortcutEditorDialog";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import { installToastPatch } from "@/utils/notify";
import { useEditorStore } from "@/store/editorStore";

export default function EditorPage() {
  useEffect(() => {
    installToastPatch();
    import("@/engine/dropletEngine").then((m) => m.runDropletFromUrl());
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    import("@/engine/pluginRuntime").then((m) => m.syncPluginStoreWithRuntime());
    import("@/store/pluginHostStore").then((m) => m.startPluginHostStore());
  }, []);

  if (typeof window !== "undefined") {
    (window as any).__kaypaintStore = useEditorStore;
  }

  return (
    <main className="flex flex-col flex-1 min-h-screen bg-gray-900 text-white overflow-hidden">
      <ToastHost />
      <ShortcutEditorDialog />
      <OnboardingOverlay />
      <ToolManager />
      <MainMenu />
      <OptionsBar />
      <InfoPanel />
      <AIAssistantPanel />

      <section className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-44 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-700 bg-gray-950 flex items-center justify-center">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Tools</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 flex flex-col scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <Toolbar />
          </div>
        </aside>

        {/* Canvas Area - Photoshop style: top-left with rulers */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <DocumentTabs />
          <KayCanvas />
          <Timeline />
        </div>

        <CanvasContextMenu />

        {/* Right Sidebar */}
        <RightSidebar />
      </section>
    </main>
  );
}