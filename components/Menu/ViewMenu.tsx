"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import { showOptions } from "./OptionDialog";
import { canvasNow } from "@/utils/menuUtils";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFeaturesStore } from "@/store/featuresStore";
import {
  WORKING_SPACES,
  fitInWindow,
  getPxRatio,
  getProofCustom,
  getViewSnapshot,
  printSize,
  resetView,
  setProofCustom,
  setProofMode,
  setPxRatio,
  setScreenMode,
  setZoomPercent,
  subscribeView,
  toggleGamutWarning,
  toggleLockGuides,
  toggleProofColors,
  zoomBy,
} from "@/engine/viewOps";

interface ViewState {
  proofMode: string;
  proofColorsOn: boolean;
  gamutWarning: boolean;
  screenMode: string;
  showExtras: boolean;
  showSelectionEdges: boolean;
  showGrid: boolean;
  showGuides: boolean;
  snapToGuides: boolean;
  showSlices: boolean;
  showRulers: boolean;
  snapOn: boolean;
  snapToGrid: boolean;
  snapToBounds: boolean;
  pxRatio: number;
  lockGuides: boolean;
  showLayerEdges: boolean;
  layerEdgeColor: string;
}

function entries(s: ViewState): MenuEntry[] {
  const snapToAll = () =>
    useSettingsStore
      .getState()
      .set({ snapToGrid: true, snapToGuides: true, snapToBounds: true });
  const snapToNone = () =>
    useSettingsStore
      .getState()
      .set({ snapToGrid: false, snapToGuides: false, snapToBounds: false });

  return [
    {
      label: "Proof Setup",
      children: [
        {
          label: "Working CMYK…",
          checked: s.proofMode === "workingCMYK",
          onClick: () => setProofMode("workingCMYK"),
        },
        {
          label: "Working RGB…",
          checked: s.proofMode === "workingRGB",
          onClick: () => setProofMode("workingRGB"),
        },
        {
          label: "Monitor RGB",
          checked: s.proofMode === "monitorRGB",
          onClick: () => setProofMode("monitorRGB"),
        },
        {
          label: "Custom…",
          onClick: async () => {
            const custom = getProofCustom();
            const res = await showOptions({
              title: "Custom Proof Condition",
              fields: [
                {
                  key: "renderingIntent",
                  label: "Rendering Intent",
                  type: "select",
                  value: custom.renderingIntent,
                  options: [
                    { value: "relative", label: "Relative Colorimetric" },
                    { value: "absolute", label: "Absolute Colorimetric" },
                    { value: "perceptual", label: "Perceptual" },
                    { value: "saturation", label: "Saturation" },
                  ],
                },
                {
                  key: "simulatePaperBlack",
                  label: "Simulate Paper & Black Ink",
                  type: "checkbox",
                  value: custom.simulatePaperBlack,
                },
                {
                  key: "workingSpace",
                  label: "Working RGB",
                  type: "select",
                  value: custom.workingSpace,
                  options: WORKING_SPACES.map((w) => ({
                    value: w.id,
                    label: w.label,
                  })),
                },
              ],
            });
            if (!res) return;
            setProofCustom({
              renderingIntent: res.renderingIntent as any,
              simulatePaperBlack: !!res.simulatePaperBlack,
              workingSpace: res.workingSpace as any,
            });
            setProofMode("custom");
          },
        },
      ],
    },
    {
      label: "Proof Colors",
      shortcut: "Ctrl+Y",
      checked: s.proofColorsOn,
      onClick: () => toggleProofColors(),
    },
    {
      label: "Gamut Warning",
      shortcut: "Shift+Ctrl+Y",
      checked: s.gamutWarning,
      onClick: () => toggleGamutWarning(),
    },
    { divider: true },
    {
      label: "Pixel Aspect Ratio",
      children: [
        {
          label: "Square (1.0)",
          checked: Math.abs(s.pxRatio - 1) < 0.01,
          onClick: () => setPxRatio(1),
        },
        {
          label: "4:3",
          checked: Math.abs(s.pxRatio - 4 / 3) < 0.01,
          onClick: () => setPxRatio(4 / 3),
        },
        {
          label: "3:2",
          checked: Math.abs(s.pxRatio - 3 / 2) < 0.01,
          onClick: () => setPxRatio(3 / 2),
        },
        {
          label: "16:9",
          checked: Math.abs(s.pxRatio - 16 / 9) < 0.01,
          onClick: () => setPxRatio(16 / 9),
        },
        {
          label: "2:1",
          checked: Math.abs(s.pxRatio - 2) < 0.01,
          onClick: () => setPxRatio(2),
        },
        {
          label: "Ratio…",
          onClick: async () => {
            const res = await showOptions({
              title: "Pixel Aspect Ratio",
              fields: [
                {
                  key: "ratio",
                  label: "Ratio",
                  type: "number",
                  min: 0.1,
                  max: 4,
                  step: 0.01,
                  value: Math.round(getPxRatio() * 100) / 100,
                },
              ],
            });
            if (res && Number.isFinite(res.ratio)) {
              setPxRatio(Number(res.ratio));
            }
          },
        },
      ],
    },
    { divider: true },
    {
      id: "view.zoomIn",
      label: "Zoom In",
      shortcut: "Ctrl+Plus",
      onClick: () => zoomBy(1.2),
    },
    {
      id: "view.zoomOut",
      label: "Zoom Out",
      shortcut: "Ctrl+Minus",
      onClick: () => zoomBy(1 / 1.2),
    },
    {
      id: "view.fitOnScreen",
      label: "Fit on Screen",
      shortcut: "Ctrl+0",
      onClick: () => fitInWindow(),
    },
    {
      label: "100%",
      shortcut: "Ctrl+1",
      onClick: () => setZoomPercent(100),
    },
    {
      label: "Zoom",
      children: [
        { label: "Zoom In", shortcut: "Ctrl+Plus", onClick: () => zoomBy(1.2) },
        {
          label: "Zoom Out",
          shortcut: "Ctrl+Minus",
          onClick: () => zoomBy(1 / 1.2),
        },
        {
          label: "Fit on Screen",
          shortcut: "Ctrl+0",
          onClick: () => fitInWindow(),
        },
        {
          id: "view.actualPixels",
          label: "Actual Pixels",
          onClick: () => setZoomPercent(100),
        },
        { label: "Reset View", onClick: () => resetView() },        {
          label: "Zoom…",
          onClick: async () => {
            const c = canvasNow();
            const res = await showOptions({
              title: "Zoom",
              fields: [
                {
                  key: "zoom",
                  label: "Zoom (%)",
                  type: "number",
                  min: 10,
                  max: 1600,
                  step: 5,
                  value: c ? Math.round(c.getZoom() * 100) : 100,
                  suffix: "%",
                },
              ],
            });
            if (res && Number.isFinite(res.zoom)) {
              setZoomPercent(Number(res.zoom));
            }
          },
        },
      ],
    },
    { id: "view.printSize", label: "Print Size", onClick: () => printSize() },
    { divider: true },
    {
      label: "Screen Mode",
      children: [
        {
          label: "Standard Screen Mode",
          checked: s.screenMode === "standard",
          onClick: () => setScreenMode("standard"),
        },
        {
          label: "Full Screen Mode with Menu Bar",
          checked: s.screenMode === "menufull",
          onClick: () => setScreenMode("menufull"),
        },
        {
          label: "Full Screen Mode",
          checked: s.screenMode === "full",
          onClick: () => setScreenMode("full"),
        },
      ],
    },
    { divider: true },
    {
      label: "Extras",
      shortcut: "Ctrl+H",
      checked: s.showExtras,
      onClick: () => useSettingsStore.getState().toggle("showExtras"),
    },
    {
      label: "Show",
      children: [
        {
          label: "Layer Edges",
          checked: s.showSelectionEdges,
          onClick: () =>
            useSettingsStore.getState().toggle("showSelectionEdges"),
        },
        {
          id: "view.grid",
          label: "Grid",
          checked: s.showGrid,
          onClick: () => useSettingsStore.getState().toggle("showGrid"),
        },
        {
          id: "view.guides",
          label: "Guides",
          checked: s.showGuides,
          onClick: () => useEditorStore.getState().toggleGuides(),
        },
        {
          label: "Smart Guides",
          checked: s.snapToGuides,
          onClick: () => useSettingsStore.getState().toggle("snapToGuides"),
        },
        {
          label: "Slices",
          checked: s.showSlices,
          onClick: () => useSettingsStore.getState().toggle("showSlices"),
        },
      ],
    },
    {
      id: "view.layerEdges",
      label: "Show Layer Edges",
      checked: s.showLayerEdges,
      onClick: () => useFeaturesStore.getState().setShowLayerEdges(!s.showLayerEdges),
    },
    {
      label: "Layer Edges Color",
      children: [
        {
          id: "view.layerEdgeColor.red",
          label: "Red",
          checked: s.layerEdgeColor === "#ff0000",
          onClick: () => useFeaturesStore.getState().setLayerEdgeColor("#ff0000"),
        },
        {
          id: "view.layerEdgeColor.green",
          label: "Green",
          checked: s.layerEdgeColor === "#00ff00",
          onClick: () => useFeaturesStore.getState().setLayerEdgeColor("#00ff00"),
        },
        {
          id: "view.layerEdgeColor.blue",
          label: "Blue",
          checked: s.layerEdgeColor === "#0000ff",
          onClick: () => useFeaturesStore.getState().setLayerEdgeColor("#0000ff"),
        },
        {
          id: "view.layerEdgeColor.yellow",
          label: "Yellow",
          checked: s.layerEdgeColor === "#ffff00",
          onClick: () => useFeaturesStore.getState().setLayerEdgeColor("#ffff00"),
        },
        {
          id: "view.layerEdgeColor.magenta",
          label: "Magenta",
          checked: s.layerEdgeColor === "#ff00ff",
          onClick: () => useFeaturesStore.getState().setLayerEdgeColor("#ff00ff"),
        },
      ],
    },
    {
      id: "view.rulers",
      label: "Rulers",
      shortcut: "Ctrl+R",
      checked: s.showRulers,
      onClick: () => useSettingsStore.getState().toggle("showRulers"),
    },
    { divider: true },
    {
      label: "Snap",
      shortcut: "Shift+Ctrl+;",
      checked: s.snapOn,
      onClick: () => useSettingsStore.getState().toggle("snapOn"),
    },
    {
      label: "Snap To",
      children: [
        {
          label: "Grid",
          checked: s.snapToGrid,
          onClick: () => useSettingsStore.getState().toggle("snapToGrid"),
        },
        {
          label: "Guides",
          checked: s.snapToGuides,
          onClick: () => useSettingsStore.getState().toggle("snapToGuides"),
        },
        {
          label: "Document Bounds",
          checked: s.snapToBounds,
          onClick: () => useSettingsStore.getState().toggle("snapToBounds"),
        },
        { divider: true },
        { label: "All", onClick: snapToAll },
        { label: "None", onClick: snapToNone },
      ],
    },
    { divider: true },
    {
      label: "New Guide…",
      onClick: async () => {
        const res = await showOptions({
          title: "New Guide",
          fields: [
            {
              key: "orientation",
              label: "Orientation",
              type: "select",
              value: "h",
              options: [
                { value: "h", label: "Horizontal" },
                { value: "v", label: "Vertical" },
              ],
            },
            {
              key: "position",
              label: "Position (px)",
              type: "number",
              value: 0,
              min: 0,
              max: 100000,
              step: 1,
            },
          ],
        });
        if (!res) return;
        const canvas = canvasNow();
        const max =
          res.orientation === "h"
            ? (canvas?.height ?? 1080)
            : (canvas?.width ?? 1920);
        const pos = Math.max(0, Math.min(max, Number(res.position) || 0));
        useEditorStore.getState().addGuide(res.orientation, pos);
      },
    },
    {
      label: "Lock Guides",
      shortcut: "Alt+Ctrl+;",
      checked: s.lockGuides,
      onClick: () => toggleLockGuides(),
    },
    {
      label: "Show / Hide Guides",
      shortcut: "Ctrl+;",
      onClick: () => useEditorStore.getState().toggleGuides(),
    },
    {
      label: "Clear All Guides",
      onClick: () => useEditorStore.getState().clearGuides(),
    },
    { divider: true },
    {
      label: "Reset Zoom",
      onClick: () => resetView(),
    },
  ];
}

