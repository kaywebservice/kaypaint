"use client";

import { useState } from "react";
import { useFeaturesStore } from "@/store/featuresStore";
import { canvasNow } from "@/engine/pixelOps";
import {
  startRecording,
  stopRecording,
  cancelRecording,
  playAction,
  playActionDialog,
  deleteActionAction,
  isRecording,
} from "@/engine/actionsEngine";
import { showOptions } from "@/components/Menu/OptionDialog";
import { runScriptDialog } from "@/engine/scriptEngine";

export default function ActionsPanel() {
  const actions = useFeaturesStore((s) => s.actions);
  const saveAction = useFeaturesStore((s) => s.saveAction);
  const [rec, setRec] = useState(isRecording());

  const doRecord = () => {
    startRecording();
    setRec(true);
  };

  const doStop = async () => {
    const id = await stopRecording(canvasNow());
    setRec(false);
    if (id) setRec(isRecording());
  };

  const doNew = async () => {
    const res = await showOptions({
      title: "New Action",
      fields: [{ key: "name", label: "Action Name", type: "text", value: "Action 1" }],
      okLabel: "Create",
    });
    if (!res) return;
    const name = String(res.name ?? "Action 1") || "Action 1";
    saveAction({
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      steps: [],
      createdAt: Date.now(),
    });
  };

  const doCancel = () => {
    cancelRecording();
    setRec(false);
  };

  const list = Object.values(actions).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full bg-gray-800/60">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10">
        {rec ? (
          <>
            <button
              onClick={doStop}
              className="flex-1 px-2 py-1 text-[11px] rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              ■ Stop
            </button>
            <button
              onClick={doCancel}
              className="px-2 py-1 text-[11px] rounded-md bg-white/10 hover:bg-white/20 text-gray-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={doRecord}
            className="flex-1 px-2 py-1 text-[11px] rounded-md bg-gray-700 hover:bg-gray-600 text-white font-medium"
          >
            ● Record
          </button>
        )}
        <button
          onClick={doNew}
          className="flex-1 px-2 py-1 text-[11px] rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
        >
          New
        </button>
        <button
          onClick={() => void runScriptDialog(canvasNow())}
          title="Run a JSON script (loops, conditions, batch over layers)"
          className="px-2 py-1 text-[11px] rounded-md bg-fuchsia-700/60 hover:bg-fuchsia-600/70 text-white font-medium"
        >
          Script
        </button>
      </div>
      {rec && (
        <div className="px-2 py-1 text-[11px] text-red-400 bg-red-950/40 border-b border-red-900/40 animate-pulse">
          Recording… performing actions now captures steps.
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && (
          <div className="p-3 text-[11px] text-gray-500 leading-relaxed">
            No actions yet. Press <span className="text-gray-300">Record</span>, perform
            operations (invert, blur, resize…), then <span className="text-gray-300">Stop</span> to
            save the action.
          </div>
        )}
        <div className="divide-y divide-white/5">
          {list.map((a) => (
            <div key={a.id} className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/5">
              <button
                onClick={() => void playAction(canvasNow(), a, true)}
                className="flex-1 text-left"
                title={`Play ${a.name}`}
              >
                <div className="text-[12px] text-gray-100 truncate">▶ {a.name}</div>
                <div className="text-[10px] text-gray-500 truncate">
                  {a.steps.length ? a.steps.map((s) => s.label).join(" → ") : "empty action"}
                </div>
              </button>
              <button
                onClick={() => void playActionDialog(canvasNow())}
                className="px-1.5 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-gray-300"
                title="Play with dialog…"
              >
                …
              </button>
              <button
                onClick={() => deleteActionAction(a.id)}
                className="px-1.5 py-1 text-[11px] rounded bg-white/5 hover:bg-red-600/40 text-gray-300"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      {list.length > 0 && (
        <div className="px-2 py-1.5 border-t border-white/10 text-[10px] text-gray-500">
          Play applies each step to the active layer / document.
        </div>
      )}
    </div>
  );
}
