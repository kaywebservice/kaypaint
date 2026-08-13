import { create } from "zustand";

/**
 * Shared client-side state for the Photoshop-parity feature set
 * (notes, counts, layer comps, smart objects, smart filters, blend-if,
 * knockout, global light, bit depth, profiles, key remaps, menu
 * customization, recorded actions, spellcheck, pattern-stamp source...).
 *
 * This store is intentionally session-only (no persistence) except where
 * explicitly noted; persistent prefs live in settingsStore instead.
 */

export interface NoteDef {
  id: string;
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

export interface CountDef {
  id: string;
  x: number;
  y: number;
  n: number;
}

export interface LayerComp {
  id: string;
  name: string;
  canvasJson: unknown;
  layerJson: unknown;
  thumb: string;
  createdAt: number;
}

export interface SmartObjectDef {
  layerId: string;
  name: string;
  json: unknown;
  linkedFile: string | null;
  linkedDataUrl: string | null;
  editing: boolean;
}

export interface SmartFilterStep {
  id: string;
  filterId: string;
  label: string;
  params: Record<string, unknown>;
}

export interface BlendIfParams {
  channel: "gray" | "r" | "g" | "b";
  thisLo: number;
  thisHi: number;
  underLo: number;
  underHi: number;
}

export type KnockoutMode = "none" | "shallow" | "deep";

export interface PSOActionStep {
  cmd: string;
  label: string;
  params: Record<string, unknown>;
}

export interface PSOAction {
  id: string;
  name: string;
  steps: PSOActionStep[];
  createdAt: number;
}

export interface MenuCustomEntry {
  hidden: boolean;
  color: string | null;
}

interface FeaturesState {
  notes: NoteDef[];
  addNote: (x: number, y: number, text: string) => void;
  updateNoteText: (id: string, text: string) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;

  counts: CountDef[];
  addCount: (x: number, y: number) => void;
  removeCount: (id: string) => void;
  clearCounts: () => void;

  infoOpen: boolean;
  setInfoOpen: (open: boolean) => void;

  viewRotate: number;
  setViewRotate: (deg: number) => void;

  layerComps: LayerComp[];
  addComp: (name: string, canvasJson: unknown, layerJson: unknown, thumb: string) => void;
  removeComp: (id: string) => void;
  clearComps: () => void;

  smartObjects: Record<string, SmartObjectDef>;
  registerSO: (layerId: string, def: SmartObjectDef) => void;
  updateSO: (layerId: string, patch: Partial<SmartObjectDef>) => void;
  removeSO: (layerId: string) => void;
  clearSO: () => void;

  smartFilters: Record<string, SmartFilterStep[]>;
  setSmartFilters: (layerId: string, steps: SmartFilterStep[]) => void;
  clearSmartFilters: (layerId: string) => void;

  blendIf: Record<string, BlendIfParams[]>;
  setBlendIf: (layerId: string, params: BlendIfParams[]) => void;
  clearBlendIf: (layerId: string) => void;

  knockout: Record<string, KnockoutMode>;
  setKnockout: (layerId: string, mode: KnockoutMode) => void;

  globalLight: number;
  setGlobalLight: (angle: number) => void;

  bitDepth: 8 | 16 | 32;
  setBitDepth: (depth: 8 | 16 | 32) => void;

  assignedProfile: string | null;
  setAssignedProfile: (profile: string | null) => void;

  keyBindings: Record<string, string>;
  setKeyBinding: (toolId: string, key: string) => void;
  resetBindings: () => void;
  shortcutEditorOpen: boolean;
  setShortcutEditorOpen: (open: boolean) => void;

  menuCustom: Record<string, MenuCustomEntry>;
  setMenuCustom: (id: string, entry: MenuCustomEntry) => void;
  resetMenus: () => void;

  actions: Record<string, PSOAction>;
  saveAction: (action: PSOAction) => void;
  deleteAction: (id: string) => void;

  spellcheckOn: boolean;
  setSpellcheck: (on: boolean) => void;

  patternSource: string | null;
  setPatternSource: (dataUrl: string | null) => void;

  aiAssistantOpen: boolean;
  setAiAssistantOpen: (open: boolean) => void;

  panelVisibility: Record<string, boolean>;
  setPanelVisibility: (name: string, visible: boolean) => void;

  showLayerEdges: boolean;
  setShowLayerEdges: (on: boolean) => void;

