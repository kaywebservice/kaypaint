import { create } from "zustand";
import { PLUGIN_CATALOG } from "@/engine/pluginCatalog";
import { pushLicense } from "@/engine/licensing";

const LS_KEY = "kaypaint:plugins";

export interface PluginState {
  marketOpen: boolean;
  bundleFocus: boolean;
  purchased: Record<string, boolean>;
  enabled: Record<string, boolean>;
  bundleOwned: boolean;
  openMarket: (bundle?: boolean) => void;
  closeMarket: () => void;
  purchase: (id: string) => void;
  purchaseBundle: () => void;
  toggleEnabled: (id: string) => void;
  owns: (id: string) => boolean;
  importLicenses: (ids: string[]) => void;
}

function load(): Partial<PluginState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

const persisted = load();

export const usePluginStore = create<PluginState>((set, get) => ({
  marketOpen: false,
  bundleFocus: false,
  purchased: persisted.purchased ?? {},
  enabled: persisted.enabled ?? {},
  bundleOwned: persisted.bundleOwned ?? false,

  openMarket: (bundle = false) => set({ marketOpen: true, bundleFocus: bundle }),
  closeMarket: () => set({ marketOpen: false, bundleFocus: false }),

  purchase: (id) => {
    const purchased = { ...get().purchased, [id]: true };
    const enabled = get().enabled[id] ? get().enabled : { ...get().enabled, [id]: true };
    set({ purchased, enabled });
    persist(get());
    pushLicense(id, "once").catch(() => {});
  },

  purchaseBundle: () => {
    const purchased: Record<string, boolean> = {};
    for (const pl of PLUGIN_CATALOG) purchased[pl.id] = true;
    set({ bundleOwned: true, purchased });
    persist(get());
    pushLicense("bundle", "bundle").catch(() => {});
  },

  toggleEnabled: (id) => {
    const enabled = { ...get().enabled, [id]: !get().enabled[id] };
    set({ enabled });
    persist(get());
  },

  owns: (id) => get().bundleOwned || !!get().purchased[id],

  importLicenses: (ids) => {
    const purchased = { ...get().purchased };
    const enabled = { ...get().enabled };
    let bundleOwned = get().bundleOwned;
    for (const id of ids) {
      purchased[id] = true;
      if (typeof enabled[id] !== "boolean") enabled[id] = true;
      if (id === "bundle") bundleOwned = true;
    }
    set({ purchased, enabled, bundleOwned });
    persist(get());
  },
}));

function persist(state: PluginState) {
  const { marketOpen, bundleFocus, openMarket, closeMarket, purchase, purchaseBundle, toggleEnabled, owns, importLicenses, ...rest } =
    state;
  void marketOpen;
  void bundleFocus;
  void openMarket;
  void closeMarket;
  void purchase;
  void purchaseBundle;
  void toggleEnabled;
  void owns;
  void importLicenses;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
  } catch {
    /* storage full */
  }
}