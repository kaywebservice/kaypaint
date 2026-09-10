# AGENTS.md — KayPaint

Browser-based, full-featured image editor (Photoshop/GIMP-class) built with **Next.js 16 (Turbopack), React, fabric.js, zustand, TypeScript**. Everything runs client-side except 3 serverless API routes. **92/92 marketplace plugins are real and shipped.**

This file is the single source of truth for the codebase. Read it fully before making changes.

---

## 1. Quick reference

| Thing | Value |
|---|---|
| Runtime | Next.js 16, App Router, Turbopack |
| State | zustand stores in `store/` |
| Canvas | fabric.js v6 (class `Canvas`) |
| Rendering of pixels | browser canvas + a Web Worker (`public/workers/pixelWorker.js`) |
| Editor page | `app/editor/page.tsx` |
| AI | server proxy `app/api/gemini/route.ts` (Gemini, key server-side only) |
| Language | TypeScript (ESM); plugins are ES5 JS |

**Commands**
```bash
npm run dev          # dev server
npm run build        # production build (Turbopack)
npm run start        # serve production build
npm run lint         # eslint
npm run smoke        # module-load + plugin validation smoke (no server)
# HTTP smoke (after build+start): SMOKE_HTTP=1 SMOKE_BASE=http://localhost:3000 npm run smoke
# Unit tests are run with Node's type stripping:
node --experimental-strip-types --experimental-transform-types scripts/<test>.mjs
```

**Node version note:** all `.mjs` test scripts must be run with `--experimental-strip-types --experimental-transform-types`. Two test scripts (`test_tools_qr.mjs`, `test_tools_barcode.mjs`) depend on **`jsqr`** / **`jsbarcode`**, which are installed with `--no-save` (dev-only validation) and get **pruned by any later `npm install`** — reinstall with `npm i --no-save jsqr jsbarcode` if they error with `Cannot find module`.

---

## 2. Directory map

- `app/` — routes: `editor/page.tsx` (the editor), `projects`, `settings`, `page.tsx`, `manifest.ts` (PWA), `layout.tsx` (metadata, manifest link), `api/gemini`, `api/raw`, `api/creem/checkout` (serverless).
- `components/Editor/` — CanvasViewport (fabric canvas + rulers + overlays), Toolbar, OptionsBar, PropertiesPanel, ToolManager (shortcuts/undo wiring), Timeline, CommandPalette, DocumentTabs.
- `components/Menu/` — top menus (File/Edit/Image/Layer/Select/Filter/View/Type/Window/Help), dialogs, PluginMarket.
- `components/Panels/` — right sidebar tabs (Properties, Layers, Channels, Paths, Adjustments, Character, Paragraph, Swatches, Gradients, Patterns, Libraries, Actions, Glyphs, Layer Comps, History).
- `components/Tools/` — one file per tool (~60 tools; registered in `store/toolRegistry.ts`, dispatched by `engine/toolEngine.ts`).
- `engine/` — ~120 pure/browser engines. **The majority are pure functions; several are the "source of truth" for worker math (see §6).**
- `store/` — zustand stores: `editorStore` (activeTool/size/color/etc.), `layerStore`, `featuresStore` (actions, keyBindings, smartFilters), `settingsStore`, `animationStore`, `pluginStore`, `pluginHostStore`, `commandStore`, `toastStore`, `documentStore`.
- `public/plugins/` — 92 shipped plugin files (ES5, sandbox-run).
- `public/workers/pixelWorker.js` — standalone worker (no imports) mirroring the pure engine math.
- `public/sw.js` — PWA service worker (precaches app shell, network-first).
- `public/pdf.worker.min.mjs` — pdf.js worker (copied from node_modules for PDF import).
- `scripts/` — node test scripts (`test_*.mjs`) + `smoke_test.mjs`.
- `lib/` — Gemini client/image helpers, firebase, creem.
- `layers/`, `types/`, `utils/` — layer panel, TS types, shared helpers (`menuUtils`, `imageUtils`, `notify`).

---

## 3. Core mental model

