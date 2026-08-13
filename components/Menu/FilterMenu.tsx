"use client";

import { useEffect, useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { showOptions } from "./OptionDialog";
import type { OptionField } from "./OptionDialog";
import { getCtx } from "@/utils/menuUtils";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { LastFilter } from "@/store/settingsStore";
import { applyFilter, clearFilters } from "@/engine/filterEngine";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { FILTER_OPS } from "@/engine/filterOps";
import { applyToolOnce } from "@/engine/toolEngine";
import { lensCorrection } from "@/engine/lensCorrection";
import { cameraRawFilter } from "@/engine/cameraRawFilter";
import { cameraShake } from "@/engine/cameraShake";
import { startVanishingPoint } from "@/engine/vanishingPoint";
import {
  neuralPhotoRestoration,
  neuralEnhanceDetails,
  neuralPortraitDefocus,
  neuralSuperZoom,
  reflectionRemoval,
} from "@/engine/generativeAI";
import FilterGalleryDialog from "@/components/Menu/FilterGalleryDialog";

const CLASSIC: Record<string, { label: string; options: Record<string, unknown> }> = {
  grayscale: { label: "Grayscale", options: {} },
  sepia: { label: "Sepia", options: {} },
  invert: { label: "Invert", options: {} },
  vintage: { label: "Vintage", options: {} },
  kodachrome: { label: "Kodachrome", options: {} },
  polaroid: { label: "Polaroid", options: {} },
  brownie: { label: "Brownie", options: {} },
  pixelate: { label: "Pixelate", options: { blocksize: 6 } },
  noise: { label: "Noise", options: { noise: 24 } },
  contrast: { label: "High Contrast", options: { contrast: 0.5 } },
  saturation: { label: "Saturated", options: { saturation: 0.6 } },
};

function activeImage() {
  const canvas = useEditorStore.getState().canvas;
  const active = canvas?.getActiveObject?.();
  if (active && active.type === "image") return active;
  return null;
}

async function execute(name: string, params: Record<string, unknown>): Promise<boolean> {
  if (CLASSIC[name]) {
    const img = activeImage();
    if (!img) return false;
    const def = CLASSIC[name];
    applyFilter(img, name, { ...def.options, ...params });
    getCtx().push();
    return true;
  }
  const fn = FILTER_OPS[name];
  if (!fn) return false;
  return applyPixelsToActiveLayer(getCtx(), (d, w, h) => fn(d, w, h, params));
}

function remember(name: string, label: string, params: Record<string, unknown>) {
  void execute(name, params).then((ok) => {
    if (ok) useSettingsStore.getState().setLastFilter({ name, label, params });
  });
}

function runOp(name: string, label: string, params: Record<string, unknown> = {}) {
  remember(name, label, params);
}

function withDialog(name: string, label: string, fields: OptionField[]) {
  void (async () => {
    const res = await showOptions({ title: label, fields });
    if (!res) return;
    remember(name, label, res);
  })();
}

function applyLastFilter() {
  const lf = useSettingsStore.getState().lastFilter;
  if (!lf) {
    window.alert("Apply Last Filter: no filter has been applied yet.");
    return;
  }
  void execute(lf.name, lf.params);
}

function neuralDialog(
  title: string,
  apply: (intensity: number) => Promise<boolean>
) {
  void (async () => {
    const res = await showOptions({
      title,
      fields: [sl("intensity", "Intensity", 50, 0, 100, 1, " %")],
    });
    if (!res) return;
    try {
      const ok = await apply(Number(res.intensity));
      if (!ok) window.alert("No target found. Select an object or ensure content exists.");
    } catch (error: unknown) {
      window.alert(
        error instanceof Error ? (error.message ?? `${title} failed`) : `${title} failed`
      );
    }
  })();
}

function paramLabel(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) parts.push(`${k}: ${v}`);
  const s = parts.join("  ");
  return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

const sl = (
  key: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step = 1,
  suffix = ""
): OptionField => ({ key, label, type: "slider", value, min, max, step, suffix });

const num = (
  key: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step = 1,
  suffix = ""
): OptionField => ({ key, label, type: "number", value, min, max, step, suffix });

const sel = (key: string, label: string, value: string, options: string[]): OptionField => ({
  key,
  label,
  type: "select",
  value,
  options: options.map((o) => ({ value: o, label: o })),
});

const chk = (key: string, label: string, value: boolean): OptionField => ({
  key,
  label,
  type: "checkbox",
  value,
});

const F: Record<string, OptionField[]> = {
  gaussianBlur: [sl("radius", "Radius", 2, 0.5, 250, 0.5, " px")],
  boxBlur: [sl("radius", "Radius", 3, 1, 250, 1, " px")],
  motionBlur: [
    sl("angle", "Angle", 0, -360, 360, 1, " °"),
    sl("distance", "Distance", 10, 1, 999, 1, " px"),
  ],
  radialBlur: [sl("amount", "Amount", 10, 0, 100, 1, " %"), sel("method", "Method", "Zoom", ["Zoom", "Rotate"])],
  lensBlur: [
    sl("radius", "Radius", 5, 1, 100, 1, " px"),
    sl("brightness", "Brightness", 10, 0, 100, 1, " %"),
  ],
  shapeBlur: [
    sl("radius", "Radius", 10, 1, 100, 1, " px"),
    sel("shape", "Shape", "Circle", ["Diamond", "Circle", "Square"]),
  ],
  emboss: [
    sl("angle", "Angle", 135, -360, 360, 1, " °"),
    sl("height", "Height", 10, 1, 100, 1, " px"),
    sl("amount", "Amount", 100, 0, 500, 1, " %"),
  ],
  diffuse: [sel("mode", "Mode", "Normal", ["Normal", "Darken Only", "Lighten Only"])],
  wind: [
    sel("method", "Method", "Wind", ["Wind", "Blast", "Stagger"]),
    sel("direction", "Direction", "From the Right", ["From the Left", "From the Right"]),
  ],
  tiles: [
    sl("tiles", "Number of Tiles", 6, 2, 100, 1, ""),
    sl("offset", "Offset", 20, 0, 99, 1, " %"),
    sel("fill", "Fill", "Background", ["Background", "Inverse", "Unchanged"]),
  ],
  pinch: [sl("amount", "Amount", 50, -100, 100, 1, " %")],
  spherize: [
    sl("amount", "Amount", 50, -100, 100, 1, " %"),
    sel("mode", "Mode", "Normal", ["Normal", "Horizontal Only", "Vertical Only"]),
  ],
  twirl: [sl("angle", "Angle", 50, -999, 999, 1, " °")],
  ripple: [
    sl("amount", "Amount", 100, -999, 999, 1, ""),
    sel("size", "Size", "Medium", ["Small", "Medium", "Large"]),
  ],
  shear: [
    sl("offset", "Offset", 0, -100, 100, 1, " %"),
    sel("fill", "Undefined Areas", "Wrap Around", ["Wrap Around", "Repeat Edge", "Set to Background"]),
  ],
  displace: [
    sl("horizontal", "Horizontal Scale", 20, 0, 100, 1, " %"),
    sl("vertical", "Vertical Scale", 20, 0, 100, 1, " %"),
  ],
  fibers: [
    sl("variance", "Variance", 20, 0, 100, 1, " %"),
    sl("strength", "Strength", 40, 0, 100, 1, " %"),
  ],
  lensFlare: [
    sl("brightness", "Brightness", 100, 0, 300, 1, " %"),
    sel("center", "Flare Center", "C", ["TL", "TR", "C", "BR", "BL"]),
    sel("lens", "Lens Type", "50-300mm Zoom", ["50-300mm Zoom", "35mm Prime"]),
  ],
  addNoise: [
    sl("amount", "Amount", 30, 0, 400, 1, " %"),
    sel("distribution", "Distribution", "Uniform", ["Uniform", "Gaussian"]),
    chk("monochromatic", "Monochromatic", false),
  ],
  reduceNoise: [
    sl("strength", "Strength", 5, 0, 10, 1, ""),
    sl("preserveDetails", "Preserve Details", 50, 0, 100, 1, " %"),
    sl("reduceColorNoise", "Reduce Color Noise", 50, 0, 100, 1, " %"),
  ],
  median: [sl("radius", "Radius", 3, 1, 100, 1, " px")],
  dustScratches: [
    sl("radius", "Radius", 3, 1, 100, 1, " px"),
    sl("threshold", "Threshold", 128, 0, 255, 1, ""),
  ],
  highPass: [sl("radius", "Radius", 2, 0.5, 250, 0.5, " px")],
  unsharpMask: [
    sl("amount", "Amount", 100, 0, 500, 1, " %"),
    sl("radius", "Radius", 1, 0.5, 250, 0.5, " px"),
    sl("threshold", "Threshold", 0, 0, 255, 1, ""),
  ],
  smartSharpen: [
    sl("amount", "Amount", 100, 0, 500, 1, " %"),
    sl("radius", "Radius", 1, 0.5, 250, 0.5, " px"),
    sel("reduceNoise", "Reduce Noise", "None", ["None", "Low", "Medium", "High"]),
  ],
  offset: [
    num("horizontal", "Horizontal", 0, -10000, 10000, 1, " px"),
    num("vertical", "Vertical", 0, -10000, 10000, 1, " px"),
    sel("fill", "Undefined Areas", "Repeat", ["Set to Background", "Repeat", "Wrap"]),
  ],
  custom: [
    num("k11", "K11", 0, -100, 100, 1),
    num("k12", "K12", 0, -100, 100, 1),
    num("k13", "K13", 0, -100, 100, 1),
    num("k21", "K21", 0, -100, 100, 1),
    num("k22", "K22", 1, -100, 100, 1),
    num("k23", "K23", 0, -100, 100, 1),
    num("k31", "K31", 0, -100, 100, 1),
    num("k32", "K32", 0, -100, 100, 1),
    num("k33", "K33", 0, -100, 100, 1),
    num("scale", "Scale", 1, -100, 100, 1),
    num("offset", "Offset", 0, -255, 255, 1),
  ],
  maximum: [sl("radius", "Radius", 10, 1, 100, 1, " px")],
  minimum: [sl("radius", "Radius", 10, 1, 100, 1, " px")],
};

function entries(lastFilter: LastFilter | null, onGallery: () => void): MenuEntry[] {
  const canvas = useEditorStore.getState().canvas;
  const hasImg = !!activeImage();
  const D = !canvas?.getActiveObject?.();
  const NC = !canvas;

  const blur: MenuEntry[] = [
    { label: "Gaussian Blur…", disabled: D, onClick: () => withDialog("gaussianBlur", "Gaussian Blur", F.gaussianBlur) },
    { label: "Box Blur…", disabled: D, onClick: () => withDialog("boxBlur", "Box Blur", F.boxBlur) },
    { label: "Motion Blur…", disabled: D, onClick: () => withDialog("motionBlur", "Motion Blur", F.motionBlur) },
    { label: "Radial Blur…", disabled: D, onClick: () => withDialog("radialBlur", "Radial Blur", F.radialBlur) },
    { label: "Average", disabled: D, onClick: () => runOp("average", "Average") },
    { label: "Blur More", disabled: D, onClick: () => runOp("blurMore", "Blur More") },
    { label: "Lens Blur…", disabled: D, onClick: () => withDialog("lensBlur", "Lens Blur", F.lensBlur) },
    { label: "Shape Blur…", disabled: D, onClick: () => withDialog("shapeBlur", "Shape Blur", F.shapeBlur) },
  ];

  const sharpen: MenuEntry[] = [
    { label: "Sharpen", disabled: D, onClick: () => runOp("sharpen", "Sharpen") },
    { label: "Sharpen More", disabled: D, onClick: () => runOp("sharpenMore", "Sharpen More") },
    { label: "Sharpen Edges", disabled: D, onClick: () => runOp("sharpenEdges", "Sharpen Edges") },
    { label: "Unsharp Mask…", disabled: D, onClick: () => withDialog("unsharpMask", "Unsharp Mask", F.unsharpMask) },
    { label: "Smart Sharpen…", disabled: D, onClick: () => withDialog("smartSharpen", "Smart Sharpen", F.smartSharpen) },
  ];

  const stylize: MenuEntry[] = [
    { label: "Emboss…", disabled: D, onClick: () => withDialog("emboss", "Emboss", F.emboss) },
    { label: "Find Edges", disabled: D, onClick: () => runOp("findEdges", "Find Edges") },
    { label: "Solarize", disabled: D, onClick: () => runOp("solarize", "Solarize") },
    { label: "Diffuse…", disabled: D, onClick: () => withDialog("diffuse", "Diffuse", F.diffuse) },
    { label: "Wind…", disabled: D, onClick: () => withDialog("wind", "Wind", F.wind) },
    { label: "Tiles…", disabled: D, onClick: () => withDialog("tiles", "Tiles", F.tiles) },
  ];

  const distort: MenuEntry[] = [
    { label: "Pinch…", disabled: D, onClick: () => withDialog("pinch", "Pinch", F.pinch) },
    { label: "Spherize…", disabled: D, onClick: () => withDialog("spherize", "Spherize", F.spherize) },
    { label: "Twirl…", disabled: D, onClick: () => withDialog("twirl", "Twirl", F.twirl) },
    { label: "Ripple…", disabled: D, onClick: () => withDialog("ripple", "Ripple", F.ripple) },
    { label: "Shear…", disabled: D, onClick: () => withDialog("shear", "Shear", F.shear) },
    { label: "Displace…", disabled: D, onClick: () => withDialog("displace", "Displace", F.displace) },
    { label: "Liquify", disabled: D, onClick: () => applyToolOnce("liquify", getCtx()) },
  ];

  const render: MenuEntry[] = [
    { label: "Clouds", disabled: D, onClick: () => runOp("clouds", "Clouds") },
    { label: "Difference Clouds", disabled: D, onClick: () => runOp("differenceClouds", "Difference Clouds") },
    { label: "Fibers…", disabled: D, onClick: () => withDialog("fibers", "Fibers", F.fibers) },
    { label: "Lens Flare…", disabled: D, onClick: () => withDialog("lensFlare", "Lens Flare", F.lensFlare) },
  ];

  const noise: MenuEntry[] = [
    { label: "Add Noise…", disabled: D, onClick: () => withDialog("addNoise", "Add Noise", F.addNoise) },
    { label: "Reduce Noise…", disabled: D, onClick: () => withDialog("reduceNoise", "Reduce Noise", F.reduceNoise) },
    { label: "Median…", disabled: D, onClick: () => withDialog("median", "Median", F.median) },
    { label: "Dust & Scratches…", disabled: D, onClick: () => withDialog("dustScratches", "Dust & Scratches", F.dustScratches) },
  ];

  const other: MenuEntry[] = [
    { label: "High Pass…", disabled: D, onClick: () => withDialog("highPass", "High Pass", F.highPass) },
    { label: "Offset…", disabled: D, onClick: () => withDialog("offset", "Offset", F.offset) },
    { label: "Custom…", disabled: D, onClick: () => withDialog("custom", "Custom", F.custom) },
    { label: "Maximum…", disabled: D, onClick: () => withDialog("maximum", "Maximum", F.maximum) },
    { label: "Minimum…", disabled: D, onClick: () => withDialog("minimum", "Minimum", F.minimum) },
    { label: "Dither", disabled: D, onClick: () => runOp("dither", "Dither") },
  ];

  const classic: MenuEntry[] = Object.entries(CLASSIC).map(([name, def]) => ({
    label: def.label,
    disabled: !hasImg,
    onClick: () => runOp(name, def.label, def.options),
  }));

  const fix: MenuEntry[] = [
    { label: "Lens Correction…", disabled: D, onClick: () => void lensCorrection(canvas) },
    { label: "Camera Raw Filter…", disabled: D, onClick: () => void cameraRawFilter(canvas) },
    { label: "Shake Reduction…", disabled: D, onClick: () => void cameraShake(canvas) },
    { label: "Vanishing Point…", disabled: D, onClick: () => void startVanishingPoint(canvas) },
  ];

  const neural: MenuEntry[] = [
    {
      id: "filter.neuralFilters.photoRestoration",
      label: "Photo Restoration…",
      disabled: NC,
      onClick: () => neuralDialog("Photo Restoration", (i) => neuralPhotoRestoration(canvas, i)),
    },
    {
      id: "filter.neuralFilters.enhanceDetails",
      label: "Enhance Details…",
      disabled: NC,
      onClick: () => neuralDialog("Enhance Details", (i) => neuralEnhanceDetails(canvas, i)),
    },
    {
      id: "filter.neuralFilters.portraitDefocus",
      label: "Smart Portrait Defocus…",
      disabled: NC,
      onClick: () => neuralDialog("Smart Portrait Defocus", (i) => neuralPortraitDefocus(canvas, i)),
    },
    {
      id: "filter.neuralFilters.superZoom",
      label: "Super Zoom…",
      disabled: NC,
      onClick: () => neuralDialog("Super Zoom", () => neuralSuperZoom(canvas)),
    },
  ];

  const correction: MenuEntry[] = [
    {
      id: "filter.correction.reflectionRemoval",
      label: "Reflection Removal…",
      disabled: NC,
      onClick: () =>
        neuralDialog("Reflection Removal", (i) => reflectionRemoval(canvas, i)),
    },
  ];

  return [
    {
      label: lastFilter ? `Apply ${lastFilter.label} (${paramLabel(lastFilter.params)})` : "Apply Last Filter",
      shortcut: "Ctrl+F",
      disabled: !lastFilter,
      onClick: applyLastFilter,
    },
    { divider: true },
    { id: "filter.gallery", label: "Filter Gallery…", disabled: NC, onClick: onGallery },
    { id: "filter.neuralFilters", label: "Neural Filters", disabled: NC, children: neural },
    { divider: true },
    { id: "filter.blur", label: "Blur", disabled: D, children: blur },
    { id: "filter.sharp", label: "Sharpen", disabled: D, children: sharpen },
    { label: "Stylize", disabled: D, children: stylize },
    { label: "Distort", disabled: D, children: distort },
    { id: "filter.render", label: "Render", disabled: D, children: render },
    { id: "filter.noise", label: "Noise", disabled: D, children: noise },
    { id: "filter.other", label: "Other", disabled: D, children: other },
    { label: "Classic Filters", disabled: !hasImg, children: classic },
    { label: "Fix", disabled: D, children: fix },
    { id: "filter.correction", label: "Correction", disabled: NC, children: correction },
    { divider: true },
    {
      label: "Clear Filters",
      disabled: !hasImg,
      onClick: () => {
        const img = activeImage();
        if (!img) return;
        clearFilters(img);
        getCtx().push();
      },
    },
  ];
}

export default function FilterMenu() {
  const lastFilter = useSettingsStore((s) => s.lastFilter);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        applyLastFilter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <MenuButton title="Filter" entries={entries(lastFilter, () => setGalleryOpen(true))} />
      {galleryOpen && <FilterGalleryDialog onClose={() => setGalleryOpen(false)} />}
    </>
  );
}