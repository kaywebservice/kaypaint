"use client";

import { useState, useEffect } from "react";
import {
  RotateCcw,
  RotateCw,
  Camera,
  Trash2,
  Clock,
} from "lucide-react";
import { histNow } from "@/utils/menuUtils";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";

const FMT = (ts: number) => new Date(ts).toLocaleTimeString();

export default function HistoryPanel() {
  const historyVisible = useSettingsStore((s) => s.panelVisible["history"] !== false);
  const canvas = useEditorStore((s) => s.canvas);

  const [expanded, setExpanded] = useState(true);
  const [steps, setSteps] = useState<{ id: number; name: string; ts: number }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);

  useEffect(() => {
    if (!canvas) return;
    const history = histNow();
    if (!history) return;
    const sync = () => {
      if (!history) return;
      setSteps(history.historyStack.map((s: { id: number; name: string; timestamp: number }) => ({ id: s.id, name: s.name, ts: s.timestamp })));
      setCurrentIdx(history.currentIndex);
    };
    sync();
    const id = setInterval(sync, 200);
    return () => clearInterval(id);
  }, [canvas]);

  if (!historyVisible) return null;

  const history = histNow();
  const canUndo = history?.canUndo ?? false;
  const canRedo = history?.canRedo ?? false;

  const handleUndo = () => history?.undo();
  const handleRedo = () => history?.redo();
  const handleJump = (idx: number) => history?.jumpTo(idx);
  const handleTruncate = (idx: number) => {
    if (window.confirm("Delete all steps after this one?")) history?.truncate(idx);
  };
  const handleSnapshot = () => {
    const name = window.prompt("Snapshot name:", `Snapshot ${new Date().toLocaleTimeString()}`);
    if (name) history?.snapshot(name);
  };
  const handleClear = () => {
    if (window.confirm("Clear all history?")) history?.clear();
  };

  return (
    <div className="flex flex-col min-h-40 bg-gray-900 shrink-0 border-t border-white/5">
      <div className="h-10 flex items-center gap-1 px-2 border-b border-white/5 bg-gray-950/70 flex-shrink-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300"
          title={expanded ? "Collapse" : "Expand"}
        >
          <Clock size={14} />
        </button>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-gradient uppercase tracking-wider pr-2">
          History
        </span>

        <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 disabled:opacity-40">
          <RotateCcw size={14} />
        </button>
        <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 disabled:opacity-40">
          <RotateCw size={14} />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button onClick={handleSnapshot} title="Create Snapshot" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300">
          <Camera size={14} />
        </button>
        <button onClick={handleClear} title="Clear History" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin p-1">
          {steps.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-gray-500">
              No history yet. Perform an action to start recording.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 px-2 py-1.5 hover:bg-white/5 cursor-pointer transition-colors ${
                    idx === currentIdx ? "bg-indigo-500/20 text-white" : "text-gray-300"
                  }`}
                  onClick={() => handleJump(idx)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleTruncate(idx);
                  }}
                  title={`Jump to this step${idx !== steps.length - 1 ? " (right-click to truncate here)" : ""}`}
                >
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{idx + 1}</span>
                  <span className="flex-1 truncate text-[11px]">{step.name}</span>
                  <span className="text-[9px] text-gray-500">{FMT(step.ts)}</span>
                  {idx === currentIdx && <span className="text-indigo-400 text-[10px]">●</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}