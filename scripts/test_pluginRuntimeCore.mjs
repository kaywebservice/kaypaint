import {
  validatePluginCode,
  runInSandbox,
  createPluginSandbox,
  checkPermission,
  requirePermission,
  ALL_PERMISSIONS,
} from "../engine/pluginRuntimeCore.ts";

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

// ---- validatePluginCode ----
check("allows simple math", validatePluginCode("1+1").length === 0);
check("blocks eval", validatePluginCode("eval('x')").length > 0);
check("blocks Function constructor", validatePluginCode("new Function('x')").length > 0);
check("blocks document access", validatePluginCode("document.body").length > 0);
check("blocks window access", validatePluginCode("window.alert").length > 0);
check("blocks fetch", validatePluginCode("fetch('/')").length > 0);
check("blocks localStorage", validatePluginCode("localStorage.setItem('x','y')").length > 0);
check("allows safe code", validatePluginCode("const x = 1+2; x*3").length === 0);

// ---- runInSandbox ----
check("executes safe code", runInSandbox("1+2").ok && runInSandbox("1+2").value === 3);
check("returns error on forbidden", !runInSandbox("eval('x')").ok);
check("isolated scope", runInSandbox("(() => { const x = 5; return x; })()").ok && runInSandbox("(() => { const x = 5; return x; })()").value === 5);
check("allows allowed globals", runInSandbox("JSON.stringify({a:1})", ["JSON"]).ok && runInSandbox("JSON.stringify({a:1})", ["JSON"]).value === '{"a":1}');
check("blocks disallowed globals", !runInSandbox("fetch('/')", ["JSON"]).ok);

// ---- permission checks ----
const mockCtx = {
  permissions: new Set(["canvas.read", "layers.write", "history.read"]),
};
check("checkPermission grants", checkPermission(mockCtx, "canvas.read"));
check("checkPermission denies", !checkPermission(mockCtx, "canvas.write"));
check("requirePermission passes", (() => { try { requirePermission(mockCtx, "layers.write"); return true; } catch { return false; } })());
check("requirePermission throws", (() => { try { requirePermission(mockCtx, "network.fetch"); return false; } catch { return true; } })());

// ---- createPluginSandbox ----
const manifest = {
  id: "test-plugin",
  name: "Test",
  version: "1.0.0",
  permissions: ["canvas.read", "layers.write"],
  apiVersion: 1,
  main: "index.js",
};
const mockApi = { canvas: { getInfo: () => ({ width: 100, height: 100, zoom: 1, rotation: 0 }) } };
const mockStorage = { get: async () => null, set: async () => {}, delete: async () => {}, clear: async () => {}, keys: async () => [] };
const mockEvents = { on: () => () => {}, emit: () => {}, once: () => () => {} };

const sandbox = createPluginSandbox(manifest, mockApi, mockStorage, mockEvents);
check("sandbox has context", !!sandbox.context);
check("sandbox context has manifest", sandbox.context.manifest.id === "test-plugin");
check("sandbox context has permissions", sandbox.context.permissions.has("canvas.read"));
check("sandbox run works", sandbox.run("1+1").ok && sandbox.run("1+1").value === 2);
check("sandbox run blocks forbidden", !sandbox.run("eval('x')").ok);

// ---- plugin environment injection ----
check("injects api identifier", (() => {
  const r = sandbox.run("api.canvas.getInfo().width");
  return r.ok && r.value === 100;
})());
check("injects context identifier", (() => {
  const r = sandbox.run("context.manifest.id");
  return r.ok && r.value === "test-plugin";
})());
check("injects permissions identifier", (() => {
  const r = sandbox.run("permissions.has('canvas.read')");
  return r.ok && r.value === true;
})());
check("injects storage identifier", (() => {
  const r = sandbox.run("typeof storage.get");
  return r.ok && r.value === "function";
})());
check("injects events identifier", (() => {
  const r = sandbox.run("typeof events.emit");
  return r.ok && r.value === "function";
})());
check("runModule passes api too", (() => {
  const r = sandbox.runModule("api.canvas.getInfo().height");
  return r.ok && r.value === 100;
})());

// ---- ALL_PERMISSIONS list ----
check("ALL_PERMISSIONS has expected count", ALL_PERMISSIONS.length === 26);
check("ALL_PERMISSIONS contains canvas.read", ALL_PERMISSIONS.includes("canvas.read"));
check("ALL_PERMISSIONS contains text.write", ALL_PERMISSIONS.includes("text.write"));
check("ALL_PERMISSIONS contains file.write", ALL_PERMISSIONS.includes("file.write"));
check("ALL_PERMISSIONS contains video", ALL_PERMISSIONS.includes("video"));
check("ALL_PERMISSIONS contains layers.write", ALL_PERMISSIONS.includes("layers.write"));
check("ALL_PERMISSIONS contains history.write", ALL_PERMISSIONS.includes("history.write"));

console.log(failures === 0 ? "\nAll pluginRuntimeCore tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);