- **Canvas objects** are fabric objects with a `kaypaintId` (string) that links them to `layerStore.layers` (`layer.objectId`).
- **Selections are the active image layer's ALPHA channel** (not a separate mask object). Selection ops (`selectOps.ts`) read alpha, modify it, and write it back via `applyPixelsToActiveLayer`. A **marching-ants overlay** (`engine/marchingAnts.ts`) traces the active image's alpha contour live.
- **History** (`engine/historyEngine.ts`) snapshots `canvas.toJSON()` as a JSON string per step: dedupes identical snaps, **coalesces rapid pushes** (150ms window) into one undo step, and **caps total memory (~128MB)** with a size-aware step limit.
- **Layer masks** (`engine/maskEngine.ts`): a real mask = `obj.maskData` (Uint8ClampedArray) + an image `clipPath`; seeded from the object's alpha; painted via the QuickMask tool when a mask exists; `applyMask` bakes it.
- **Layer styles** (`layerStylesEngine.ts`) are stored per-layer as a JSON string; drop shadow / outer stroke / color overlay / gradient overlay.

---

## 4. The plugin system (the unique part)

Sandbox core: `engine/pluginRuntimeCore.ts` (pure, node-testable). Browser glue: `engine/pluginRuntime.ts`.

- **Sandbox**: `createPluginSandbox(manifest, api, storage, events).run(code)` executes plugin code via `new Function` with only `console, JSON, Math, Date, Array, Object, String, Number, Boolean, Map, Set, Promise, Error` as globals. **`storage` and `events` are separate injected bindings, not `api.storage`/`api.events`.**
- **Forbidden patterns** (`FORBIDDEN_PATTERNS`): `/eval\s*\(/`, `/new\s+Function\s*\(/`, `/Function\s*\(/`, `/document\./`, `/window\./`, `/navigator\./`, `/fetch\s*\(/`, `/XMLHttpRequest/`, `/WebSocket/`, `/localStorage/`, `/sessionStorage/`, `/indexedDB/`, `/crypto\./`, `/performance\./`, `/require\s*\(/`, `/import\s*\(/`, `__dirname`, `__filename`, `/process\./`, `/global\./`, `/globalThis/`. **Watch out:** literal words like "in this document." or `api.network.fetch(` match these patterns.
- **Permissions** (26, `ALL_PERMISSIONS` in `pluginRuntimeCore.ts`): `canvas.read/write`, `file.read/write`, `layers.read/write/create/delete`, `text.read/write`, `history.read/write`, `actions.read/run`, `filters.read/apply`, `tools.register`, `video`, `ui.toolbar/menu/panel`, `storage.read/write`, `network.fetch`, `events.on/emit`.
- **PluginAPI** (`PluginAPI` interface): `canvas` (getInfo, getDataURL, toBlob, readPixels, writePixels, replaceActivePixels, addImage, replaceActiveImage, addSvg, pathfinder, setFill), `layers`, `text`, `history`, `actions`, `filters`, `tools` (register/unregister/setActive), `ui` (toolbar buttons, menus, panels, `onPanelAction`, notifications), `network.request`, `file` (exportPSD/importPSD), `video` (play/pause/seek/setLoop/setFps/getState/addKeyframes/importMovie/exportVideo).
- **Registry**: `REAL_PLUGINS` in `pluginRuntime.ts` maps each plugin id → its permissions. `isPluginShipped(id)` gates the marketplace UI. `registerRealPlugins()` loads sources from `/plugins/<id>.js`.
- **Plugin style conventions**: ES5 (`var`, `function`, string concat — NO arrow functions/template literals). Panels are HTML strings rendered via `api.ui.createPanel`; inputs use `data-plugin-action="name"` and the host passes the input's `value` to the `onPanelAction(panelId, action, handler)` handler. Async host calls use `.then(function (ok) {...})`.
- **Tests**: `scripts/test_pluginRuntimeCore.mjs` (core), plus per-plugin suites in `C:\Users\DELL54~1\AppData\Local\Temp\opencode\test_*.mjs` (the authoring tests live there). `validatePluginCode(code)` must return no problems for every plugin (`scripts/smoke_test.mjs` enforces it).

---

## 5. Notable UI features

