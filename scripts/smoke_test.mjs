/**
 * Smoke test: verifies the codebase actually loads and key routes respond.
 *
 *  1. Module-load: imports every pure engine module and calls it once — catches
 *     import-time/syntax crashes (like a stale-cache parse error) fast.
 *  2. Plugin validation: every public/plugins/*.js passes the sandbox validator.
 *  3. HTTP smoke (optional): if a server is reachable, checks the core routes
 *     return 200. Run with SMOKE_HTTP=1 after `npm run build && npm start`.
 *
 * Usage: node scripts/smoke_test.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const require = createRequire(pathToFileURL(`${ROOT}/scripts/placeholder.mjs`).href);

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

// ---- 1. Module-load smoke ----
const PURE = {
  "engine/inpaintFallback.ts": (m) => m.inpaintFallback(new Uint8ClampedArray(16), new Uint8ClampedArray(16), 4, 4).data.length,
  "engine/rawDemosaic.ts": (m) => m.demosaic(new Uint8Array(16), 4, 4, "RGGB").length,
  "engine/healEngine.ts": (m) => m.findHealOffset(new Uint8ClampedArray(64), 4, 4, 2, 2, 1).dx,
  "engine/shapeBoolean.ts": (m) => m.traceMask(new Uint8ClampedArray(16), 4, 4).length,
  "engine/keyframes.ts": (m) => m.interpolate([{ t: 0, v: 0 }, { t: 10, v: 10 }], 5),
  "engine/adjustmentCore.ts": (m) => m.applyHueSat(new Uint8ClampedArray(16), 0, 0, 0),
  "engine/refineEdgeCore.ts": (m) => m.edgeFeatherAlpha(new Uint8ClampedArray(16), 4, 4, 1, 1),
  "engine/pathEditCore.ts": (m) => m.parsePathNodes([["M", 0, 0], ["L", 10, 0]]).nodes.length,
  "engine/historyEngine.ts": (m) => new m.HistoryEngine({ toJSON: () => ({}), loadFromJSON: () => Promise.resolve(), requestRenderAll: () => {} }, { coalesceMs: 0 }).reset(),
};
for (const [rel, call] of Object.entries(PURE)) {
  try {
    const mod = await import(pathToFileURL(`${ROOT}/${rel}`).href);
    call(mod);
    check(`loads ${rel}`, true);
  } catch (e) {
    check(`loads ${rel}`, false);
    console.log(`   -> ${e?.message ?? e}`);
  }
}

// ---- 2. Plugin validation ----
const { validatePluginCode } = await import(pathToFileURL(`${ROOT}/engine/pluginRuntimeCore.ts`).href);
const pluginFiles = readdirSync(`${ROOT}/public/plugins`).filter((f) => f.endsWith(".js"));
let invalid = [];
for (const f of pluginFiles) {
  const code = readFileSync(`${ROOT}/public/plugins/${f}`, "utf8");
  const probs = validatePluginCode(code);
  if (probs.length) invalid.push(`${f}: ${probs.join("; ")}`);
}
check(`plugins validate (${pluginFiles.length} files)`, invalid.length === 0);
if (invalid.length) console.log("   ", invalid.join("\n    "));

// ---- 3. HTTP smoke (optional) ----
if (process.env.SMOKE_HTTP) {
  const base = process.env.SMOKE_BASE ?? "http://localhost:3000";
  const routes = ["/", "/editor", "/settings", "/projects", "/manifest.webmanifest", "/icon.svg"];
  for (const r of routes) {
    try {
      const res = await fetch(base + r, { signal: AbortSignal.timeout(10000) });
      check(`GET ${r} -> ${res.status}`, res.status === 200);
    } catch (e) {
      check(`GET ${r} (no server)`, false);
      console.log(`   -> ${e?.message ?? e}`);
    }
  }
}

console.log(failures === 0 ? "\nSmoke test passed." : `\nSmoke test FAILED (${failures}).`);
process.exit(failures === 0 ? 0 : 1);