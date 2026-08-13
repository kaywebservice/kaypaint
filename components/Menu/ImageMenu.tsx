"use client";

import { useEffect, useReducer, useState } from "react";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { canvasNow, getCtx, histNow } from "@/utils/menuUtils";
import { importImageDataURL } from "@/components/Tools/ImageTool";
import { removeBackground } from "@/ai/backgroundRemoval";
import { syncCanvasSizeStore, scaleCanvasContent } from "@/engine/canvasSizeEngine";
import { showOptions } from "./OptionDialog";
import { BLEND_MODES } from "@/engine/pixelOps";
import { useDocStore } from "@/store/documentStore";
import CanvasSizeDialog from "./CanvasSizeDialog";
import ColorSettingsDialog from "@/components/Editor/ColorSettingsDialog";
import {
  adjAutoColor,
  adjAutoContrast,
  adjAutoTone,
  adjBlackAndWhite,
  adjBrightnessContrast,
  adjChannelMixer,
  adjColorBalance,
  adjColorLookup,
  adjCurves,
  adjExposure,
  adjGradientMap,
  adjHueSat,
  adjInvert,
  adjLevels,
  adjPhotoFilter,
  adjPosterize,
  adjSelectiveColor,
  adjShadowsHighlights,
  adjThreshold,
  adjVibrance,
  applyImage,
  COLOR_LOOKUP_PRESETS,
  convertToCmyk,
  convertToGrayscale,
  convertToIndexedColor,
  convertToLab,
  cropDocument,
  duplicateDocument,
  flipDocument,
  getImageMode,
  onImageModeChange,
  rotateDocument,
  revealAll,
  runAdjustment,
  setImageMode,
  trimDocument,
} from "@/engine/imageOps";
import type { SelectiveTarget } from "@/engine/imageOps";
import { setBitDepthDialog, hdrExposure } from "@/engine/bitDepth";
import { duotoneDialog } from "@/engine/duotone";
import { bitmapDialog } from "@/engine/bitmapMode";
import { assignProfileDialog, convertToProfileDialog } from "@/engine/colorProfiles";
import {
  adjClarity,
  adjDehaze,
  adjGrain,
  adjColorAndVibrance,
} from "@/engine/generativeAI";

function rotateObjects(canvas: FabricCanvas | null, cw: boolean) {
  const objects: FabricObject[] = canvas?.getObjects() ?? [];
  if (!objects.length || !canvas) return;

  const h = canvas.height;
  objects.forEach((obj) => {
    const bb = obj.getBoundingRect();
    const cx = bb.left + bb.width / 2;
    const cy = bb.top + bb.height / 2;

    let nx = cx;
    let ny = cy;

    if (cw) {
      nx = h - cy;
      ny = cx;
    } else {
      nx = cy;
      ny = h - cx;
    }

    obj.set({
      angle: (obj.angle ?? 0) + (cw ? 90 : -90),
      left: nx - bb.width / 2,
      top: ny - bb.height / 2,
    });
    obj.setCoords();
  });

  const width = canvas.width;
  canvas.setDimensions({ width: canvas.height, height: width });
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  syncCanvasSizeStore(canvas);
  getCtx().push();
}

function getImageObject(canvas: FabricCanvas | null): FabricObject | null {
  const active = canvas?.getActiveObject() ?? null;
  if (active && active.type === "image") return active;
  return (canvas?.getObjects() ?? []).find((obj) => obj.type === "image") ?? null;
}

const AUTO_TONE_ENTRY: MenuEntry = {
  label: "Auto Tone",
  onClick: () => runAdjustment(adjAutoTone()),
};

const AUTO_CONTRAST_ENTRY: MenuEntry = {
  label: "Auto Contrast",
  onClick: () => runAdjustment(adjAutoContrast()),
};

const AUTO_COLOR_ENTRY: MenuEntry = {
  label: "Auto Color",
  onClick: () => runAdjustment(adjAutoColor()),
};

