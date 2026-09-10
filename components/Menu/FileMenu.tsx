"use client";

import { useState } from "react";
import MenuButton from "./MenuButton";
import type { MenuEntry } from "./MenuButton";
import OptionDialog from "./OptionDialog";
import NewDocumentDialog from "./NewDocumentDialog";
import { exportPNG, exportJPEG, exportJSON, exportSVG, exportPngWithIcc, exportScaled, EXPORT_PRESETS } from "@/engine/exportEngine";
import { showOptions } from "./OptionDialog";
import { exportPSD } from "@/engine/psdEngine";
import { exportTiff16 } from "@/engine/bitDepth";
import { useDocStore } from "@/store/documentStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { RecentFile } from "@/store/settingsStore";
import { canvasNow } from "@/utils/menuUtils";
import {
  clearRecentFiles,
  closeDocument,
  fileInfo,
  openAnyFilePicker,
  openImagePicker,
  openProjectPicker,
  openPsdPicker,
  openRecent,
  printDocument,
  revertDocument,
  saveCopy,
} from "@/engine/fileOps";
import { runBatchDialog } from "@/engine/batchEngine";
import { imageProcessorDialog } from "@/engine/imageProcessor";
import { contactSheetDialog } from "@/engine/contactSheet";
import { pdfPresentationDialog } from "@/engine/pdfPresentation";
import { saveForWebDialog } from "@/engine/saveForWeb";
import { createDropletDialog } from "@/engine/dropletEngine";
import {
  fitImageDialog,
  cropAndStraightenPhotos,
  placeEmbedded,
  exportLayersToFiles,
  quickExportPng,
  quickExportJpeg,
} from "@/engine/fileAutomate";
import { photomergeDialog } from "@/engine/photomerge";
import { hdrMergeDialog } from "@/engine/hdrMerge";
import { placeVideoClipDialog } from "@/engine/movieLayerEngine";

function recentShortcut(savedAt: number) {
  try {
    return new Date(savedAt).toLocaleDateString();
  } catch {
    return "";
  }
}

function recentChildren(recentFiles: RecentFile[]): MenuEntry[] {
  if (!recentFiles.length) {
    return [{ label: "No Recent Files", disabled: true }];
  }
  return [
    ...recentFiles.map((r) => ({
      label: r.name,
      shortcut: recentShortcut(r.savedAt),
      onClick: () => {
        void openRecent(r.name);
      },
    })),
    { divider: true },
    { label: "Clear Recent Files", danger: true, onClick: clearRecentFiles },
  ];
}

