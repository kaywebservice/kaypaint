"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { canvasNow, getCtx } from "@/utils/menuUtils";
import { showOptions } from "./OptionDialog";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import {
  colorRange,
  deselectLayers,
  ensureSelectionTracking,
  findLayers,
  grow,
  isIsolated,
  lastFuzziness,
  loadSelection,
  modifyMask,
  reselect,
  saveSelection,
  selectAllLayers,
  selectionNames,
  similar,
  subscribe,
  toggleIsolate,
  toggleQuickMask,
  transformSelection,
} from "@/engine/selectOps";
import { refineEdges } from "@/engine/refineEdge";
import { selectSubject } from "@/engine/selectSubject";
import { focusArea } from "@/engine/textTypeOps";
import { applyPathfinder } from "@/engine/pathfinder";

function activeObjectLabel(canvas: any): string {
  const obj = canvas?.getActiveObject?.();
  if (!obj) return "";
  const id = obj.kaypaintId ?? obj.id;
  const layerName = useLayerStore
    .getState()
    .layers.find((l) => l.objectId === id)?.name;
  return layerName || obj.name || obj.type || "";
}

function entries(isolated: boolean, quickMaskOn: boolean): MenuEntry[] {
  const canvas = canvasNow();
  ensureSelectionTracking();

  const modifyEntries: MenuEntry[] = [
    {
      label: "Border…",
      onClick: async () => {
        const res = await showOptions({
          title: "Border Selection",
          fields: [
            { key: "width", label: "Width", type: "slider", min: 1, max: 200, value: 8, suffix: "px" },
          ],
        });
        if (res) void modifyMask("border", Number(res.width));
      },
    },
    {
      label: "Smooth…",
      onClick: async () => {
        const res = await showOptions({
          title: "Smooth Selection",
          fields: [
            { key: "radius", label: "Sample Radius", type: "slider", min: 1, max: 100, value: 4, suffix: "px" },
          ],
        });
        if (res) void modifyMask("smooth", Number(res.radius));
      },
    },
    {
      label: "Expand…",
      onClick: async () => {
        const res = await showOptions({
          title: "Expand Selection",
          fields: [
            { key: "amount", label: "Expand By", type: "slider", min: 1, max: 100, value: 8, suffix: "px" },
          ],
        });
        if (res) void modifyMask("expand", Number(res.amount));
      },
    },
    {
      label: "Contract…",
      onClick: async () => {
        const res = await showOptions({
          title: "Contract Selection",
          fields: [
            { key: "amount", label: "Contract By", type: "slider", min: 1, max: 100, value: 8, suffix: "px" },
          ],
        });
        if (res) void modifyMask("contract", Number(res.amount));
      },
    },
    {
      label: "Feather…",
      onClick: async () => {
        const res = await showOptions({
          title: "Feather Selection",
          fields: [
            { key: "radius", label: "Feather Radius", type: "slider", min: 1, max: 250, value: 8, suffix: "px" },
          ],
        });
        if (res) void modifyMask("feather", Number(res.radius));
      },
    },
  ];

  return [
    {
      id: "select.all",
      label: "Select All",
      shortcut: "Ctrl+A",
      onClick: () => {
        const objects = canvas?.getObjects?.() ?? [];
        if (objects.length) {
          canvas.setActiveObject(objects);
        }
      },
    },
    {
      id: "select.deselect",
      label: "Deselect",
      shortcut: "Ctrl+D",
      onClick: () => canvas?.discardActiveObject?.(),
    },
    {
      label: "Reselect",
      shortcut: "Shift+Ctrl+D",
      onClick: () => {
        if (!reselect()) {
          window.alert("No previous selection saved.");
        }
      },
    },
    {
      id: "select.inverse",
      label: "Invert Selection",
      onClick: () => {
        if (!canvas) return;
        const all: any[] = canvas.getObjects();
        const selected = canvas.getActiveObjects?.() ?? [];
        const inverted = all.filter((o) => !selected.includes(o));
        canvas.discardActiveObject();
        if (inverted.length) {
          canvas.setActiveObject(inverted);
        }
      },
    },
    { divider: true },
    {
      label: "All Layers",
      shortcut: "Alt+Ctrl+A",
      onClick: () => selectAllLayers(),
    },
    {
      label: "Deselect Layers",
      onClick: () => deselectLayers(),
    },
    {
      label: "Find Layers…",
      onClick: async () => {
        const res = await showOptions({
          title: "Find Layers",
          fields: [
            {
              key: "query",
              label: "Layer Name or Number",
              type: "text",
              value: activeObjectLabel(canvas),
            },
          ],
        });
        if (!res) return;
        if (!findLayers(String(res.query))) {
          window.alert("No layers matched.");
        }
      },
    },
    {
      label: "Isolate Layers",
      shortcut: "Alt+Ctrl+I",
      checked: isolated,
      onClick: () => toggleIsolate(),
    },
    { divider: true },
    {
      id: "select.subject",
      label: "Subject",
      onClick: () => void selectSubject(canvas),
    },
    {
      id: "select.focusArea",
      label: "Focus Area…",
      onClick: async () => {
        const res = await showOptions({
          title: "Focus Area",
          text: "Detects the central high-contrast (Sobel edge) region of the document and builds a marching-ants selection rectangle around it. Lower sensitivity = a larger selection.",
          fields: [
            {
              key: "threshold",
              label: "Edge Sensitivity",
              type: "slider",
              min: 1,
              max: 512,
              step: 1,
              value: 48,
              suffix: " px",
            },
          ],
          okLabel: "Select",
        });
        if (!res) return;
        void focusArea(Number(res.threshold));
      },
    },
    {
      label: "Refine Edge…",
      onClick: () => void refineEdges(canvas),
    },
    {
      id: "select.colorRange",
      label: "Color Range…",
      onClick: async () => {
        const res = await showOptions({
          title: "Color Range",
          fields: [
            {
              key: "color",
              label: "Sampled Color",
              type: "color",
              value: useEditorStore.getState().color,
            },
            {
              key: "fuzziness",
              label: "Fuzziness",
              type: "slider",
              min: 0,
              max: 200,
              value: lastFuzziness(),
            },
            { key: "invert", label: "Invert", type: "checkbox", value: false },
          ],
        });
        if (!res) return;
        void colorRange(
          String(res.color),
          Number(res.fuzziness),
          !!res.invert
        );
      },
    },
    { divider: true },
    {
      id: "select.modify",
      label: "Modify",
      children: modifyEntries,
    },
    {
      label: "Grow",
      onClick: () => void grow(),
    },
    {
      label: "Similar",
      onClick: () => void similar(),
    },
    { divider: true },
    {
      label: "Transform Selection…",
      onClick: async () => {
        const res = await showOptions({
          title: "Transform Selection",
          fields: [
            { key: "scale", label: "Scale", type: "number", min: 1, max: 1000, value: 100, suffix: "%" },
            { key: "rotate", label: "Rotate", type: "number", min: -360, max: 360, value: 0, suffix: "°" },
          ],
        });
        if (!res) return;
        void transformSelection(Number(res.scale), Number(res.rotate));
      },
    },
    {
      label: "Pathfinder",
      children: [
        {
          id: "pathfinder.unite",
          label: "Unite",
          onClick: () => void applyPathfinder(canvas, "union"),
        },
        {
          id: "pathfinder.intersect",
          label: "Intersect",
          onClick: () => void applyPathfinder(canvas, "intersect"),
        },
        {
          id: "pathfinder.subtract",
          label: "Subtract Front",
          onClick: () => void applyPathfinder(canvas, "subtract"),
        },
      ],
    },
    { divider: true },
    {
      label: "Save Selection…",
      onClick: async () => {
        const res = await showOptions({
          title: "Save Selection",
          fields: [
            {
              key: "name",
              label: "Selection Name",
              type: "text",
              value: "Selection 1",
            },
          ],
        });
        if (!res || !String(res.name).trim()) return;
        void saveSelection(String(res.name).trim());
      },
    },
    {
      label: "Load Selection…",
      onClick: async () => {
        const names = selectionNames();
        if (!names.length) {
          window.alert("No saved selections found.");
          return;
        }
        const res = await showOptions({
          title: "Load Selection",
          fields: [
            {
              key: "name",
              label: "Selection",
              type: "select",
              value: names[0],
              options: names.map((n) => ({ value: n, label: n })),
            },
            {
              key: "applyToAlpha",
              label: "Load as Layer Alpha",
              type: "checkbox",
              value: true,
            },
          ],
        });
        if (!res) return;
        void loadSelection(String(res.name), !!res.applyToAlpha);
      },
    },
    { divider: true },
    {
      label: "Delete Selection",
      danger: true,
      onClick: () => {
        const objs = canvas?.getActiveObjects?.() ?? [];
        if (!objs.length) return;
        objs.forEach((obj: any) => canvas.remove(obj));
        canvas?.discardActiveObject?.();
        getCtx().push();
      },
    },
    {
      label: "Edit in Quick Mask Mode",
      checked: quickMaskOn,
      onClick: () => toggleQuickMask(),
    },
  ];
}

export default function SelectMenu() {
  const [isolated, setIsolated] = useState(false);
  useEffect(() => {
    return subscribe(() => setIsolated(isIsolated()));
  }, []);
  const quickMaskOn = useEditorStore((s) => s.activeTool === "quickMask");
  return <MenuButton title="Select" entries={entries(isolated, quickMaskOn)} />;
}