- **Toolbar** (`components/Editor/Toolbar.tsx`): Photoshop-style **grouped flyouts**. `TOOL_GROUPS` defines groups; each slot shows the last-used (or active) tool with icon + name; clicking a multi-tool group toggles a fixed-position flyout of variants (outside-click/Esc closes). Quick Mask is a bottom **mode toggle** (`toggleQuickMask`). Sidebar width is `w-44` in `app/editor/page.tsx`.
- **Adaptive PropertiesPanel**: context badge (Image/Text/Shape), live **Brightness/Contrast/Saturation/Blur** sliders (debounced 120ms, history pushed on release, filter chain read back on selection), document empty-state.
- **Command palette** (`commandStore.ts` + `CommandPalette.tsx`): searches tools, menus, **user actions**, and **shipped plugins** (dynamic commands); remembers **recent commands** (localStorage `kaypaint:recentCommands`); matches labels/groups/hints. Opened with Ctrl/Cmd twice or Ctrl+K.
- **Toast system** (`store/toastStore.ts`, `components/ToastHost.tsx`, `utils/notify.ts`): `notify(msg, type)` + `installToastPatch()` overrides `window.alert` app-wide so old `alert()` calls show toasts.
- **Shortcut editor** (`components/ShortcutEditorDialog.tsx`): capture-based; **Edit → Keyboard Shortcuts…** opens it (bindings in `featuresStore.keyBindings`; `engine/shortcuts.ts`).
- **Onboarding overlay** (`components/OnboardingOverlay.tsx`): hydration-safe via `useSyncExternalStore` (server snapshot `false`; reads localStorage key `kaypaint:onboarded:v1`). **Do not read localStorage in React initial state — it causes hydration mismatch.**
- **PWA**: `app/manifest.ts` (standalone, start_url `/editor`), `public/sw.js` (precache shell + network-first fallback), registered in production only.

---

## 6. Pure engine cores & the Web Worker (KEEP IN SYNC)

The heavy pixel algorithms live in **pure TS modules** (node-testable) and are **mirrored by `public/workers/pixelWorker.js`** (self-contained, no imports). The client `engine/pixelWorkerClient.ts` dispatches to the worker with a **sync fallback** to the TS cores (identical results). **If you change an algorithm, update BOTH the TS core and the worker**, and run `test_pixelWorker.mjs` (parity is byte-for-byte).

| Algorithm | TS core | Used by |
|---|---|---|
| Content-aware inpaint (nearest-fill + Perona–Malik diffusion) | `engine/inpaintFallback.ts` | contentAwareEngine fallback |
| Bayer demosaic + auto white balance | `engine/rawDemosaic.ts` | rawImport default decoder |
| Heal brush (offset scan + tone-matched stamp) | `engine/healEngine.ts` | Heal/SpotHeal tools |
| Boolean masks + contour tracing (holes via evenodd) | `engine/shapeBoolean.ts` | pathfinder, marching-ants |
| Keyframe interpolation + easing | `engine/keyframes.ts` | animation engine |
| Levels/Curves/Hue-Sat | `engine/adjustmentCore.ts` | adjustment preview (worker), imageOps |
| Refine-edge (edge-aware feather, morph, decontaminate) | `engine/refineEdgeCore.ts` | RefineEdge tool/menu |
| Path parse/serialize (bezier nodes) | `engine/pathEditCore.ts` | anchor editor |
| History engine | `engine/historyEngine.ts` | undo/redo |

Worker ops: `inpaint, demosaic, whiteBalance, healOffset, healStamp, combineMasks, trace, adjust`.

---

## 7. Key engines & features

