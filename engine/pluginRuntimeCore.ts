/**
 * Pure plugin runtime core — no DOM, no browser globals.
 * Fully node-testable. Provides sandboxed execution, permission checks,
 * and a typed API surface for plugins.
 */

export type PluginPermission =
  | "canvas.read"
  | "canvas.write"
  | "file.read"
  | "file.write"
  | "layers.read"
  | "layers.write"
  | "layers.create"
  | "layers.delete"
  | "text.read"
  | "text.write"
  | "history.read"
  | "history.write"
  | "actions.read"
  | "actions.run"
  | "filters.read"
  | "filters.apply"
  | "tools.register"
  | "video"
  | "ui.toolbar"
  | "ui.menu"
  | "ui.panel"
  | "storage.read"
  | "storage.write"
  | "network.fetch"
  | "events.on"
  | "events.emit";

export type PermissionSet = ReadonlySet<PluginPermission>;

export const ALL_PERMISSIONS: PluginPermission[] = [
  "canvas.read", "canvas.write",
  "file.read", "file.write",
  "layers.read", "layers.write", "layers.create", "layers.delete",
  "text.read", "text.write",
  "history.read", "history.write",
  "actions.read", "actions.run",
  "filters.read", "filters.apply",
  "tools.register",
  "video",
  "ui.toolbar", "ui.menu", "ui.panel",
  "storage.read", "storage.write",
  "network.fetch",
  "events.on", "events.emit",
];

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  main: string;
  permissions: PluginPermission[];
  apiVersion: number;
  entryPoints?: {
    onLoad?: string;
    onUnload?: string;
    onCanvasChange?: string;
    onLayerChange?: string;
    tools?: Record<string, string>;
    menuItems?: Record<string, string>;
    panel?: string;
  };
}

export interface PluginContext {
  readonly manifest: PluginManifest;
  readonly permissions: PermissionSet;
  readonly api: PluginAPI;
  readonly storage: PluginStorage;
  readonly events: PluginEventBus;
}

export interface PluginStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface PluginEventBus {
  on(event: string, handler: (...args: unknown[]) => void): () => void;
  emit(event: string, ...args: unknown[]): void;
  once(event: string, handler: (...args: unknown[]) => void): () => void;
}

export interface CanvasInfo {
  width: number;
  height: number;
  zoom: number;
  rotation: number;
}

export interface PixelImage {
  width: number;
  height: number;
  data: number[];
}

export interface SvgInsertOptions {
  left?: number;
  top?: number;
  scale?: number;
  name?: string;
}

export interface NetworkResponse {
  ok: boolean;
  status: number;
  json(): unknown | null;
}

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  index: number;
}

export interface TextStyleInfo {
  isText: boolean;
  type: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: number;
  fill: string;
  textAlign: string;
  lineHeight: number;
}

export interface TextStylePatch {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  letterSpacing?: number;
  fill?: string;
  textAlign?: string;
  lineHeight?: number;
}

