"use client";

import { useEffect, useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import {
  APP_NAME,
  APP_VERSION,
  getCurrentUser,
  manageExtensions,
  openDocs,
  openSearch,
  openSupportCommunity,
  requestSignIn,
  resetSettings,
  runUpdates,
  signOut,
  subscribeUserChanged,
} from "@/engine/helpOps";
import { getKeyboardShortcuts, getSystemInfo } from "@/engine/interfaceOps";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[540px] max-h-[85vh] overflow-y-auto bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">{title}</div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-[12px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
          >
            Close
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export default function HelpMenu() {
  const [tick, setTick] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => subscribeUserChanged(() => setTick((t) => t + 1)), []);
  void tick;

  const user = getCurrentUser();

  const entries: MenuEntry[] = [
    {
      label: "KayPaint Help",
      onClick: openDocs,
    },
    {
      label: "Search…",
      onClick: () => void openSearch(),
    },
    {
      label: "Support Community",
      onClick: openSupportCommunity,
    },
    { divider: true },
    {
      label: "Manage Extensions…",
      onClick: () => void manageExtensions(),
    },
    {
      label: "Updates…",
      onClick: () => void runUpdates(),
    },
    {
      label: "System Info…",
      onClick: () => setInfoOpen(true),
    },
    {
      label: "Keyboard Shortcuts",
      onClick: () => setShortcutsOpen(true),
    },
    { divider: true },
    {
      label: "Reset All Settings…",
      danger: true,
      onClick: () => void resetSettings(),
    },
    user
      ? { label: `Signed in as ${user}`, checked: true, disabled: true }
      : {
          label: "Sign In…",
          onClick: () => void requestSignIn(),
        },
    {
      label: "Sign Out",
      disabled: !user,
      onClick: signOut,
    },
    { divider: true },
    {
      label: "About KayPaint",
      onClick: () => setAboutOpen(true),
    },
  ];

  const shortcuts = getKeyboardShortcuts();
  const sys = getSystemInfo();

  return (
    <>
      <MenuButton title="Help" entries={entries} />

      <Modal open={shortcutsOpen} title="Keyboard Shortcuts" onClose={() => setShortcutsOpen(false)}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="text-left text-gray-400 py-1.5 pr-2">Group</th>
                <th className="text-left text-gray-400 py-1.5 pr-2">Command</th>
                <th className="text-left text-gray-400 py-1.5">Key</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((s, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-1 pr-2 text-gray-400">{s.group}</td>
                  <td className="py-1 pr-2 text-gray-300">{s.label}</td>
                  <td className="py-1 font-mono text-indigo-300">{s.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={infoOpen} title="System Info" onClose={() => setInfoOpen(false)}>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">App</td>
              <td className="py-1.5 text-gray-300">{sys.appName} {sys.appVersion}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">OS</td>
              <td className="py-1.5 text-gray-300">{sys.os}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Browser</td>
              <td className="py-1.5 text-gray-300 break-all">{sys.browser}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Screen</td>
              <td className="py-1.5 text-gray-300">{sys.screen}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Memory</td>
              <td className="py-1.5 text-gray-300">{sys.memory}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Document</td>
              <td className="py-1.5 text-gray-300">{sys.docW} x {sys.docH} px @ {sys.zoom}%</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Color Mode</td>
              <td className="py-1.5 text-gray-300">{sys.mode}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-gray-400">Plugins</td>
              <td className="py-1.5 text-gray-300">{sys.pluginCount} in catalog</td>
            </tr>
          </tbody>
        </table>
      </Modal>

      <Modal open={aboutOpen} title="About KayPaint" onClose={() => setAboutOpen(false)}>
        <div className="space-y-3 text-[13px] text-gray-300">
          <div>
            <span className="text-white font-medium">{APP_NAME}</span> {APP_VERSION} — a Photoshop-style
            web editor built with fabric.js.
          </div>
          <div>
            Tools: move, select, marquee, brush, pencil, eraser, text, shapes, bucket, gradient, crop,
            zoom, hand, eyedropper, blur, brightness, plus filters and an AI background removal
            assistant.
          </div>
          <div>
            <span className="text-gray-400">Platform:</span> {sys.platform ?? "web"}
          </div>
        </div>
      </Modal>
    </>
  );
}
