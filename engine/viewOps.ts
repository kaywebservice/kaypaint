import { buildCmykPreview } from "@/engine/colorEngine";
import type { RenderingIntent, WorkingSpace } from "@/engine/colorEngine";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ScreenMode } from "@/store/settingsStore";

const PROOF_CUSTOM_KEY = "kaypaint:proofCustom";
const PROOF_OVERLAY_KEY = "kaypaint:proofOverlay";
const PX_RATIO_KEY = "kaypaint:pxRatio";
const LOCK_GUIDES_KEY = "kaypaint:lockGuides";

const listeners = new Set<() => void>();

export function subscribeView(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyView() {
  for (const fn of listeners) fn();
}

export const WORKING_SPACES: { id: WorkingSpace; label: string }[] = [
  { id: "srgb", label: "sRGB IEC61966-2.1 (current)" },
  { id: "p3", label: "Display P3" },
  { id: "adobergb", label: "Adobe RGB" },
  { id: "prophoto", label: "ProPhoto RGB" },
];

export interface ProofCustom {
  renderingIntent: RenderingIntent | "absolute";
  simulatePaperBlack: boolean;
  workingSpace: WorkingSpace;
}

const DEFAULT_PROOF_CUSTOM: ProofCustom = {
  renderingIntent: "relative",
  simulatePaperBlack: false,
  workingSpace: "srgb",
};

let proofCustomCache: ProofCustom | null = null;

export function getProofCustom(): ProofCustom {
  if (!proofCustomCache) {
    try {
      const raw = localStorage.getItem(PROOF_CUSTOM_KEY);
      if (raw) proofCustomCache = { ...DEFAULT_PROOF_CUSTOM, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    if (!proofCustomCache) proofCustomCache = { ...DEFAULT_PROOF_CUSTOM };
  }
  return proofCustomCache;
}

export function setProofCustom(patch: Partial<ProofCustom>) {
  proofCustomCache = { ...getProofCustom(), ...patch };
  try {
    localStorage.setItem(PROOF_CUSTOM_KEY, JSON.stringify(proofCustomCache));
  } catch {
    /* ignore */
  }
  if (useSettingsStore.getState().proofColorsOn) void runProofPreview();
}

function proofIntent() {
  const custom = getProofCustom();
  if (useSettingsStore.getState().proofMode !== "custom") {
    return {
      renderingIntent: "relative" as RenderingIntent,
      simulatePaperBlack: false,
      workingSpace: "srgb" as WorkingSpace,
    };
  }
  return {
    renderingIntent:
      custom.renderingIntent === "absolute"
        ? ("relative" as RenderingIntent)
        : custom.renderingIntent,
    simulatePaperBlack: custom.simulatePaperBlack,
    workingSpace: custom.workingSpace,
  };
}

let proofOverlayURL: string | null = null;

export function getProofOverlayURL() {
  return proofOverlayURL;
}

export function setProofOverlayURL(url: string | null) {
  proofOverlayURL = url;
  try {
    if (url) localStorage.setItem(PROOF_OVERLAY_KEY, url);
    else localStorage.removeItem(PROOF_OVERLAY_KEY);
  } catch {
    /* ignore */
  }
  notifyView();
}

export async function runProofPreview() {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  try {
    const data = canvas.toDataURL({ format: "png", multiplier: 1 });
    const { renderingIntent, simulatePaperBlack, workingSpace } = proofIntent();
    const result = await buildCmykPreview(data, {
      renderingIntent,
      simulatePaperBlack,
      workingSpace,
    });
    setProofOverlayURL(result.cmykPreview);
  } catch {
    setProofOverlayURL(null);
  }
}

export function toggleProofColors() {
  const state = useSettingsStore.getState();
  const next = !state.proofColorsOn;
  state.set({ proofColorsOn: next });
  if (!next) setProofOverlayURL(null);
}

export function setProofMode(mode: string) {
  useSettingsStore.getState().set({ proofMode: mode });
}

export function toggleGamutWarning() {
  const state = useEditorStore.getState();
  const next = !state.gamutWarning;
  state.setGamutWarning(next);
  if (!next) state.setGamutOverlay(null);
}

let pxRatioCache: number | null = null;

export function getPxRatio(): number {
  if (pxRatioCache === null) {
    try {
      pxRatioCache = Number(localStorage.getItem(PX_RATIO_KEY) ?? "1");
    } catch {
      pxRatioCache = 1;
    }
    if (!Number.isFinite(pxRatioCache) || pxRatioCache <= 0) pxRatioCache = 1;
  }
  return pxRatioCache;
}

export function setPxRatio(ratio: number) {
  pxRatioCache = Math.max(0.1, Math.min(4, Number(ratio) || 1));
  try {
    localStorage.setItem(PX_RATIO_KEY, String(pxRatioCache));
  } catch {
    /* ignore */
  }
  notifyView();
}

let lockGuidesCache: boolean | null = null;

export function getLockGuides(): boolean {
  if (lockGuidesCache === null) {
    try {
      lockGuidesCache = localStorage.getItem(LOCK_GUIDES_KEY) === "1";
    } catch {
      lockGuidesCache = false;
    }
  }
  return lockGuidesCache;
}

export function toggleLockGuides() {
  lockGuidesCache = !getLockGuides();
  try {
    localStorage.setItem(LOCK_GUIDES_KEY, lockGuidesCache ? "1" : "0");
  } catch {
    /* ignore */
  }
  notifyView();
}

export interface ViewSnapshot {
  proofOverlayURL: string | null;
  pxRatio: number;
  lockGuides: boolean;
}

let cachedSnapshot: ViewSnapshot | null = null;

export function getViewSnapshot(): ViewSnapshot {
  const next: ViewSnapshot = {
    proofOverlayURL: getProofOverlayURL(),
    pxRatio: getPxRatio(),
    lockGuides: getLockGuides(),
  };
  if (
    cachedSnapshot &&
    cachedSnapshot.proofOverlayURL === next.proofOverlayURL &&
    cachedSnapshot.pxRatio === next.pxRatio &&
    cachedSnapshot.lockGuides === next.lockGuides
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return cachedSnapshot;
}

export function applyScreenClasses(mode: ScreenMode) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("kp-screen-menufull", mode === "menufull");
  document.body.classList.toggle("kp-screen-full", mode === "full");
}

export function setScreenMode(mode: ScreenMode) {
  useSettingsStore.getState().set({ screenMode: mode });
  applyScreenClasses(mode);
}

export function zoomBy(factor: number) {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const target = Math.max(0.05, Math.min(10, canvas.getZoom() * factor));
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, target);
  canvas.requestRenderAll();
}

export function setZoomPercent(pct: number) {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const zoom = Math.max(0.05, Math.min(16, (Number(pct) || 100) / 100));
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
  canvas.requestRenderAll();
}

export function fitInWindow() {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const element = canvas.lowerCanvasEl as HTMLCanvasElement;
  const parent = element.parentElement;
  if (!parent) return;
  const w = parent.clientWidth - 40;
  const h = parent.clientHeight - 40;
  const zoomLevel = Math.max(
    0.05,
    Math.min(1, Math.min(w / canvas.width, h / canvas.height))
  );
  canvas.zoomToPoint({ x: 0, y: 0 }, zoomLevel);
  canvas.requestRenderAll();
}

export function resetView() {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, 1);
  canvas.requestRenderAll();
}

export function printSize() {
  const canvas = useEditorStore.getState().canvas;
  if (!canvas) return;
  const dpi = useSettingsStore.getState().dpi;
  canvas.zoomToPoint(
    { x: canvas.width / 2, y: canvas.height / 2 },
    Math.max(0.05, Math.min(16, dpi / 96))
  );
  canvas.requestRenderAll();
}