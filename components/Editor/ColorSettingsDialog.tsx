"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { downloadDataURL } from "@/utils/imageUtils";
import { buildCmykPreview, isOutOfGamut } from "@/engine/colorEngine";
import { exportPSD } from "@/engine/psdEngine";
import type { RenderingIntent, WorkingSpace } from "@/engine/colorEngine";

const WORKING_SPACES: { id: WorkingSpace; label: string }[] = [
  { id: "srgb", label: "sRGB IEC61966-2.1 (current)" },
  { id: "p3", label: "Display P3" },
  { id: "adobergb", label: "Adobe RGB" },
  { id: "prophoto", label: "ProPhoto RGB" },
];

function canvasDataURL(canvas: any): string | null {
  if (!canvas?.toDataURL) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export default function ColorSettingsDialog({ onClose }: { onClose: () => void }) {
  const canvas = useEditorStore((state) => state.canvas);
  const [workingSpace, setWorkingSpace] = useState<WorkingSpace>("srgb");
  const [generating, setGenerating] = useState<null | "preview" | "plates">(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [plateUrls, setPlateUrls] = useState<
    Record<"c" | "m" | "y" | "k", string> | null
  >(null);
  const [gamutCount, setGamutCount] = useState(0);
  const [psdCmyk, setPsdCmyk] = useState(false);
  const setGamutWarning = useEditorStore((state) => state.setGamutWarning);
  const gamutWarning = useEditorStore((state) => state.gamutWarning);
  const [intent, setIntent] = useState<RenderingIntent>("relative");
  const [paperBlack, setPaperBlack] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const computeGamut = () => {
    const data = canvasDataURL(canvas);
    if (!data) {
      window.alert("No canvas to analyze.");
      return;
    }
    const img = new Image();
    img.src = data;
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      let count = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (isOutOfGamut(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255)) count++;
      }
      setGamutCount(count);
    };
  };

  const runCmyk = async (kind: "preview" | "plates") => {
    const data = canvasDataURL(canvas);
    if (!data) {
      window.alert("No canvas to process.");
      return;
    }
    setGenerating(kind);
    try {
      const result = await buildCmykPreview(data, {
        renderingIntent: intent,
        simulatePaperBlack: paperBlack,
        gamutOverlay: kind === "preview" ? overlay : false,
        workingSpace,
      });
      if (kind === "preview") {
        setPreviewUrl(result.cmykPreview);
        setOverlayUrl(result.gamutOverlay ?? null);
      } else {
        setPlateUrls(result.plates);
        const names = { c: "Cyan", m: "Magenta", y: "Yellow", k: "Black" };
        for (const key of ["c", "m", "y", "k"] as const) {
          downloadDataURL(result.plates[key], `plate-${names[key]}.png`);
        }
      }
    } catch (err: any) {
      window.alert("CMYK conversion failed: " + (err?.message ?? "unknown"));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (generating === null) {
            const name = window.prompt("Project name (for the filename):");
            if (name !== null) {
              downloadDataURL(
                previewUrl ??
                  canvasDataURL(canvas) ??
                  "data:,",
                `${(name || "kaypaint").replace(/\.kps?$/i, "")}.cmYK.png`
              );
            }
          }
        }}
        className="w-[460px] rounded-2xl bg-[#161b26] border border-white/10 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-100 tracking-wide">
            Color Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm text-gray-200">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={computeGamut}
              className="px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600"
            >
              Check print gamut
            </button>
            {gamutCount > 0 && (
              <span className="text-xs text-yellow-300">
                {gamutCount} out-of-gamut pixels
              </span>
            )}
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">Proof setup</div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-xs text-gray-300">
                Rendering intent
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as RenderingIntent)}
                  className="mt-0.5 w-full bg-[#0d121c] border border-white/10 rounded-lg px-1.5 py-1 text-[12px] text-gray-200"
                >
                  <option value="relative">Relative colorimetric</option>
                  <option value="perceptual">Perceptual</option>
                  <option value="saturation">Saturation</option>
                </select>
              </label>
              <label className="text-xs text-gray-300">
                Working RGB space
                <select
                  value={workingSpace}
                  onChange={(e) => setWorkingSpace(e.target.value as WorkingSpace)}
                  className="mt-0.5 w-full bg-[#0d121c] border border-white/10 rounded-lg px-1.5 py-1 text-[12px] text-gray-200"
                >
                  {WORKING_SPACES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 mt-5">
                <input
                  type="checkbox"
                  checked={paperBlack}
                  onChange={(e) => setPaperBlack(e.target.checked)}
                  className="accent-indigo-500"
                />
                Simulate paper black
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(e) => setOverlay(e.target.checked)}
                  className="accent-indigo-500"
                />
                Show out-of-gamut overlay
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={gamutWarning}
                  onChange={(e) => {
                    setGamutWarning(e.target.checked);
                  }}
                  className="accent-indigo-500"
                />
                Gamut warning on canvas
              </label>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">CMYK preview / export</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runCmyk("preview")}
                disabled={!canvas || generating === "preview"}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
              >
                Soft-proof preview
              </button>
              <button
                type="button"
                onClick={() => runCmyk("plates")}
                disabled={!canvas || generating === "plates"}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600"
              >
                {generating === "plates" ? "Exporting…" : "Export CMYK plates"}
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-1">PSD export</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={psdCmyk}
                  onChange={(e) => setPsdCmyk(e.target.checked)}
                  className="accent-indigo-500"
                />
                Export PSD as CMYK (color mode 4)
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (!canvas) {
                    window.alert("No canvas to export.");
                    return;
                  }
                  const name = window.prompt("Filename (without .psd):", "kaypaint");
                  const filename = name ? `${name.replace(/\.psd$/i, "")}.psd` : "kaypaint.psd";
                  await exportPSD(
                    canvas,
                    filename,
                    psdCmyk ? { cmyk: true } : {}
                  );
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 flex items-center gap-1"
              >
                <Download size={12} />
                Save PSD
              </button>
            </div>
          </div>

          {previewUrl && (
            <div>
              <div className="text-xs text-gray-400 mb-1">CMYK preview</div>
            <img
              src={previewUrl}
              alt="CMYK preview"
              className="rounded border border-white/10 max-w-full"
            />
          </div>
          )}

          {overlayUrl && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Out-of-gamut overlay</div>
              <img
                src={overlayUrl}
                alt="Out-of-gamut overlay"
                className="rounded border border-white/10 max-w-full"
              />
            </div>
          )}

          {plateUrls && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Generated plates</div>
              <div className="grid grid-cols-2 gap-2">
                {(["c", "m", "y", "k"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <img
                      src={plateUrls[key]}
                      alt={`plate ${key}`}
                      className="rounded border border-white/10 w-10 h-10 object-cover"
                    />
                    <span className="text-xs text-gray-400">
                      {key.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] text-gray-300 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
          {previewUrl && (
            <button
              type="submit"
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white accent-gradient hover:opacity-90 transition-opacity"
            >
              <Download size={14} />
              Download preview PNG
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
