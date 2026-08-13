"use client";

import { useState } from "react";
import { Grid3x3, Keyboard, Command, Puzzle, X } from "lucide-react";

const KEY = "kaypaint:onboarded:v1";

const TIPS = [
  {
    icon: Grid3x3,
    title: "Tools are grouped like Photoshop",
    body: "Each toolbar icon is a group — click the tiny caret to open a flyout of the other tools in that slot.",
  },
  {
    icon: Keyboard,
    title: "Keyboard-first",
    body: "Press Ctrl+K to open the command palette and run anything. Double-click a path to edit its anchors. Q toggles Quick Mask.",
  },
  {
    icon: Command,
    title: "Edit Edit Edit — with a safety net",
    body: "Every change is undoable (Ctrl+Z), history is non-blocking, and heavy pixel work runs off the main thread so the UI never freezes.",
  },
  {
    icon: Puzzle,
    title: "92 plugins, all real",
    body: "Add QR codes, barcodes, AI background cutout, PSD export, video — all from the Plugins menu in the top bar.",
  },
];

export default function OnboardingOverlay() {
  const [show, setShow] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return !localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-[560px] max-w-[94vw] max-h-[85vh] overflow-y-auto rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/70 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Welcome to KayPaint</h1>
            <p className="text-sm text-gray-400 mt-1">
              A full-featured image editor that runs in your browser.
            </p>
          </div>
          <button onClick={dismiss} className="p-1 rounded hover:bg-white/10 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {TIPS.map((tip) => {
            const Icon = tip.icon;
            return (
              <div key={tip.title} className="flex gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                <Icon size={20} className="text-indigo-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-100">{tip.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{tip.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={dismiss}
          className="mt-5 w-full px-4 py-2.5 rounded-xl accent-gradient text-white font-semibold shadow-lg shadow-indigo-500/30 hover:brightness-110"
        >
          Get started
        </button>
      </div>
    </div>
  );
}