export default function FileMenu() {
  const [newOpen, setNewOpen] = useState(false);
  const recentFiles = useSettingsStore((s) => s.recentFiles);

  const entries: MenuEntry[] = [
    {
      id: "file.new",
      label: "New Document…",
      shortcut: "Ctrl+N",
      onClick: () => setNewOpen(true),
    },
    {
      id: "file.open",
      label: "Open…",
      shortcut: "Ctrl+O",
      onClick: openAnyFilePicker,
    },
    {
      label: "Open Image…",
      onClick: openImagePicker,
    },
    { label: "Open PSD…", onClick: openPsdPicker },
    {
      label: "Open Project (JSON)…",
      onClick: () => openProjectPicker(null),
    },
    { id: "file.openRecent", label: "Open Recent", children: recentChildren(recentFiles) },
    { divider: true },
    { id: "file.close", label: "Close", onClick: closeDocument },
    {
      label: "Revert",
      onClick: () => {
        void revertDocument();
      },
    },
    { divider: true },
    {
      id: "file.save",
      label: "Save",
      shortcut: "Ctrl+S",
      onClick: () => useDocStore.getState().saveDoc(),
    },
    {
      id: "file.saveAs",
      label: "Save As…",
      shortcut: "Ctrl+Shift+S",
      onClick: () => {
        const st = useDocStore.getState();
        const current = st.docs.find((d) => d.id === st.activeDocId)?.name;
        const chosen = window.prompt("Save As", current ?? "Untitled-1");
        if (chosen !== null && chosen.trim()) {
          useDocStore.getState().saveDocAs({ name: chosen, download: true });
          useSettingsStore.getState().addRecent(chosen);
        }
      },
    },
    {
      label: "Save a Copy…",
      onClick: () => {
        void saveCopy();
      },
    },
    { divider: true },
    {
      id: "file.export",
      label: "Export",
      children: [
        { label: "Export as PNG", onClick: () => exportPNG(canvasNow()) },
        { label: "Export as JPEG", onClick: () => exportJPEG(canvasNow()) },
        { label: "Export as SVG", onClick: () => exportSVG(canvasNow()) },
        {
          label: "Export Presets",
          children: [
            ...Object.entries(EXPORT_PRESETS).map(([label, p]): MenuEntry => ({
              label,
              onClick: () =>
                void exportScaled(canvasNow(), { width: p.width, height: p.height, format: "png" }),
            })),
            {
              label: "Custom size…",
              onClick: async () => {
                const c = canvasNow();
                if (!c) return;
                const res = await showOptions({
                  title: "Export Preset",
                  fields: [
                    { key: "width", label: "Width", type: "number", min: 16, max: 20000, value: 1080, suffix: " px" },
                    { key: "height", label: "Height", type: "number", min: 16, max: 20000, value: 1080, suffix: " px" },
                    {
                      key: "format",
                      label: "Format",
                      type: "select",
                      value: "png",
                      options: [
                        { value: "png", label: "PNG" },
                        { value: "jpeg", label: "JPEG" },
                      ],
                    },
                  ],
                  okLabel: "Export",
                });
                if (!res) return;
                const w = Number(res.width);
                const h = Number(res.height);
                if (!w || !h || w < 16 || h < 16) return;
                void exportScaled(c, {
                  width: w,
                  height: h,
                  format: res.format === "jpeg" ? "jpeg" : "png",
                });
              },
            },
          ],
        },
        {
          label: "Save for Web…",
          onClick: () => void saveForWebDialog(canvasNow()),
        },
        {
          label: "Save as PSD",
          onClick: () => exportPSD(canvasNow(), "kaypaint.psd"),
        },
        {
          label: "Export as PNG (color managed)",
          onClick: () => void exportPngWithIcc(canvasNow()),
        },
        {
          label: "Export as 16-bit TIFF (color managed)",
          onClick: () => void exportTiff16(canvasNow()),
        },
        { label: "Export Project (JSON)", onClick: () => exportJSON(canvasNow()) },
        { divider: true },
        { label: "Quick Export as PNG", onClick: quickExportPng },
        { label: "Quick Export as JPEG…", onClick: quickExportJpeg },
      ],
    },
    { divider: true },
    {
      id: "file.placeEmbedded",
      label: "Place Embedded…",
      shortcut: "Shift+Ctrl+P",
      onClick: () => void placeEmbedded(),
    },
    {
      label: "Place Video Clip…",
      onClick: () => placeVideoClipDialog(canvasNow()),
    },
    {
      id: "file.automate",
      label: "Automate",
      children: [
        { label: "Batch…", onClick: () => void runBatchDialog(canvasNow()) },
        { label: "Image Processor…", onClick: () => void imageProcessorDialog() },
        { label: "Contact Sheet II…", onClick: () => void contactSheetDialog() },
        { label: "PDF Presentation…", onClick: () => void pdfPresentationDialog() },
        { divider: true },
        { label: "Fit Image…", onClick: () => void fitImageDialog() },
        { label: "Crop and Straighten Photos", onClick: () => void cropAndStraightenPhotos() },
        { label: "Photomerge…", onClick: () => void photomergeDialog() },
        { label: "Merge to HDR Pro…", onClick: () => void hdrMergeDialog() },
        { divider: true },
        {
          label: "Scripts",
          children: [{ label: "Export Layers to Files…", onClick: () => void exportLayersToFiles() }],
        },
        { label: "Create Droplet…", onClick: () => void createDropletDialog() },
      ],
    },
    { divider: true },
    {
      label: "File Info…",
      onClick: () => {
        void fileInfo();
      },
    },
    {
      label: "Print…",
      onClick: () => {
        void printDocument();
      },
    },
  ];

  return (
    <>
      <MenuButton title="File" entries={entries} />
      <OptionDialog />
      {newOpen && <NewDocumentDialog onClose={() => setNewOpen(false)} />}
    </>
  );
}