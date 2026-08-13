"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { canvasNow, layersNow, getCtx } from "@/utils/menuUtils";
import { toggleMask } from "@/engine/maskEngine";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import {
  convertToSmartObject,
  rasterizeActiveLayer,
  enterSmartObjectIsolation,
  exitSmartObjectIsolation,
  isSmartObject,
} from "@/engine/smartObjectEngine";
import type { KayLayer } from "@/types/layer";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import {
  applyLayerEffectDialog,
  blendingOptionsDialog,
  resetLayerStyle,
  addFillLayerDialog,
  addPatternFillLayerDialog,
  addAdjustmentLayerMenu,
  revealAllMask,
  hideAllMask,
  revealSelectionMask,
  hideSelectionMask,
  deleteLayerMask,
  applyLayerMask,
  toggleLayerMaskEnabled,
  maskFromTransparency,
  createClippingMask,
  releaseClippingMask,
  groupLayers,
  ungroupLayers,
  alignObjects,
  distributeObjects,
  lockLayers,
  ensureLinkedMoveSupport,
  linkLayers,
  unlinkLayers,
  mergeDown,
  mergeVisibleLayers,
  flattenImageLayer,
} from "@/engine/layerOps";
import * as smartObjectsV2 from "@/engine/smartObjects";
import * as smartFilters from "@/engine/smartFilters";
import * as layerComps from "@/engine/layerComps";
import * as blendIfEngine from "@/engine/blendIfEngine";
import { globalLightDialog } from "@/engine/globalLight";
import {
  autoAlignLayers,
  autoBlendLayers,
  rasterizeLayerByKind,
  rasterizeAllLayers,
  groupLayersIntoSmartObject,
  selectLinkedLayers,
} from "@/engine/autoAlignBlend";

function objId(o: FabricObject | null | undefined): string | undefined {
  const oid = (o as { kaypaintId?: string }).kaypaintId;
  return oid ?? (o as { id?: string }).id;
}

function layerObject(layer: KayLayer | undefined): FabricObject | null {
  const canvas = canvasNow();
  if (!canvas || !layer?.objectId) return null;
  return (
    canvas.getObjects().find((o: any) => objId(o) === layer.objectId) ?? null
  );
}

function selectedObjectIds(canvas: FabricCanvas | null): string[] {
  if (!canvas) return [];
  const ids = (canvas.getActiveObjects?.() ?? [])
    .map((o) => objId(o))
    .filter((id): id is string => !!id);
  if (!ids.length) {
    const layer = layersNow().layers.find((l) => l.id === layersNow().activeLayer);
    const id = objId(layerObject(layer));
    if (id) ids.push(id);
  }
  return ids;
}

function layerIdsForSelection(canvas: FabricCanvas | null): string[] {
  const ls = layersNow();
  const ids: string[] = [];
  if (!canvas) return ids;
  for (const o of canvas.getActiveObjects?.() ?? []) {
    const lay = ls.layers.find((l) => l.objectId === objId(o));
    if (lay) ids.push(lay.id);
  }
  if (!ids.length && ls.activeLayer) ids.push(ls.activeLayer);
  return ids;
}

function groupSelectedCount(canvas: FabricCanvas | null): number {
  const ls = layersNow();
  const groupIds = new Set<string>();
  for (const id of layerIdsForSelection(canvas)) {
    const g = ls.groupForLayer(id);
    if (g) groupIds.add(g.id);
  }
  return groupIds.size;
}

