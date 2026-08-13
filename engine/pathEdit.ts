/* eslint-disable @typescript-eslint/no-explicit-any */
import { Circle, Line } from "fabric";
import { getPointer } from "@/engine/canvasEngine";
import {
  parsePathNodes,
  serializePathNodes,
  type PathNode,
} from "@/engine/pathEditCore";

/**
 * Direct-selection anchor editor. Double-click a Path to enter edit mode:
 * drag anchors or control handles to reshape; Alt while dragging a handle
 * breaks the mirror link; Escape or deselect exits.
 */

interface HandleSet {
  anchor: any;
  inDot: any;
  outDot: any;
  inLine: any;
  outLine: any;
}

interface Editor {
  canvas: any;
  obj: any;
  nodes: PathNode[];
  closed: boolean;
  handles: HandleSet[];
  drag: { node: PathNode; kind: "anchor" | "ctrlIn" | "ctrlOut" } | null;
  dragStart: { x: number; y: number } | null;
  selected: Set<number>;
}

let editor: Editor | null = null;

export function isEditingPath(): boolean {
  return !!editor;
}

function dot(x: number, y: number, r: number, fill: string, kind: string) {
  return new Circle({
    left: x,
    top: y,
    radius: r,
    fill,
    stroke: "#fff",
    strokeWidth: 1.5,
    selectable: false,
    evented: true,
    hasControls: false,
    hasBorders: false,
    isPathEditHandle: true,
    penKind: kind,
  });
}

function line(a: { x: number; y: number }, b: { x: number; y: number }) {
  return new Line([a.x, a.y, b.x, b.y], {
    stroke: "#61dafb",
    strokeWidth: 1,
    selectable: false,
    evented: false,
    opacity: 0.85,
  });
}

function rebuild(canvas: any) {
  if (!editor) return;
  const e = editor;
  for (const h of e.handles) {
    canvas.remove(h.anchor, h.inDot, h.outDot, h.inLine, h.outLine);
  }
  e.handles = [];
  for (let i = 0; i < e.nodes.length; i++) {
    const n = e.nodes[i];
    const sel = e.selected.has(i);
    const hs: HandleSet = {
      anchor: dot(n.x, n.y, sel ? 6 : 5, sel ? "#f59e0b" : "#ff6b6b", "anchor"),
      inDot: n.ctrlIn ? dot(n.ctrlIn.x, n.ctrlIn.y, 3.5, "#61dafb", "ctrlIn") : null,
      outDot: n.ctrlOut ? dot(n.ctrlOut.x, n.ctrlOut.y, 3.5, "#61dafb", "ctrlOut") : null,
      inLine: n.ctrlIn ? line(n, n.ctrlIn) : null,
      outLine: n.ctrlOut ? line(n, n.ctrlOut) : null,
    };
    canvas.add(hs.anchor);
    if (hs.inDot) canvas.add(hs.inDot, hs.inLine);
    if (hs.outDot) canvas.add(hs.outDot, hs.outLine);
    e.handles.push(hs);
  }
  syncPath();
  canvas.requestRenderAll();
}

function syncPath() {
  if (!editor) return;
  const e = editor;
  e.obj.set({ path: serializePathNodes(e.nodes, e.closed) });
  e.obj.setCoords?.();
}

export function enterPathEdit(canvas: any, obj: any) {
  if (editor) exitPathEdit(canvas);
  const { nodes, closed } = parsePathNodes(obj.path ?? []);
  if (!nodes.length) return;
  editor = { canvas, obj, nodes, closed, handles: [], drag: null, dragStart: null, selected: new Set() };
  rebuild(canvas);
  document.addEventListener("keydown", onKey);
}

export function exitPathEdit(canvas: any) {
  if (!editor) return;
  const e = editor;
  for (const h of e.handles) {
    canvas.remove(h.anchor, h.inDot, h.outDot, h.inLine, h.outLine);
  }
  e.obj.setCoords?.();
  canvas.requestRenderAll();
  document.removeEventListener("keydown", onKey);
  editor = null;
}

function onKey(e: KeyboardEvent) {
  if (!editor) return;
  if ((e.key === "Delete" || e.key === "Backspace") && editor.selected.size) {
    e.preventDefault();
    e.stopPropagation();
    deleteSelected();
  } else if (e.key === "Escape") {
    // let ToolManager handle exiting edit mode
  }
}

function deleteSelected() {
  if (!editor) return;
  const e = editor;
  // Remove selected nodes (keep at least one).
  const keep = e.nodes.filter((_, i) => !e.selected.has(i));
  if (keep.length === 0) {
    e.selected = new Set([0]);
    return;
  }
  e.nodes = keep;
  e.selected = new Set();
  rebuild(e.canvas);
}

