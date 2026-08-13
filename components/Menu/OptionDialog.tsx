"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";

export interface OptionField {
  key: string;
  label: string;
  type: "slider" | "number" | "color" | "select" | "text" | "checkbox";
  min?: number;
  max?: number;
  step?: number;
  value: number | string | boolean;
  options?: { value: string; label: string }[];
  suffix?: string;
}

interface DialogOpen {
  title: string;
  fields: OptionField[];
  okLabel?: string;
  text?: string;
}

let resolver: ((value: Record<string, any> | null) => void) | null = null;
let open: DialogOpen | null = null;
let listeners: (() => void)[] = [];

function notify() {
  for (const l of listeners) l();
}

/**
 * Global promise-based options dialog. Any menu command can do:
 *   const res = await showOptions({ title: "Blur", fields: [...] });
 *   if (res) { ... }
 */
export function showOptions(opts: DialogOpen): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    resolver = resolve;
    open = opts;
    notify();
  });
}

export function closeOptions() {
  resolver?.(null);
  resolver = null;
  open = null;
  notify();
}

export default function OptionDialog() {
  const [state, setState] = useState<Record<string, any>>({});
  const [dialog, setDialog] = useState(open);

  useEffect(() => {
    const refresh = () => {
      setDialog(open);
      if (open) {
        const init: Record<string, any> = {};
        for (const f of open.fields) init[f.key] = f.value;
        setState(init);
      }
    };
    listeners.push(refresh);
    return () => {
      listeners = listeners.filter((l) => l !== refresh);
    };
  }, []);

  if (!dialog) return null;

  const fields = dialog.fields;
  const doOk = () => {
    resolver?.(state);
    resolver = null;
    open = null;
    notify();
  };
  const doCancel = () => {
    resolver?.(null);
    resolver = null;
    open = null;
    notify();
  };

  const set = (key: string, value: any) => setState((s) => ({ ...s, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) doCancel();
      }}
    >
      <div className="w-[420px] max-h-[80vh] overflow-y-auto bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-4">
        <div className="text-sm font-semibold text-white mb-3">{dialog.title}</div>
        {dialog.text && (
          <div className="text-[12px] text-gray-400 mb-3 whitespace-pre-wrap">{dialog.text}</div>
        )}
        <div className="space-y-3">
          {fields.map((f) => {
            const v = state[f.key];
            return (
              <div key={f.key}>
                <div className="flex justify-between items-baseline">
                  <label className="text-[12px] text-gray-300">{f.label}</label>
                  {f.type !== "checkbox" && (
                    <span className="text-[11px] text-indigo-300 tabular-nums">
                      {typeof v === "number" ? (Math.round(v * 100) / 100).toLocaleString() : String(v)}
                      {f.suffix ?? ""}
                    </span>
                  )}
                </div>
                {f.type === "slider" && (
                  <input
                    type="range"
                    min={f.min ?? 0}
                    max={f.max ?? 100}
                    step={f.step ?? 1}
                    value={Number(v)}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                )}
                {f.type === "number" && (
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={Number(v)}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                    className="w-full bg-gray-900 border border-white/10 rounded-md px-2 py-1 text-[13px] text-white"
                  />
                )}
                {f.type === "color" && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={String(v)}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="h-8 w-12 cursor-pointer bg-transparent border border-white/10 rounded-md"
                    />
                    <input
                      type="text"
                      value={String(v)}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="flex-1 bg-gray-900 border border-white/10 rounded-md px-2 py-1 text-[12px] text-white"
                    />
                  </div>
                )}
                {f.type === "select" && (
                  <select
                    value={String(v)}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-md px-2 py-1 text-[13px] text-white"
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                {f.type === "text" && (
                  <input
                    type="text"
                    value={String(v)}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-md px-2 py-1 text-[13px] text-white"
                  />
                )}
                {f.type === "checkbox" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) => set(f.key, e.target.checked)}
                      className="accent-indigo-500"
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={doCancel}
            className="px-3 py-1.5 text-[12px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={doOk}
            className="px-3 py-1.5 text-[12px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            {dialog.okLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}