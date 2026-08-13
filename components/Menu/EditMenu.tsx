"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import ColorSettingsDialog from "@/components/Editor/ColorSettingsDialog";
import { canvasNow, histNow, getCtx } from "@/utils/menuUtils";
import {
  copyActiveSelection,
  cutActiveSelection,
  pasteClipboard,
  duplicateActiveSelection,
  hasClipboard,
} from "@/engine/toolEngine";
import {
  copyMerged,
  pasteInto,
  fillSelection,
  strokeSelection,
  freeTransformSelection,
  transformScale,
  transformRotate,
  transformRotateStep,
  transformFlip,
  transformSkew,
  transformDistort,
  transformPerspective,
  defineBrushPreset,
  manageBrushPresets,
  openColorSettings,
  showMenusHelp,
  prefsUnitsAndRulers,
  prefsGuidesAndGrid,
  prefsInterface,
} from "@/engine/editOps";
import { importImageFile } from "@/components/Tools/ImageTool";
import { contentAwareFill } from "@/engine/contentAwareEngine";
import {
  generativeFill,
  generativeExpand,
  generativeUpscale,
  generativeRemove,
  harmonizeLayers,
} from "@/engine/generativeAI";
import {
  startFade,
  purgeUndo,
  purgeClipboard,
  purgeHistory,
  purgeAll,
  openToolbarEditor,
} from "@/engine/editExtras";
import { definePatternPreset, defineCustomShape } from "@/engine/presetsOps";
import { showOptions } from "./OptionDialog";
import { startMeshWarp } from "@/engine/warpEngine";
import { startPuppetWarp } from "@/engine/puppetWarp";
import { startPerspectiveWarp } from "@/engine/perspectiveWarp";
import { contentAwareScale } from "@/engine/contentAwareScale";
import { skyReplacement } from "@/engine/skyReplace";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFeaturesStore } from "@/store/featuresStore";
import type { BrushPreset } from "@/store/settingsStore";

