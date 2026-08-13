"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { filters } from "fabric";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { applyFilter, clearFilters } from "@/engine/filterEngine";
import {
  parseLayerStyles,
  applyLayerStyles,
  stringifyStyles,
  DEFAULT_STYLE,
  type LayerStyles,
} from "@/engine/layerStylesEngine";
import { isOutOfGamut, hexToRgb } from "@/engine/colorEngine";

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

function readFilterChain(obj: any): Adjustments {
  const res: Adjustments = { brightness: 0, contrast: 0, saturation: 1, blur: 0 };
  for (const f of obj?.filters ?? []) {
    const t = f?.type ?? "";
    if (t === "Brightness" && typeof f.brightness === "number") res.brightness = f.brightness;
    else if (t === "Contrast" && typeof f.contrast === "number") res.contrast = f.contrast;
    else if (t === "Saturation" && typeof f.saturation === "number") res.saturation = f.saturation;
    else if (t === "Blur" && typeof f.blur === "number") res.blur = f.blur;
  }
  return res;
}

export default function PropertiesPanel() {
  const canvas = useEditorStore((state) => state.canvas);
  const [object, setObject] = useState<any>(null);
  const [name, setName] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [angle, setAngle] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [fill, setFill] = useState("#000000");
  const [text, setText] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontWeight, setFontWeight] = useState("normal");
  const [fontStyle, setFontStyle] = useState("normal");
  const [textAlign, setTextAlign] = useState("left");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [stroke, setStroke] = useState("");
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [dashArray, setDashArray] = useState("");
  const [fontSize, setFontSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.2);
  const activeLayerId = useLayerStore((s) => s.activeLayer);
  const updateLayerStyles = useLayerStore((s) => s.updateLayerStyles);
  const [styles, setStyles] = useState<LayerStyles>({ ...DEFAULT_STYLE });
  const [adj, setAdj] = useState<Adjustments>({ brightness: 0, contrast: 0, saturation: 1, blur: 0 });
  const adjTimer = useRef<number | null>(null);

  const applyAdjustments = (obj: any, a: Adjustments) => {
    const chain: any[] = [];
    if (a.brightness !== 0) chain.push(new filters.Brightness({ brightness: a.brightness }));
    if (a.contrast !== 0) chain.push(new filters.Contrast({ contrast: a.contrast }));
    if (a.saturation !== 1) chain.push(new filters.Saturation({ saturation: a.saturation }));
    if (a.blur > 0) chain.push(new filters.Blur({ blur: a.blur }));
    if (obj && obj.filters) {
      obj.filters = chain;
      obj.applyFilters?.();
      canvas?.requestRenderAll?.();
    }
  };

  const onAdjust = (patch: Partial<Adjustments>) => {
    const next = { ...adj, ...patch };
    setAdj(next);
    if (adjTimer.current != null) window.clearTimeout(adjTimer.current);
    adjTimer.current = window.setTimeout(() => applyAdjustments(object, next), 120);
  };

  const commitAdjust = () => {
    if (adjTimer.current != null) {
      window.clearTimeout(adjTimer.current);
      adjTimer.current = null;
    }
    applyAdjustments(object, adj);
    useEditorStore.getState().history?.push();
  };

  useEffect(() => {
    if (!canvas) return;

    const sync = () => {
      const obj = canvas.getActiveObject() ?? null;
      setObject(obj);

      if (obj) {
        const rect = obj.getBoundingRect();
        setName(obj.name ?? obj.kaypaintId ?? obj.type);
        setX(Math.round(rect.left));
        setY(Math.round(rect.top));
        setW(Math.round(rect.width));
        setH(Math.round(rect.height));
        setAngle(Math.round(obj.angle ?? 0));
        setOpacity(Math.round((obj.opacity ?? 1) * 100));
        setFill(typeof obj.fill === "string" ? obj.fill : "#000000");
        setText(obj.text ?? "");
        setFontFamily(obj.fontFamily ?? "Arial");
        setFontWeight(obj.fontWeight ?? "normal");
        setFontStyle(obj.fontStyle ?? "normal");
        setTextAlign(obj.textAlign ?? "left");
        setLetterSpacing(obj.letterSpacing ?? 0);
        setStroke(typeof obj.stroke === "string" ? obj.stroke : "");
        setStrokeWidth(obj.strokeWidth ?? 0);
        setDashArray(
          Array.isArray(obj.strokeDashArray) ? obj.strokeDashArray.join(",") : ""
        );
        setFontSize(obj.fontSize ?? 28);
        setLineHeight(obj.lineHeight ?? 1.2);

        const layer = useLayerStore.getState().layers.find(
          (l) => l.objectId === (obj.kaypaintId ?? obj.id)
        );
        const parsed = parseLayerStyles(layer?.layerStyles);
        setStyles(parsed);
        applyLayerStyles(obj, parsed);

        if (obj.type === "image") setAdj(readFilterChain(obj));
      }
    };

    canvas.on("selection:created", sync);
    canvas.on("selection:updated", sync);
    canvas.on("selection:cleared", sync);
    canvas.on("object:modified", sync);

    return () => {
      canvas.off("selection:created", sync);
      canvas.off("selection:updated", sync);
      canvas.off("selection:cleared", sync);
      canvas.off("object:modified", sync);
    };
  }, [canvas]);

  if (!canvas || !object) {
    const cw = useEditorStore.getState().canvasW;
    const ch = useEditorStore.getState().canvasH;
    const grid = useEditorStore.getState().gridEnabled;
    return (
      <div className="p-4 text-sm text-gray-200 border-t border-gray-700 space-y-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Document</span>
          <p className="text-xs text-gray-500 mt-1">
            Nothing selected — edit the document here.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-gray-400 block mb-1">Width</label>
            <input
              type="number"
              value={cw}
              disabled
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 opacity-60"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1">Height</label>
            <input
              type="number"
              value={ch}
              disabled
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 opacity-60"
            />
          </div>
        </div>
        <label className="flex items-center justify-between text-xs text-gray-400 cursor-pointer">
          <span>Show grid</span>
          <input
            type="checkbox"
            checked={grid}
            onChange={() => useEditorStore.getState().toggleGrid()}
            className="accent-indigo-500"
          />
        </label>
        <p className="text-[10px] text-gray-600">
          Tip: press Ctrl (or ⌘) twice to open the palette, or use the command
          palette for quick actions.
        </p>
      </div>
    );
  }

  const update = (props: Record<string, any>, push = false) => {
    object.set(props);
    object.setCoords?.();
    canvas.requestRenderAll();
    if (push) {
      useEditorStore.getState().history?.push();
    }
  };

  const commitStyles = (next: LayerStyles) => {
    setStyles(next);
    applyLayerStyles(object, next);
    canvas.requestRenderAll();
    if (activeLayerId) {
      updateLayerStyles(activeLayerId, stringifyStyles(next));
    }
  };

  const isText = typeof object.text === "string";
  const isImage = object.type === "image";
  const contextLabel = isImage ? "Image" : isText ? "Text" : "Shape / Layer";

  return (
    <div className="p-4 text-sm text-gray-200 border-t border-gray-700 space-y-3">
      <div>
        <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">
          {contextLabel}
        </span>
        <span className="text-[10px] text-gray-500 ml-2">{object.type}</span>
      </div>
      <div>
        <label className="text-gray-400 block mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            update({ kaypaintName: e.target.value });
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 block mb-1">X</label>
          <input
            type="number"
            value={x}
            onChange={(e) => {
              setX(Number(e.target.value));
              update({ left: Number(e.target.value) });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">Y</label>
          <input
            type="number"
            value={y}
            onChange={(e) => {
              setY(Number(e.target.value));
              update({ top: Number(e.target.value) });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">W</label>
          <input
            type="number"
            value={w}
            onChange={(e) => {
              setW(Number(e.target.value));
              update({ width: Number(e.target.value), scaleX: 1 });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">H</label>
          <input
            type="number"
            value={h}
            onChange={(e) => {
              setH(Number(e.target.value));
              update({ height: Number(e.target.value), scaleY: 1 });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 block mb-1">Rotation°</label>
          <input
            type="number"
            value={angle}
            onChange={(e) => {
              setAngle(Number(e.target.value));
              update({ angle: Number(e.target.value) });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="text-gray-400 block mb-1">Opacity</label>
          <input
            type="range"
            min="0"
            max="100"
            value={opacity}
            onChange={(e) => {
              setOpacity(Number(e.target.value));
              update({ opacity: Number(e.target.value) / 100 });
            }}
            className="w-full mt-2"
          />
          <span className="text-xs">{opacity}%</span>
        </div>
      </div>

      {typeof object.fill === "string" && (
        <div>
          <label className="text-gray-400 block mb-1">Fill</label>
          <input
            type="color"
            value={fill}
            onChange={(e) => {
              setFill(e.target.value);
              update({ fill: e.target.value });
            }}
            className="w-10 h-8 cursor-pointer"
          />
        </div>
      )}

      {isText && (
        <div>
          <label className="text-gray-400 block mb-1">Text content</label>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              update({ text: e.target.value });
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 min-h-16"
          />
        </div>
      )}

      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-400 block mb-1">Font size</label>
              <input
                type="number"
                min="1"
                value={fontSize}
                onChange={(e) => {
                  setFontSize(Number(e.target.value));
                  update({ fontSize: Number(e.target.value) });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Line height</label>
              <input
                type="number"
                step="0.1"
                min="0.6"
                value={lineHeight}
                onChange={(e) => {
                  setLineHeight(Number(e.target.value));
                  update({ lineHeight: Number(e.target.value) });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 block mb-1">Font family</label>
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                update({ fontFamily: e.target.value });
              }}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
            >
              {[
                "Arial",
                "Verdana",
                "Tahoma",
                "Trebuchet MS",
                "Times New Roman",
                "Georgia",
                "Courier New",
                "Impact",
                "Comic Sans MS",
                "Palatino Linotype",
              ].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-400 block mb-1">Weight</label>
              <select
                value={fontWeight}
                onChange={(e) => {
                  setFontWeight(e.target.value);
                  update({ fontWeight: e.target.value });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
                <option value="300">Light</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Style</label>
              <select
                value={fontStyle}
                onChange={(e) => {
                  setFontStyle(e.target.value);
                  update({ fontStyle: e.target.value });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              >
                <option value="normal">Regular</option>
                <option value="italic">Italic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-400 block mb-1">Align</label>
              <select
                value={textAlign}
                onChange={(e) => {
                  setTextAlign(e.target.value);
                  update({ textAlign: e.target.value });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">
                Letter spacing
              </label>
              <input
                type="number"
                value={letterSpacing}
                onChange={(e) => {
                  setLetterSpacing(Number(e.target.value));
                  update({ letterSpacing: Number(e.target.value) });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
              />
            </div>
          </div>
        </>
      )}

      {(object.type !== "SAdjustment" && !object.isGuideLine) && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-gray-400 font-medium">Layer Styles</label>
            <button
              onClick={() =>
                commitStyles({ ...DEFAULT_STYLE, dropShadow: { ...DEFAULT_STYLE.dropShadow!, enabled: false }, outerStroke: { ...DEFAULT_STYLE.outerStroke!, enabled: false }, colorOverlay: { ...DEFAULT_STYLE.colorOverlay!, enabled: false }, gradientOverlay: { ...DEFAULT_STYLE.gradientOverlay!, enabled: false } })
              }
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
            >
              Reset
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={styles.dropShadow?.enabled ?? false}
                  onChange={(e) =>
                    commitStyles({
                      ...styles,
                      dropShadow: { ...styles.dropShadow!, enabled: e.target.checked },
                    })
                  }
                  className="accent-indigo-500"
                />
                Drop Shadow
              </label>
              {styles.dropShadow?.enabled && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-gray-400 block mb-1 text-xs">Opacity</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={styles.dropShadow.opacity ?? 75}
                      onChange={(e) =>
                        commitStyles({
                          ...styles,
                          dropShadow: { ...styles.dropShadow!, opacity: Number(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1 text-xs">Offset X</label>
                    <input
                      type="number"
                      value={styles.dropShadow.offsetX ?? 0}
                      onChange={(e) =>
                        commitStyles({
                          ...styles,
                          dropShadow: { ...styles.dropShadow!, offsetX: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1 text-xs">Offset Y</label>
                    <input
                      type="number"
                      value={styles.dropShadow.offsetY ?? 0}
                      onChange={(e) =>
                        commitStyles({
                          ...styles,
                          dropShadow: { ...styles.dropShadow!, offsetY: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1 text-xs">Blur</label>
                    <input
                      type="number"
                      value={styles.dropShadow.blur ?? 5}
                      onChange={(e) =>
                        commitStyles({
                          ...styles,
                          dropShadow: { ...styles.dropShadow!, blur: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <input
                      type="color"
                      value={styles.dropShadow.color ?? "#000000"}
                      onChange={(e) =>
                        commitStyles({
                          ...styles,
                          dropShadow: { ...styles.dropShadow!, color: e.target.value },
                        })
                      }
                      className="w-full h-7 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={styles.outerStroke?.enabled ?? false}
                  onChange={(e) =>
                    commitStyles({
                      ...styles,
                      outerStroke: { ...styles.outerStroke!, enabled: e.target.checked },
                    })
                  }
                  className="accent-indigo-500"
                />
                Outer Stroke
              </label>
              {styles.outerStroke?.enabled && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min="0"
                    value={styles.outerStroke.size ?? 2}
                    onChange={(e) =>
                      commitStyles({
                        ...styles,
                        outerStroke: { ...styles.outerStroke!, size: Number(e.target.value) },
                      })
                    }
                    className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1"
                  />
                  <input
                    type="color"
                    value={styles.outerStroke.color ?? "#000000"}
                    onChange={(e) =>
                      commitStyles({
                        ...styles,
                        outerStroke: { ...styles.outerStroke!, color: e.target.value },
                      })
                    }
                    className="w-8 h-7 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={styles.colorOverlay?.enabled ?? false}
                onChange={(e) => {
                  if (e.target.checked && !styles.colorOverlay?.originalFill) {
                    const curFill = typeof object.fill === "string" ? object.fill : "#000000";
                    commitStyles({
                      ...styles,
                      colorOverlay: { ...styles.colorOverlay!, enabled: true, originalFill: curFill },
                    });
                  } else {
                    commitStyles({
                      ...styles,
                      colorOverlay: { ...styles.colorOverlay!, enabled: e.target.checked },
                    });
                  }
                }}
                className="accent-indigo-500"
              />
              Color Overlay
            </label>
            {styles.colorOverlay?.enabled && (
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={styles.colorOverlay.color ?? "#000000"}
                  onChange={(e) =>
                    commitStyles({
                      ...styles,
                      colorOverlay: { ...styles.colorOverlay!, color: e.target.value },
                    })
                  }
                  className="w-40 h-7 cursor-pointer"
                />
                {(() => {
                  const rgb = hexToRgb(styles.colorOverlay.color ?? "#000000");
                  const oog = rgb && isOutOfGamut(...rgb);
                  return oog ? (
                    <span
                      title="Color is out of CMYK print gamut (will shift when printed)"
                      className="text-[10px] text-yellow-300 whitespace-nowrap"
                    >
                      out of gamut
                    </span>
                  ) : null;
                })()}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={styles.gradientOverlay?.enabled ?? false}
                onChange={(e) =>
                  commitStyles({
                    ...styles,
                    gradientOverlay: { ...styles.gradientOverlay!, enabled: e.target.checked },
                  })
                }
                className="accent-indigo-500"
              />
              Gradient Overlay
            </label>
            {styles.gradientOverlay?.enabled && (
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={styles.gradientOverlay.angle ?? 90}
                  onChange={(e) =>
                    commitStyles({
                      ...styles,
                      gradientOverlay: { ...styles.gradientOverlay!, angle: Number(e.target.value) },
                    })
                  }
                  className="w-full"
                />
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={styles.gradientOverlay.stops?.[0]?.color ?? "#000000"}
                    onChange={(e) =>
                      commitStyles({
                        ...styles,
                        gradientOverlay: {
                          ...styles.gradientOverlay!,
                          stops: [
                            { ...styles.gradientOverlay!.stops![0], color: e.target.value },
                            styles.gradientOverlay!.stops![1] ?? { offset: 1, color: "#ffffff" },
                          ],
                        },
                      })
                    }
                    className="flex-1 h-7 cursor-pointer"
                  />
                  <input
                    type="color"
                    value={styles.gradientOverlay.stops?.[1]?.color ?? "#ffffff"}
                    onChange={(e) =>
                      commitStyles({
                        ...styles,
                        gradientOverlay: {
                          ...styles.gradientOverlay!,
                          stops: [
                            styles.gradientOverlay!.stops![0] ?? { offset: 0, color: "#000000" },
                            { ...styles.gradientOverlay!.stops![1], color: e.target.value },
                          ],
                        },
                      })
                    }
                    className="flex-1 h-7 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isImage && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <label className="text-gray-400 block mb-2 font-medium">
            Stroke
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between">
              <input
                type="color"
                value={stroke || "#000000"}
                onChange={(e) => {
                  setStroke(e.target.value);
                  update({ stroke: e.target.value, strokeWidth: strokeWidth || 1 });
                }}
                className="w-8 h-7 cursor-pointer"
              />
              <button
                onClick={() => {
                  if (stroke) {
                    setStroke("");
                    update({ stroke: null });
                  } else {
                    setStroke("#000000");
                    update({ stroke: "#000000", strokeWidth: strokeWidth || 1 });
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
              >
                {stroke ? "None" : "Add"}
              </button>
            </div>
            <div>
              <input
                type="number"
                min="0"
                max="100"
                value={strokeWidth}
                disabled={!stroke}
                onChange={(e) => {
                  setStrokeWidth(Number(e.target.value));
                  if (stroke) update({ strokeWidth: Number(e.target.value) });
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 disabled:opacity-40"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-gray-400 block mb-1 text-xs">
              Dash pattern (e.g. 5,3)
            </label>
            <input
              value={dashArray}
              disabled={!stroke}
              onChange={(e) => {
                setDashArray(e.target.value);
                const parts = e.target.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => !isNaN(n) && n > 0);
                update({
                  strokeDashArray: parts.length ? parts : null,
                });
              }}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 disabled:opacity-40"
            />
          </div>
        </div>
      )}

      {isImage && (
        <div>
          <label className="text-gray-400 block mb-1">Adjustments</label>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Brightness</span>
                <span>{adj.brightness >= 0 ? "+" : ""}{adj.brightness}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={adj.brightness}
                onChange={(e) => onAdjust({ brightness: Number(e.target.value) })}
                onPointerUp={commitAdjust}
                onKeyUp={commitAdjust}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Contrast</span>
                <span>{adj.contrast >= 0 ? "+" : ""}{adj.contrast}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={adj.contrast}
                onChange={(e) => onAdjust({ contrast: Number(e.target.value) })}
                onPointerUp={commitAdjust}
                onKeyUp={commitAdjust}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Saturation</span>
                <span>{(adj.saturation * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={adj.saturation}
                onChange={(e) => onAdjust({ saturation: Number(e.target.value) })}
                onPointerUp={commitAdjust}
                onKeyUp={commitAdjust}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Blur</span>
                <span>{adj.blur.toFixed(0)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={adj.blur}
                onChange={(e) => onAdjust({ blur: Number(e.target.value) })}
                onPointerUp={commitAdjust}
                onKeyUp={commitAdjust}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {isImage && (
        <div>
          <label className="text-gray-400 block mb-1">Filters</label>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => {
                applyFilter(object, "grayscale");
                useEditorStore.getState().history?.push();
              }}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Grayscale
            </button>
            <button
              onClick={() => {
                applyFilter(object, "sepia");
                useEditorStore.getState().history?.push();
              }}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Sepia
            </button>
            <button
              onClick={() => {
                applyFilter(object, "invert");
                useEditorStore.getState().history?.push();
              }}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Invert
            </button>
            <button
              onClick={() => {
                applyFilter(object, "pixelate", { blocksize: 6 });
                useEditorStore.getState().history?.push();
              }}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Pixelate
            </button>
            <button
              onClick={() => {
                clearFilters(object);
                useEditorStore.getState().history?.push();
              }}
              className="px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-xs"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}