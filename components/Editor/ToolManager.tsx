import { useEffect, useRef } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEditorStore } from "@/store/editorStore";
import { HistoryEngine } from "@/engine/historyEngine";
import { tools } from "@/store/toolRegistry";
import {
  switchTool,
  deactivateTool,
  syncBrushParams,
  syncShapeKind,
  syncFilterValue,
  getCurrentToolId,
  copyActiveSelection,
  pasteClipboard,
  cutActiveSelection,
  duplicateActiveSelection,
} from "@/engine/toolEngine";
import { exitAllFreeTransforms } from "@/engine/freeTransform";
import { exitPathEdit, isEditingPath } from "@/engine/pathEdit";
import { getBinding } from "@/engine/shortcuts";
import { useLayerStore as useLayerStoreSelf } from "@/store/layerStore";
import type { ToolCtx } from "@/types/editor";

export default function ToolManager() {
  const canvas = useEditorStore((state) => state.canvas);
  const activeTool = useEditorStore((state) => state.activeTool);
  const setHistory = useEditorStore((state) => state.setHistory);
  const lastCtrlPress = useRef(0);

  const get = (key: string) => {
    const state = useEditorStore.getState() as any;
    return state[key];
  };

  const ctxRef = useRef<ToolCtx | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const history = new HistoryEngine(canvas);
    setHistory(history);

    const ctx: ToolCtx = {
      canvas,
      get,
      push: () => history.push(),
    };

    ctxRef.current = ctx;
    history.reset();

    const onModified = () => history.push();
    const onRemoved = () => history.push();
    const onPathCreated = () => history.push();

    canvas.on("object:modified", onModified);
    canvas.on("object:removed", onRemoved);
    canvas.on("path:created", onPathCreated);

    return () => {
      canvas.off("object:modified", onModified);
      canvas.off("object:removed", onRemoved);
      canvas.off("path:created", onPathCreated);
      ctxRef.current = null;
    };
  }, [canvas, setHistory]);

  useEffect(() => {
    if (!canvas || !ctxRef.current) return;
    switchTool(activeTool, ctxRef.current);
  }, [canvas, activeTool]);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        deactivateTool(ctxRef.current);
      }
    };
  }, [canvas]);

  const size = useEditorStore((state) => state.size);
  const color = useEditorStore((state) => state.color);

  useEffect(() => {
    if (!ctxRef.current) return;
    syncBrushParams(ctxRef.current);
  }, [size, color]);

  const shape = useEditorStore((state) => state.shape);

  useEffect(() => {
    if (!ctxRef.current || getCurrentToolId() !== "shape") return;
    syncShapeKind(ctxRef.current);
  }, [shape]);

  const filterAmount = useEditorStore((state) => state.filterAmount);

  useEffect(() => {
    if (!ctxRef.current) return;
    const id = getCurrentToolId();
    if (id === "blur" || id === "brightness") {
      syncFilterValue(ctxRef.current);
    }
  }, [filterAmount]);

  useEffect(() => {
    if (!canvas || !ctxRef.current) return;

    const isEditableTarget = (el: any) =>
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable);

    const onKey = async (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const ctx = ctxRef.current;
      if (!ctx) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "Control" && !e.repeat) {
        const now = Date.now();
        if (now - lastCtrlPress.current < 500) {
          e.preventDefault();
          useEditorStore.getState().setPaletteOpen(true);
        }
        lastCtrlPress.current = now;
        return;
      }

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.getState().history?.redo();
        } else {
          useEditorStore.getState().history?.undo();
        }
        return;
      }

      if (mod && key === "y") {
        e.preventDefault();
        useEditorStore.getState().history?.redo();
        return;
      }

      if (mod && key === "c") {
        e.preventDefault();
        await copyActiveSelection(canvas);
        return;
      }

      if (mod && key === "v") {
        e.preventDefault();
        await pasteClipboard(canvas, ctx);
        return;
      }

      if (mod && key === "x") {
        e.preventDefault();
        await cutActiveSelection(canvas, ctx);
        return;
      }

      if (mod && key === "a") {
        e.preventDefault();
        const objects = canvas.getObjects();
        if (objects.length) {
          canvas.setActiveObject(objects);
        }
        return;
      }

      if (mod && key === "j") {
        e.preventDefault();
        await duplicateActiveSelection(canvas, ctx);
        return;
      }

      if (mod && key === "g" && !e.shiftKey) {
        e.preventDefault();
        const activeId = useLayerStoreSelf.getState().activeLayer;
        if (activeId) {
          useLayerStoreSelf.getState().createGroup([activeId]);
        }
        return;
      }

      if (mod && key === "g" && e.shiftKey) {
        e.preventDefault();
        const st = useLayerStoreSelf.getState();
        const g = st.groups.find((gr) => gr.children.includes(st.activeLayer ?? ""));
        if (g) st.deleteGroup(g.id);
        return;
      }

      if (mod && key === "n" && e.shiftKey) {
        e.preventDefault();
        import("@/store/documentStore").then(({ useDocStore }) =>
          useDocStore.getState().createDoc()
        );
        return;
      }

      if (mod && key === "s" && !e.shiftKey) {
        e.preventDefault();
        import("@/store/documentStore").then(({ useDocStore }) =>
          useDocStore.getState().saveDoc()
        );
        return;
      }

      if (mod && key === "s" && e.shiftKey) {
        e.preventDefault();
        import("@/store/documentStore").then(({ useDocStore }) => {
          const st = useDocStore.getState();
          const name = window.prompt(
            "Save As",
            st.docs.find((d) => d.id === st.activeDocId)?.name ?? "Untitled-1"
          );
          if (name !== null) st.saveDocAs({ name, download: true });
        });
        return;
      }

      const arrow = ["arrowleft", "arrowright", "arrowup", "arrowdown"];
      if (arrow.includes(key)) {
        const objs = canvas.getActiveObjects();
        if (objs.length && !objs.some((o: any) => o.isEditing)) {
          const mods = canvas.getObjects().filter((o: any) => o.isGuideLine);
          const movable = objs.filter((o: any) => !mods.includes(o));
          if (movable.length) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
            const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
            movable.forEach((o: any) => {
              o.left += dx;
              o.top += dy;
              o.setCoords?.();
            });
            canvas.requestRenderAll();
          }
        }
        return;
      }

      if (key === "delete" || key === "backspace") {
        const objs = canvas.getActiveObjects();
        if (objs.length) {
          e.preventDefault();
          if (objs.some((o: any) => o.isEditing)) {
            return;
          }
          objs.forEach((obj: any) => canvas.remove(obj));
          canvas.discardActiveObject();
          ctx.push();
        }
        return;
      }

      if (key === "escape") {
        const ed = useEditorStore.getState();
        if (ed.paletteOpen) {
          ed.setPaletteOpen(false);
          return;
        }
        if (isEditingPath()) {
          exitPathEdit(canvas);
          return;
        }
        const active = canvas.getActiveObject();
        if (active?.exitEditing) {
          active.exitEditing();
        }
        exitAllFreeTransforms(canvas);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }

      if (key === "[" || key === "]") {
        const step = 10;
        const current = useEditorStore.getState().size;
        useEditorStore.getState().setSize(
          key === "["
            ? Math.max(1, current - step)
            : Math.min(500, current + step)
        );
        return;
      }

      const shortcut = tools.find(
        (t) => getBinding(t.id).toLowerCase() === key
      );

      if (shortcut && !mod && key.length === 1) {
        useEditorStore.getState().setTool(shortcut.id);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [canvas]);

  return null;
}