"use client";

import { useFeaturesStore } from "@/store/featuresStore";
import { canvasNow } from "@/engine/pixelOps";
import { captureComp, applyComp } from "@/engine/layerComps";

export default function LayerCompsPanel() {
  const comps = useFeaturesStore((s) => s.layerComps);
  const removeComp = useFeaturesStore((s) => s.removeComp);

  const doApply = (id: string) => void applyComp(canvasNow(), id);
  const doDelete = (id: string) => removeComp(id);

  return (
    <div className="flex flex-col h-full bg-gray-800/60">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10">
        <button
          onClick={() => void captureComp(canvasNow())}
          className="flex-1 px-2 py-1 text-[11px] rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
        >
          New Comp
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {comps.length === 0 && (
          <div className="p-3 text-[11px] text-gray-500 leading-relaxed">
            No layer comps yet. Capture the current document state as a comp, then apply it later.
          </div>
        )}
        <div className="divide-y divide-white/5">
          {comps.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-2 hover:bg-white/5">
              {c.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumb} alt={c.name} className="w-12 h-12 object-contain rounded border border-white/10 bg-black/30" />
              ) : (
                <div className="w-12 h-12 rounded border border-white/10 bg-black/30" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-100 truncate">{c.name}</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}{" "}
                  {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button
                onClick={() => doApply(c.id)}
                className="px-1.5 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-gray-300"
                title="Apply"
              >
                Apply
              </button>
              <button
                onClick={() => doDelete(c.id)}
                className="px-1.5 py-1 text-[11px] rounded bg-white/5 hover:bg-red-600/40 text-gray-300"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      {comps.length > 0 && (
        <div className="px-2 py-1.5 border-t border-white/10 text-[10px] text-gray-500">
          Applying a comp restores its canvas and layer state.
        </div>
      )}
    </div>
  );
}
