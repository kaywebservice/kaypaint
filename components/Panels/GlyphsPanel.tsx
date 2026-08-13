"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";

const GLYPH_CATEGORIES: { name: string; glyphs: string[] }[] = [
  { name: "Quotes", glyphs: ["'", "\u201C", "\u201D", "\u00AB", "\u00BB", "\u201E"] },
  { name: "Dashes", glyphs: ["\u2013", "\u2014", "\u2012"] },
  { name: "Fractions", glyphs: ["\u00BD", "\u00BC", "\u00BE", "\u2153", "\u2154", "\u215B"] },
  { name: "Math", glyphs: ["\u00B1", "\u00D7", "\u00F7", "\u2248", "\u2260", "\u2264", "\u2265", "\u221E"] },
  { name: "Arrows", glyphs: ["\u2192", "\u2190", "\u2191", "\u2193", "\u2194", "\u21D2"] },
  { name: "Bullets", glyphs: ["\u2022", "\u25E6", "\u25AA", "\u25AB", "\u00B7"] },
  { name: "Symbols", glyphs: ["\u00A9", "\u00AE", "\u2122", "\u00A7", "\u00B6", "\u2020", "\u2021", "\u00B0"] },
  { name: "Superscripts", glyphs: ["\u00B9", "\u00B2", "\u00B3", "\u2074"] },
  { name: "Currency", glyphs: ["$", "\u20AC", "\u00A3", "\u00A5", "\u00A2"] },
];

function isTextObject(obj: any): boolean {
  return !!obj && (obj.type === "i-text" || obj.type === "i-textbox");
}

export default function GlyphsPanel() {
  const canvas = useEditorStore((s) => s.canvas);
  const active = canvas?.getActiveObject?.();
  const hasText = isTextObject(active);

  const insertGlyph = (glyph: string) => {
    if (!hasText) return;
    const text = active.text ?? "";
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? text.length;
    if (start === end) {
      active.insertChars(glyph, null, end);
    } else {
      active.insertChars(glyph, null, start, end);
    }
    canvas.requestRenderAll();
    useEditorStore.getState().history?.push?.();
  };

  return (
    <div className="space-y-3">
      {!hasText && (
        <div className="text-xs text-gray-500">
          No text layer selected. Select a text layer to insert glyphs at the cursor.
        </div>
      )}
      {GLYPH_CATEGORIES.map((cat) => (
        <div key={cat.name}>
          <div className="text-[11px] font-semibold text-gray-400 mb-1">{cat.name}</div>
          <div className="grid grid-cols-6 gap-1">
            {cat.glyphs.map((g) => (
              <button
                key={g}
                onClick={() => insertGlyph(g)}
                disabled={!hasText}
                title={`Insert "${g}"`}
                className="h-8 flex items-center justify-center text-[15px] leading-none bg-gray-800 border border-white/10 rounded-md text-gray-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
