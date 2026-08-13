import { create } from "zustand";

const LS_KEY = "kaypaint-settings-v1";

export interface RecentFile {
  name: string;
  savedAt: number;
}

export interface BrushPreset {
  name: string;
  color: string;
  size: number;
}

export interface LastFilter {
  name: string;
  label: string;
  params: Record<string, unknown>;
}

export interface PatternPreset {
  name: string;
  dataUrl: string;
}

export interface CustomShapePreset {
  name: string;
  path: unknown[];
}

export type ScreenMode = "standard" | "menufull" | "full";

interface SettingsState {
  // View
  showRulers: boolean;
  showGrid: boolean;
  showExtras: boolean;
  showSelectionEdges: boolean;
  showSlices: boolean;
  snapOn: boolean;
  snapToGrid: boolean;
  snapToGuides: boolean;
  snapToBounds: boolean;
  screenMode: ScreenMode;
  gridSize: number;
  gridColor: string;
  guideColor: string;
  rulerUnit: string;
  dpi: number;

  // Proof
  proofColorsOn: boolean;
  proofMode: string;

  // Select memory
  reselectIds: string[];

  // Filter memory
  lastFilter: LastFilter | null;

  // Workspace / panels
  panelVisible: Record<string, boolean>;
  workspaces: Record<string, Record<string, boolean>>;

  // Layers
  linkedIds: string[];

  // Brush presets
  brushPresets: BrushPreset[];

  // Patterns & shapes
  patternPresets: PatternPreset[];
  customShapes: CustomShapePreset[];

  // Toolbar
  hiddenTools: string[];

  // File
  recentFiles: RecentFile[];

  // actions
  set: (patch: Partial<SettingsState>) => void;
  toggle: (key: keyof SettingsState) => void;
  addRecent: (name: string) => void;
  setLastFilter: (lf: LastFilter | null) => void;
  setReselect: (ids: string[]) => void;
  setPanelVisible: (id: string, visible: boolean) => void;
  saveWorkspace: (name: string) => void;
  deleteWorkspace: (name: string) => void;
  resetWorkspace: () => void;
  setLinked: (ids: string[]) => void;
  addBrushPreset: (p: BrushPreset) => void;
  removeBrushPreset: (name: string) => void;
  addPatternPreset: (p: PatternPreset) => void;
  removePatternPreset: (name: string) => void;
  addCustomShape: (s: CustomShapePreset) => void;
  setHiddenTools: (tools: string[]) => void;
}

const DEFAULT_PANELS: Record<string, boolean> = {
  layers: true,
  properties: true,
  adjustments: true,
  channels: true,
  paths: true,
  swatches: true,
  patterns: true,
  gradients: true,
  libraries: true,
  color: true,
  history: true,
  timeline: true,
  character: true,
  paragraph: true,
  navigator: true,
};

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

const persisted = load();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showRulers: false,
  showGrid: false,
  showExtras: true,
  showSelectionEdges: true,
  showSlices: false,
  snapOn: true,
  snapToGrid: false,
  snapToGuides: true,
  snapToBounds: true,
  screenMode: "standard",
  gridSize: 64,
  gridColor: "#4b5563",
  guideColor: "#38bdf8",
  rulerUnit: "px",
  dpi: 96,

  proofColorsOn: false,
  proofMode: "workingCMYK",

  reselectIds: [],

  lastFilter: null,

  panelVisible: { ...DEFAULT_PANELS, ...(persisted.panelVisible ?? {}) },
  workspaces: persisted.workspaces ?? {},

  linkedIds: persisted.linkedIds ?? [],

  brushPresets: persisted.brushPresets ?? [],

  patternPresets: persisted.patternPresets ?? [],
  customShapes: persisted.customShapes ?? [],
  hiddenTools: persisted.hiddenTools ?? [],

  recentFiles: persisted.recentFiles ?? [],

  ...persisted,

  set: (patch) => {
    set(patch);
    persist(get());
  },

  toggle: (key) => {
    set({ [key]: !get()[key] } as Partial<SettingsState>);
    persist(get());
  },

  addRecent: (name) => {
    const others = get().recentFiles.filter((r) => r.name !== name);
    const next = [{ name, savedAt: Date.now() }, ...others].slice(0, 12);
    set({ recentFiles: next });
    persist(get());
  },

  setLastFilter: (lf) => {
    set({ lastFilter: lf });
    persist(get());
  },

  setReselect: (ids) => {
    set({ reselectIds: ids });
    persist(get());
  },

  setPanelVisible: (id, visible) => {
    const panelVisible = { ...get().panelVisible, [id]: visible };
    set({ panelVisible });
    persist(get());
  },

  saveWorkspace: (name) => {
    const workspaces = { ...get().workspaces, [name]: { ...get().panelVisible } };
    set({ workspaces });
    persist(get());
  },

  deleteWorkspace: (name) => {
    const workspaces = { ...get().workspaces };
    delete workspaces[name];
    set({ workspaces });
    persist(get());
  },

  resetWorkspace: () => {
    set({ panelVisible: { ...DEFAULT_PANELS } });
    persist(get());
  },

  setLinked: (ids) => {
    set({ linkedIds: ids });
    persist(get());
  },

  addBrushPreset: (p) => {
    const brushPresets = [...get().brushPresets.filter((b) => b.name !== p.name), p];
    set({ brushPresets });
    persist(get());
  },

  removeBrushPreset: (name) => {
    const brushPresets = get().brushPresets.filter((b) => b.name !== name);
    set({ brushPresets });
    persist(get());
  },

  addPatternPreset: (p) => {
    const patternPresets = [...get().patternPresets.filter((b) => b.name !== p.name), p];
    set({ patternPresets });
    persist(get());
  },

  removePatternPreset: (name) => {
    const patternPresets = get().patternPresets.filter((b) => b.name !== name);
    set({ patternPresets });
    persist(get());
  },

  addCustomShape: (s) => {
    const customShapes = [...get().customShapes.filter((b) => b.name !== s.name), s];
    set({ customShapes });
    persist(get());
  },

  setHiddenTools: (tools) => {
    set({ hiddenTools: tools });
    persist(get());
  },
}));

function persist(state: SettingsState) {
  const { set, toggle, addRecent, setLastFilter, setReselect, setPanelVisible, saveWorkspace, deleteWorkspace, resetWorkspace, setLinked, addBrushPreset, removeBrushPreset, addPatternPreset, removePatternPreset, addCustomShape, setHiddenTools, ...rest } =
    state;
  void set;
  void toggle;
  void addRecent;
  void setLastFilter;
  void setReselect;
  void setPanelVisible;
  void saveWorkspace;
  void deleteWorkspace;
  void resetWorkspace;
  void setLinked;
  void addBrushPreset;
  void removeBrushPreset;
  void addPatternPreset;
  void removePatternPreset;
  void addCustomShape;
  void setHiddenTools;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
  } catch {
    /* storage full */
  }
}