- **PSD codec** (`psdEngine.ts`): real binary PSD read/write — RLE encode/decode, layer records, RGB + CMYK (+ICC), composite flatten. `openPSDFile` adds layers via `canvas.add(...)` (do NOT mutate `canvas._objects`). Node round-trip test exists in temp suite.
- **RAW** (`rawImport.ts`): injectable `_decodeRawImpl` seam + `app/api/raw/route.ts`. Default impl = pure-JS Bayer demosaic (needs `meta` w/h/pattern); **compressed CR2/NEF/ARW still need an external libraw WASM build** (documented, not implemented).
- **PDF import** (`engine/pdfImport.ts`): `importPDF(file, canvas)` renders pages (≤20) as image layers via **pdf.js (dynamic `import("pdfjs-dist")` — never static, it breaks SSR with `DOMMatrix is not defined`)**; worker at `/pdf.worker.min.mjs`.
- **File → Open…** (`fileOps.openAnyFilePicker`): any file → routes by extension (psd, json, pdf, images, TIFF/RAW → informative toast, else tries as image).
- **Pathfinder** (`engine/pathfinder.ts`): rasterizes 2 selected objects to masks, `combineMasks` (union/intersect/subtract), `trace` contours, emits a fabric Path with `fillRule: evenodd`. Wired in Select → Pathfinder + plugins.
- **Anchor editor** (`engine/pathEdit.ts`): double-click a Path to edit (drag anchors/handles, Shift multi-select, Alt breaks mirror, Delete removes, Esc exits). Parse/serialize math in `pathEditCore.ts`.
- **Selections**: `selectOps.ts` (colorRange, similar, grow, modify: border/smooth/expand/contract/feather, transform, save/load), `selectSubject.ts` (edge flood matting), `refineEdge.ts` (dialog + edge-aware feather), `marchingAnts.ts` (overlay).
- **Retouch**: `healEngine.ts`-backed Heal/SpotHeal; CloneTool (Alt picks source); `contentAwareEngine.ts` (OpenCV-Telea via CDN when available, else worker inpaint).
- **Video**: `animationEngine.ts` (tracks + keyframes, now incl. `angle` prop, easing via `keyframes.ts`, per-layer mute), `movieLayerEngine.ts` (`placeVideoClipDialog`), `videoExport.ts` (MediaRecorder). Exposed to plugins via the `video` API.
- **Filters** (`filterEngine.ts`): 13 fabric filters (`blur…contrast`); `applyFilter` REPLACES the whole chain each call.
- **AI** (`app/api/gemini/route.ts`): modes `generate|inpaint|upscale`; body `{mode, prompt, imageBase64?, width?, height?}` → `{dataUrl}`. Plugins call it via `api.network.request("/api/gemini", …)`; ai-eraser/ai-background/ai-texttoimage use it with local-heuristic fallbacks.

---

## 8. Conventions & gotchas (READ THIS)

1. **Node tests**: run `.mjs` tests with `--experimental-strip-types --experimental-transform-types`. The `@/` alias is **NOT resolvable in plain Node** — pure cores (listed §6) must not import via `@/`; test those directly. Browser-only modules (fabric, `@/components`) can't run in node.
2. **eslint `no-explicit-any`**: files that use `any` need the standard header `/* eslint-disable @typescript-eslint/no-explicit-any */` (most engine/tool files have it).
3. **Hydration**: never read `localStorage`/`window` in React state initializers or render — use `useSyncExternalStore` with a server snapshot (see OnboardingOverlay) or effect-gated mounting. `setState` synchronously in `useEffect` is a lint error.
4. **Plugins are ES5** and must pass `validatePluginCode` (no `fetch(`, `document.`, `import(`, etc. even in comments/strings).
5. **Worker parity**: change TS core + `pixelWorker.js` together.
6. **Never commit `.env.local`** (gitignored). `GEMINI_API_KEY`, `CEERM_API_KEY` must be env vars (Vercel dashboard). Firebase `apiKey` in `lib/firebase.ts` is a PUBLIC web key (fine to commit).
7. **Git**: repo initialized, branch `main`, initial commit made (not yet pushed to GitHub).
8. **Selections are alpha-based**: any tool that paints alpha is editing the selection; don't confuse with the object selection (fabric active object).
9. **The sidebar/toolbar**: group flyouts defined in `TOOL_GROUPS` (`Toolbar.tsx`); add/remove groups there.

---

## 9. What was built in the big hardening pass (this codebase's history)

- Selections rebuilt (wand/quick-select/quick-mask, tolerance+feather UI, marching-ants overlay, refine-edge brush, edge-aware feather, smarter decontaminate).
- Real retouch: heal/spot-heal engine, fixed clone tool, content-aware offline via edge-preserving diffusion (worker).
- Vector: bezier Pen, anchor editor (multi-select/delete), pathfinder (boolean ops with holes), shipped the ai2-* plugins.
- Pixels off the main thread: Web-Worker engine + client with sync fallback (parity-tested) for inpaint/demosaic/heal/boolean/adjustments; non-blocking history (coalescing + memory caps); large-image objectCaching off.
- Camera-RAW tone pipeline depth (tint + smooth curves) in `formats-raw.js`; PDF import; unified File → Open.
- All 92 plugins shipped (QR/barcode encoders verified against jsqr/jsbarcode; Gemini text-to-image; PSD codec plugin; video plugins; pathfinder plugins).
- UI: Photoshop-style grouped toolbar, adaptive live PropertiesPanel, command palette with recents, toast system (alert patch), shortcut editor, onboarding overlay, PWA manifest + service worker.
- QA: `scripts/smoke_test.mjs` (module-load + plugin validation + optional HTTP routes), plus ~20 test suites in temp authoring dir.
