const KEY = "kaypaint-doc-v1";

export interface SavedDoc {
  version: number;
  canvas: any;
  layers: any[];
  guides: any[];
  groups: any[];
  savedAt: number;
}

export function saveDocument(obj: {
  canvas: any;
  layers: any[];
  guides: any[];
  groups?: any[];
}) {
  try {
    const payload: SavedDoc = {
      version: 1,
      canvas: obj.canvas.toJSON(),
      layers: obj.layers,
      guides: obj.guides,
      groups: obj.groups ?? [],
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage full or unavailable */
  }
}

export function hasSavedDoc() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadSavedDoc(): SavedDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedDoc;
  } catch {
    return null;
  }
}

export function clearSavedDoc() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}