"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { Canvas } from "fabric";
import { useEditorStore } from "@/store/editorStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useLayerStore } from "@/store/layerStore";
import {
  applyScreenClasses,
  getViewSnapshot,
  runProofPreview,
  setProofOverlayURL,
  subscribeView,
} from "@/engine/viewOps";
import { useDocStore } from "@/store/documentStore";
import { HistoryEngine } from "@/engine/historyEngine";
import { useFeaturesStore } from "@/store/featuresStore";
import { editNote } from "@/components/Tools/NotesTool";
import {
  toggleFreeTransform,
  exitAllFreeTransforms,
  getPivotScene,
  handleTransformStart,
  handleTransformRotate,
  handleTransformEnd,
} from "@/engine/freeTransform";
import {
  saveDocument,
  hasSavedDoc,
  loadSavedDoc,
  clearSavedDoc,
} from "@/engine/persistence";
import {
  DEFAULT_CANVAS_W,
  DEFAULT_CANVAS_H,
  syncCanvasSizeStore,
} from "@/engine/canvasSizeEngine";
import {
  buildContour,
  contourToPath,
  drawAnts,
} from "@/engine/marchingAnts";
import {
  enterPathEdit,
  exitPathEdit,
  initPathEdit,
  isEditingPath,
} from "@/engine/pathEdit";

function drawRulerMarkers(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  size: number,
  isVertical: boolean,
  gridSize: number,
  rulerUnit: string,
  dpi: number
) {
  ctx.save();
  ctx.fillStyle = "#1a2130";
  ctx.fillRect(0, 0, isVertical ? 20 : size, isVertical ? size : 20);

  ctx.strokeStyle = "#3b4358";
  ctx.lineWidth = 1;
  ctx.font = "8px sans-serif";
  ctx.fillStyle = "#8b94ab";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const step = Math.max(4, gridSize * zoom);
  const pxPerUnit =
    rulerUnit === "px"
      ? 1
      : rulerUnit === "in"
        ? dpi
        : rulerUnit === "cm"
          ? dpi / 2.54
          : rulerUnit === "mm"
            ? dpi / 25.4
            : rulerUnit === "pt"
              ? dpi / 72
              : rulerUnit === "pica"
                ? dpi / 6
                : 1;

  const label = (doc: number) =>
    rulerUnit === "px"
      ? String(Math.round(doc))
      : (doc / Math.max(pxPerUnit, 0.001)).toFixed(1);

  if (isVertical) {
    for (let s = 0; s < size; s += step) {
      const doc = s / zoom;
      const isMajor = Math.round(doc / Math.max(1, gridSize)) % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(isMajor ? 16 : 18, s);
      ctx.lineTo(20, s);
      ctx.stroke();
      if (isMajor && s > 0) {
        ctx.fillText(label(doc), 10, s + 3);
      }
    }
  } else {
    for (let s = 0; s < size; s += step) {
      const doc = s / zoom;
      const isMajor = Math.round(doc / Math.max(1, gridSize)) % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(isMajor ? 16 : 18, s);
      ctx.lineTo(s, 20);
      ctx.stroke();
      if (isMajor && s > 0) {
        ctx.fillText(label(doc), s + 3, 10);
      }
    }
  }
  ctx.restore();
}

export default function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const topRulerRef = useRef<HTMLCanvasElement | null>(null);
  const leftRulerRef = useRef<HTMLCanvasElement | null>(null);
  const cornerRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const topRulerRowRef = useRef<HTMLDivElement | null>(null);
  const leftRulerColRef = useRef<HTMLDivElement | null>(null);
  const antsRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvas = useEditorStore((state) => state.setCanvas);
  const setHistory = useEditorStore((state) => state.setHistory);
  const guides = useEditorStore((state) => state.guides);
  const showGuides = useEditorStore((state) => state.showGuides);
  const snapGuides = useEditorStore((state) => state.snapGuides);
  const activeDocId = useDocStore((state) => state.activeDocId);
  const activeTool = useEditorStore((state) => state.activeTool);
  const canvasW = useEditorStore((state) => state.canvasW);
  const canvasH = useEditorStore((state) => state.canvasH);

