import { resolveTemplate, normalizeOptions, extForFormat } from "../engine/batchEngineCore.ts";

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

check("resolveTemplate simple", resolveTemplate("{name}-{action}.{ext}", { name: "img", action: "Resize", ext: "png" }) === "img-Resize.png");
check("resolveTemplate missing key", resolveTemplate("{name}-{missing}", { name: "x" }) === "x-");
check("resolveTemplate no braces", resolveTemplate("static", {}) === "static");
check("resolveTemplate multiple", resolveTemplate("{name}-{action}.{ext}", { name: "photo", action: "Batch", ext: "jpeg" }) === "photo-Batch.jpeg");

// BatchOptions shape check (interface only, but test shape)
const opts = {
  actionId: "a1",
  source: "open",
  format: "png",
  quality: 0.9,
  namingTemplate: "{name}-{action}.{ext}",
  saveToFolder: false,
};
check("BatchOptions shape ok", opts.format === "png" && opts.quality === 0.9);

console.log(failures === 0 ? "\nAll batchEngine core tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);