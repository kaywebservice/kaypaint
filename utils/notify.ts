import { useToastStore, type ToastType } from "@/store/toastStore";

/** Show a non-blocking toast. Use instead of window.alert for feedback. */
export function notify(message: string, type: ToastType = "info") {
  useToastStore.getState().push(message, type);
}

/** Install the global alert patch: any window.alert(...) becomes a toast. */
export function installToastPatch() {
  if (typeof window === "undefined") return;
  (window as unknown as { alert: (m?: unknown) => void }).alert = (m?: unknown) => {
    notify(String(m ?? ""), "warning");
  };
}