const [zoom, setZoom] = useState(1);
  const [restorePrompt, setRestorePrompt] = useState(false);
  const [, force] = useState(0);
  const transformObjectId = useEditorStore((state) => state.transformObjectId);
  const gamutWarning = useEditorStore((state) => state.gamutWarning);
  const gamutOverlayURL = useEditorStore((state) => state.gamutOverlayURL);
  const setGamutOverlay = useEditorStore((state) => state.setGamutOverlay);
  const lastDocRef = useRef<string | null>(activeDocId);
  const guideDragRef = useRef<{
    axis: "h" | "v";
    active: boolean;
  } | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const showRulers = useSettingsStore((x) => x.showRulers);
  const showGrid = useSettingsStore((x) => x.showGrid);
  const gridSize = useSettingsStore((x) => x.gridSize);
  const gridColor = useSettingsStore((x) => x.gridColor);
  const guideColor = useSettingsStore((x) => x.guideColor);
  const rulerUnit = useSettingsStore((x) => x.rulerUnit);
  const dpi = useSettingsStore((x) => x.dpi);
  const screenMode = useSettingsStore((x) => x.screenMode);
  const proofColorsOn = useSettingsStore((x) => x.proofColorsOn);
  const proofMode = useSettingsStore((x) => x.proofMode);
  const showSelectionEdges = useSettingsStore((x) => x.showSelectionEdges);
  const showSlices = useSettingsStore((x) => x.showSlices);
  const viewRotate = useFeaturesStore((x) => x.viewRotate);
  const notes = useFeaturesStore((x) => x.notes);
  const counts = useFeaturesStore((x) => x.counts);
  const showLayerEdges = useFeaturesStore((x) => x.showLayerEdges);
  const layerEdgeColor = useFeaturesStore((x) => x.layerEdgeColor);

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    const objects = canvas.getObjects();
    if (showLayerEdges) {
      canvas.selectionColor = layerEdgeColor;
      for (const obj of objects) {
        if (obj === active) continue;
        obj.set({ stroke: layerEdgeColor, strokeWidth: 1, strokeUniform: true });
      }
    } else {
      canvas.selectionColor = "rgba(173,216,230,0.75)";
      for (const obj of objects) {
        obj.set({ stroke: null, strokeWidth: 0 });
      }
    }
    canvas.requestRenderAll();
  }, [showLayerEdges, layerEdgeColor]);

  const [view, setView] = useState(getViewSnapshot());
  useEffect(() => {
    return subscribeView(() => setView(getViewSnapshot()));
  }, []);
  const pxRatio = view.pxRatio;
  const proofURL = view.proofOverlayURL;

  useEffect(() => {
    if (!canvasRef.current || !viewportRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: DEFAULT_CANVAS_W,
      height: DEFAULT_CANVAS_H,
      backgroundColor: "white",
      selection: true,
      preserveObjectStacking: true,
    });

    setCanvas(canvas);
    syncCanvasSizeStore(canvas);
    initPathEdit(canvas);
    const history = new HistoryEngine(canvas);
    setHistory(history);
    history.reset();

    const viewport = viewportRef.current!;

    const handleObjectSelected = (event: any) => {
      const object = event.selected?.[0];
      if (!object?.kaypaintId) return;

      const layers = useLayerStore?.getState?.().layers ?? [];
      const layer = layers.find(
        (item: any) => item.objectId === object.kaypaintId
      );

      if (layer) {
        useLayerStore.getState().setActiveLayer(layer.id);
      }
    };

    const handleObjectModified = (event: any) => {
      const object = event.target;
      if (!object) return;
      object.setCoords();
      canvas.requestRenderAll();
      useEditorStore.getState().setSnapGuides([], []);
    };

    const handleSelectionCleared = () => {
      exitPathEdit(canvas);
      exitAllFreeTransforms(canvas);
    };

    const updateZoomDisplay = () => {
      const z = Math.round(canvas.getZoom() * 100);
      setZoom(z);
    };

    const syncRulers = () => {
      if (!topRulerRef.current || !leftRulerRef.current || !cornerRef.current)
        return;
      const z = canvas.getZoom();
      const s = useSettingsStore.getState();

      const tctx = topRulerRef.current.getContext("2d")!;
      tctx.clearRect(0, 0, topRulerRef.current.width, topRulerRef.current.height);
      drawRulerMarkers(tctx, z, topRulerRef.current.width, false, s.gridSize, s.rulerUnit, s.dpi);

      const lctx = leftRulerRef.current.getContext("2d")!;
      lctx.clearRect(0, 0, leftRulerRef.current.width, leftRulerRef.current.height);
      drawRulerMarkers(lctx, z, leftRulerRef.current.height, true, s.gridSize, s.rulerUnit, s.dpi);

      const cctx = cornerRef.current.getContext("2d")!;
      cctx.fillStyle = "#12161f";
      cctx.fillRect(0, 0, 36, 36);
      cctx.strokeStyle = "#3b4358";
      cctx.strokeRect(0, 0, 36, 36);
    };

    const handleWheel = (opt: any) => {
      const e = opt.e as WheelEvent;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const newZoom = Math.max(
          0.1,
          Math.min(8, canvas.getZoom() * (e.deltaY > 0 ? 0.92 : 1.08))
        );
        canvas.zoomToPoint(canvas.getScenePoint(e as any), newZoom);
        canvas.requestRenderAll();
        updateZoomDisplay();
        syncRulers();
      }
    };

    const handleScroll = () => {
      if (!viewportRef.current) return;
      syncRulers();
    };

    const scheduleSave = () => {
      useDocStore.getState().markDirty();
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveDocument({
          canvas,
          layers: useLayerStore.getState().layers,
          guides: useEditorStore.getState().guides,
          groups: useLayerStore.getState().groups,
        });
      }, 800);
    };

    const handleAnyChange = () => scheduleSave();

    const handleMoving = (opt: any) => {
      const obj = opt.target;
      if (!obj || obj.isGuideLine) return;
      const s = useSettingsStore.getState();
      if (!s.snapOn) return;

      const tolerance = Math.max(6, s.gridSize / 4);
      const rect = obj.getBoundingRect();
      const myV = [rect.left, rect.left + rect.width / 2, rect.left + rect.width];
      const myH = [rect.top, rect.top + rect.height / 2, rect.top + rect.height];

      const targetsV: number[] = [];
      const targetsH: number[] = [];

      if (s.snapToBounds) {
        targetsV.push(0, canvas.width);
        targetsH.push(0, canvas.height);
      }

      if (s.snapToGrid && s.gridSize > 0) {
        for (let x = 0; x <= canvas.width; x += s.gridSize) targetsV.push(x);
        for (let y = 0; y <= canvas.height; y += s.gridSize) targetsH.push(y);
      }

      if (s.snapToGuides) {
        const state = useEditorStore.getState();
        for (const g of state.guides) {
          if (g.axis === "v") targetsV.push(g.pos);
          else targetsH.push(g.pos);
        }
        // Object-to-object snapping is O(n) per move; skip it for large
        // documents to keep dragging responsive.
        if (canvas.getObjects().length <= 60) {
          for (const o of canvas.getObjects()) {
            if (o === obj || (o as { isGuideLine?: boolean }).isGuideLine) continue;
            const r = o.getBoundingRect();
            targetsV.push(r.left, r.left + r.width / 2, r.left + r.width);
            targetsH.push(r.top, r.top + r.height / 2, r.top + r.height);
          }
        }
      }

      let dx = 0;
      let dy = 0;
      const snapV: number[] = [];
      const snapH: number[] = [];

      for (const v of myV) {
        for (const t of targetsV) {
          const d = t - v;
          if (Math.abs(d) < tolerance && (Math.abs(d) < Math.abs(dx) || dx === 0)) {
            dx = d;
            if (!snapV.includes(t)) snapV.push(t);
          }
        }
      }

      for (const v of myH) {
        for (const t of targetsH) {
          const d = t - v;
          if (Math.abs(d) < tolerance && (Math.abs(d) < Math.abs(dy) || dy === 0)) {
            dy = d;
            if (!snapH.includes(t)) snapH.push(t);
          }
        }
      }

      if (dx !== 0) {
        obj.left += dx;
        obj.setCoords?.();
      }
      if (dy !== 0) {
        obj.top += dy;
        obj.setCoords?.();
      }

      if (s.snapToGuides) {
        const r2 = obj.getBoundingRect();
        const edgesV = [r2.left, r2.left + r2.width / 2, r2.left + r2.width];
        const edgesH = [r2.top, r2.top + r2.height / 2, r2.top + r2.height];
        useEditorStore.getState().setSnapGuides(
          edgesH
            .map((e) => targetsH.find((t) => Math.abs(t - e) < tolerance) ?? -1)
            .filter((t) => t >= 0),
          edgesV
            .map((e) => targetsV.find((t) => Math.abs(t - e) < tolerance) ?? -1)
            .filter((t) => t >= 0)
        );
      } else {
        useEditorStore.getState().setSnapGuides([], []);
      }
    };

    const handleDblClick = (opt: any) => {
      const target = opt.target;
      if (!target || target.isGuideLine) return;
      if (isEditingPath()) {
        exitPathEdit(canvas);
        return;
      }
      if (target.type === "path" && !target.freeTransformOn) {
        enterPathEdit(canvas, target);
        return;
      }
      const tool = useEditorStore.getState().activeTool;
      if (tool !== "select" && tool !== "move") return;
      toggleFreeTransform(canvas, target);
    };

    canvas.on("selection:created", handleObjectSelected);
    canvas.on("selection:updated", handleObjectSelected);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("mouse:wheel", handleWheel);
    canvas.on("after:render", updateZoomDisplay);
    const handleTransformStartEvt = (ev: any) => handleTransformStart(canvas, ev);
    const handleTransformRotateEvt = (ev: any) => handleTransformRotate(canvas, ev);
    const handleTransformEndEvt = (ev: any) => handleTransformEnd(canvas, ev);

    canvas.on("object:moving", handleMoving);
    canvas.on("mouse:dblclick", handleDblClick);
    canvas.on("before:transform", handleTransformStartEvt);
    canvas.on("object:rotating", handleTransformRotateEvt);
    canvas.on("object:modified", handleTransformEndEvt);

    canvas.on("object:added", handleAnyChange);
    canvas.on("object:removed", handleAnyChange);
    canvas.on("path:created", handleAnyChange);

    // Large images shouldn't be rasterized into a fabric cache canvas on every
    // interactive transform frame — that causes stutter + memory spikes.
    const handleObjectAdded = (opt: any) => {
      const o = opt.target;
      if (o?.type === "image" && (o.width ?? 0) * (o.height ?? 0) > 8_000_000) {
        o.objectCaching = false;
        o.dirty = true;
      }
    };
    canvas.on("object:added", handleObjectAdded);

    const forceRender = () => force((t) => t + 1);
    canvas.on("object:added", forceRender);
    canvas.on("object:removed", forceRender);

    viewport.addEventListener("scroll", handleScroll);

    updateZoomDisplay();
    syncRulers();

    if (hasSavedDoc()) {
      setRestorePrompt(true);
    }

     return () => {
      canvas.off("selection:created", handleObjectSelected);
      canvas.off("selection:updated", handleObjectSelected);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("mouse:wheel", handleWheel);
      canvas.off("after:render", updateZoomDisplay);
      canvas.off("object:moving", handleMoving);
      canvas.off("mouse:dblclick", handleDblClick);
      canvas.off("before:transform", handleTransformStartEvt);
      canvas.off("object:rotating", handleTransformRotateEvt);
      canvas.off("object:modified", handleTransformEndEvt);
      canvas.off("object:added", handleAnyChange);
      canvas.off("object:removed", handleAnyChange);
      canvas.off("path:created", handleAnyChange);
      canvas.off("object:added", handleObjectAdded);
      canvas.off("object:added", forceRender);
      canvas.off("object:removed", forceRender);
      viewport.removeEventListener("scroll", handleScroll);
      setCanvas(null);
      canvas.dispose();
    };
  }, [setCanvas, setHistory]);

  // ---- document switching ----
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;
    const prev = lastDocRef.current;
    if (prev === activeDocId) return;

    if (prev) {
      try {
        useDocStore
          .getState()
          .updateDocData(
            prev,
            JSON.stringify(canvas.toJSON()),
            JSON.stringify(useLayerStore.getState().groups)
          );
      } catch {
        /* noop */
      }
    }

    const doc = useDocStore.getState().docs.find((d) => d.id === activeDocId);
    lastDocRef.current = activeDocId;

    const finish = () => {
      canvas.requestRenderAll();
      useEditorStore.getState().history?.reset?.();
      useDocStore.getState().clearDirty();
    };

    if (doc?.data) {
      canvas
        .loadFromJSON(JSON.parse(doc.data))
        .then(() => {
          if (doc.groups) {
            try {
              useLayerStore.setState({ groups: JSON.parse(doc.groups) });
            } catch {
              useLayerStore.setState({ groups: [] });
            }
          } else {
            useLayerStore.setState({ groups: [] });
          }
          finish();
        })
        .catch(finish);
    } else {
      canvas.getObjects().forEach((o: any) => canvas.remove(o));
      canvas.backgroundColor = "white";
      canvas.discardActiveObject();
      useLayerStore.setState({ layers: [], activeLayer: null, groups: [] });
      finish();
    }
  }, [activeDocId]);

  // ---- restore prompt actions ----
  const handleRestore = () => {
    const canvas = useEditorStore.getState().canvas;
    const saved = loadSavedDoc();
    if (!canvas || !saved) {
      setRestorePrompt(false);
      return;
    }
    canvas
      .loadFromJSON(saved.canvas)
      .then(() => {
        useLayerStore.setState({
          layers: saved.layers ?? [],
          activeLayer: null,
          groups: saved.groups ?? [],
        });
        useEditorStore.setState({ guides: saved.guides ?? [] });
        canvas.requestRenderAll();
      })
      .catch((err: any) => console.error("restore failed", err));
    setRestorePrompt(false);
  };

  const handleDiscard = () => {
    clearSavedDoc();
    setRestorePrompt(false);
  };

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      const c = useEditorStore.getState().canvas;
      if (!c) return;
      try {
        const data = c.toDataURL({ format: "png", multiplier: 1 });
        const { buildCmykPreview } = await import("@/engine/colorEngine");
        const result = await buildCmykPreview(data, {
          renderingIntent: "relative",
          gamutOverlay: true,
        });
        if (!cancelled) setGamutOverlay(result.gamutOverlay ?? null);
      } catch {
        if (!cancelled) setGamutOverlay(null);
      }
    };
    if (gamutWarning) {
      build();
    } else {
      setGamutOverlay(null);
    }
    return () => {
      cancelled = true;
    };
  }, [gamutWarning, setGamutOverlay]);

  useEffect(() => {
    if (!topRulerRef.current || !leftRulerRef.current || !cornerRef.current)
      return;
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;
    const z = canvas.getZoom();
    const s = useSettingsStore.getState();
    const tctx = topRulerRef.current.getContext("2d")!;
    tctx.clearRect(0, 0, topRulerRef.current.width, topRulerRef.current.height);
    drawRulerMarkers(tctx, z, topRulerRef.current.width, false, s.gridSize, s.rulerUnit, s.dpi);
    const lctx = leftRulerRef.current.getContext("2d")!;
    lctx.clearRect(0, 0, leftRulerRef.current.width, leftRulerRef.current.height);
    drawRulerMarkers(lctx, z, leftRulerRef.current.height, true, s.gridSize, s.rulerUnit, s.dpi);
    const cctx = cornerRef.current.getContext("2d")!;
    cctx.fillStyle = "#12161f";
    cctx.fillRect(0, 0, 36, 36);
    cctx.strokeStyle = "#3b4358";
    cctx.strokeRect(0, 0, 36, 36);
  }, [showRulers, gridSize, rulerUnit, dpi, proofColorsOn, view]);

  useEffect(() => {
    if (!proofColorsOn) {
      setProofOverlayURL(null);
      return;
    }
    void runProofPreview();
  }, [proofColorsOn, proofMode]);

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas;
    if (!canvas) return;
    canvas.selection = showSelectionEdges;
    canvas.requestRenderAll();
  }, [showSelectionEdges, view]);

  useEffect(() => {
    applyScreenClasses(screenMode);
  }, [screenMode]);

  // ---- marching-ants selection overlay ----
  useEffect(() => {
    const el = antsRef.current;
    const canvas = useEditorStore.getState().canvas;
    if (!el || !canvas) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    el.width = canvas.width || DEFAULT_CANVAS_W;
    el.height = canvas.height || DEFAULT_CANVAS_H;

    let path: Path2D | null = null;
    let lastBuild = 0;
    let raf = 0;

    const build = () => {
      const c = buildContour(canvas);
      path = c ? contourToPath(c) : null;
    };
    build();

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const loop = (t: number) => {
      // Re-reading the whole active image is wasteful on large documents;
      // only poll periodically for reasonably-sized images, so selection-tool
      // alpha edits still surface without reading 4K+ images every frame.
      const obj = canvas.getActiveObject?.();
      const big = obj?.type === "image" && (obj.width ?? 0) * (obj.height ?? 0) > 8_000_000;
      const now = performance.now();
      if (!big && now - lastBuild > 1200) {
        lastBuild = now;
        build();
        if (!path) {
          stop();
          ctx.clearRect(0, 0, el.width, el.height);
          return;
        }
      }
      ctx.clearRect(0, 0, el.width, el.height);
      if (path) {
        ctx.save();
        ctx.setTransform(canvas.viewportTransform);
        drawAnts(ctx, path, t / 16);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };

    const invalidate = () => {
      lastBuild = 0;
      build();
      if (path && !raf) raf = requestAnimationFrame(loop);
      if (!path) {
        stop();
        ctx.clearRect(0, 0, el.width, el.height);
      }
    };

    if (path) raf = requestAnimationFrame(loop);
    canvas.on("selection:created", invalidate);
    canvas.on("selection:updated", invalidate);
    canvas.on("selection:cleared", invalidate);

    return () => {
      stop();
      canvas.off("selection:created", invalidate);
      canvas.off("selection:updated", invalidate);
      canvas.off("selection:cleared", invalidate);
    };
  }, []);

  const z = zoom / 100;

  const guidePos = (g: { axis: "h" | "v"; pos: number }) => g.pos * z;

  const canvasNowInternal = useEditorStore.getState().canvas;
  const transformObj = transformObjectId
    ? canvasNowInternal
        ?.getObjects()
        .find(
          (o: any) =>
            (o.kaypaintId ?? o.id) === transformObjectId && o.freeTransformOn
        ) ?? null
    : null;

  const startPivotDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!transformObj) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const zf = z || 1;
    e.currentTarget.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      transformObj.freePivotScene = {
        x: Math.round(((ev.clientX - rect.left) / zf) * 10) / 10,
        y: Math.round(((ev.clientY - rect.top) / zf) * 10) / 10,
      };
      force((t) => t + 1);
    };

    const up = () => {
      e.currentTarget.removeEventListener("pointermove", move);
      e.currentTarget.removeEventListener("pointerup", up);
    };

    e.currentTarget.addEventListener("pointermove", move);
    e.currentTarget.addEventListener("pointerup", up);
  };

  const startGuideDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    axis: "h" | "v"
  ) => {
    if (e.button !== 0) return;
    if (getViewSnapshot().lockGuides) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const zf = z || 1;
    const getPos = (ev: PointerEvent) =>
      axis === "v"
        ? (ev.clientX - rect.left) / zf
        : (ev.clientY - rect.top) / zf;

    e.currentTarget.setPointerCapture(e.pointerId);
    guideDragRef.current = { axis, active: true };

    const move = (ev: PointerEvent) => {
      if (!guideDragRef.current?.active) return;
      if (getViewSnapshot().lockGuides) return;
      const pos = Math.round(getPos(ev) * 10) / 10;
      if (axis === "v") {
        const cur = useEditorStore
          .getState()
          .guides.find((g) => g.axis === "v" && g.pos === -1);
        if (cur) useEditorStore.getState().updateGuide("v", -1, pos);
        else {
          useEditorStore.getState().addGuide("v", -1);
          useEditorStore.getState().updateGuide("v", -1, pos);
        }
      } else {
        const cur = useEditorStore
          .getState()
          .guides.find((g) => g.axis === "h" && g.pos === -1);
        if (cur) useEditorStore.getState().updateGuide("h", -1, pos);
        else {
          useEditorStore.getState().addGuide("h", -1);
          useEditorStore.getState().updateGuide("h", -1, pos);
        }
      }
    };

    const up = (ev: PointerEvent) => {
      guideDragRef.current = null;
      const canvas = useEditorStore.getState().canvas;
      const pos = Math.round(getPos(ev) * 10) / 10;
      if (axis === "v") {
        if (!canvas || pos < -60 || pos > canvas.width + 60) {
          useEditorStore.getState().removeGuide("v", -1);
        } else {
          useEditorStore.getState().updateGuide("v", -1, pos);
        }
      } else {
        if (!canvas || pos < -60 || pos > canvas.height + 60) {
          useEditorStore.getState().removeGuide("h", -1);
        } else {
          useEditorStore.getState().updateGuide("h", -1, pos);
        }
      }
      e.currentTarget.removeEventListener("pointermove", move);
      e.currentTarget.removeEventListener("pointerup", up);
    };

    e.currentTarget.addEventListener("pointermove", move);
    e.currentTarget.addEventListener("pointerup", up);
  };

  const startGuideObjectDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    g: { axis: "h" | "v"; pos: number }
  ) => {
    if (e.button !== 0) return;
    if (getViewSnapshot().lockGuides) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const zf = z || 1;
    const getPos = (ev: PointerEvent) =>
      g.axis === "v"
        ? (ev.clientX - rect.left) / zf
        : (ev.clientY - rect.top) / zf;

    e.currentTarget.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      if (getViewSnapshot().lockGuides) return;
      const pos = Math.round(getPos(ev) * 10) / 10;
      useEditorStore.getState().updateGuide(g.axis, g.pos, pos);
    };

    const up = (ev: PointerEvent) => {
      const canvas = useEditorStore.getState().canvas;
      const pos = Math.round(getPos(ev) * 10) / 10;
      if (!canvas || pos < -60 || pos > (g.axis === "v" ? canvas.width : canvas.height) + 60) {
        useEditorStore.getState().removeGuide(g.axis, pos);
      } else {
        useEditorStore.getState().updateGuide(g.axis, g.pos, pos);
      }
      e.currentTarget.removeEventListener("pointermove", move);
      e.currentTarget.removeEventListener("pointerup", up);
    };

    e.currentTarget.addEventListener("pointermove", move);
    e.currentTarget.addEventListener("pointerup", up);
  };

  const wrapStyle: React.CSSProperties =
    screenMode === "full"
      ? { position: "fixed", left: 0, right: 0, top: 0, bottom: 0, zIndex: 60, background: "#000" }
      : screenMode === "menufull"
        ? { position: "fixed", left: 0, right: 0, top: 36, bottom: 0, zIndex: 60, background: "#000" }
        : { background: "#1a2130" };

  return (
    <div
      className="flex flex-col relative bg-gray-800 min-w-0"
      style={wrapStyle}
    >
      {showRulers && (
        <div
          ref={topRulerRowRef}
          className="flex h-5 border-b border-gray-700 bg-gray-900 flex-shrink-0 cursor-ns-resize"
          onPointerDown={(e) => startGuideDrag(e, "h")}
        >
          <canvas
            ref={cornerRef}
            width={20}
            height={20}
            className="border-r border-gray-700 flex-shrink-0"
          />
          <div className="flex-1 overflow-hidden relative">
            <canvas
              ref={topRulerRef}
              height={20}
              style={{
                width: "100%",
                minWidth: `${(canvasW * zoom * pxRatio) / 100 + 72}px`,
                display: "block",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-0 overflow-hidden relative">
        {showRulers && (
          <div
            ref={leftRulerColRef}
            className="w-5 border-r border-gray-700 bg-gray-900 flex-shrink-0 overflow-hidden relative cursor-ew-resize"
            onPointerDown={(e) => startGuideDrag(e, "v")}
          >
            <canvas
              ref={leftRulerRef}
              width={20}
              style={{ height: "100%", display: "block" }}
            />
          </div>
        )}

        <div
          ref={viewportRef}
          className="flex-1 overflow-auto relative"
          style={
            screenMode === "standard"
              ? { background: "#1a2130" }
              : { background: "#000", display: "flex" }
          }
        >
          <div
            ref={wrapperRef}
            id="kaypaint-canvas-wrap"
            style={{
              width: `${((canvasW * zoom) / 100 + 72) * pxRatio}px`,
              height: `${(canvasH * zoom) / 100}px`,
              position: "relative",
              margin: screenMode === "standard" ? undefined : "auto",
              transform: `scaleX(${pxRatio}) rotate(${viewRotate}deg)`,
              transformOrigin: "left top",
            }}
          >
            <canvas ref={canvasRef} style={{ display: "block" }} />
            <canvas
              ref={antsRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ width: `${canvasW}px`, height: `${canvasH}px` }}
            />

            {gamutOverlayURL && (
              <img
                src={gamutOverlayURL}
                alt="Gamut warning overlay"
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: `${canvasW * z}px`,
                  height: `${canvasH * z}px`,
                  mixBlendMode: "multiply",
                }}
                draggable={false}
              />
            )}

            {showGrid && (
              <div
                className="absolute top-0 left-0 pointer-events-none opacity-40"
                style={{
                  width: `${canvasW * z}px`,
                  height: `${canvasH * z}px`,
                  backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                }}
              />
            )}

            {proofColorsOn && proofURL && (
              <img
                src={proofURL}
                alt="Proof colors preview"
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: `${canvasW * z}px`,
                  height: `${canvasH * z}px`,
                }}
                draggable={false}
              />
            )}

            {showSlices &&
              (() => {
                const c = useEditorStore.getState().canvas;
                const objs = c?.getObjects() ?? [];
                return objs
                  .filter((o: any) => (o as { name?: string }).name === "Slice")
                  .map((o: any, i: number) => {
                    const r = o.getBoundingRect();
                    return (
                      <div
                        key={`slice${i}`}
                        className="absolute pointer-events-none border border-red-400/70"
                        style={{
                          left: r.left * z,
                          top: r.top * z,
                          width: r.width * z,
                          height: r.height * z,
                        }}
                      />
                    );
                  });
              })()}

            {showGuides &&
              guides.map((g, i) =>
                g.axis === "v" ? (
                  <div
                    key={`v${i}`}
                    className="absolute cursor-ew-resize z-20"
                    style={{
                      left: guidePos(g) - 0.75,
                      top: 0,
                      bottom: 0,
                      width: 1.5,
                      background: guideColor,
                      opacity: 0.9,
                    }}
                    onPointerDown={(e) => startGuideObjectDrag(e, g)}
                  />
                ) : (
                  <div
                    key={`h${i}`}
                    className="absolute cursor-ns-resize z-20"
                    style={{
                      top: guidePos(g) - 0.75,
                      left: 0,
                      right: 0,
                      height: 1.5,
                      background: guideColor,
                      opacity: 0.9,
                    }}
                    onPointerDown={(e) => startGuideObjectDrag(e, g)}
                  />
                )
              )}

            {snapGuides.v.map((p, i) => (
              <div
                key={`sv${i}`}
                className="absolute bg-[#f06595] z-10"
                style={{ left: p * z - 0.75, top: 0, bottom: 0, width: 1.5 }}
              />
            ))}
            {snapGuides.h.map((p, i) => (
              <div
                key={`sh${i}`}
                className="absolute bg-[#f06595] z-10"
                style={{ top: p * z - 0.75, left: 0, right: 0, height: 1.5 }}
              />
            ))}

            {transformObj && (
              <div
                title="Drag to move transform pivot"
                className="absolute z-30 w-4 h-4 rounded-full border-2 border-indigo-200 bg-[#a7b1ff]/90 shadow-[0_0_10px_rgba(167,177,255,0.9)] cursor-crosshair"
                style={{
                  left: getPivotScene(transformObj).x * z - 8,
                  top: getPivotScene(transformObj).y * z - 8,
                }}
                onPointerDown={startPivotDrag}
              >
                <div className="absolute left-1/2 top-1/2 w-px h-6 bg-indigo-200/80 pointer-events-none -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute left-1/2 top-1/2 h-px w-6 bg-indigo-200/80 pointer-events-none -translate-x-1/2 -translate-y-1/2" />
              </div>
            )}

            {notes.map((n) => (
              <div
                key={n.id}
                title={n.text || "Note"}
                onClick={() => void editNote(n.id)}
                className="absolute z-20 cursor-pointer select-none"
                style={{ left: n.x * z, top: n.y * z }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-amber-300 bg-amber-500/90 shadow-[0_0_8px_rgba(245,158,11,0.8)] text-amber-950 text-[13px] font-black flex items-center justify-center">
                  ✎
                </div>
                {n.text && (
                  <div className="absolute left-7 top-0 max-w-44 bg-amber-50/95 text-gray-900 text-[10px] leading-tight rounded px-1.5 py-1 shadow whitespace-pre-wrap pointer-events-none">
                    {n.text}
                  </div>
                )}
              </div>
            ))}

            {counts.map((c) => (
              <div
                key={c.id}
                className="absolute z-20 pointer-events-none select-none w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-cyan-500/90 text-cyan-950 text-[11px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                style={{ left: c.x * z, top: c.y * z }}
              >
                {c.n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {restorePrompt && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-800/95 backdrop-blur border border-indigo-400/40 shadow-2xl shadow-black/50 text-xs">
          <span className="text-gray-200">
            A saved project was found — restore it?
          </span>
          <button
            onClick={handleRestore}
            className="px-3 py-1 rounded-lg accent-gradient text-white font-semibold shadow-lg shadow-indigo-500/30 hover:brightness-110"
          >
            Restore
          </button>
          <button
            onClick={handleDiscard}
            className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}