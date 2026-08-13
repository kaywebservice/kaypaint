/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  executeScript,
  validateScript,
  type KayPaintScript,
  type ScriptResult,
  type ScriptRuntimeCtx,
  type ScriptValue,
} from "@/engine/scriptEngineCore";
import { readActivePixels, applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { useLayerStore } from "@/store/layerStore";
import { showOptions } from "@/components/Menu/OptionDialog";

export const SCRIPT_SAMPLES: string[] = [
  JSON.stringify({
    name: "Sepia Tone",
    params: [{ key: "strength", label: "Strength", type: "number", default: 15 }],
    steps: [
      { op: "grayscale" },
      { op: "brightness", params: { amount: "$param:strength" } },
      { op: "sepia" },
    ],
  }),
  JSON.stringify({
    name: "Brighten if Dark",
    steps: [
      {
        if: { path: "$var:avgLuma", op: "<", value: 80 },
        then: [{ op: "brightness", params: { amount: 20 } }],
      },
    ],
  }),
  JSON.stringify({
    name: "Glitch Pop",
    steps: [
      { op: "invert" },
      {
        repeat: 2,
        do: [
          { op: "pixelate", params: { block: 2 } },
          { op: "brightness", params: { amount: -10 } },
        ],
      },
    ],
  }),
];

type ScriptScope = "active" | "all";

export async function runScriptOnLayer(
  canvas: any,
  script: KayPaintScript,
  params?: Record<string, ScriptValue>
): Promise<ScriptResult> {
  const bad = validateScript(script);
  if (bad.length > 0) return { ok: false, errors: bad, stepsRun: 0 };

  const read = readActivePixels(canvas);
  if (!read) return { ok: false, errors: ["Select a layer to run the script on."], stepsRun: 0 };

  const vars = new Map<string, ScriptValue>();
  let current: Uint8ClampedArray = new Uint8ClampedArray(read.data);
  const ctx: ScriptRuntimeCtx = {
    getVar: (k) => vars.get(k),
    setVar: (k, v) => {
      vars.set(k, v);
    },
    currentImage: () => current,
    setImage: (d) => {
      current = d;
    },
    currentSize: () => ({ width: read.width, height: read.height }),
    forEach: (items, cb) => items.forEach((it, idx) => cb(it, idx)),
  };

  const res = executeScript(script, ctx, { params });
  if (res.ok) {
    const out = current;
    await applyPixelsToActiveLayer(canvas, (data, w, h) => {
      if (w === read.width && h === read.height && data.length === out.length) {
        data.set(out);
      }
    });
  }
  return res;
}

async function findObjectById(canvas: any, objectId: string | undefined): Promise<any | null> {
  if (!objectId || !canvas?.getObjects) return null;
  for (const o of canvas.getObjects()) {
    if ((o.kaypaintId ?? o.id) === objectId) return o;
  }
  return null;
}

export async function runScriptOnAllLayers(
  canvas: any,
  script: KayPaintScript,
  params?: Record<string, ScriptValue>
): Promise<ScriptResult> {
  const bad = validateScript(script);
  if (bad.length > 0) return { ok: false, errors: bad, stepsRun: 0 };

  const layers = useLayerStore.getState().layers;
  const errors: string[] = [];
  let stepsRun = 0;
  let touched = 0;

  for (const layer of layers) {
    if (!layer.objectId) continue;
    const obj = await findObjectById(canvas, layer.objectId);
    if (!obj) continue;
    canvas.setActiveObject(obj);
    canvas.renderAll();
    const res = await runScriptOnLayer(canvas, script, params);
    canvas.discardActiveObject?.();
    canvas.renderAll();
    if (res.ok) {
      touched++;
      stepsRun += res.stepsRun;
    } else {
      errors.push(`${layer.name}: ${res.errors.join("; ")}`);
    }
  }

  if (touched === 0 && errors.length === 0) {
    return { ok: false, errors: ["No scriptable layers found."], stepsRun: 0 };
  }
  return { ok: errors.length === 0, errors, stepsRun };
}

export async function runScriptDialog(canvas: any): Promise<void> {
  const res = await showOptions({
    title: "Run Script (JSON)",
    okLabel: "Run",
    text:
      "Safe data-driven scripts with repeat / if / forEach and pixel ops ($param:key params, $var:avgLuma built-in).",
    fields: [
      {
        key: "scope",
        label: "Apply to",
        type: "select",
        value: "active",
        options: [
          { value: "active", label: "Active layer" },
          { value: "all", label: "All layers" },
        ],
      },
      { key: "script", label: "Script JSON", type: "text", value: SCRIPT_SAMPLES[0] },
    ],
  });
  if (!res) return;

  const scope = (res.scope as ScriptScope) ?? "active";
  let script: KayPaintScript;
  try {
    script = JSON.parse(String(res.script)) as KayPaintScript;
  } catch {
    window.alert("Invalid script JSON.");
    return;
  }

  const bad = validateScript(script);
  if (bad.length > 0) {
    window.alert("Invalid script:\n" + bad.join("\n"));
    return;
  }

  const out =
    scope === "all"
      ? await runScriptOnAllLayers(canvas, script)
      : await runScriptOnLayer(canvas, script);

  if (out.ok) {
    window.alert(`Script ran ${out.stepsRun} step(s) on ${scope === "all" ? "all layers" : "active layer"}.`);
  } else {
    window.alert("Script errors:\n" + out.errors.join("\n"));
  }
}