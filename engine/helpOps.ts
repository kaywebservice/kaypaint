import { showOptions } from "@/components/Menu/OptionDialog";
import { useDocStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { getImageMode } from "@/engine/imageOps";
import { signInWithEmail, signOutUser } from "@/engine/licensing";
import pkg from "../package.json";

export const APP_NAME = pkg.name;
export const APP_VERSION = pkg.version;

const USER_KEY = "kaypaint:user";
const AUTO_UPDATE_KEY = "kaypaint:autoUpdate";
const EXTENSIONS_KEY = "kaypaint:extensions";

export function openDocs() {
  window.open(
    "https://github.com/search?q=" + encodeURIComponent("kaypaint editor") + "&type=repositories",
    "_blank",
    "noopener,noreferrer"
  );
}

export function openSupportCommunity() {
  window.open(
    "https://github.com/search?q=kaypaint&type=repositories",
    "_blank",
    "noopener,noreferrer"
  );
}

export async function openSearch() {
  await showOptions({
    title: "Search",
    text:
      "Search is not available offline. Common topics:\n• Layers, masks, grouping\n• Filters and adjustments\n• Brushes and tools\n• Export and save\n• Keyboard shortcuts",
    fields: [{ key: "q", label: "Search KayPaint Help", type: "text", value: "" }],
  });
}

function detectBrowser(ua: string): string {
  if (/Edg\/|Edge\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Unknown";
}

export async function showSystemInfo() {
  const canvas = useEditorStore.getState().canvas;
  const zoom = Math.round((canvas?.getZoom?.() ?? 1) * 100);
  const docStore = useDocStore.getState();
  const activeDoc = docStore.docs.find((d) => d.id === docStore.activeDocId)?.name ?? "—";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "Unknown";
  const memory = nav.deviceMemory ? `${nav.deviceMemory} GB` : "Unknown";
  const screenDesc = window.screen ? `${window.screen.width} x ${window.screen.height}` : "—";
  const canvasDesc = `${useEditorStore.getState().canvasW} x ${useEditorStore.getState().canvasH} · ${zoom}%`;

  await showOptions({
    title: "System Info",
    okLabel: "OK",
    fields: [
      { key: "version", label: "App Version", type: "text", value: `${APP_NAME} ${APP_VERSION}` },
      { key: "platform", label: "Platform", type: "text", value: platform },
      { key: "browser", label: "Browser", type: "text", value: navigator.userAgent },
      { key: "os", label: "OS", type: "text", value: detectBrowser(navigator.userAgent) + " · " + platform },
      { key: "screen", label: "Screen", type: "text", value: screenDesc },
      { key: "canvas", label: "Canvas", type: "text", value: canvasDesc },
      { key: "colorMode", label: "Color Mode", type: "text", value: getImageMode().toUpperCase() },
      { key: "memory", label: "Memory", type: "text", value: memory },
      { key: "cores", label: "Cores", type: "text", value: `${navigator.hardwareConcurrency ?? "Unknown"}` },
      { key: "locale", label: "Locale", type: "text", value: navigator.language ?? "Unknown" },
      { key: "activeDoc", label: "Active Doc", type: "text", value: activeDoc },
    ],
  });
}

export function getAutoUpdate(): boolean {
  try {
    return localStorage.getItem(AUTO_UPDATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoUpdate(on: boolean) {
  try {
    localStorage.setItem(AUTO_UPDATE_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export async function fetchLatestRelease(): Promise<{
  version: string;
  notes: string;
  url: string;
} | null> {
  try {
    const res = await fetch("https://api.github.com/repos/kaywebservice/kaypaint/releases/latest");
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; body?: string; html_url?: string };
    const tag = String(data.tag_name ?? "").replace(/^v/, "");
    if (!tag) return null;
    return {
      version: tag,
      notes: data.body ? String(data.body).slice(0, 2000) : "",
      url: String(data.html_url ?? ""),
    };
  } catch {
    return null;
  }
}

export async function runUpdates() {
  const res = await showOptions({
    title: "Updates",
    text: "KayPaint checks GitHub releases for newer versions.",
    okLabel: "Check for Updates",
    fields: [{ key: "auto", label: "Enable Auto Updates", type: "checkbox", value: getAutoUpdate() }],
  });
  if (!res) return;
  setAutoUpdate(Boolean(res.auto));
  const release = await fetchLatestRelease();
  if (release) {
    await showOptions({
      title: "Update Available",
      okLabel: "OK",
      text:
        `Update available: ${release.version}.\n\n` +
        (release.notes ? release.notes + "\n\n" : "") +
        (release.url ? `Download: ${release.url}` : ""),
      fields: [],
    });
    return;
  }
  await showOptions({
    title: "Updates",
    okLabel: "OK",
    text: `You are up to date (${APP_VERSION}). KayPaint checks GitHub releases.`,
    fields: [],
  });
}

export async function manageExtensions() {
  let names: string[] = [];
  try {
    const raw = localStorage.getItem(EXTENSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) names = parsed.map((n) => String(n));
    }
  } catch {
    /* ignore */
  }
  const text = names.length
    ? `Installed extensions:\n${names.map((n) => `• ${n}`).join("\n")}`
    : "No extensions installed.";
  await showOptions({ title: "Manage Extensions", okLabel: "OK", text, fields: [] });
}

const RESET_KEYS = [
  "kaypaint-settings-v1",
  "kaypaint:imageMode",
  "kaypaint:pxRatio",
  "kaypaint:proofCustom",
  "kaypaint:extensions",
  "kaypaint:autoUpdate",
  "kaypaint:lastFilter",
  "kaypaint:plugins",
];

export function clearKnownStorage() {
  try {
    for (const key of RESET_KEYS) localStorage.removeItem(key);
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("kaypaint:selection")) {
        localStorage.removeItem(key);
        i -= 1;
      }
    }
  } catch {
    /* ignore */
  }
}

export async function resetSettings() {
  const res = await showOptions({
    title: "Reset All Settings",
    text:
      "This will clear saved settings, image mode, extensions, updates and selections. This cannot be undone.",
    okLabel: "Reset",
    fields: [{ key: "confirm", label: "I understand", type: "checkbox", value: false }],
  });
  if (!res?.confirm) return;
  clearKnownStorage();
  window.location.reload();
}

export function getCurrentUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export async function requestSignIn(): Promise<string | null> {
  const res = await showOptions({
    title: "Sign In with Firebase",
    okLabel: "Continue",
    fields: [
      {
        key: "email",
        label: "Email",
        type: "text",
        value: getCurrentUser() ?? "",
      },
      {
        key: "password",
        label: "Password",
        type: "text",
        value: "",
      },
      {
        key: "create",
        label: "Create a new account",
        type: "checkbox",
        value: false,
      },
    ],
  });
  if (!res) return null;
  const email = String(res.email ?? "").trim();
  const password = String(res.password ?? "");
  if (!email || !password) {
    window.alert("Email and password are required.");
    return null;
  }
  try {
    const user = await signInWithEmail(email, password, !!res.create);
    return user?.email ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign in failed.";
    window.alert(msg.replace("Firebase: ", ""));
    return null;
  }
}

export function signOut() {
  void signOutUser();
}

export function subscribeUserChanged(fn: () => void): () => void {
  window.addEventListener("kaypaint:user-changed", fn);
  return () => window.removeEventListener("kaypaint:user-changed", fn);
}