export default function ViewMenu() {
  const [viewSnap, setViewSnap] = useState({ pxRatio: getViewSnapshot().pxRatio, lockGuides: getViewSnapshot().lockGuides });
  useEffect(() => {
    return subscribeView(() => {
      const snap = getViewSnapshot();
      setViewSnap({ pxRatio: snap.pxRatio, lockGuides: snap.lockGuides });
    });
  }, []);
  const s: ViewState = {
    proofMode: useSettingsStore((x) => x.proofMode),
    proofColorsOn: useSettingsStore((x) => x.proofColorsOn),
    gamutWarning: useEditorStore((x) => x.gamutWarning),
    screenMode: useSettingsStore((x) => x.screenMode),
    showExtras: useSettingsStore((x) => x.showExtras),
    showSelectionEdges: useSettingsStore((x) => x.showSelectionEdges),
    showGrid: useSettingsStore((x) => x.showGrid),
    showGuides: useEditorStore((x) => x.showGuides),
    snapToGuides: useSettingsStore((x) => x.snapToGuides),
    showSlices: useSettingsStore((x) => x.showSlices),
    showRulers: useSettingsStore((x) => x.showRulers),
    snapOn: useSettingsStore((x) => x.snapOn),
    snapToGrid: useSettingsStore((x) => x.snapToGrid),
    snapToBounds: useSettingsStore((x) => x.snapToBounds),
    pxRatio: viewSnap.pxRatio,
    lockGuides: viewSnap.lockGuides,
    showLayerEdges: useFeaturesStore((x) => x.showLayerEdges),
    layerEdgeColor: useFeaturesStore((x) => x.layerEdgeColor),
  };

  return <MenuButton title="View" entries={entries(s)} />;
}