const ADJUSTMENT_ENTRIES: MenuEntry[] = [
  {
    label: "Levels…",
    onClick: async () => {
      const res = await showOptions({
        title: "Levels",
        fields: [
          { key: "black", label: "Black", type: "slider", min: 0, max: 255, value: 0 },
          { key: "gamma", label: "Gamma", type: "slider", min: 0.1, max: 5, step: 0.05, value: 1 },
          { key: "white", label: "White", type: "slider", min: 0, max: 255, value: 255 },
        ],
      });
      if (!res) return;
      runAdjustment(adjLevels(Number(res.black), Number(res.gamma), Number(res.white)));
    },
  },
  {
    label: "Curves…",
    onClick: async () => {
      const res = await showOptions({
        title: "Curves",
        fields: [
          {
            key: "preset",
            label: "Preset",
            type: "select",
            value: "linear",
            options: [
              { value: "linear", label: "Linear" },
              { value: "sCurve", label: "S-Curve" },
              { value: "negative", label: "Negative" },
            ],
          },
          { key: "adjust", label: "Adjust", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(adjCurves(String(res.preset), Number(res.adjust)));
    },
  },
  {
    label: "Hue/Saturation…",
    onClick: async () => {
      const res = await showOptions({
        title: "Hue/Saturation",
        fields: [
          { key: "hue", label: "Hue", type: "slider", min: -180, max: 180, value: 0 },
          { key: "sat", label: "Saturation", type: "slider", min: -100, max: 100, value: 0 },
          { key: "light", label: "Lightness", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(adjHueSat(Number(res.hue), Number(res.sat), Number(res.light)));
    },
  },
  {
    label: "Color Balance…",
    onClick: async () => {
      const res = await showOptions({
        title: "Color Balance",
        fields: [
          { key: "cy", label: "Cyan / Red", type: "slider", min: -100, max: 100, value: 0 },
          { key: "mg", label: "Magenta / Green", type: "slider", min: -100, max: 100, value: 0 },
          { key: "yl", label: "Yellow / Blue", type: "slider", min: -100, max: 100, value: 0 },
          { key: "preserve", label: "Preserve Luminosity", type: "checkbox", value: true },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjColorBalance(Number(res.cy), Number(res.mg), Number(res.yl), !!res.preserve)
      );
    },
  },
  {
    label: "Brightness/Contrast…",
    onClick: async () => {
      const res = await showOptions({
        title: "Brightness/Contrast",
        fields: [
          { key: "brightness", label: "Brightness", type: "slider", min: -100, max: 100, value: 0 },
          { key: "contrast", label: "Contrast", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjBrightnessContrast(Number(res.brightness), Number(res.contrast))
      );
    },
  },
  {
    label: "Exposure…",
    onClick: async () => {
      const res = await showOptions({
        title: "Exposure",
        fields: [
          { key: "exposure", label: "Exposure", type: "slider", min: -2, max: 2, step: 0.1, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(adjExposure(Number(res.exposure)));
    },
  },
  {
    label: "Vibrance…",
    onClick: async () => {
      const res = await showOptions({
        title: "Vibrance",
        fields: [
          { key: "vibrance", label: "Vibrance", type: "slider", min: -100, max: 100, value: 0 },
          { key: "sat", label: "Saturation", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(adjVibrance(Number(res.vibrance), Number(res.sat)));
    },
  },
  {
    label: "Black & White…",
    onClick: async () => {
      const res = await showOptions({
        title: "Black & White",
        fields: [
          { key: "reds", label: "Reds", type: "slider", min: -200, max: 300, value: 40 },
          { key: "yellows", label: "Yellows", type: "slider", min: -200, max: 300, value: 60 },
          { key: "greens", label: "Greens", type: "slider", min: -200, max: 300, value: 40 },
          { key: "cyans", label: "Cyans", type: "slider", min: -200, max: 300, value: 60 },
          { key: "blues", label: "Blues", type: "slider", min: -200, max: 300, value: 20 },
          { key: "magentas", label: "Magentas", type: "slider", min: -200, max: 300, value: 80 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjBlackAndWhite(
          Number(res.reds),
          Number(res.yellows),
          Number(res.greens),
          Number(res.cyans),
          Number(res.blues),
          Number(res.magentas)
        )
      );
    },
  },
  {
    label: "Photo Filter…",
    onClick: async () => {
      const res = await showOptions({
        title: "Photo Filter",
        fields: [
          { key: "color", label: "Color", type: "color", value: "#b3995d" },
          { key: "density", label: "Density", type: "slider", min: 0, max: 100, value: 25, suffix: "%" },
        ],
      });
      if (!res) return;
      runAdjustment(adjPhotoFilter(String(res.color), Number(res.density)));
    },
  },
  {
    label: "Channel Mixer…",
    onClick: async () => {
      const res = await showOptions({
        title: "Channel Mixer",
        fields: [
          {
            key: "channel",
            label: "Output Channel",
            type: "select",
            value: "r",
            options: [
              { value: "r", label: "Red" },
              { value: "g", label: "Green" },
              { value: "b", label: "Blue" },
            ],
          },
          { key: "red", label: "Red", type: "slider", min: -200, max: 200, value: 100 },
          { key: "green", label: "Green", type: "slider", min: -200, max: 200, value: 0 },
          { key: "blue", label: "Blue", type: "slider", min: -200, max: 200, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjChannelMixer(
          res.channel as "r" | "g" | "b",
          Number(res.red),
          Number(res.green),
          Number(res.blue)
        )
      );
    },
  },
  {
    label: "Color Lookup…",
    onClick: async () => {
      const res = await showOptions({
        title: "Color Lookup",
        fields: [
          {
            key: "preset",
            label: "Preset",
            type: "select",
            value: "none",
            options: COLOR_LOOKUP_PRESETS.map((p) => ({
              value: p,
              label: p === "nightFromDay" ? "Night From Day" : p === "tealOrange" ? "Teal & Orange" : p === "mono" ? "Mono" : p[0].toUpperCase() + p.slice(1),
            })),
          },
        ],
      });
      if (!res) return;
      runAdjustment(adjColorLookup(String(res.preset)));
    },
  },
  {
    label: "Invert",
    onClick: () => runAdjustment(adjInvert()),
  },
  {
    label: "Posterize…",
    onClick: async () => {
      const res = await showOptions({
        title: "Posterize",
        fields: [
          { key: "levels", label: "Levels", type: "slider", min: 2, max: 255, value: 4 },
        ],
      });
      if (!res) return;
      runAdjustment(adjPosterize(Number(res.levels)));
    },
  },
  {
    label: "Threshold…",
    onClick: async () => {
      const res = await showOptions({
        title: "Threshold",
        fields: [
          { key: "level", label: "Threshold Level", type: "slider", min: 1, max: 255, value: 128 },
        ],
      });
      if (!res) return;
      runAdjustment(adjThreshold(Number(res.level)));
    },
  },
  {
    label: "Gradient Map…",
    onClick: async () => {
      const res = await showOptions({
        title: "Gradient Map",
        fields: [
          { key: "dark", label: "Dark Color", type: "color", value: "#000000" },
          { key: "light", label: "Light Color", type: "color", value: "#ffffff" },
          { key: "smooth", label: "Smoothness", type: "slider", min: 0, max: 100, value: 50 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjGradientMap(String(res.dark), String(res.light), Number(res.smooth))
      );
    },
  },
  {
    label: "Selective Color…",
    onClick: async () => {
      const res = await showOptions({
        title: "Selective Color",
        fields: [
          {
            key: "target",
            label: "Colors",
            type: "select",
            value: "reds",
            options: [
              { value: "reds", label: "Reds" },
              { value: "yellows", label: "Yellows" },
              { value: "greens", label: "Greens" },
              { value: "cyans", label: "Cyans" },
              { value: "blues", label: "Blues" },
              { value: "magentas", label: "Magentas" },
              { value: "whites", label: "Whites" },
              { value: "neutrals", label: "Neutrals" },
              { value: "blacks", label: "Blacks" },
            ],
          },
          { key: "cyan", label: "Cyan", type: "slider", min: -100, max: 100, value: 0 },
          { key: "magenta", label: "Magenta", type: "slider", min: -100, max: 100, value: 0 },
          { key: "yellow", label: "Yellow", type: "slider", min: -100, max: 100, value: 0 },
          { key: "black", label: "Black", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjSelectiveColor(
          res.target as SelectiveTarget,
          Number(res.cyan),
          Number(res.magenta),
          Number(res.yellow),
          Number(res.black)
        )
      );
    },
  },
  {
    label: "Shadows/Highlights…",
    onClick: async () => {
      const res = await showOptions({
        title: "Shadows/Highlights",
        fields: [
          { key: "shadows", label: "Shadows", type: "slider", min: 0, max: 100, value: 35 },
          { key: "highlights", label: "Highlights", type: "slider", min: 0, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjShadowsHighlights(Number(res.shadows), Number(res.highlights))
      );
    },
  },
  {
    id: "image.adjustments.clarity",
    label: "Clarity…",
    onClick: async () => {
      const res = await showOptions({
        title: "Clarity",
        fields: [
          { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, value: 50, suffix: "%" },
        ],
      });
      if (!res) return;
      runAdjustment(adjClarity(Number(res.amount)));
    },
  },
  {
    id: "image.adjustments.dehaze",
    label: "Dehaze…",
    onClick: async () => {
      const res = await showOptions({
        title: "Dehaze",
        fields: [
          { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, value: 50, suffix: "%" },
        ],
      });
      if (!res) return;
      runAdjustment(adjDehaze(Number(res.amount)));
    },
  },
  {
    id: "image.adjustments.grain",
    label: "Grain…",
    onClick: async () => {
      const res = await showOptions({
        title: "Grain",
        fields: [
          { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, value: 30, suffix: "%" },
        ],
      });
      if (!res) return;
      runAdjustment(adjGrain(Number(res.amount)));
    },
  },
  {
    id: "image.adjustments.colorVibrance",
    label: "Color and Vibrance…",
    onClick: async () => {
      const res = await showOptions({
        title: "Color and Vibrance",
        fields: [
          { key: "red", label: "Red", type: "slider", min: -100, max: 100, value: 0 },
          { key: "green", label: "Green", type: "slider", min: -100, max: 100, value: 0 },
          { key: "blue", label: "Blue", type: "slider", min: -100, max: 100, value: 0 },
          { key: "cyan", label: "Cyan", type: "slider", min: -100, max: 100, value: 0 },
          { key: "magenta", label: "Magenta", type: "slider", min: -100, max: 100, value: 0 },
          { key: "yellow", label: "Yellow", type: "slider", min: -100, max: 100, value: 0 },
          { key: "vibrance", label: "Vibrance", type: "slider", min: -100, max: 100, value: 0 },
        ],
      });
      if (!res) return;
      runAdjustment(
        adjColorAndVibrance({
          red: Number(res.red),
          green: Number(res.green),
          blue: Number(res.blue),
          cyan: Number(res.cyan),
          magenta: Number(res.magenta),
          yellow: Number(res.yellow),
          vibrance: Number(res.vibrance),
        })
      );
    },
  },
  AUTO_TONE_ENTRY,
  AUTO_CONTRAST_ENTRY,
  AUTO_COLOR_ENTRY,
];

const IMAGE_ROTATION_ENTRIES: MenuEntry[] = [
  { label: "180°", onClick: () => rotateDocument(180) },
  { label: "90° CW", onClick: () => rotateDocument(90) },
  { label: "90° CCW", onClick: () => rotateDocument(-90) },
  {
    label: "Arbitrary…",
    onClick: async () => {
      const res = await showOptions({
        title: "Rotate Canvas",
        fields: [
          { key: "angle", label: "Angle", type: "slider", min: -180, max: 180, step: 0.1, value: 45, suffix: "°" },
          {
            key: "direction",
            label: "Direction",
            type: "select",
            value: "cw",
            options: [
              { value: "cw", label: "CW" },
              { value: "ccw", label: "CCW" },
            ],
          },
        ],
      });
      if (!res) return;
      rotateDocument(Number(res.angle) * (res.direction === "ccw" ? -1 : 1));
    },
  },
  { divider: true },
  { label: "Flip Canvas Horizontal", onClick: () => flipDocument(true) },
  { label: "Flip Canvas Vertical", onClick: () => flipDocument(false) },
];

function entries(onCanvasSize: () => void, onColorSettings: () => void): MenuEntry[] {
  const canvas = canvasNow();
  const image = getImageObject(canvas);
  const mode = getImageMode();

  return [
    {
      label: "Rotate 90° CW",
      onClick: () => rotateObjects(canvas, true),
    },
    {
      label: "Rotate 90° CCW",
      onClick: () => rotateObjects(canvas, false),
    },
    {
      label: "Flip Horizontal",
      onClick: () => {
        const objects: FabricObject[] = canvas?.getActiveObjects?.().length
          ? canvas.getActiveObjects()
          : canvas?.getObjects() ?? [];
        objects.forEach((obj) => obj.set({ flipX: !obj.flipX }));
        canvas?.requestRenderAll?.();
        getCtx().push();
      },
    },
    {
      label: "Flip Vertical",
      onClick: () => {
        const objects: FabricObject[] = canvas?.getActiveObjects?.().length
          ? canvas.getActiveObjects()
          : canvas?.getObjects() ?? [];
        objects.forEach((obj) => obj.set({ flipY: !obj.flipY }));
        canvas?.requestRenderAll?.();
        getCtx().push();
      },
    },
    { divider: true },
    {
      id: "image.mode",
      label: "Mode",
      children: [
        {
          label: "RGB Color",
          checked: mode === "rgb",
          onClick: () => setImageMode("rgb"),
        },
        {
          label: "Grayscale",
          checked: mode === "grayscale",
          onClick: async () => {
            await convertToGrayscale();
            setImageMode("grayscale");
          },
        },
        {
          label: "CMYK Color",
          checked: mode === "cmyk",
          onClick: async () => {
            await convertToCmyk();
            setImageMode("cmyk");
          },
        },
        {
          label: "Lab Color",
          checked: mode === "lab",
          onClick: async () => {
            await convertToLab();
            setImageMode("lab");
          },
        },
        {
          label: "Indexed Color…",
          checked: mode === "indexed",
          onClick: async () => {
            const res = await showOptions({
              title: "Indexed Color",
              fields: [
                {
                  key: "colors",
                  label: "Number of Colors",
                  type: "slider",
                  min: 2,
                  max: 256,
                  value: 64,
                },
              ],
            });
            if (!res) return;
            await convertToIndexedColor(Number(res.colors));
            setImageMode("indexed");
          },
        },
        { divider: true },
        { label: "8 Bits/Channel…", onClick: () => void setBitDepthDialog(canvas) },
        { label: "16 Bits/Channel…", onClick: () => void setBitDepthDialog(canvas) },
        { label: "32 Bits/Channel…", onClick: () => void setBitDepthDialog(canvas) },
        { divider: true },
        { label: "Duotone…", onClick: () => void duotoneDialog(canvas) },
        { label: "Bitmap…", onClick: () => void bitmapDialog(canvas) },
      ],
    },
    {
      id: "image.adjustments",
      label: "Adjustments",
      children: ADJUSTMENT_ENTRIES,
    },
    AUTO_TONE_ENTRY,
    AUTO_CONTRAST_ENTRY,
    AUTO_COLOR_ENTRY,
    { divider: true },
    {
      label: "HDR Exposure…",
      onClick: () => void hdrExposure(canvas, 0),
    },
    {
      label: "Assign Profile…",
      onClick: () => void assignProfileDialog(canvas),
    },
    {
      label: "Convert to Profile…",
      onClick: () => void convertToProfileDialog(canvas),
    },
    { divider: true },
    {
      id: "image.rotate",
      label: "Image Rotation",
      children: IMAGE_ROTATION_ENTRIES,
    },
    { label: "Flip Canvas Horizontal", onClick: () => flipDocument(true) },
    { label: "Flip Canvas Vertical", onClick: () => flipDocument(false) },
    { divider: true },
    {
      label: "Crop…",
      onClick: async () => {
        const c = canvasNow();
        if (!c) return;
        const res = await showOptions({
          title: "Crop",
          fields: [
            { key: "trim", label: "Trim transparent pixels", type: "checkbox", value: false },
            { key: "left", label: "Left", type: "slider", min: 0, max: c.width, value: 0 },
            { key: "top", label: "Top", type: "slider", min: 0, max: c.height, value: 0 },
            { key: "width", label: "Width", type: "slider", min: 1, max: c.width, value: c.width },
            { key: "height", label: "Height", type: "slider", min: 1, max: c.height, value: c.height },
          ],
        });
        if (!res) return;
        if (res.trim) {
          trimDocument("transparent");
          return;
        }
        cropDocument(Number(res.left), Number(res.top), Number(res.width), Number(res.height));
      },
    },
    {
      label: "Trim…",
      onClick: async () => {
        const res = await showOptions({
          title: "Trim",
          fields: [
            {
              key: "basedOn",
              label: "Based On",
              type: "select",
              value: "transparent",
              options: [
                { value: "transparent", label: "Transparent Pixels" },
                { value: "topleft", label: "Top Left Pixel Color" },
                { value: "bottomright", label: "Bottom Right Pixel Color" },
              ],
            },
          ],
        });
        if (!res) return;
        trimDocument(res.basedOn as "transparent" | "topleft" | "bottomright");
      },
    },
    { divider: true },
    {
      label: "Reveal All",
      onClick: () => revealAll(),
    },
    { divider: true },
    {
      id: "image.imageSize",
      label: "Image Size…",
      onClick: () => {
        const c = canvasNow();
        if (!c) return;
        const w = window.prompt("Width (px)", String(c.width));
        const h = window.prompt("Height (px)", String(c.height));
        const width = Number(w);
        const height = Number(h);

        if (width > 0 && height > 0) {
          scaleCanvasContent(width, height);
          histNow()?.push?.();
        }
      },
    },
    {
      id: "image.canvasSize",
      label: "Canvas Size…",
      onClick: onCanvasSize,
    },
    { divider: true },
    {
      label: "Remove Background (AI)",
      disabled: !image,
      onClick: async () => {
        const obj = getImageObject(canvasNow());
        if (!obj) return;

        try {
          const el = (obj as unknown as { getElement?: () => HTMLImageElement }).getElement?.();
          const src = el?.src ?? el?.currentSrc;
          if (!src) {
            window.alert("This image cannot be processed.");
            return;
          }

          const result = await removeBackground(src);
          const id = await importImageDataURL(result, getCtx());
          if (id) {
            canvasNow().remove(obj);
            canvasNow().requestRenderAll();
            getCtx().push();
          }
        } catch (error) {
          window.alert(
            "Background removal failed: " +
              (error instanceof Error ? error.message : "OpenCV unavailable")
          );
        }
      },
    },
    {
      label: "Apply Image…",
      onClick: async () => {
        const res = await showOptions({
          title: "Apply Image",
          fields: [
            {
              key: "source",
              label: "Source",
              type: "select",
              value: "merged",
              options: [
                { value: "merged", label: "Merged" },
                { value: "active", label: "Active Layer" },
              ],
            },
            {
              key: "blend",
              label: "Blend Mode",
              type: "select",
              value: "normal",
              options: BLEND_MODES.map((m) => ({ value: m, label: m })),
            },
            { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, value: 100, suffix: "%" },
            { key: "invert", label: "Invert", type: "checkbox", value: false },
          ],
        });
        if (!res) return;
        applyImage({
          source: res.source === "active" ? "active" : "merged",
          blendMode: String(res.blend),
          opacity: Number(res.opacity),
          invert: !!res.invert,
        });
      },
    },
    {
      label: "Duplicate…",
      onClick: async () => {
        const doc = useDocStore
          .getState()
          .docs.find((d) => d.id === useDocStore.getState().activeDocId);
        const defaultName = `${doc?.name ?? "Untitled-1"} copy`;
        const res = await showOptions({
          title: "Duplicate Image",
          fields: [{ key: "name", label: "Document Name", type: "text", value: defaultName }],
        });
        if (!res) return;
        duplicateDocument(String(res.name));
      },
    },
    { divider: true },
    {
      label: "Color Settings…",
      onClick: () => onColorSettings(),
    },
  ];
}

export default function ImageMenu() {
  const [canvasSizeOpen, setCanvasSizeOpen] = useState(false);
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => onImageModeChange(force), []);

  return (
    <>
      <MenuButton title="Image" entries={entries(() => setCanvasSizeOpen(true), () => setColorSettingsOpen(true))} />
      {canvasSizeOpen && <CanvasSizeDialog onClose={() => setCanvasSizeOpen(false)} />}
      {colorSettingsOpen && <ColorSettingsDialog onClose={() => setColorSettingsOpen(false)} />}
    </>
  );
}