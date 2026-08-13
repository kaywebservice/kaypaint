"use client";

import { useMemo, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { useFeaturesStore } from "@/store/featuresStore";
import { getAllCommands, getBinding } from "@/engine/shortcuts";

export default function ShortcutEditorDialog() {
  const open = useFeaturesStore((s) => s.shortcutEditorOpen);
  const setOpen = useFeaturesStore((s) => s.setShortcutEditorOpen);
  const keyBindings = useFeaturesStore((s) => s.keyBindings);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const commands = useMemo(() => getAllCommands(), []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return commands.filter((c) => {
      if (q && !c.label.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [commands, filter]);

  const currentBinding = (id: string) => getBinding(id) || "";

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (capturing) {
      e.preventDefault();
      e.stopPropagation();
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const mods: string[] = [];
      if (e.ctrlKey || e.metaKey) mods.push(e.ctrlKey && e.metaKey ? "Ctrl+Meta" : e.ctrlKey ? "Ctrl" : "Meta");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      const main = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const combo = mods.length ? mods.join("+") + "+" + main : main;
      useFeaturesStore.getState().setKeyBinding(capturing, combo);
      setCapturing(null);
      return;
    }
    if (e.key === "Escape") setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onPointerDown={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] max-h-[80vh] rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
        tabIndex={0}
        onKeyDown={onKeyDown}
        autoFocus
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <span className="font-medium text-sm text-gray-100">Keyboard Shortcuts</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter commands…"
            className="flex-1 ml-2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 placeholder:text-gray-600 outline-none"
          />
          <button
            onClick={() => {
              useFeaturesStore.getState().resetBindings();
            }}
            title="Reset all bindings to defaults"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
          >
            <RotateCcw size={12} />
            Reset all
          </button>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 py-1">
          {visible.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">No commands match “{filter}”</div>
          )}
          {visible.map((c) => {
            const bound = currentBinding(c.id);
            const isCustom = !!keyBindings[c.id];
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-white/5"
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-500 w-16 shrink-0">
                  {c.group}
                </span>
                <span className="flex-1 truncate text-gray-200">{c.label}</span>
                <button
                  onClick={() => setCapturing(c.id)}
                  title="Click then press the new key(s)"
                  className={`px-2 py-0.5 rounded text-[11px] border ${
                    capturing === c.id
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-200 animate-pulse"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {capturing === c.id ? "Press keys…" : bound || "—"}
                </button>
                {isCustom && (
                  <button
                    onClick={() => useFeaturesStore.getState().setKeyBinding(c.id, "")}
                    title="Clear custom binding"
                    className="text-[10px] px-1 rounded text-gray-500 hover:text-white hover:bg-white/10"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-gray-600">
          Click a key, then press the new combination. Modifier combos like Ctrl+Shift+K work too.
        </div>
      </div>
    </div>
  );
}
