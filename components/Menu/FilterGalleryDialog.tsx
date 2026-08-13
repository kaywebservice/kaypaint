"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { applyFilter, applyFilterToCanvas } from "@/engine/filterEngine";
import { canvasNow } from "@/utils/menuUtils";

interface FilterDef {
  name: string;
  label: string;
  options?: any;
}

const FILTER_DEFS: FilterDef[] = [
  { name: "grayscale", label: "Grayscale" },
  { name: "sepia", label: "Sepia" },
  { name: "invert", label: "Invert" },
  { name: "pixelate", label: "Pixelate", options: { blocksize: 8 } },
  { name: "noise", label: "Noise", options: { noise: 60 } },
  { name: "vintage", label: "Vintage" },
  { name: "kodachrome", label: "Kodachrome" },
  { name: "polaroid", label: "Polaroid" },
  { name: "brownie", label: "Brownie" },
  { name: "saturation", label: "Saturation", options: { saturation: 1.5 } },
  { name: "contrast", label: "Contrast", options: { contrast: 0.4 } },
  { name: "brightness", label: "Brightness", options: { brightness: 0.3 } },
  { name: "blur", label: "Blur", options: { blur: 0.8 } },
];

const GALLERY = [{ name: "none", label: "None" }, ...FILTER_DEFS];

export default function FilterGalleryDialog({ onClose }: { onClose: () => void }) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const obj = canvasNow()?.getActiveObject?.() as any;
      if (!obj || !Array.isArray(obj.filters)) {
        setPreviews({});
        return;
      }
      try {
        const thumb = obj.toCanvasElement({ multiplier: 1 }) as HTMLCanvasElement;
        const s = Math.min(1, 180 / Math.max(1, thumb.width, thumb.height));
        const tw = Math.max(1, Math.round(thumb.width * s));
        const th = Math.max(1, Math.round(thumb.height * s));
        const sc = document.createElement("canvas");
        sc.width = tw;
        sc.height = th;
        sc.getContext("2d")!.drawImage(thumb, 0, 0, tw, th);
        const out: Record<string, string> = { none: sc.toDataURL("image/png") };
        for (const def of FILTER_DEFS) {
          out[def.name] = applyFilterToCanvas(sc, def.name, def.options).toDataURL("image/png");
        }
        if (!cancelled) setPreviews(out);
      } catch {
        if (!cancelled) setPreviews({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (name: string) => {
    const obj = canvasNow()?.getActiveObject?.() as any;
    if (obj) {
      if (name === "none") {
        obj.filters.length = 0;
        obj.applyFilters?.();
        obj.canvas?.requestRenderAll();
      } else {
        const def = FILTER_DEFS.find((d) => d.name === name);
        applyFilter(obj, name, def?.options ?? {});
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[780px] max-h-[85vh] overflow-y-auto bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-4">
        <div className="text-sm font-semibold text-white mb-3">Filter Gallery</div>
        {!Object.keys(previews).length ? (
          <div className="text-[12px] text-gray-400 py-6 text-center">
            Select an image layer to preview filters.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {GALLERY.map((f) => (
              <button key={f.name} onClick={() => apply(f.name)} className="group text-left">
                <div className="aspect-square bg-black/40 border border-white/10 rounded-lg overflow-hidden group-hover:border-indigo-400 transition-colors flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previews[f.name]} alt={f.label} className="w-full h-full object-contain" />
                </div>
                <div className="text-[11px] text-gray-300 mt-1">{f.label}</div>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}