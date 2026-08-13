"use client";

import { useEffect, useRef, useState } from "react";
import { isMenuHidden, menuColor } from "@/engine/menusCustom";

export interface MenuEntry {
  id?: string;
  label?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
  onClick?: () => void;
  children?: MenuEntry[];
}

export default function MenuButton({
  title,
  entries,
}: {
  title: string;
  entries: MenuEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSub(null);
      }
    };

    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSub(null);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const fire = (item: MenuEntry) => {
    setOpen(false);
    setSub(null);
    item.onClick?.();
  };

  const renderEntry = (item: MenuEntry, i: number, inSub = false) => {
    const hidden = item.id ? isMenuHidden(item.id) : false;
    if (hidden) return null;
    if (item.children) {
      const kids = item.children.filter((c) => !(c.id && isMenuHidden(c.id)));
      if (!kids.length) return null;
      item = { ...item, children: kids };
    }
    const color = item.id ? menuColor(item.id) : null;
    return item.divider ? (
      <div key={i} className="my-1.5 border-t border-white/5" />
    ) : (
      <div key={i} className="relative">
        <button
          onClick={() => {
            if (item.children?.length) {
              setSub(inSub ? i : i);
            } else {
              fire(item);
            }
          }}
          onMouseEnter={() => {
            if (item.children?.length) setSub(i);
          }}
          disabled={item.disabled}
          className={
            "w-full text-left px-2.5 py-2 mx-1.5 text-[13px] flex justify-between items-center gap-8 rounded-lg transition-colors " +
            (item.danger
              ? "text-red-400 hover:bg-red-500/15"
              : "text-gray-200 hover:text-white hover:accent-gradient hover:shadow-lg hover:shadow-indigo-500/20") +
            (item.disabled ? " opacity-40 pointer-events-none" : "")
          }
        >
          <span className="flex items-center gap-2">
            {item.checked && (
              <span className="text-indigo-300 text-xs leading-none">✓</span>
            )}
            <span style={color ? { color } : undefined}>{item.label}</span>
          </span>
          {item.children?.length ? (
            <span className="text-gray-500 text-[11px] ml-6">▸</span>
          ) : (
            item.shortcut && (
              <span
                className={
                  "text-[10px] px-1.5 py-0.5 rounded-md border " +
                  (item.danger
                    ? "text-red-400/70 border-white/5"
                    : "text-gray-500 border-white/10 bg-white/5")
                }
              >
                {item.shortcut}
              </span>
            )
          )}
        </button>
        {item.children?.length && sub === i && (
          <div className="absolute left-full top-0 z-50 min-w-56 bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 ml-1">
            {item.children.map((c, ci) => renderEntry(c, ci, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onMouseDown={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          "h-full px-3 text-sm font-medium rounded-lg transition-colors " +
          (open
            ? "text-white bg-white/10"
            : "text-gray-300 hover:text-white hover:bg-white/5")
        }
      >
        {title}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 min-w-56 bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 mt-1">
          {entries.map((item, i) => renderEntry(item, i))}
        </div>
      )}
    </div>
  );
}