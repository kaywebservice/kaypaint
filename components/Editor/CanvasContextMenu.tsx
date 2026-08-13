"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import {
  copyActiveSelection,
  cutActiveSelection,
  duplicateActiveSelection,
  pasteClipboard,
  hasClipboard,
} from "@/engine/toolEngine";
import { toggleFreeTransform } from "@/engine/freeTransform";
import { ArrowUp, ArrowDown, Copy, Clipboard, Scissors, Trash2, Repeat2, Minus, Pencil } from "lucide-react";

interface MenuState {
  x: number;
  y: number;
  target: any;
  isGuide: boolean;
}

interface Item {
  label?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export default function CanvasContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ready = () => {
      const canvas = useEditorStore.getState().canvas;
      if (!canvas) return;

      const push = () => useEditorStore.getState().history?.push?.();

      const onMouseDown = (opt: any) => {
        const e = opt.e as MouseEvent;
        if (e.button !== 2) return;

        const found = canvas.findTarget(e, true);
        const target = found?.target ?? null;
        const isGuide = !!target?.isGuideLine;

        setMenu({
          x: e.clientX,
          y: e.clientY,
          target: target ?? null,
          isGuide,
        });
      };

      const onContextMenu = (e: Event) => e.preventDefault();

      canvas.on("mouse:down", onMouseDown);
      canvas.upperCanvasEl?.addEventListener?.("contextmenu", onContextMenu);
      return () => {
        canvas.off("mouse:down", onMouseDown);
        canvas.upperCanvasEl?.removeEventListener?.("contextmenu", onContextMenu);
      };
    };

    const unsub = useEditorStore.subscribe((s: any, prev: any) => {
      if (s.canvas && s.canvas !== prev.canvas) {
        cleanup();
        cleanup = ready() ?? (() => {});
      }
    });

    let cleanup = ready() ?? (() => {});
    return () => {
      unsub();
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  if (!menu) return null;

  const canvas = useEditorStore.getState().canvas;
  const ctx = { canvas, get: (k: string) => (useEditorStore.getState() as any)[k], push: () => useEditorStore.getState().history?.push?.() };

  const items: Item[] = [];

  if (menu.target && !menu.isGuide) {
    items.push({
      label: "Free Transform",
      icon: <Minus size={13} />,
      onClick: () => {
        toggleFreeTransform(canvas, menu.target);
        const id = menu.target.kaypaintId ?? menu.target.id ?? null;
        useEditorStore.getState().setTransformObject(id);
      },
    });
    items.push({ divider: true });
    items.push({
      label: "Duplicate",
      icon: <Repeat2 size={13} />,
      onClick: () => duplicateActiveSelection(canvas, ctx),
    });
    items.push({
      label: "Copy",
      icon: <Copy size={13} />,
      onClick: () => copyActiveSelection(canvas),
    });
    items.push({
      label: "Cut",
      icon: <Scissors size={13} />,
      onClick: () => cutActiveSelection(canvas, ctx),
    });
    items.push({
      label: "Paste",
      icon: <Clipboard size={13} />,
      disabled: !hasClipboard(),
      onClick: () => pasteClipboard(canvas, ctx),
    });
    items.push({ divider: true });
    items.push({
      label: "Bring to Front",
      icon: <ArrowUp size={13} />,
      onClick: () => {
        canvas.bringObjectToFront(menu.target);
        canvas.requestRenderAll();
        ctx.push();
      },
    });
    items.push({
      label: "Send to Back",
      icon: <ArrowDown size={13} />,
      onClick: () => {
        canvas.sendObjectToBack(menu.target);
        canvas.requestRenderAll();
        ctx.push();
      },
    });
    items.push({ divider: true });
    items.push({
      label: "Delete",
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: () => {
        canvas.remove(menu.target);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        ctx.push();
      },
    });
  } else if (menu.isGuide) {
    items.push({
      label: "Delete Guide",
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: () => {
        useEditorStore
          .getState()
          .removeGuide(menu.target.guideAxis, menu.target.guidePos);
      },
    });
  } else {
    items.push({
      label: "New Blank Document",
      icon: <Pencil size={13} />,
      onClick: () => {
        import("@/store/documentStore").then(({ useDocStore }) =>
          useDocStore.getState().createDoc()
        );
      },
    });
  }

  return (
    <div
      ref={ref}
      className="fixed z-[1000] min-w-48 bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1.5"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        const key = item.label ?? `d-${i}`;
        if (item.divider) {
          return <div key={key} className="my-1.5 border-t border-white/5" />;
        }
        return (
          <button
            key={key}
            onClick={() => {
              item.onClick?.();
              setMenu(null);
            }}
            disabled={item.disabled}
            className={
              "w-full text-left px-2.5 py-1.5 mx-1.5 text-[11px] flex items-center justify-between gap-4 rounded-lg transition-colors " +
              (item.danger
                ? "text-red-400 hover:bg-red-500/15"
                : "text-gray-200 hover:text-white hover:accent-gradient") +
              (item.disabled ? " opacity-40 pointer-events-none" : "")
            }
            style={{ width: "calc(100% - 12px)" }}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}