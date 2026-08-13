/**
 * Browser glue for the plugin runtime.
 *
 * Bridges the pure sandbox core (pluginRuntimeCore.ts) to the actual
 * kaypaint engine: it implements the PluginAPI against the real stores
 * (editorStore, layerStore, featuresStore, settingsStore), provides a
 * namespaced storage backend and an in-memory event bus, and manages
 * plugin lifecycle (load / enable / disable) while routing every call
 * through the plugin's permission set.
 *
 * Browser-only (imports fabric-backed modules via the @/ alias), so it is
 * verified with tsc + eslint rather than node tests.
 */

import {
  createPluginSandbox,
  requirePermission,
  type PluginManifest,
  type PluginContext,
  type PluginAPI,
  type PluginPermission,
  type PluginStorage,
  type PluginEventBus,
  type CanvasInfo,
  type PixelImage,
  type SvgInsertOptions,
  type TextStyleInfo,
  type TextStylePatch,
  type NetworkResponse,
  type LayerInfo,
  type ToolConfig,
  type ToolbarButtonConfig,
  type MenuItemConfig,
  type SandboxResult,
} from "@/engine/pluginRuntimeCore";
import { useEditorStore } from "@/store/editorStore";
import { useLayerStore, syncVisibility } from "@/store/layerStore";
import { useFeaturesStore } from "@/store/featuresStore";
import { usePluginStore } from "@/store/pluginStore";
import { PLUGIN_CATALOG } from "@/engine/pluginCatalog";
import { canvasNow, histNow } from "@/utils/menuUtils";
import { applyFilter } from "@/engine/filterEngine";
import { playAction } from "@/engine/actionsEngine";
import { readActivePixels, applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { useAnimationStore } from "@/store/animationStore";
import { startPlayback, stopPlayback, seekAndApply } from "@/engine/animationEngine";
import { placeVideoClipDialog } from "@/engine/movieLayerEngine";
import { exportVideo as exportVideoEngine } from "@/engine/videoExport";

/* ------------------------------------------------------------------ *
 * Generic framing
 * ------------------------------------------------------------------ */

function toLayerInfo(l: { id: string; name: string; visible: boolean; locked: boolean; opacity: number; blendMode: string }, index: number): LayerInfo {
  return {
    id: l.id,
    name: l.name,
    visible: l.visible,
    locked: l.locked,
    opacity: l.opacity,
    blendMode: l.blendMode,
    index,
  };
}

/* ------------------------------------------------------------------ *
 * Storage (namespaced localStorage)
 * ------------------------------------------------------------------ */

export function createPluginStorage(pluginId: string, store: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> = localStorage): PluginStorage {
  const prefix = `kaypaint:plugin:${pluginId}:`;
  return {
    async get(key) {
      return store.getItem(prefix + key);
    },
    async set(key, value) {
      store.setItem(prefix + key, value);
    },
    async delete(key) {
      store.removeItem(prefix + key);
    },
    async clear() {
      const keep: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k !== null) keep.push(k);
      }
      for (const k of keep) {
        if (k.startsWith(prefix)) store.removeItem(k);
      }
    },
    async keys() {
      const out: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k !== null && k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
      return out;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Events (in-memory bus)
 * ------------------------------------------------------------------ */

export function createPluginEventBus(): PluginEventBus {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  function subscribe(event: string, handler: (...args: unknown[]) => void): () => void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }
  return {
    on: (event, handler) => subscribe(event, handler),
    once(event, handler) {
      const off = subscribe(event, (...args) => {
        off();
        handler(...args);
      });
      return off;
    },
    emit(event, ...args) {
      for (const h of [...(handlers.get(event) ?? [])]) {
        try {
          h(...args);
        } catch {
          /* plugin handler error - do not break the host */
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * Host API
 * ------------------------------------------------------------------ */

function perm(ctx: PluginContext, p: PluginPermission) {
  requirePermission(ctx, p);
}

export function createHostAPI(getCtx: () => PluginContext, mgr: PluginManager): PluginAPI {
  const ctx = getCtx();
  const api: PluginAPI = {
    canvas: {
      getInfo(): CanvasInfo {
        perm(ctx, "canvas.read");
        const ed = useEditorStore.getState();
        const canvas = ed.canvas;
        const zoom = typeof canvas?.getZoom === "function" ? canvas.getZoom() : 1;
        const rotation = useFeaturesStore.getState().viewRotate || 0;
        const width = canvas?.width ?? ed.canvasW;
        const height = canvas?.height ?? ed.canvasH;
        return { width, height, zoom, rotation };
      },
      getDataURL(format = "png", quality?: number): string {
        perm(ctx, "canvas.read");
        const canvas = canvasNow();
        if (!canvas || typeof canvas.toDataURL !== "function") return "";
        return canvas.toDataURL({
          format,
          quality: quality ?? 1,
          multiplier: 1,
          enableRetinaScaling: false,
        });
      },
      async toBlob(mimeType = "image/png", quality?: number): Promise<Blob> {
        perm(ctx, "canvas.read");
        const dataUrl = api.canvas.getDataURL(mimeType.split("/")[1] ?? "png", quality);
        if (!dataUrl) throw new Error("canvas unavailable");
        const res = await fetch(dataUrl);
        return res.blob();
      },
      readPixels(maxPixels = 4_000_000): PixelImage | null {
        perm(ctx, "canvas.read");
        const read = readActivePixels(canvasNow());
        if (!read) return null;
        const total = read.width * read.height;
        if (total > maxPixels || total <= 0) return null;
        return { width: read.width, height: read.height, data: Array.from(read.data) };
      },
      async writePixels(pixels: PixelImage): Promise<boolean> {
        perm(ctx, "canvas.write");
        if (!pixels || !Array.isArray(pixels.data)) return false;
        const expected = pixels.width * pixels.height * 4;
        if (pixels.data.length !== expected || expected <= 0) return false;
        const canvas = canvasNow();
        if (!canvas) return false;
        const read = readActivePixels(canvas);
        if (!read || read.width !== pixels.width || read.height !== pixels.height) return false;
        const ok = await applyPixelsToActiveLayer(canvas, (out) => {
          out.set(pixels.data);
        });
        if (ok) histNow()?.push?.(`Plugin pixel edit (${pixels.width}x${pixels.height})`);
        return ok;
      },
      async replaceActivePixels(pixels: PixelImage): Promise<boolean> {
        perm(ctx, "canvas.write");
        if (!pixels || !Array.isArray(pixels.data)) return false;
        const expected = pixels.width * pixels.height * 4;
        if (pixels.data.length !== expected || expected <= 0) return false;
        if (pixels.width > 8192 || pixels.height > 8192) return false;
        const canvas = canvasNow();
        if (!canvas) return false;
        const obj = canvas.getActiveObject?.();
        if (!obj) return false;
        try {
          const c = document.createElement("canvas");
          c.width = pixels.width;
          c.height = pixels.height;
          c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
          const newEl = document.createElement("img");
          newEl.src = c.toDataURL("image/png");
          await new Promise<void>((res) => {
            newEl.onload = () => res();
            newEl.onerror = () => res();
          });
          const prevLeft = obj.left;
          const prevTop = obj.top;
          const prevScaleX = obj.scaleX;
          const prevScaleY = obj.scaleY;
          const prevAngle = obj.angle;
          const prevOpacity = obj.opacity;
          const prevVisible = obj.visible;
          const prevId = obj.kaypaintId ?? obj.id;
          obj.setElement(newEl);
          obj.set({
            left: prevLeft,
            top: prevTop,
            scaleX: prevScaleX,
            scaleY: prevScaleY,
            angle: prevAngle,
            opacity: prevOpacity,
            visible: prevVisible,
          });
          if (prevId !== undefined) obj.kaypaintId = prevId;
          obj.setCoords?.();
          canvas.requestRenderAll?.();
          histNow()?.push?.(`Plugin: resized pixels to ${pixels.width}x${pixels.height}`);
          return true;
        } catch (err) {
          console.error("[pluginRuntime] replaceActivePixels failed:", err);
          return false;
        }
      },
      async addImage(dataUrl: string, options: SvgInsertOptions = {}): Promise<boolean> {
        perm(ctx, "canvas.write");
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) return false;
        const canvas = canvasNow();
        if (!canvas) return false;
        try {
          const { Image: FabricImage } = await import("fabric");
          const img = await FabricImage.fromURL(dataUrl);
          img.set({
            left: options.left ?? canvas.width / 2,
            top: options.top ?? canvas.height / 2,
            originX: "center",
            originY: "center",
            scaleX: options.scale ?? 1,
            scaleY: options.scale ?? 1,
          });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.requestRenderAll();
          if (options.name) {
            img.set({ name: options.name });
            const s = useLayerStore.getState();
            if (typeof s.addLayer === "function") {
              s.addLayer();
              const fresh = useLayerStore.getState();
              if (typeof fresh.renameLayer === "function" && fresh.activeLayer) fresh.renameLayer(fresh.activeLayer, options.name);
            }
          }
          histNow()?.push?.(`Plugin: added ${options.name ?? "image"}`);
          return true;
        } catch (err) {
          console.error("[pluginRuntime] addImage failed:", err);
          return false;
        }
      },
      async addSvg(svg: string, options: SvgInsertOptions = {}): Promise<boolean> {
        perm(ctx, "canvas.write");
        if (!svg || typeof svg !== "string") return false;
        const canvas = canvasNow();
        if (!canvas) return false;
        try {
          const { loadSVGFromString, Group } = await import("fabric");
          const parsed = await loadSVGFromString(svg);
          const objects = (parsed?.objects ?? []).filter(Boolean);
          if (!objects.length) return false;
          const group = new Group(objects as never[]);
          group.set({
            left: options.left ?? canvas.width / 2,
            top: options.top ?? canvas.height / 2,
            scaleX: options.scale ?? 1,
            scaleY: options.scale ?? 1,
          });
          group.originX = "center";
          group.originY = "center";
          canvas.add(group);
          canvas.setActiveObject(group);
          canvas.requestRenderAll();
          if (options.name) {
            group.set({ name: options.name });
            const s = useLayerStore.getState();
            if (typeof s.addLayer === "function") {
              s.addLayer();
              const fresh = useLayerStore.getState();
              if (typeof fresh.renameLayer === "function" && fresh.activeLayer) fresh.renameLayer(fresh.activeLayer, options.name);
            }
          }
          histNow()?.push?.(`Plugin: added ${options.name ?? "SVG object"}`);
          return true;
        } catch (err) {
          console.error("[pluginRuntime] addSvg failed:", err);
          return false;
        }
      },
      async replaceActiveImage(dataUrl: string): Promise<boolean> {
        perm(ctx, "canvas.write");
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) return false;
        const canvas = canvasNow();
        const obj = canvas?.getActiveObject?.();
        if (!canvas || !obj || obj.type !== "image") return false;
        try {
          const { Image: FabricImage } = await import("fabric");
          const img = await FabricImage.fromURL(dataUrl);
          const prev = {
            left: obj.left, top: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            angle: obj.angle, opacity: obj.opacity, visible: obj.visible,
          };
          obj.setElement(img.getElement());
          obj.set(prev);
          obj.setCoords?.();
          canvas.requestRenderAll?.();
          histNow()?.push?.(`Plugin: AI replaced image`);
          return true;
        } catch (err) {
          console.error("[pluginRuntime] replaceActiveImage failed:", err);
          return false;
        }
      },
      async pathfinder(op: "union" | "intersect" | "subtract"): Promise<boolean> {
        perm(ctx, "canvas.write");
        const { applyPathfinder } = await import("@/engine/pathfinder");
        return applyPathfinder(canvasNow(), op);
      },
      setFill(color: string): boolean {
        perm(ctx, "canvas.write");
        const obj = canvasNow()?.getActiveObject?.();
        if (!obj || typeof color !== "string") return false;
        obj.set({ fill: color });
        obj.canvas?.requestRenderAll?.();
        histNow()?.push?.(`Plugin: fill ${color}`);
        return true;
      },
    },

    layers: {
      getAll(): LayerInfo[] {
        perm(ctx, "layers.read");
        const s = useLayerStore.getState();
        return s.layers.map((l, i) => toLayerInfo(l, i));
      },
      getById(id: string): LayerInfo | null {
        perm(ctx, "layers.read");
        const s = useLayerStore.getState();
        const idx = s.layers.findIndex((l) => l.id === id);
        return idx < 0 ? null : toLayerInfo(s.layers[idx], idx);
      },
      getActive(): LayerInfo | null {
        perm(ctx, "layers.read");
        const s = useLayerStore.getState();
        if (!s.activeLayer) return null;
        const idx = s.layers.findIndex((l) => l.id === s.activeLayer);
        return idx < 0 ? null : toLayerInfo(s.layers[idx], idx);
      },
      setActive(id: string): boolean {
        perm(ctx, "layers.write");
        const s = useLayerStore.getState();
        if (!s.layers.some((l) => l.id === id)) return false;
        s.setActiveLayer(id);
        return true;
      },
      create(name: string): Promise<LayerInfo> {
        perm(ctx, "layers.create");
        const s = useLayerStore.getState();
        s.addLayer();
        const id = useLayerStore.getState().activeLayer;
        if (!id) return Promise.reject(new Error("layers.create failed to allocate a layer"));
        if (name) useLayerStore.getState().renameLayer(id, name);
        const fresh = useLayerStore.getState();
        const idx = fresh.layers.findIndex((l) => l.id === id);
        const layer = fresh.layers[idx] ?? {
          id,
          name: name || "New Layer",
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: "normal",
        };
        return Promise.resolve(toLayerInfo(layer, Math.max(idx, 0)));
      },
      delete(id: string): boolean {
        perm(ctx, "layers.delete");
        const s = useLayerStore.getState();
        if (!s.layers.some((l) => l.id === id)) return false;
        s.removeLayer(id);
        return true;
      },
      setVisibility(id: string, visible: boolean): boolean {
        perm(ctx, "layers.write");
        const s = useLayerStore.getState();
        if (!s.layers.some((l) => l.id === id)) return false;
        const layers = s.layers.map((l) => (l.id === id ? { ...l, visible } : l));
        useLayerStore.setState({ layers });
        syncVisibility(canvasNow(), layers, useLayerStore.getState().groups);
        return true;
      },
      setOpacity(id: string, opacity: number): boolean {
        perm(ctx, "layers.write");
        const s = useLayerStore.getState();
        if (!s.layers.some((l) => l.id === id)) return false;
        s.setOpacity(id, opacity);
        return true;
      },
      setBlendMode(id: string, mode: string): boolean {
        perm(ctx, "layers.write");
        const s = useLayerStore.getState();
        if (!s.layers.some((l) => l.id === id)) return false;
        s.setBlendMode(id, mode);
        return true;
      },
      reorder(id: string, newIndex: number): boolean {
        perm(ctx, "layers.write");
        const s = useLayerStore.getState();
        const from = s.layers.findIndex((l) => l.id === id);
        if (from < 0) return false;
        const layers = [...s.layers];
        const [moved] = layers.splice(from, 1);
        const clamp = Math.max(0, Math.min(newIndex, layers.length));
        layers.splice(clamp, 0, moved);
        useLayerStore.setState({ layers });
        return true;
      },
    },

    history: {
      get canUndo() {
        perm(ctx, "history.read");
        return histNow()?.canUndo ?? false;
      },
      get canRedo() {
        perm(ctx, "history.read");
        return histNow()?.canRedo ?? false;
      },
      undo() {
        perm(ctx, "history.write");
        histNow()?.undo?.();
      },
      redo() {
        perm(ctx, "history.write");
        histNow()?.redo?.();
      },
      getStack() {
        perm(ctx, "history.read");
        const hs = histNow();
        const stack = hs?.historyStack ?? [];
        return stack.map((s: { id: number; name: string; timestamp: number }) => ({
          id: s.id,
          name: s.name,
          timestamp: s.timestamp,
        }));
      },
      jumpTo(index: number) {
        perm(ctx, "history.write");
        histNow()?.jumpTo?.(index);
      },
    },

    text: {
      getActive(): TextStyleInfo | null {
        perm(ctx, "text.read");
        const obj = canvasNow()?.getActiveObject?.();
        if (!obj) return null;
        const isText = obj.type === "i-text" || obj.type === "i-textbox" || obj.type === "text";
        if (!isText) return null;
        return {
          isText: true,
          type: obj.type,
          text: String(obj.text ?? ""),
          fontFamily: String(obj.fontFamily ?? "Arial"),
          fontSize: Number(obj.fontSize ?? 24),
          fontWeight: String(obj.fontWeight ?? "normal"),
          fontStyle: String(obj.fontStyle ?? "normal"),
          letterSpacing: Number(obj.letterSpacing ?? obj.charSpacing ?? 0),
          fill: String(obj.fill ?? "#000000"),
          textAlign: String(obj.textAlign ?? "left"),
          lineHeight: Number(obj.lineHeight ?? 1.2),
        };
      },
      setStyle(patch: TextStylePatch): boolean {
        perm(ctx, "text.write");
        const obj = canvasNow()?.getActiveObject?.();
        if (!obj) return false;
        const isText = obj.type === "i-text" || obj.type === "i-textbox" || obj.type === "text";
        if (!isText) return false;
        const props: Record<string, unknown> = {};
        if (patch.fontFamily !== undefined) props.fontFamily = patch.fontFamily;
        if (patch.fontSize !== undefined) props.fontSize = patch.fontSize;
        if (patch.fontWeight !== undefined) props.fontWeight = patch.fontWeight;
        if (patch.fontStyle !== undefined) props.fontStyle = patch.fontStyle;
        if (patch.letterSpacing !== undefined) props.letterSpacing = patch.letterSpacing;
        if (patch.fill !== undefined) props.fill = patch.fill;
        if (patch.textAlign !== undefined) props.textAlign = patch.textAlign;
        if (patch.lineHeight !== undefined) props.lineHeight = patch.lineHeight;
        if (Object.keys(props).length === 0) return false;
        obj.set(props);
        obj.setCoords?.();
        canvasNow()?.requestRenderAll?.();
        histNow()?.push?.("Plugin text style");
        return true;
      },
    },

    actions: {
      getAll() {
        perm(ctx, "actions.read");
        return Object.values(useFeaturesStore.getState().actions).map((a) => ({
          id: a.id,
          name: a.name,
          steps: a.steps,
        }));
      },
      async run(actionId: string) {
        perm(ctx, "actions.run");
        const action = useFeaturesStore.getState().actions[actionId];
        if (!action) return false;
        return playAction(canvasNow(), action, false);
      },
    },

    filters: {
      getAvailable(): string[] {
        perm(ctx, "filters.read");
        return [
          "blur", "brightness", "grayscale", "sepia", "invert", "pixelate",
          "noise", "vintage", "kodachrome", "polaroid", "brownie", "saturation", "contrast",
        ];
      },
      async apply(filterName: string, params: Record<string, unknown>) {
        perm(ctx, "filters.apply");
        const object = canvasNow()?.getActiveObject?.();
        if (!object) return false;
        applyFilter(object, filterName, params);
        histNow()?.push?.(`Filter: ${filterName}`);
        return true;
      },
    },

    tools: {
      register(id: string, config: ToolConfig) {
        perm(ctx, "tools.register");
        mgr.registerTool(ctx.manifest.id, id, config);
      },
      unregister(id: string) {
        perm(ctx, "tools.register");
        mgr.unregisterTool(ctx.manifest.id, id);
      },
      setActive(toolId: string): boolean {
        perm(ctx, "tools.register");
        try {
          useEditorStore.getState().setTool(toolId as never);
          return true;
        } catch {
          return false;
        }
      },
    },

    ui: {
      addToolbarButton(config: ToolbarButtonConfig) {
        perm(ctx, "ui.toolbar");
        mgr.addToolbarButton(ctx.manifest.id, config);
      },
      removeToolbarButton(id: string) {
        perm(ctx, "ui.toolbar");
        mgr.removeToolbarButton(ctx.manifest.id, id);
      },
      addMenuItem(menu: string, config: MenuItemConfig) {
        perm(ctx, "ui.menu");
        mgr.addMenuItem(ctx.manifest.id, menu, config);
      },
      removeMenuItem(menu: string, id: string) {
        perm(ctx, "ui.menu");
        mgr.removeMenuItem(ctx.manifest.id, menu, id);
      },
      createPanel(id: string, title: string, content: string) {
        perm(ctx, "ui.panel");
        mgr.addPanel(ctx.manifest.id, id, title, content);
      },
      removePanel(id: string) {
        perm(ctx, "ui.panel");
        mgr.removePanel(ctx.manifest.id, id);
      },
      onPanelAction(panelId: string, action: string, handler: (value: string) => void) {
        perm(ctx, "ui.panel");
        mgr.registerPanelAction(ctx.manifest.id, panelId, action, handler);
      },
      showNotification(message: string, type: "info" | "warning" | "error" = "info") {
        mgr.notify(ctx.manifest.id, type, message);
      },
    },

    network: {
      async request(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<NetworkResponse> {
        perm(ctx, "network.fetch");
        try {
          const res = await fetch(url, {
            method: init?.method ?? "GET",
            headers: init?.headers,
            body: init?.body,
          });
          const text = await res.text();
          let data: unknown = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = null;
          }
          return { ok: res.ok, status: res.status, json: () => data };
        } catch {
          return { ok: false, status: 0, json: () => null };
        }
      },
    },

    file: {
      async exportPSD(filename = "kaypaint.psd", options?: { cmyk?: boolean }): Promise<boolean> {
        perm(ctx, "file.write");
        const canvas = canvasNow();
        if (!canvas) return false;
        try {
          const { exportPSD } = await import("@/engine/psdEngine");
          await exportPSD(canvas, filename, options ?? {});
          return true;
        } catch (err) {
          console.error("[pluginRuntime] exportPSD failed:", err);
          return false;
        }
      },
      async importPSD(): Promise<boolean> {
        perm(ctx, "file.read");
        const canvas = canvasNow();
        if (!canvas) return false;
        try {
          const file = await new Promise<File | null>((resolve) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".psd,image/vnd.adobe.photoshop";
            input.onchange = () => resolve(input.files?.[0] ?? null);
            input.click();
            window.setTimeout(() => resolve(null), 60000);
          });
          if (!file) return false;
          const { openPSDFile } = await import("@/engine/psdEngine");
          await openPSDFile(file, canvas);
          return true;
        } catch (err) {
          console.error("[pluginRuntime] importPSD failed:", err);
          return false;
        }
      },
    },

    video: {
      async play(): Promise<boolean> {
        perm(ctx, "video");
        if (!useAnimationStore.getState().playing) useAnimationStore.getState().togglePlay();
        startPlayback();
        return true;
      },
      pause(): boolean {
        perm(ctx, "video");
        stopPlayback();
        if (useAnimationStore.getState().playing) useAnimationStore.getState().togglePlay();
        return true;
      },
      seek(frame: number): boolean {
        perm(ctx, "video");
        seekAndApply(Math.max(0, Math.round(frame)));
        return true;
      },
      setLoop(on: boolean): boolean {
        perm(ctx, "video");
        useAnimationStore.getState().setLoop(on);
        return true;
      },
      setFps(fps: number): boolean {
        perm(ctx, "video");
        useAnimationStore.getState().setFps(fps);
        return true;
      },
      getState() {
        perm(ctx, "video");
        const s = useAnimationStore.getState();
        return {
          time: s.time,
          duration: s.duration,
          fps: s.fps,
          playing: s.playing,
          trackCount: Object.keys(s.tracks).length,
        };
      },
      async addKeyframes(): Promise<boolean> {
        perm(ctx, "video");
        const obj = canvasNow()?.getActiveObject?.();
        const id = obj?.kaypaintId ?? obj?.id;
        if (!id) return false;
        useAnimationStore.getState().addKeyframes(id);
        return true;
      },
      async importMovie(): Promise<boolean> {
        perm(ctx, "video");
        const canvas = canvasNow();
        if (!canvas) return false;
        placeVideoClipDialog(canvas);
        return true;
      },
      async exportVideo(options?: Record<string, unknown>): Promise<boolean> {
        perm(ctx, "video");
        return exportVideoEngine(canvasNow(), options ?? {});
      },
    },
  };

  return api;
}

/* ------------------------------------------------------------------ *
 * Plugin registry + manager
 * ------------------------------------------------------------------ */

export type PluginCodeLoader = () => Promise<string> | string;

export interface PluginSource {
  manifest: PluginManifest;
  load: PluginCodeLoader;
}

export interface PluginContribution {
  pluginId: string;
  type: "toolbar" | "menu" | "panel" | "tool";
  id: string;
  menu?: string;
  label?: string;
}

interface ActivePlugin {
  source: PluginSource;
  sandbox: ReturnType<typeof createPluginSandbox>;
  context: PluginContext;
  unsubscribers: Array<() => void>;
}

let instance: PluginManager | null = null;

export class PluginManager {
  private sources = new Map<string, PluginSource>();
  private active = new Map<string, ActivePlugin>();

  private toolbarButtons = new Map<string, ToolbarButtonConfig[]>();
  private menuItems = new Map<string, MenuItemConfig[]>();
  private panels = new Map<string, { id: string; title: string; content: string }[]>();
  private pluginTools = new Map<string, ToolConfig[]>();
  private panelActions = new Map<string, Map<string, Map<string, (value: string) => void>>>();

  private listeners = new Set<(msg: string, pluginId: string) => void>();

  register(manifest: PluginManifest, loader: PluginCodeLoader) {
    this.sources.set(manifest.id, { manifest, load: loader });
  }

  unregister(pluginId: string) {
    if (this.isEnabled(pluginId)) this.disable(pluginId);
    this.sources.delete(pluginId);
  }

  getSource(pluginId: string): PluginSource | undefined {
    return this.sources.get(pluginId);
  }

  listSources(): PluginManifest[] {
    return [...this.sources.values()].map((s) => s.manifest);
  }

  isEnabled(pluginId: string): boolean {
    return this.active.has(pluginId);
  }

  getContext(pluginId: string): PluginContext | undefined {
    return this.active.get(pluginId)?.context;
  }

  getContributionIds(pluginId: string): string[] {
    return [
      ...(this.toolbarButtons.get(pluginId) ?? []).map((c) => c.id),
      ...(this.menuItems.get(pluginId) ?? []).map((c) => c.id),
      ...(this.panels.get(pluginId) ?? []).map((p) => p.id),
      ...(this.pluginTools.get(pluginId) ?? []).map((t) => t.id),
    ];
  }

  activePlugins(): string[] {
    return [...this.active.keys()];
  }

  /* lifecycle ------------------------------------------------------ */

  async load(pluginId: string): Promise<PluginContext> {
    const source = this.sources.get(pluginId);
    if (!source) throw new Error(`No plugin registered with id "${pluginId}"`);
    if (this.active.has(pluginId)) return this.active.get(pluginId)!.context;

    const context = {
      manifest: source.manifest,
      permissions: new Set(source.manifest.permissions),
      api: {} as PluginAPI,
      storage: createPluginStorage(pluginId),
      events: createPluginEventBus(),
    } as PluginContext;
    const hostApi = createHostAPI(() => context, this);
    (context as PluginContext & { api: PluginAPI }).api = hostApi;

    const sandbox = createPluginSandbox(source.manifest, context.api, context.storage, context.events);
    const unsubscribers: Array<() => void> = [];
    this.active.set(pluginId, { source, sandbox, context, unsubscribers });

    // Run the plugin module code inside the sandbox.
    const code = await source.load();
    const result = sandbox.run(code);
    if (!result.ok) {
      this.active.delete(pluginId);
      throw new Error(`Plugin "${pluginId}" failed to run: ${result.error}`);
    }

    // Hook manifests entryPoint as sandbox-resident function (e.g. onLoad/onUnload).
    const ep = source.manifest.entryPoints;
    if (ep?.onLoad) {
      const r2 = sandbox.run(`typeof ${ep.onLoad} === "function" ? ${ep.onLoad}() : undefined`);
      if (!r2.ok) this.emit("error", pluginId);
    }
    this.emit("load", pluginId);
    return context;
  }

  unload(pluginId: string) {
    const active = this.active.get(pluginId);
    if (!active) return;
    const ep = active.source.manifest.entryPoints;
    if (ep?.onUnload) {
      active.sandbox.run(`typeof ${ep.onUnload} === "function" ? ${ep.onUnload}() : undefined`);
    }
    for (const off of active.unsubscribers) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
    this.clearContributions(pluginId);
    this.active.delete(pluginId);
    this.emit("unload", pluginId);
  }

  async enable(pluginId: string): Promise<boolean> {
    if (!this.sources.has(pluginId)) return false;
    try {
      await this.load(pluginId);
      return true;
    } catch (err) {
      console.error(`[pluginRuntime] failed to enable ${pluginId}:`, err);
      this.active.delete(pluginId);
      return false;
    }
  }

  disable(pluginId: string) {
    this.unload(pluginId);
  }

  run(pluginId: string, code: string): SandboxResult<unknown> {
    const active = this.active.get(pluginId);
    if (!active) return { ok: false, error: `Plugin "${pluginId}" is not active` };
    return active.sandbox.run(code);
  }

  /* event dispatch -------------------------------------------------- */

  on(listener: (msg: string, pluginId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(msg: string, pluginId: string) {
    for (const l of [...this.listeners]) l(msg, pluginId);
  }

  /* UI contributions ------------------------------------------------- */

  getToolbarButtons(pluginId?: string): ToolbarButtonConfig[] {
    if (pluginId) return this.toolbarButtons.get(pluginId) ?? [];
    return [...this.toolbarButtons.values()].flat();
  }

  getMenuItems(pluginId?: string): MenuItemConfig[] {
    if (pluginId) return this.menuItems.get(pluginId) ?? [];
    return [...this.menuItems.values()].flat();
  }

  getPanels(pluginId?: string) {
    if (pluginId) return this.panels.get(pluginId) ?? [];
    return [...this.panels.values()].flat();
  }

  getTools(pluginId?: string) {
    if (pluginId) return this.pluginTools.get(pluginId) ?? [];
    return [...this.pluginTools.values()].flat();
  }

  addToolbarButton(pluginId: string, config: ToolbarButtonConfig) {
    let list = this.toolbarButtons.get(pluginId);
    if (!list) {
      list = [];
      this.toolbarButtons.set(pluginId, list);
    }
    list.push(config);
    this.emit("contribution", pluginId);
  }

  removeToolbarButton(pluginId: string, id: string) {
    const list = this.toolbarButtons.get(pluginId);
    if (!list) return;
    this.toolbarButtons.set(pluginId, list.filter((c) => c.id !== id));
    this.emit("contribution", pluginId);
  }

  addMenuItem(pluginId: string, _menu: string, config: MenuItemConfig) {
    let list = this.menuItems.get(pluginId);
    if (!list) {
      list = [];
      this.menuItems.set(pluginId, list);
    }
    list.push(config);
    this.emit("contribution", pluginId);
  }

  removeMenuItem(pluginId: string, menu: string, id: string) {
    const list = this.menuItems.get(pluginId);
    if (!list) return;
    this.menuItems.set(pluginId, list.filter((m) => m.id !== id));
    void menu;
    this.emit("contribution", pluginId);
  }

  addPanel(pluginId: string, id: string, title: string, content: string) {
    let list = this.panels.get(pluginId);
    if (!list) {
      list = [];
      this.panels.set(pluginId, list);
    }
    const existing = list.findIndex((p) => p.id === id);
    const panel = { id, title, content };
    if (existing >= 0) list[existing] = panel;
    else list.push(panel);
    this.emit("contribution", pluginId);
  }

  removePanel(pluginId: string, id: string) {
    const list = this.panels.get(pluginId);
    if (!list) return;
    this.panels.set(pluginId, list.filter((p) => p.id !== id));
    this.panelActions.get(pluginId)?.delete(id);
    this.emit("contribution", pluginId);
  }

  registerPanelAction(pluginId: string, panelId: string, action: string, handler: (value: string) => void) {
    let byPlugin = this.panelActions.get(pluginId);
    if (!byPlugin) {
      byPlugin = new Map();
      this.panelActions.set(pluginId, byPlugin);
    }
    let byPanel = byPlugin.get(panelId);
    if (!byPanel) {
      byPanel = new Map();
      byPlugin.set(panelId, byPanel);
    }
    byPanel.set(action, handler);
  }

  runPanelAction(pluginId: string, panelId: string, action: string, value: string) {
    const handler = this.panelActions.get(pluginId)?.get(panelId)?.get(action);
    if (!handler) return;
    try {
      handler(value);
    } catch (err) {
      console.error(`[pluginRuntime] panel action "${action}" failed for ${pluginId}:`, err);
    }
  }

  registerTool(pluginId: string, _id: string, config: ToolConfig) {
    let list = this.pluginTools.get(pluginId);
    if (!list) {
      list = [];
      this.pluginTools.set(pluginId, list);
    }
    list.push(config);
    this.emit("contribution", pluginId);
  }

  unregisterTool(pluginId: string, id: string) {
    const list = this.pluginTools.get(pluginId);
    if (!list) return;
    this.pluginTools.set(pluginId, list.filter((t) => t.id !== id));
    this.emit("contribution", pluginId);
  }

  notify(_pluginId: string, type: "info" | "warning" | "error", message: string) {
    // Simple in-app notification placeholder; wire to a toast system later.
    console.info(`[plugin:${type}] ${message}`);
  }

  private clearContributions(pluginId: string) {
    this.toolbarButtons.delete(pluginId);
    this.menuItems.delete(pluginId);
    this.panels.delete(pluginId);
    this.pluginTools.delete(pluginId);
    this.panelActions.delete(pluginId);
  }
}

export function getPluginManager(): PluginManager {
  if (!instance) instance = new PluginManager();
  return instance;
}

/* ------------------------------------------------------------------ *
 * React integration
 * ------------------------------------------------------------------ */

export function buildManifestFromCatalog(
  def: { id: string; name: string },
  permissions: PluginPermission[],
  main = `${def.id}.js`,
  apiVersion = 1
): PluginManifest {
  return {
    id: def.id,
    name: def.name,
    version: "1.0.0",
    main,
    permissions,
    apiVersion,
  };
}

/**
 * Real, shipped plugins. Each entry has genuine plugin code in
 * /public/plugins/<id>.js that runs in the sandbox and provides real
 * functionality through the PluginAPI. Catalog entries not listed here are
 * not yet shipped and are shown as "Coming soon" in the UI.
 */
export const REAL_PLUGINS: Record<string, { permissions: PluginPermission[] }> = {
  "luts-bw": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-grain": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-pixelart": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "widgets-contrast": { permissions: ["ui.panel", "storage.read", "storage.write"] },
  "widgets-typography": { permissions: ["ui.panel", "storage.read", "storage.write"] },
  "luts-tealorange": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "luts-dreamy": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-halftone": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-ink": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-glow": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-watercolor": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-lightleaks": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "retouch-dodgeburn": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "textures-grunge": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-cartoon": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-glitch": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "filters-oil": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-chromatic": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-anaglyph": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "luts-film": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "automation-organizer": { permissions: ["layers.read", "layers.write", "ui.panel", "ui.toolbar"] },
  "batch-filters": { permissions: ["filters.apply", "layers.read", "layers.write", "ui.panel", "ui.toolbar"] },
  "collab-versions": { permissions: ["history.read", "history.write", "ui.panel", "ui.toolbar"] },
  "prepress-flatten": { permissions: ["layers.read", "ui.panel", "ui.toolbar"] },
  "textures-canvas": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-particles": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "vfx-godrays": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "textures-metal": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "retouch-skin": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "scripts-recorder": { permissions: ["actions.read", "actions.run", "ui.panel", "ui.toolbar"] },
  "harmony-accessible": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "styles-neon": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "styles-glass": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "asset-library": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "presets-pantone": { permissions: ["ui.panel", "ui.toolbar"] },
  "styles-chrome": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "styles-buttons": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "textures-seamless": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "harmony-auto": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "workflows-social": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "templates-social": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "templates-youtube": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "templates-cards": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "export-cropmarks": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "asset-manager": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "templates-poster": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "collab-comments": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "workflows-print": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "presets-print": { permissions: ["ui.panel", "ui.toolbar"] },
  "prepress-imposition": { permissions: ["ui.panel", "ui.toolbar"] },
  "dev-css": { permissions: ["layers.read", "ui.panel", "ui.toolbar"] },
  "mockups-social": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "mockups-product": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "prepress-spot": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "scripts-library": { permissions: ["storage.read", "storage.write", "actions.read", "actions.run", "ui.panel", "ui.toolbar"] },
  "export-sprite": { permissions: ["ui.panel", "ui.toolbar"] },
  "dev-slices": { permissions: ["storage.read", "storage.write", "ui.panel", "ui.toolbar"] },
  "3d-shadows": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "3d-bevel": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "automation-rename": { permissions: ["layers.read", "ui.panel", "ui.toolbar"] },
  "tools-isometric": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "tools-perspective": { permissions: ["layers.read", "layers.create", "ui.panel", "ui.toolbar"] },
  "tools-qr": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "tools-barcode": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "pattern-tile": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "pattern-live": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "tools-gradientmesh": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "type-variable": { permissions: ["text.read", "text.write", "ui.panel", "ui.toolbar"] },
  "type-kerning": { permissions: ["text.read", "text.write", "ui.panel", "ui.toolbar"] },
  "brushes-splatter": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "brushes-hair": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "brushes-foliage": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "brushes-chalk": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "brushes-calligraphy": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai2-artboards": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai-upscaler": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai-background": { permissions: ["network.fetch", "canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai-eraser": { permissions: ["network.fetch", "canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "formats-raw": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai2-strokegradient": { permissions: ["canvas.read", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai-texttoimage": { permissions: ["network.fetch", "canvas.write", "ui.panel", "ui.toolbar"] },
  "formats-psd": { permissions: ["file.read", "file.write", "ui.panel", "ui.toolbar"] },
  "ai2-pen": { permissions: ["tools.register", "canvas.write", "ui.panel", "ui.toolbar"] },
  "ai2-shapebuilder": { permissions: ["canvas.write", "ui.panel", "ui.toolbar"] },
  "ai2-livepaint": { permissions: ["canvas.write", "ui.panel", "ui.toolbar"] },
  "ai2-pathfinder": { permissions: ["canvas.write", "ui.panel", "ui.toolbar"] },
  "video-timeline": { permissions: ["video", "ui.panel", "ui.toolbar"] },
  "video-keyframes": { permissions: ["video", "ui.panel", "ui.toolbar"] },
  "video-movielayers": { permissions: ["video", "ui.panel", "ui.toolbar"] },
  "video-export": { permissions: ["video", "ui.panel", "ui.toolbar"] },
  "retouch-frequency": { permissions: ["filters.apply", "ui.toolbar", "ui.panel"] },
  "batch-resize": { permissions: ["ui.panel", "ui.toolbar"] },
};

export function isPluginShipped(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(REAL_PLUGINS, id);
}

/**
 * Registers every shipped plugin as a loadable source. The loader fetches the
 * plugin's real code from /plugins/<id>.js at enable time.
 */
export function registerRealPlugins(): void {
  const manager = getPluginManager();
  for (const id of Object.keys(REAL_PLUGINS)) {
    if (manager.getSource(id)) continue;
    const def = PLUGIN_CATALOG.find((p) => p.id === id);
    if (!def) continue;
    manager.register(
      {
        id,
        name: def.name,
        version: "1.0.0",
        description: def.tagline,
        author: "kaypaint",
        main: `/plugins/${id}.js`,
        permissions: REAL_PLUGINS[id].permissions,
        apiVersion: 1,
      },
      async () => {
        const res = await fetch(`/plugins/${id}.js`);
        if (!res.ok) throw new Error(`Plugin source missing: ${id} (HTTP ${res.status})`);
        return res.text();
      }
    );
  }
}

/**
 * Call once (client-side) to keep plugin enablement in pluginStore in sync
 * with the runtime: toggling a shipped plugin in the UI enables/disables it
 * here. Returns an unsubscribe function.
 */
export function syncPluginStoreWithRuntime(): () => void {
  const manager = getPluginManager();
  registerRealPlugins();

  const applyEnabled = () => {
    const st = usePluginStore.getState();
    for (const id of Object.keys(st.enabled)) {
      const on = !!st.enabled[id] && st.owns(id);
      if (on && manager.getSource(id) && !manager.isEnabled(id)) {
        void manager.enable(id);
      } else if (!on && manager.isEnabled(id)) {
        manager.disable(id);
      }
    }
  };

  applyEnabled();
  return usePluginStore.subscribe(() => applyEnabled());
}
