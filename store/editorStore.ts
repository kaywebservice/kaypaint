import { create } from "zustand";
import type { ShapeKind, ToolId } from "@/types/editor";

export interface GuideLine {
  axis: "h" | "v";
  pos: number;
}

interface EditorState {
  activeTool: ToolId;
  color: string;
  size: number;
  shape: ShapeKind;
  fontSize: number;
  filterAmount: number;
  gradientType: "linear" | "radial";
  canvas: any | null;
  history: any | null;
  gridEnabled: boolean;
  canvasW: number;
  canvasH: number;

  guides: GuideLine[];
  showGuides: boolean;
  snapGuides: { h: number[]; v: number[] };
  transformObjectId: string | null;
  liquifyStrength: number;
  tolerance: number;
  feather: number;
  paletteOpen: boolean;
  soIsolation: { groupId: string } | null;
  gamutWarning: boolean;
  gamutOverlayURL: string | null;

  setTool: (tool: ToolId) => void;
  setCanvas: (canvas: any) => void;
  setCanvasSize: (w: number, h: number) => void;
  setHistory: (history: any) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setShape: (shape: ShapeKind) => void;
  setFontSize: (fontSize: number) => void;
  setFilterAmount: (amount: number) => void;
  setGradientType: (type: "linear" | "radial") => void;
  setLiquifyStrength: (strength: number) => void;
  setTolerance: (tolerance: number) => void;
  setFeather: (feather: number) => void;
  setPaletteOpen: (open: boolean) => void;
  setSoIsolation: (soIsolation: { groupId: string } | null) => void;
  setGamutWarning: (on: boolean) => void;
  setGamutOverlay: (url: string | null) => void;
  toggleGrid: () => void;

  addGuide: (axis: "h" | "v", pos: number) => void;
  updateGuide: (axis: "h" | "v", oldPos: number, newPos: number) => void;
  removeGuide: (axis: "h" | "v", pos: number) => void;
  clearGuides: () => void;
  toggleGuides: () => void;
  setSnapGuides: (h: number[], v: number[]) => void;
  setTransformObject: (objectId: string | null) => void;
}

export const useEditorStore = create<EditorState>(
  (set) => ({
    activeTool: "brush",
    color: "#000000",
    size: 12,
    shape: "rect",
    fontSize: 28,
    filterAmount: 50,
    gradientType: "linear",
    canvas: null,
    history: null,
    gridEnabled: false,
    canvasW: 1920,
    canvasH: 1080,

    guides: [],
    showGuides: true,
    snapGuides: { h: [], v: [] },
    transformObjectId: null,
    liquifyStrength: 60,
    tolerance: 30,
    feather: 0,
     paletteOpen: false,
     soIsolation: null,
     gamutWarning: false,
     gamutOverlayURL: null,

     setTool: (tool) => set({ activeTool: tool }),

     setCanvas: (canvas) => set({ canvas }),

     setCanvasSize: (canvasW, canvasH) => set({ canvasW, canvasH }),

     setHistory: (history) => set({ history }),

     setColor: (color) => set({ color }),

     setSize: (size) => set({ size }),

     setShape: (shape) => set({ shape }),

     setFontSize: (fontSize) => set({ fontSize }),

     setFilterAmount: (filterAmount) =>
       set({ filterAmount }),

     setGradientType: (gradientType) =>
       set({ gradientType }),

     setLiquifyStrength: (liquifyStrength) =>
       set({ liquifyStrength }),

     setTolerance: (tolerance) =>
       set({ tolerance }),

     setFeather: (feather) =>
       set({ feather }),

     setPaletteOpen: (paletteOpen) =>
       set({ paletteOpen }),

     setSoIsolation: (soIsolation) =>
       set({ soIsolation }),

     toggleGrid: () =>
       set((state) => ({
         gridEnabled: !state.gridEnabled,
       })),

     addGuide: (axis, pos) =>
       set((state) => ({
         guides: [...state.guides, { axis, pos }],
       })),

     updateGuide: (axis, oldPos, newPos) =>
       set((state) => ({
         guides: state.guides.map((g) =>
           g.axis === axis && Math.abs(g.pos - oldPos) < 1
             ? { ...g, pos: newPos }
             : g
         ),
       })),

     removeGuide: (axis, pos) =>
       set((state) => ({
         guides: state.guides.filter(
           (g) => !(g.axis === axis && Math.abs(g.pos - pos) < 1)
         ),
       })),

     clearGuides: () => set({ guides: [] }),

     toggleGuides: () =>
       set((state) => ({ showGuides: !state.showGuides })),

     setSnapGuides: (h, v) => set({ snapGuides: { h, v } }),

     setTransformObject: (transformObjectId) =>
       set({ transformObjectId }),

     setGamutWarning: (gamutWarning) =>
       set({ gamutWarning }),
     setGamutOverlay: (gamutOverlayURL) =>
       set({ gamutOverlayURL }),
   })
);