function handleToNode(target: any): { node: PathNode; kind: "anchor" | "ctrlIn" | "ctrlOut" } | null {
  if (!editor) return null;
  for (let i = 0; i < editor.handles.length; i++) {
    const h = editor.handles[i];
    if (h.anchor === target) return { node: editor.nodes[i], kind: "anchor" };
    if (h.inDot === target) return { node: editor.nodes[i], kind: "ctrlIn" };
    if (h.outDot === target) return { node: editor.nodes[i], kind: "ctrlOut" };
  }
  return null;
}

function onDown(canvas: any, e: any) {
  if (!editor || e.e.button !== 0) return;
  const target = canvas.findTarget?.(e.e);
  if (!target || !target.isPathEditHandle) return;
  const hit = handleToNode(target);
  if (!hit) return;
  const idx = editor.handles.findIndex((h) => h.anchor === target);
  if (idx >= 0 && hit.kind === "anchor") {
    // Multi-select: Shift-click toggles; otherwise select just this anchor.
    if (e.e.shiftKey) {
      if (editor.selected.has(idx)) editor.selected.delete(idx);
      else editor.selected.add(idx);
    } else if (!editor.selected.has(idx)) {
      editor.selected = new Set([idx]);
    }
    rebuild(canvas);
  } else if (hit.kind !== "anchor" && !e.e.shiftKey) {
    editor.selected = new Set();
    rebuild(canvas);
  }
  editor.drag = hit;
  editor.dragStart = { x: hit.node.x, y: hit.node.y };
}

function onMove(canvas: any, e: any) {
  if (!editor || !editor.drag || !e.e.buttons) return;
  const pt = getPointer(canvas, e.e);
  const { node, kind } = editor.drag;
  if (kind === "anchor") {
    const dx = pt.x - node.x;
    const dy = pt.y - node.y;
    if (editor.selected.size > 0) {
      // Translate every selected anchor by the same delta.
      const start = editor.dragStart ?? { x: node.x, y: node.y };
      const deltaX = pt.x - start.x;
      const deltaY = pt.y - start.y;
      editor.selected.forEach((i) => {
        const n = editor!.nodes[i];
        n.x = n.x + deltaX;
        n.y = n.y + deltaY;
        if (n.ctrlIn) {
          n.ctrlIn.x += deltaX;
          n.ctrlIn.y += deltaY;
        }
        if (n.ctrlOut) {
          n.ctrlOut.x += deltaX;
          n.ctrlOut.y += deltaY;
        }
      });
    } else {
      node.x = pt.x;
      node.y = pt.y;
      if (node.ctrlIn) {
        node.ctrlIn.x += dx;
        node.ctrlIn.y += dy;
      }
      if (node.ctrlOut) {
        node.ctrlOut.x += dx;
        node.ctrlOut.y += dy;
      }
    }
  } else if (kind === "ctrlOut") {
    if (!node.ctrlOut) node.ctrlOut = { x: pt.x, y: pt.y };
    node.ctrlOut.x = pt.x;
    node.ctrlOut.y = pt.y;
    if (node.linked && !e.e.altKey && node.ctrlOut) {
      node.ctrlIn = { x: 2 * node.x - node.ctrlOut.x, y: 2 * node.y - node.ctrlOut.y };
    } else if (e.e.altKey) {
      node.linked = false;
    }
  } else if (kind === "ctrlIn") {
    if (!node.ctrlIn) node.ctrlIn = { x: pt.x, y: pt.y };
    node.ctrlIn.x = pt.x;
    node.ctrlIn.y = pt.y;
    if (node.linked && !e.e.altKey && node.ctrlIn) {
      node.ctrlOut = { x: 2 * node.x - node.ctrlIn.x, y: 2 * node.y - node.ctrlIn.y };
    } else if (e.e.altKey) {
      node.linked = false;
    }
  }
  rebuild(editor.canvas);
}

function onUp() {
  if (editor) {
    editor.drag = null;
    editor.dragStart = null;
  }
}

let wired = false;
let wiredCanvas: any = null;

function ensureWired(canvas: any) {
  if (wired && wiredCanvas === canvas) return;
  wiredCanvas = canvas;
  canvas.on("mouse:down", (e: any) => onDown(canvas, e));
  canvas.on("mouse:move", (e: any) => onMove(canvas, e));
  canvas.on("mouse:up", onUp);
  wired = true;
}

/** Called from the editor page so the canvas-level handlers exist. */
export function initPathEdit(canvas: any) {
  ensureWired(canvas);
}
