import { create } from "zustand";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore } from "@/store/layerStore";
import { downloadDataURL } from "@/utils/imageUtils";

export interface Doc {
  id: string;
  name: string;
  data: string | null;
  dirty: boolean;
  groups: string | null;
}

export interface SaveAsOptions {
  name?: string;
  download?: boolean;
}

const KP_SAVEDAT_VERSION = 3;

const newId = () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

let counter = 1;

interface DocState {
  docs: Doc[];
  activeDocId: string;

  createDoc: () => void;
  closeDoc: (id: string) => void;
  setActiveDoc: (id: string) => void;
  renameDoc: (id: string, name: string) => void;
  updateDocData: (id: string, data: string, groups?: string | null) => void;
  saveDoc: () => void;
  saveDocAs: (opts?: SaveAsOptions) => void;
  markDirty: () => void;
  clearDirty: () => void;
}

export const useDocStore = create<DocState>((set, get) => ({
  docs: [
    {
      id: "doc-default",
      name: "Untitled-1",
      data: null,
      dirty: false,
      groups: null,
    },
  ],
  activeDocId: "doc-default",

  createDoc: () =>
    set((state) => {
      counter += 1;
      const doc: Doc = {
        id: newId(),
        name: `Untitled-${counter}`,
        data: null,
        dirty: false,
        groups: null,
      };
      return {
        docs: [...state.docs, doc],
        activeDocId: doc.id,
      };
    }),

  closeDoc: (id) =>
    set((state) => {
      const docs = state.docs.filter((d) => d.id !== id);
      if (docs.length === 0) {
        counter += 1;
        const fresh: Doc = {
          id: newId(),
          name: `Untitled-${counter}`,
          data: null,
          dirty: false,
          groups: null,
        };
        return { docs: [fresh], activeDocId: fresh.id };
      }
      return {
        docs,
        activeDocId:
          state.activeDocId === id ? docs[docs.length - 1].id : state.activeDocId,
      };
    }),

  setActiveDoc: (id) => set({ activeDocId: id }),

  renameDoc: (id, name) =>
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === id ? { ...d, name: name.trim() || d.name } : d
      ),
    })),

  updateDocData: (id, data, groups) =>
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === id ? { ...d, data, groups: groups !== undefined ? groups : d.groups } : d
      ),
    })),

  saveDoc: () => {
    const { activeDocId } = get();
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;

    let data: string | null = null;
    let groups: string | null = null;
    try {
      data = JSON.stringify(canvas.toJSON());
      groups = JSON.stringify(useLayerStore.getState().groups);
    } catch {
      return;
    }

    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === activeDocId ? { ...d, data, groups, dirty: false } : d
      ),
    }));
  },

  saveDocAs: (opts) => {
    const { activeDocId, docs } = get();
    const doc = docs.find((d) => d.id === activeDocId);
    if (!doc) return;
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;

    if (opts?.name && opts.name.trim()) {
      set((state) => ({
        docs: state.docs.map((d) =>
          d.id === activeDocId ? { ...d, name: opts.name!.trim() } : d
        ),
      }));
    }

    let data: string | null = null;
    let groups: string | null = null;
    try {
      data = JSON.stringify(canvas.toJSON());
      groups = JSON.stringify(useLayerStore.getState().groups);
    } catch {
      return;
    }

    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === activeDocId ? { ...d, data, groups, dirty: false } : d
      ),
    }));

    if (opts?.download !== false) {
      try {
        const payload = {
          version: KP_SAVEDAT_VERSION,
          canvas: JSON.parse(data),
          layers: useLayerStore.getState().layers,
          guides: useEditorStore.getState().guides,
          groups: useLayerStore.getState().groups,
          savedAt: Date.now(),
        };
        const dataURL =
          "data:application/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(payload));
        const finalName = opts?.name?.trim() || doc.name || "Untitled-1";
        downloadDataURL(dataURL, `${finalName.replace(/\.kps?$/i, "")}.kp`);
      } catch {
        /* download failed, state is saved */
      }
    }
  },

  markDirty: () =>
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === state.activeDocId ? { ...d, dirty: true } : d
      ),
    })),

  clearDirty: () =>
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === state.activeDocId ? { ...d, dirty: false } : d
      ),
    })),
}));