function entries(): MenuEntry[] {
  const ls = layersNow();
  const canvas: FabricCanvas | null = canvasNow();
  const idx = ls.layers.findIndex((l) => l.id === ls.activeLayer);
  const active = ls.layers[idx];
  const obj = layerObject(active);
  const activeIdx = obj ? (canvas?.getObjects()?.indexOf(obj) ?? -1) : -1;
  const below = activeIdx > 0 ? canvas?.getObjects()?.[activeIdx - 1] : null;
  const belowHasLayer = !!below && ls.layers.some((l) => l.objectId === objId(below));
  const selCount = canvas?.getActiveObjects?.().length ?? (obj ? 1 : 0);
  const linkedIds = useSettingsStore.getState().linkedIds;
  const selObjIds = selectedObjectIds(canvas);
  const allLinked = selObjIds.length > 0 && selObjIds.every((i) => linkedIds.includes(i));
  const clipActive = !!obj?.clipPath;

  ensureLinkedMoveSupport(canvas!);

  const arrange = (label: string, shortcut: string | undefined, up: boolean, front: boolean): MenuEntry => ({
    label,
    shortcut,
    disabled: !active || activeIdx < 0,
    onClick: () => {
      if (!active || !canvas) return;
      const o = canvas.getActiveObject();
      if (!o) return;
      if (front && up) canvas.moveObjectTo(o, canvas.getObjects().length - 1);
      else if (front) canvas.sendObjectToBack(o);
      else if (up) canvas.bringObjectForward(o);
      else canvas.sendObjectBackwards(o);
      canvas.requestRenderAll();
      if (front && up) ls.bringLayerToFront(active.id);
      else if (front) ls.sendLayerToBack(active.id);
      else if (up) ls.moveLayerUp(active.id);
      else ls.moveLayerDown(active.id);
      getCtx().push();
    },
  });

  const styleEffect = (key: string, label: string): MenuEntry => ({
    label: `${label}…`,
    disabled: !obj,
    onClick: () => applyLayerEffectDialog(canvas, key),
  });

  const maskEntry = (label: string, onClick: () => void, disabled = !obj): MenuEntry => ({
    label,
    disabled,
    onClick,
  });

  const adjustmentEntries: MenuEntry[] = [
    { label: "Levels…", onClick: () => addAdjustmentLayerMenu(canvas, "levels") },
    { label: "Curves…", onClick: () => addAdjustmentLayerMenu(canvas, "curves") },
    { label: "Hue/Saturation…", onClick: () => addAdjustmentLayerMenu(canvas, "hueSat") },
    { divider: true },
    { label: "Brightness/Contrast…", onClick: () => addAdjustmentLayerMenu(canvas, "brightnessContrast") },
    { label: "Exposure…", onClick: () => addAdjustmentLayerMenu(canvas, "exposure") },
    { label: "Posterize…", onClick: () => addAdjustmentLayerMenu(canvas, "posterize") },
    { label: "Threshold…", onClick: () => addAdjustmentLayerMenu(canvas, "threshold") },
    { label: "Invert…", onClick: () => addAdjustmentLayerMenu(canvas, "invert") },
  ];

  return [
    {
      id: "layer.new",
      label: "New",
      children: [
        { label: "Layer…", shortcut: "Shift+Ctrl+N", onClick: () => ls.addLayer?.() },
        { label: "Group…", onClick: () => ls.createGroup(active ? [active.id] : []) },
        {
          label: "Group from Layers",
          shortcut: "Ctrl+G",
          disabled: !active,
          onClick: () => groupLayers(canvas),
        },
        { divider: true },
        {
          label: "Fill Layer",
          children: [
            { label: "Solid Color…", onClick: () => addFillLayerDialog(canvas, "solid") },
            { label: "Gradient…", onClick: () => addFillLayerDialog(canvas, "gradient") },
            { label: "Pattern…", onClick: () => addPatternFillLayerDialog(canvas) },
          ],
        },
        { label: "Adjustment Layer", children: adjustmentEntries },
      ],
    },
    {
      id: "layer.duplicate",
      label: "Duplicate Layer",
      disabled: !active,
      onClick: () => active && ls.duplicateLayer(active.id),
    },
    {
      id: "layer.delete",
      label: "Delete Layer",
      danger: true,
      disabled: !active,
      onClick: () => active && ls.removeLayer(active.id),
    },
    { divider: true },
    {
      label: "Layer Style",
      disabled: !obj,
      children: [
        { label: "Blending Options…", disabled: !obj, onClick: () => blendingOptionsDialog(canvas) },
        styleEffect("dropShadow", "Drop Shadow"),
        styleEffect("innerShadow", "Inner Shadow"),
        styleEffect("outerGlow", "Outer Glow"),
        styleEffect("innerGlow", "Inner Glow"),
        styleEffect("bevelEmboss", "Bevel & Emboss"),
        styleEffect("satin", "Satin"),
        styleEffect("colorOverlay", "Color Overlay"),
        styleEffect("gradientOverlay", "Gradient Overlay"),
        styleEffect("patternOverlay", "Pattern Overlay"),
        styleEffect("stroke", "Stroke"),
        { divider: true },
        { label: "Reset Style", disabled: !obj, onClick: () => resetLayerStyle(canvas) },
      ],
    },
    { divider: true },
    {
      label: "Convert to Smart Object",
      disabled: !active || !canvas?.getActiveObject?.(),
      onClick: () => {
        convertToSmartObject(canvas);
      },
    },
    {
      label: "Rasterize Layer",
      disabled:
        !active ||
        !canvas?.getActiveObject?.() ||
        canvas.getActiveObject()?.type === "image" ||
        canvas.getActiveObject()?.type === "SAdjustment",
      onClick: () => {
        rasterizeActiveLayer(canvas);
      },
    },
    {
      label: "Rasterize",
      children: [
        { label: "Type", disabled: !obj || !["i-text", "textbox", "text"].includes(obj.type), onClick: () => rasterizeLayerByKind(canvas, "type") },
        { label: "Shape", disabled: !obj || !["path", "rect", "circle", "triangle", "ellipse", "polygon", "line"].includes(obj.type), onClick: () => rasterizeLayerByKind(canvas, "shape") },
        { label: "Fill Content", disabled: !obj || !["rect", "circle", "triangle", "ellipse", "polygon", "path"].includes(obj.type), onClick: () => rasterizeLayerByKind(canvas, "fill") },
        { label: "Smart Object", disabled: !obj, onClick: () => rasterizeLayerByKind(canvas, "smart") },
        { label: "Layer Style", disabled: !obj || !(obj as { layerStyleJson?: unknown }).layerStyleJson, onClick: () => rasterizeLayerByKind(canvas, "style") },
        { label: "Video", disabled: !obj || obj.type !== "video", onClick: () => rasterizeLayerByKind(canvas, "video") },
        { divider: true },
        { label: "All Layers", disabled: !canvas, onClick: () => rasterizeAllLayers(canvas) },
      ],
    },
    {
      label: "Edit Smart Object Contents…",
      disabled: !active || !canvas?.getActiveObject?.() || !isSmartObject(canvas.getActiveObject()),
      onClick: () => {
        enterSmartObjectIsolation(canvas);
      },
    },
    {
      label: "Exit Smart Object Edit",
      disabled: !useEditorStore.getState().soIsolation,
      onClick: () => {
        exitSmartObjectIsolation(canvas, false);
      },
    },
    {
      label: "Discard Smart Object Changes",
      danger: true,
      disabled: !useEditorStore.getState().soIsolation,
      onClick: () => {
        exitSmartObjectIsolation(canvas, true);
      },
    },
    { divider: true },
    {
      label: "Smart Objects",
      children: [
        {
          label: "Convert to Smart Object",
          disabled: !active,
          onClick: () => smartObjectsV2.convertToSmartObject(canvas),
        },
        {
          label: "Edit Contents…",
          disabled: !active || !smartObjectsV2.isSmartObject(active.id),
          onClick: () => smartObjectsV2.openSmartObjectEdit(canvas, active.id),
        },
        {
          label: "Close Edit",
          disabled: !active || !smartObjectsV2.isSmartObject(active.id),
          onClick: () => smartObjectsV2.closeSmartObjectEdit(canvas, active.id),
        },
        { divider: true },
        {
          label: "Link…",
          disabled: !active || !smartObjectsV2.isSmartObject(active.id),
          onClick: () => smartObjectsV2.linkSmartObject(canvas, active.id),
        },
        {
          label: "Update Linked…",
          disabled: !active || !smartObjectsV2.isSmartObject(active.id),
          onClick: () => smartObjectsV2.updateLinkedSmartObject(canvas, active.id),
        },
        { divider: true },
        {
          label: "Rasterize",
          disabled: !active || !smartObjectsV2.isSmartObject(active.id),
          onClick: () => smartObjectsV2.rasterizeSmartObject(canvas, active.id),
        },
        { divider: true },
        {
          label: "Group into New Smart Object",
          disabled: (canvas?.getActiveObjects?.().length ?? 0) < 2,
          onClick: () => void groupLayersIntoSmartObject(canvas),
        },
      ],
    },
    {
      label: "Smart Filters",
      children: [
        { label: "Add Smart Filter…", disabled: !active, onClick: () => smartFilters.addSmartFilter(canvas) },
        { label: "Manage Smart Filters…", disabled: !active, onClick: () => smartFilters.openSmartFilterManager(canvas) },
      ],
    },
    {
      label: "Layer Comps",
      children: [
        { label: "New Comp…", onClick: () => layerComps.captureComp(canvas) },
        { label: "Apply Comp…", onClick: () => layerComps.manageComps(canvas) },
        { label: "Manage Comps…", onClick: () => layerComps.manageComps(canvas) },
      ],
    },
    {
      label: "Blending",
      children: [
        { label: "Blend If…", disabled: !active, onClick: () => blendIfEngine.setBlendIfDialog(canvas, active.id) },
        { label: "Knockout…", disabled: !active, onClick: () => blendIfEngine.knockoutDialog(canvas, active.id) },
        { label: "Clear Blend If", disabled: !active, onClick: () => blendIfEngine.clearBlendIfForLayer(active.id) },
        { divider: true },
        { label: "Flatten (Advanced)", disabled: !canvas, onClick: () => blendIfEngine.flattenWithAdvanced(canvas) },
      ],
    },
    {
      label: "Global Light…",
      disabled: !canvas,
      onClick: () => globalLightDialog(canvas),
    },
    { divider: true },
    {
      label: "Layer Mask",
      disabled: !obj,
      children: [
        maskEntry("Reveal All", () => revealAllMask(canvas)),
        maskEntry("Hide All", () => hideAllMask(canvas)),
        maskEntry("Reveal Selection", () => revealSelectionMask(canvas)),
        maskEntry("Hide Selection", () => hideSelectionMask(canvas)),
        { divider: true },
        maskEntry("Apply", () => applyLayerMask(canvas), !clipActive),
        maskEntry("Enable/Disable", () => toggleLayerMaskEnabled(canvas), !clipActive && !(obj as { maskClip?: unknown } | null)?.maskClip),
        { divider: true },
        maskEntry("Delete", () => deleteLayerMask(canvas), !clipActive),
        maskEntry("From Transparency", () => maskFromTransparency(canvas)),
        { divider: true },
        maskEntry("Toggle Mask", () => {
          if (obj) {
            toggleMask(obj);
            canvas?.requestRenderAll?.();
            getCtx().push();
          }
        }),
      ],
    },
    {
      label: "Toggle Mask",
      disabled: !layerObject(active),
      onClick: () => {
        const maskObj = layerObject(active);
        if (maskObj) {
          toggleMask(maskObj);
          canvas?.requestRenderAll?.();
          getCtx().push();
        }
      },
    },
    {
      label: "Create Clipping Mask",
      shortcut: "Alt+Ctrl+G",
      checked: clipActive,
      disabled: !obj || !belowHasLayer,
      onClick: () => createClippingMask(canvas),
    },
    {
      label: "Release Clipping Mask",
      shortcut: "Alt+Ctrl+G",
      disabled: !clipActive,
      onClick: () => releaseClippingMask(canvas),
    },
    { divider: true },
    {
      label: "Group Layers",
      disabled: !active,
      onClick: () => groupLayers(canvas),
    },
    {
      label: "Ungroup Layers",
      shortcut: "Ctrl+Shift+G",
      disabled: groupSelectedCount(canvas) < 1,
      onClick: () => ungroupLayers(canvas),
    },
    { divider: true },
    {
      id: "layer.arrange",
      label: "Arrange",
      children: [
        arrange("Move Up", "Ctrl+]", true, false),
        arrange("Move Down", "Ctrl+[", false, false),
        arrange("Bring to Front", "Shift+Ctrl+]", true, true),
        arrange("Send to Back", "Shift+Ctrl+[", false, true),
      ],
    },
    {
      id: "layer.align",
      label: "Align",
      children: [
        { label: "Top Edges", disabled: selCount < 1, onClick: () => alignObjects(canvas, "top") },
        { label: "Vertical Centers", disabled: selCount < 1, onClick: () => alignObjects(canvas, "vc") },
        { label: "Bottom Edges", disabled: selCount < 1, onClick: () => alignObjects(canvas, "bottom") },
        { label: "Left Edges", disabled: selCount < 1, onClick: () => alignObjects(canvas, "left") },
        { label: "Horizontal Centers", disabled: selCount < 1, onClick: () => alignObjects(canvas, "hc") },
        { label: "Right Edges", disabled: selCount < 1, onClick: () => alignObjects(canvas, "right") },
      ],
    },
    {
      label: "Distribute",
      children: [
        { label: "Horizontal Left Edges", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "hl") },
        { label: "Horizontal Centers", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "hc") },
        { label: "Horizontal Right Edges", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "hr") },
        { label: "Vertical Top Edges", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "vt") },
        { label: "Vertical Centers", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "vc") },
        { label: "Vertical Bottom Edges", disabled: selCount < 3, onClick: () => distributeObjects(canvas, "vb") },
      ],
    },
    { divider: true },
    {
      id: "layer.mergeDown",
      label: "Merge Down",
      shortcut: "Ctrl+E",
      disabled: !obj || !belowHasLayer,
      onClick: () => mergeDown(canvas),
    },
    {
      label: "Merge Visible",
      shortcut: "Shift+Ctrl+E",
      disabled: !canvas,
      onClick: () => mergeVisibleLayers(canvas),
    },
    {
      label: "Flatten Image",
      disabled: !canvas,
      onClick: () => flattenImageLayer(canvas),
    },
    { divider: true },
    {
      label: "Auto-Align Layers…",
      disabled: !canvas,
      onClick: () => void autoAlignLayers(canvas),
    },
    {
      label: "Auto-Blend Layers…",
      disabled: !canvas,
      onClick: () => void autoBlendLayers(canvas),
    },
    { divider: true },
    {
      label: "Link Layers",
      checked: allLinked,
      disabled: selObjIds.length < 2,
      onClick: () => linkLayers(canvas),
    },
    {
      label: "Unlink Layers",
      disabled: !linkedIds.length,
      onClick: () => unlinkLayers(canvas),
    },
    {
      label: "Select Linked Layers",
      disabled: !obj || !linkedIds.includes(objId(obj) ?? ""),
      onClick: () => selectLinkedLayers(canvas),
    },
    {
      label: "Lock Layers",
      disabled: !obj,
      children: [
        { label: "Lock All", disabled: !obj, onClick: () => lockLayers(canvas, "all") },
        { label: "Lock Position", disabled: !obj, onClick: () => lockLayers(canvas, "position") },
        { label: "Lock Transparent Pixels", disabled: !obj, onClick: () => lockLayers(canvas, "transparent") },
        { label: "Lock All Pixels", disabled: !obj, onClick: () => lockLayers(canvas, "allPixels") },
        { divider: true },
        { label: "Unlock All Layers", disabled: !obj, onClick: () => lockLayers(canvas, "none") },
      ],
    },
    { divider: true },
    {
      label: "Show All Layers",
      onClick: () => {
        canvas?.getObjects().forEach((o) => o.set({ visible: true }));
        ls.layers.forEach((l) => {
          if (!l.visible) ls.toggleVisibility(l.id);
        });
        canvas?.requestRenderAll?.();
      },
    },
  ];
}

export default function LayerMenu() {
  return <MenuButton title="Layer" entries={entries()} />;
}