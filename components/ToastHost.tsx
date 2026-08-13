"use client";

import { useToastStore } from "@/store/toastStore";

const STYLES = {
  info: "border-indigo-400/40 bg-gray-800/95 text-gray-100",
  success: "border-emerald-400/40 bg-gray-800/95 text-emerald-100",
  warning: "border-amber-400/40 bg-gray-800/95 text-amber-100",
  error: "border-red-400/40 bg-gray-800/95 text-red-100",
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto px-3 py-2 rounded-lg border shadow-xl shadow-black/40 text-xs leading-relaxed backdrop-blur cursor-pointer animate-[toastIn_.18s_ease-out] ${STYLES[t.type]}`}
          role="status"
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