function entries(
  presets: BrushPreset[],
  onColorSettings: () => void
): MenuEntry[] {
  const canvas = canvasNow();
  const history = histNow();
  const hasActive = !!canvas?.getActiveObject?.();

  const transformChildren: MenuEntry[] = [
    {
      label: "Scale…",
      onClick: () => void transformScale(canvas, getCtx()),
    },
    {
      label: "Rotate…",
      onClick: () => void transformRotate(canvas, getCtx()),
    },
    {
      label: "Rotate 180°",
      onClick: () => transformRotateStep(canvas, getCtx(), 180),
    },
    {
      label: "Rotate 90° CW",
      onClick: () => transformRotateStep(canvas, getCtx(), 90),
    },
    {
      label: "Rotate 90° CCW",
      onClick: () => transformRotateStep(canvas, getCtx(), -90),
    },
    { divider: true },
    {
      label: "Flip Horizontal",
      onClick: () => transformFlip(canvas, getCtx(), "x"),
    },
    {
      label: "Flip Vertical",
      onClick: () => transformFlip(canvas, getCtx(), "y"),
    },
    { divider: true },
    {
      label: "Skew…",
      onClick: () => void transformSkew(canvas, getCtx()),
    },
    {
      label: "Distort…",
      onClick: () => void transformDistort(canvas, getCtx()),
    },
    {
      label: "Perspective…",
      onClick: () => void transformPerspective(canvas, getCtx()),
    },
    { divider: true },
    {
      label: "Warp…",
      disabled: !hasActive,
      onClick: () => startMeshWarp(canvas),
    },
    {
      label: "Puppet Warp…",
      disabled: !hasActive,
      onClick: () => startPuppetWarp(canvas),
    },
    {
      label: "Perspective Warp…",
      disabled: !hasActive,
      onClick: () => startPerspectiveWarp(canvas),
    },
    {
      label: "Content-Aware Scale…",
      disabled: !hasActive,
      onClick: () => void contentAwareScale(canvas),
    },
  ];

  const brushChildren: MenuEntry[] = [
    ...(presets.length
      ? presets.map((p) => ({
          label: p.name,
          onClick: () => {
            useEditorStore.getState().setColor(p.color);
            useEditorStore.getState().setSize(p.size);
          },
        }))
      : [{ label: "(none defined)", disabled: true }]),
    { divider: true },
    {
      label: "Manage…",
      onClick: () => void manageBrushPresets(),
    },
  ];

  return [
    {
      id: "edit.undo",
      label: "Undo",
      shortcut: "Ctrl+Z",
      disabled: !history?.canUndo,
      onClick: () => history?.undo?.(),
    },
    {
      id: "edit.redo",
      label: "Redo",
      shortcut: "Ctrl+Shift+Z",
      disabled: !history?.canRedo,
      onClick: () => history?.redo?.(),
    },
    { divider: true },
    {
      id: "edit.cut",
      label: "Cut",
      shortcut: "Ctrl+X",
      onClick: () => cutActiveSelection(canvas, getCtx()),
    },
    {
      id: "edit.copy",
      label: "Copy",
      shortcut: "Ctrl+C",
      onClick: () => copyActiveSelection(canvas),
    },
    {
      label: "Copy Merged",
      shortcut: "Shift+Ctrl+C",
      onClick: () => void copyMerged(canvas),
    },
    {
      id: "edit.paste",
      label: "Paste",
      shortcut: "Ctrl+V",
      disabled: !hasClipboard(),
      onClick: () => pasteClipboard(canvas, getCtx()),
    },
    {
      label: "Paste Into",
      shortcut: "Shift+Ctrl+V",
      disabled: !hasClipboard(),
      onClick: () => void pasteInto(canvas, getCtx()),
    },
    { divider: true },
    {
      label: "Duplicate Selection",
      shortcut: "Ctrl+J",
      onClick: () => duplicateActiveSelection(canvas, getCtx()),
    },
    {
      id: "edit.fade",
      label: "Fade…",
      disabled: !canvas,
      onClick: () => void startFade(),
    },
    {
      label: "Purge",
      children: [
        { id: "edit.purge.undo", label: "Undo", onClick: purgeUndo },
        { id: "edit.purge.clipboard", label: "Clipboard", onClick: purgeClipboard },
        { id: "edit.purge.history", label: "History", onClick: purgeHistory },
        { divider: true, danger: true },
        { id: "edit.purge.all", label: "All", danger: true, onClick: purgeAll },
      ],
    },
    {
      id: "edit.definePattern",
      label: "Define Pattern Preset…",
      onClick: () => void definePatternPreset(),
    },
    {
      id: "edit.defineShape",
      label: "Define Custom Shape…",
      onClick: () => void defineCustomShape(),
    },
    {
      id: "edit.toolbar",
      label: "Toolbar…",
      onClick: () => void openToolbarEditor(),
    },
    {
      label: "Delete Selection",
      shortcut: "Delete",
      onClick: () => {
        canvas?.getActiveObjects?.().forEach((obj: any) => {
          if (obj.isEditing) return;
          canvas.remove(obj);
        });
        canvas?.discardActiveObject?.();
        getCtx().push();
      },
    },
    { divider: true },
    {
      id: "edit.fill",
      label: "Fill…",
      disabled: !hasActive,
      onClick: () => void fillSelection(canvas),
    },
    {
      id: "edit.stroke",
      label: "Stroke…",
      disabled: !hasActive,
      onClick: () => void strokeSelection(canvas, getCtx()),
    },
    {
      label: "Content-Aware Fill…",
      disabled: !hasActive,
      onClick: async () => {
        try {
          await contentAwareFill(canvas);
        } catch (error: any) {
          window.alert(error?.message ?? "Content-Aware Fill failed");
        }
      },
    },
    {
      id: "edit.generativeFill",
      label: "Generative Fill…",
      disabled: !hasActive,
      onClick: async () => {
        const res = await showOptions({
          title: "Generative Fill",
          fields: [
            { key: "prompt", label: "Prompt (optional)", type: "text", value: "" },
            { key: "radius", label: "Fill Radius", type: "slider", min: 1, max: 100, value: 10, suffix: " px" },
          ],
        });
        if (!res) return;
        try {
          await generativeFill(canvas, {
            prompt: String(res.prompt),
            radius: Number(res.radius),
          });
        } catch (error: any) {
          window.alert(error?.message ?? "Generative Fill failed");
        }
      },
    },
    {
      id: "edit.generativeExpand",
      label: "Generative Expand…",
      onClick: async () => {
        if (!canvas) return;
        const res = await showOptions({
          title: "Generative Expand",
          fields: [
            { key: "width", label: "Target Width", type: "number", min: 1, max: 20000, value: Math.round(canvas.width * 1.25), suffix: " px" },
            { key: "height", label: "Target Height", type: "number", min: 1, max: 20000, value: Math.round(canvas.height * 1.25), suffix: " px" },
          ],
        });
        if (!res) return;
        try {
          await generativeExpand(canvas, {
            width: Number(res.width),
            height: Number(res.height),
          });
        } catch (error: any) {
          window.alert(error?.message ?? "Generative Expand failed");
        }
      },
    },
    {
      id: "edit.generativeUpscale",
      label: "Generative Upscale…",
      onClick: async () => {
        const res = await showOptions({
          title: "Generative Upscale",
          fields: [
            {
              key: "scale",
              label: "Scale",
              type: "select",
              value: "2",
              options: [
                { value: "2", label: "2x" },
                { value: "4", label: "4x" },
              ],
            },
          ],
        });
        if (!res) return;
        try {
          await generativeUpscale(canvas, Number(res.scale));
        } catch (error: any) {
          window.alert(error?.message ?? "Generative Upscale failed");
        }
      },
    },
    {
      id: "edit.generativeRemove",
      label: "Generative Remove",
      disabled: !hasActive,
      onClick: async () => {
        try {
          await generativeRemove(canvas);
        } catch (error: any) {
          window.alert(error?.message ?? "Generative Remove failed");
        }
      },
    },
    {
      id: "edit.harmonize",
      label: "Harmonize",
      disabled: !hasActive,
      onClick: async () => {
        try {
          await harmonizeLayers(canvas);
        } catch (error: any) {
          window.alert(error?.message ?? "Harmonize failed");
        }
      },
    },
    { divider: true },
    {
      label: "Free Transform",
      shortcut: "Ctrl+T",
      disabled: !hasActive,
      onClick: () => freeTransformSelection(canvas),
    },
    {
      label: "Transform",
      disabled: !hasActive,
      children: transformChildren,
    },
    {
      label: "Sky Replacement…",
      onClick: () => void skyReplacement(canvas),
    },
    { divider: true },
    {
      label: "Define Brush Preset…",
      onClick: () => void defineBrushPreset(),
    },
    {
      label: "Brush Presets",
      children: brushChildren,
    },
    { divider: true },
    {
      label: "Paste Image from Clipboard",
      onClick: async () => {
        try {
          if (!navigator.clipboard?.read) {
            window.alert("Clipboard image reading is not supported here.");
            return;
          }
          const items = await navigator.clipboard.read();
          const item = items.find((i) => i.types.includes("image/png"));
          const blob = await item?.getType("image/png");
          if (blob) {
            importImageFile(new File([blob], "clipboard.png", { type: "image/png" }), getCtx());
          }
        } catch {
          window.alert("Could not read the clipboard.");
        }
      },
    },
    { divider: true },
    {
      label: "Color Settings…",
      onClick: () => {
        openColorSettings();
        onColorSettings();
      },
    },
    {
      id: "edit.keyboardShortcuts",
      label: "Keyboard Shortcuts…",
      onClick: () => useFeaturesStore.getState().setShortcutEditorOpen(true),
    },
    {
      id: "edit.menus",
      label: "Menus…",
      onClick: () => void showMenusHelp(),
    },
    {
      label: "Preferences",
      children: [
        {
          label: "Units & Rulers…",
          onClick: () => void prefsUnitsAndRulers(),
        },
        {
          label: "Guides & Grid…",
          onClick: () => void prefsGuidesAndGrid(),
        },
        {
          label: "Interface…",
          onClick: () => void prefsInterface(),
        },
      ],
    },
  ];
}

export default function EditMenu() {
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  const presets = useSettingsStore((s) => s.brushPresets);
  return (
    <>
      <MenuButton
        title="Edit"
        entries={entries(presets, () => setColorSettingsOpen(true))}
      />
      {colorSettingsOpen && (
        <ColorSettingsDialog onClose={() => setColorSettingsOpen(false)} />
      )}
    </>
  );
}