  layerEdgeColor: string;
  setLayerEdgeColor: (color: string) => void;
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  notes: [],
  addNote: (x, y, text) =>
    set({ notes: [...get().notes, { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x, y, text, createdAt: Date.now() }] }),
  updateNoteText: (id, text) =>
    set({ notes: get().notes.map((n) => (n.id === id ? { ...n, text } : n)) }),
  removeNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
  clearNotes: () => set({ notes: [] }),

  counts: [],
  addCount: (x, y) =>
    set({ counts: [...get().counts, { id: `count-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x, y, n: get().counts.length + 1 }] }),
  removeCount: (id) => set({ counts: get().counts.filter((c) => c.id !== id) }),
  clearCounts: () => set({ counts: [] }),

  infoOpen: false,
  setInfoOpen: (infoOpen) => set({ infoOpen }),

  viewRotate: 0,
  setViewRotate: (viewRotate) => set({ viewRotate }),

  layerComps: [],
  addComp: (name, canvasJson, layerJson, thumb) =>
    set({ layerComps: [...get().layerComps, { id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, canvasJson, layerJson, thumb, createdAt: Date.now() }] }),
  removeComp: (id) => set({ layerComps: get().layerComps.filter((c) => c.id !== id) }),
  clearComps: () => set({ layerComps: [] }),

  smartObjects: {},
  registerSO: (layerId, def) => set({ smartObjects: { ...get().smartObjects, [layerId]: def } }),
  updateSO: (layerId, patch) =>
    set({
      smartObjects: {
        ...get().smartObjects,
        [layerId]: { ...(get().smartObjects[layerId] ?? ({ layerId, name: "Smart Object", json: null, linkedFile: null, linkedDataUrl: null, editing: false } as SmartObjectDef)), ...patch },
      },
    }),
  removeSO: (layerId) => {
    const smartObjects = { ...get().smartObjects };
    delete smartObjects[layerId];
    set({ smartObjects });
  },
  clearSO: () => set({ smartObjects: {} }),

  smartFilters: {},
  setSmartFilters: (layerId, steps) => set({ smartFilters: { ...get().smartFilters, [layerId]: steps } }),
  clearSmartFilters: (layerId) => {
    const smartFilters = { ...get().smartFilters };
    delete smartFilters[layerId];
    set({ smartFilters });
  },

  blendIf: {},
  setBlendIf: (layerId, params) => set({ blendIf: { ...get().blendIf, [layerId]: params } }),
  clearBlendIf: (layerId) => {
    const blendIf = { ...get().blendIf };
    delete blendIf[layerId];
    set({ blendIf });
  },

  knockout: {},
  setKnockout: (layerId, mode) => set({ knockout: { ...get().knockout, [layerId]: mode } }),

  globalLight: 120,
  setGlobalLight: (globalLight) => set({ globalLight }),

  bitDepth: 8,
  setBitDepth: (bitDepth) => set({ bitDepth }),

  assignedProfile: null,
  setAssignedProfile: (assignedProfile) => set({ assignedProfile }),

  keyBindings: {},
  setKeyBinding: (toolId, key) => set({ keyBindings: { ...get().keyBindings, [toolId]: key } }),
  resetBindings: () => set({ keyBindings: {} }),
  shortcutEditorOpen: false,
  setShortcutEditorOpen: (shortcutEditorOpen) => set({ shortcutEditorOpen }),

  menuCustom: {},
  setMenuCustom: (id, entry) => set({ menuCustom: { ...get().menuCustom, [id]: entry } }),
  resetMenus: () => set({ menuCustom: {} }),

  actions: {},
  saveAction: (action) => set({ actions: { ...get().actions, [action.id]: action } }),
  deleteAction: (id) => {
    const actions = { ...get().actions };
    delete actions[id];
    set({ actions });
  },

  spellcheckOn: false,
  setSpellcheck: (spellcheckOn) => set({ spellcheckOn }),

  patternSource: null,
  setPatternSource: (patternSource) => set({ patternSource }),

  aiAssistantOpen: false,
  setAiAssistantOpen: (aiAssistantOpen) => set({ aiAssistantOpen }),

  panelVisibility: {},
  setPanelVisibility: (name, visible) =>
    set({ panelVisibility: { ...get().panelVisibility, [name]: visible } }),

  showLayerEdges: false,
  setShowLayerEdges: (showLayerEdges) => set({ showLayerEdges }),

  layerEdgeColor: "#ff0000",
  setLayerEdgeColor: (layerEdgeColor) => set({ layerEdgeColor }),
}));
