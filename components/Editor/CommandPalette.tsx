"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { searchCommands, runCommand, type CommandDef } from "@/store/commandStore";

export default function CommandPalette() {
  const open = useEditorStore((state) => state.paletteOpen);
  const setOpen = useEditorStore((state) => state.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => searchCommands(query), [query, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const execute = (cmd: CommandDef) => {
    setOpen(false);
    runCommand(cmd.id);
  };

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[index];
      if (cmd) execute(cmd);
      return;
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
      onPointerDown={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Search size={16} className="text-indigo-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search commands, tools, actions…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-100 placeholder:text-gray-500"
          />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
            Esc
          </span>
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              No commands match “{query}”
            </div>
          )}
          {results.map((cmd, i) => (
            <button
              key={cmd.id}
              data-idx={i}
              onPointerEnter={() => setIndex(i)}
              onClick={() => execute(cmd)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                i === index
                  ? "bg-indigo-500/20 text-white border-l-2 border-indigo-400"
                  : "text-gray-300 border-l-2 border-transparent hover:bg-white/5"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider text-gray-500 w-16 shrink-0">
                {cmd.group}
              </span>
              <span className="flex-1 truncate">{cmd.label}</span>
              {cmd.hint && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10 shrink-0">
                  {cmd.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}