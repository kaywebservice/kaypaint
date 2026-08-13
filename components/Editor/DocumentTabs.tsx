"use client";

import { Plus, X } from "lucide-react";
import { useDocStore } from "@/store/documentStore";

export default function DocumentTabs() {
  const docs = useDocStore((s) => s.docs);
  const activeDocId = useDocStore((s) => s.activeDocId);

  return (
    <div className="h-8 bg-gray-950 border-b border-white/5 flex items-center gap-0.5 px-1.5 shrink-0 overflow-x-auto scrollbar-thin">
      {docs.map((doc) => {
        const active = doc.id === activeDocId;
        return (
          <div
            key={doc.id}
            className={
              "group flex items-center gap-1.5 px-3 h-full min-w-0 max-w-44 rounded-t-lg cursor-pointer select-none text-xs transition-colors " +
              (active
                ? "bg-gray-800 text-white border-t-2 border-indigo-400/80"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200")
            }
            onClick={() => useDocStore.getState().setActiveDoc(doc.id)}
            onDoubleClick={() => {
              const name = window.prompt("Rename document", doc.name);
              if (name !== null) useDocStore.getState().renameDoc(doc.id, name);
            }}
            title={doc.name + (doc.dirty ? " (unsaved)" : "")}
          >
            <span className="truncate">{doc.name}</span>
            {doc.dirty && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
            <button
              title="Close document"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Close "${doc.name}"?`)) {
                  useDocStore.getState().closeDoc(doc.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-opacity shrink-0"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      <button
        title="New document (Ctrl+Shift+N)"
        onClick={() => useDocStore.getState().createDoc()}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}