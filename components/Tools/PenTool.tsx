/* eslint-disable @typescript-eslint/no-explicit-any */
import { Path, Circle, Line } from "fabric";
import type { ToolCtx } from "@/types/editor";
import { getPointer } from "@/engine/canvasEngine";

interface Pt {
  x: number;
  y: number;
}

interface Anchor {
  x: number;
  y: number;
  ctrlIn: Pt | null;
  ctrlOut: Pt | null;
  linked: boolean;
}

function fmt(v: number) {
  return v.toFixed(1);
}

function fmtPt(p: Pt) {
  return `${fmt(p.x)} ${fmt(p.y)}`;
}

function segD(prev: Anchor, cur: Anchor): string {
  if (prev.ctrlOut && cur.ctrlIn) {
    return ` C ${fmtPt(prev.ctrlOut)}, ${fmtPt(cur.ctrlIn)}, ${fmtPt(cur)}`;
  }
  if (prev.ctrlOut) return ` Q ${fmtPt(prev.ctrlOut)}, ${fmtPt(cur)}`;
  if (cur.ctrlIn) return ` Q ${fmtPt(cur.ctrlIn)}, ${fmtPt(cur)}`;
  return ` L ${fmtPt(cur)}`;
}

export function activateTool(ctx: ToolCtx) {
  const { canvas } = ctx;
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let anchors: Anchor[] = [];
  let guides: any[] = [];
  let livePath: any = null;
  let dragTarget: { anchor: Anchor; kind: "ctrlIn" | "ctrlOut" | "anchor" } | null = null;
  let pending: { anchor: Anchor; start: Pt; moved: boolean } | null = null;

  const removeLive = () => {
    if (livePath) {
      canvas.remove(livePath);
      livePath = null;
    }
  };

  const removeGuides = () => {
    guides.forEach((g) => canvas.remove(g));
    guides = [];
  };

  const rebuildGuides = () => {
    removeGuides();
    for (const a of anchors) {
      const anchorDot = new Circle({
        left: a.x,
        top: a.y,
        radius: 5,
        fill: "#ff6b6b",
        stroke: "#fff",
        strokeWidth: 1.5,
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: false,
        isPenHandle: true,
        penKind: "anchor",
      });
      guides.push(anchorDot);
      canvas.add(anchorDot);

      for (const kind of ["ctrlIn", "ctrlOut"] as const) {
        const cp = a[kind];
        if (!cp) continue;
        guides.push(
          new Line([a.x, a.y, cp.x, cp.y], {
            stroke: "#61dafb",
            strokeWidth: 1,
            selectable: false,
            evented: false,
            opacity: 0.8,
          })
        );
        guides.push(
          new Circle({
            left: cp.x,
            top: cp.y,
            radius: 3.5,
            fill: "#61dafb",
            stroke: "#fff",
            strokeWidth: 1,
            selectable: false,
            evented: true,
            hasControls: false,
            hasBorders: false,
            isPenHandle: true,
            penKind: kind,
          })
        );
      }
    }
  };

  const rebuildPath = () => {
    removeLive();
    if (anchors.length < 1) return;
    let d = `M ${fmtPt(anchors[0])}`;
    for (let i = 1; i < anchors.length; i++) {
      d += segD(anchors[i - 1], anchors[i]);
    }
    if (pending) {
      const prev = anchors[anchors.length - 1];
      d += segD(prev, pending.anchor);
    }
    livePath = new Path(d, {
      fill: "",
      stroke: ctx.get("color") ?? "#000000",
      strokeWidth: ctx.get("size") ?? 2,
      selectable: false,
      evented: false,
    });
    canvas.add(livePath);
    canvas.requestRenderAll();
  };

  const rebuildAll = () => {
    rebuildGuides();
    rebuildPath();
  };

  const finishPath = (close: boolean) => {
    if (anchors.length < 2) {
      reset();
      return;
    }
    let d = `M ${fmtPt(anchors[0])}`;
    for (let i = 1; i < anchors.length; i++) {
      d += segD(anchors[i - 1], anchors[i]);
    }
    if (close && anchors.length > 2) {
      const last = anchors[anchors.length - 1];
      const first = anchors[0];
      const closing = segD(last, { ...first, ctrlIn: first.ctrlIn, ctrlOut: null });
      if (closing !== ` L ${fmtPt(first)}`) d += closing;
      d += " Z";
    }
    const finished = new Path(d, {
      fill: "",
      stroke: ctx.get("color") ?? "#000000",
      strokeWidth: ctx.get("size") ?? 2,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
    });
    removeLive();
    removeGuides();
    canvas.add(finished);
    canvas.setActiveObject(finished);
    ctx.push();
    reset();
  };

  const reset = () => {
    removeLive();
    removeGuides();
    anchors = [];
    pending = null;
    dragTarget = null;
    canvas.requestRenderAll();
  };

  const down = (e: any) => {
    if (e.e.button !== 0) return;
    const point = getPointer(canvas, e.e);

    if (e.e.altKey && anchors.length) {
      finishPath(false);
      return;
    }

    // Click on the first anchor closes the path.
    if (anchors.length >= 2) {
      const first = anchors[0];
      if (Math.hypot(point.x - first.x, point.y - first.y) < 8) {
        finishPath(true);
        return;
      }
    }

    const target = canvas.findTarget?.(e.e);
    if (target && target.isPenHandle) {
      const anchorIdx = anchorIndexFor(guides, target);
      if (anchorIdx >= 0) {
        const kind = (target.penKind as "ctrlIn" | "ctrlOut" | "anchor") || "anchor";
        dragTarget = { anchor: anchors[anchorIdx], kind };
        return;
      }
    }

    // Start a new pending anchor with drag-to-curve.
    pending = {
      anchor: { x: point.x, y: point.y, ctrlIn: null, ctrlOut: null, linked: true },
      start: { x: point.x, y: point.y },
      moved: false,
    };
    rebuildAll();
  };

  const move = (e: any) => {
    const point = getPointer(canvas, e.e);

    if (dragTarget && e.e.buttons) {
      const a = dragTarget.anchor;
      if (dragTarget.kind === "anchor") {
        const dx = point.x - a.x;
        const dy = point.y - a.y;
        a.x = point.x;
        a.y = point.y;
        if (a.ctrlIn) {
          a.ctrlIn.x += dx;
          a.ctrlIn.y += dy;
        }
        if (a.ctrlOut) {
          a.ctrlOut.x += dx;
          a.ctrlOut.y += dy;
        }
      } else if (dragTarget.kind === "ctrlOut") {
        if (a.ctrlOut) {
          a.ctrlOut.x = point.x;
          a.ctrlOut.y = point.y;
        } else {
          a.ctrlOut = { x: point.x, y: point.y };
        }
        if (a.linked && !e.e.altKey && a.ctrlOut) {
          a.ctrlIn = { x: 2 * a.x - a.ctrlOut.x, y: 2 * a.y - a.ctrlOut.y };
        } else if (e.e.altKey) {
          a.linked = false;
        }
      } else if (dragTarget.kind === "ctrlIn") {
        if (a.ctrlIn) {
          a.ctrlIn.x = point.x;
          a.ctrlIn.y = point.y;
        } else {
          a.ctrlIn = { x: point.x, y: point.y };
        }
        if (a.linked && !e.e.altKey && a.ctrlIn) {
          a.ctrlOut = { x: 2 * a.x - a.ctrlIn.x, y: 2 * a.y - a.ctrlIn.y };
        } else if (e.e.altKey) {
          a.linked = false;
        }
      }
      rebuildAll();
      return;
    }

    if (pending) {
      const dx = point.x - pending.start.x;
      const dy = point.y - pending.start.y;
      if (!pending.moved && dx * dx + dy * dy > 9) pending.moved = true;
      pending.anchor.ctrlOut = { x: point.x, y: point.y };
      rebuildPath();
      return;
    }
  };

  const up = () => {
    if (dragTarget) {
      dragTarget = null;
      rebuildAll();
      return;
    }
    if (pending) {
      const a = pending.anchor;
      if (pending.moved && a.ctrlOut) {
        // Curve: incoming handle mirrors the drag for a smooth join.
        a.ctrlIn = { x: 2 * a.x - a.ctrlOut.x, y: 2 * a.y - a.ctrlOut.y };
        a.linked = true;
      } else {
        a.ctrlOut = null;
        a.ctrlIn = null;
        a.linked = true;
      }
      anchors.push(a);
      pending = null;
      rebuildAll();
    }
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && anchors.length) {
      reset();
    } else if (e.key === "Enter" && anchors.length) {
      finishPath(false);
    }
  };

  // Helper: find which anchor index a handle belongs to (handles are added
  // in anchor order; the first matching guide group owns the anchor index).
  function anchorIndexFor(objs: any[], target: any): number {
    let idx = 0;
    let seen = 0;
    for (const g of objs) {
      if (g === target) return idx;
      if (g.penKind === "anchor") {
        idx = seen;
        seen++;
      }
    }
    return -1;
  }

  canvas.on("mouse:down", down);
  canvas.on("mouse:move", move);
  canvas.on("mouse:up", up);
  document.addEventListener("keydown", key);

  return () => {
    canvas.off("mouse:down", down);
    canvas.off("mouse:move", move);
    canvas.off("mouse:up", up);
    document.removeEventListener("keydown", key);
    reset();
  };
}