export interface PluginAPI {
  readonly canvas: {
    getInfo(): CanvasInfo;
    getDataURL(format?: string, quality?: number): string;
    toBlob(mimeType: string, quality?: number): Promise<Blob>;
    readPixels(maxPixels?: number): PixelImage | null;
    writePixels(pixels: PixelImage): Promise<boolean>;
    replaceActivePixels(pixels: PixelImage): Promise<boolean>;
    addImage(dataUrl: string, options?: SvgInsertOptions): Promise<boolean>;
    replaceActiveImage(dataUrl: string): Promise<boolean>;
    addSvg(svg: string, options?: SvgInsertOptions): Promise<boolean>;
    pathfinder(op: "union" | "intersect" | "subtract"): Promise<boolean>;
    setFill(color: string): boolean;
  };
  readonly layers: {
    getAll(): LayerInfo[];
    getById(id: string): LayerInfo | null;
    getActive(): LayerInfo | null;
    setActive(id: string): boolean;
    create(name: string, options?: { width?: number; height?: number }): Promise<LayerInfo>;
    delete(id: string): boolean;
    setVisibility(id: string, visible: boolean): boolean;
    setOpacity(id: string, opacity: number): boolean;
    setBlendMode(id: string, mode: string): boolean;
    reorder(id: string, newIndex: number): boolean;
  };
  readonly history: {
    canUndo: boolean;
    canRedo: boolean;
    undo(): void;
    redo(): void;
    getStack(): { id: number; name: string; timestamp: number }[];
    jumpTo(index: number): void;
  };
  readonly text: {
    getActive(): TextStyleInfo | null;
    setStyle(patch: TextStylePatch): boolean;
  };
  readonly actions: {
    getAll(): { id: string; name: string; steps: unknown[] }[];
    run(actionId: string): Promise<boolean>;
  };
  readonly filters: {
    getAvailable(): string[];
    apply(filterName: string, params: Record<string, unknown>): Promise<boolean>;
  };
  readonly tools: {
    register(id: string, config: ToolConfig): void;
    unregister(id: string): void;
    setActive(toolId: string): boolean;
  };
  readonly ui: {
    addToolbarButton(config: ToolbarButtonConfig): void;
    removeToolbarButton(id: string): void;
    addMenuItem(menu: string, config: MenuItemConfig): void;
    removeMenuItem(menu: string, id: string): void;
    createPanel(id: string, title: string, content: string): void;
    removePanel(id: string): void;
    onPanelAction(panelId: string, action: string, handler: (value: string) => void): void;
    showNotification(message: string, type?: "info" | "warning" | "error"): void;
  };
  readonly network: {
    request(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<NetworkResponse>;
  };
  readonly file: {
    exportPSD(filename?: string, options?: { cmyk?: boolean }): Promise<boolean>;
    importPSD(): Promise<boolean>;
  };
  readonly video: {
    play(): Promise<boolean>;
    pause(): boolean;
    seek(frame: number): boolean;
    setLoop(on: boolean): boolean;
    setFps(fps: number): boolean;
    getState(): { time: number; duration: number; fps: number; playing: boolean; trackCount: number };
    addKeyframes(): Promise<boolean>;
    importMovie(): Promise<boolean>;
    exportVideo(options?: Record<string, unknown>): Promise<boolean>;
  };
}

export interface ToolConfig {
  id: string;
  name: string;
  icon?: string;
  cursor?: string;
  onActivate: (ctx: PluginContext) => void;
  onDeactivate?: (ctx: PluginContext) => void;
  onPointerDown?: (event: PointerEventData, ctx: PluginContext) => void;
  onPointerMove?: (event: PointerEventData, ctx: PluginContext) => void;
  onPointerUp?: (event: PointerEventData, ctx: PluginContext) => void;
}

export interface PointerEventData {
  x: number;
  y: number;
  pressure: number;
  button: number;
  buttons: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ToolbarButtonConfig {
  id: string;
  tooltip: string;
  icon: string;
  onClick: (ctx: PluginContext) => void;
  toggle?: boolean;
  toggled?: boolean;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: (ctx: PluginContext) => void;
  enabled?: boolean;
  separator?: boolean;
}

const FORBIDDEN_PATTERNS = [
  /eval\s*\(/,
  /new\s+Function\s*\(/,
  /Function\s*\(/,
  /document\./,
  /window\./,
  /navigator\./,
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /crypto\./,
  /performance\./,
  /require\s*\(/,
  /import\s*\(/,
  /__dirname/,
  /__filename/,
  /process\./,
  /global\./,
  /globalThis/,
];

export function validatePluginCode(code: string): string[] {
  const errors: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Forbidden pattern: ${pattern.source}`);
    }
  }
  return errors;
}

function createSafeGlobals(allowed: string[]): Record<string, unknown> {
  const safe: Record<string, unknown> = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    ReferenceError,
    SyntaxError,
    RangeError,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };
  for (const key of allowed) {
    if (!(key in safe)) safe[key] = undefined;
  }
  return safe;
}

export interface SandboxResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function isExpression(code: string): boolean {
  try {
    new Function(`"use strict"; return (${code});`);
    return true;
  } catch {
    return false;
  }
}

export function runInSandbox<T>(
  code: string,
  allowedGlobals: string[] = [],
  thisArg?: unknown,
  bindings: Record<string, unknown> = {}
): SandboxResult<T> {
  const errors = validatePluginCode(code);
  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }
  try {
    const safeGlobals = createSafeGlobals(allowedGlobals);
    for (const [key, value] of Object.entries(bindings)) {
      safeGlobals[key] = value;
    }
    const body = isExpression(code)
      ? `"use strict"; return (${code});`
      : `"use strict"; ${code}`;
    const fn = new Function(...Object.keys(safeGlobals), body);
    const args = Object.values(safeGlobals);
    const value = fn.apply(thisArg, args) as T;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function createPluginSandbox(manifest: PluginManifest, api: PluginAPI, storage: PluginStorage, events: PluginEventBus) {
  const context: PluginContext = {
    manifest,
    permissions: new Set(manifest.permissions) as PermissionSet,
    api,
    storage,
    events,
  };

  const allowedGlobals = [
    "console",
    "JSON",
    "Math",
    "Date",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Map",
    "Set",
    "Promise",
    "Error",
  ];

  const bindings: Record<string, unknown> = {
    context,
    manifest,
    permissions: context.permissions,
    api,
    storage,
    events,
  };

  return {
    context,
    run(code: string) {
      return runInSandbox(code, allowedGlobals, context, bindings);
    },
    runModule(moduleCode: string) {
      return runInSandbox(moduleCode, allowedGlobals, context, bindings);
    },
  };
}

export function checkPermission(ctx: PluginContext, perm: PluginPermission): boolean {
  return ctx.permissions.has(perm);
}

export function requirePermission(ctx: PluginContext, perm: PluginPermission): void {
  if (!checkPermission(ctx, perm)) {
    throw new Error(`Permission denied: ${perm}`);
  }
}