/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEditorStore } from "@/store/editorStore";
import { tools } from "@/store/toolRegistry";
import { getAllCommands, getBinding } from "@/engine/shortcuts";
import { PLUGIN_CATALOG } from "@/engine/pluginCatalog";
import { getImageMode } from "@/engine/imageOps";
import pkg from "../package.json";

export interface KeyboardShortcut {
  group: string;
  label: string;
  key: string;
}

/** Main keyboard shortcuts aggregated from the tool registry and command store. */
export function getKeyboardShortcuts(): KeyboardShortcut[] {
  const out: KeyboardShortcut[] = [];
  for (const t of tools) {
    out.push({ group: "Tools", label: t.name, key: getBinding(t.id) || "—" });
  }
  for (const c of getAllCommands()) {
    if (c.group === "Tools" || !c.defaultKey) continue;
    out.push({ group: c.group, label: c.label, key: c.defaultKey });
  }
  return out;
}

export interface SystemInfo {
  appName: string;
  appVersion: string;
  platform: string;
  os: string;
  browser: string;
  userAgent: string;
  screen: string;
  memory: string;
  docW: number;
  docH: number;
  zoom: number;
  mode: string;
  pluginCount: number;
}

function detectBrowser(ua: string): string {
  if (/Edg\/|Edge\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Unknown";
}

/** Collect runtime/system info for the Help → System Info panel. */
export function getSystemInfo(): SystemInfo {
  const state = useEditorStore.getState();
  const canvas: any = state.canvas;
  const zoom = Math.round((canvas?.getZoom?.() ?? 1) * 100);
  const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";
  const nav: any = isBrowser ? (navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  }) : null;
  const ua = isBrowser ? navigator.userAgent : "";
  const platform = nav ? (nav.userAgentData?.platform ?? nav.platform ?? "Unknown") : "Unknown";
  const memory = nav && nav.deviceMemory ? `${nav.deviceMemory} GB` : "Unknown";
  const screenDesc = isBrowser && window.screen ? `${window.screen.width} x ${window.screen.height}` : "Unknown";
  return {
    appName: pkg.name,
    appVersion: pkg.version,
    platform,
    os: `${detectBrowser(ua)} · ${platform}`,
    browser: ua,
    userAgent: ua,
    screen: screenDesc,
    memory,
    docW: state.canvasW,
    docH: state.canvasH,
    zoom,
    mode: (getImageMode() || "RGB").toUpperCase(),
    pluginCount: PLUGIN_CATALOG.length,
  };
}
