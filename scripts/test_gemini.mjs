import {
  buildPrompt,
  extractImageUrl,
  imagePart,
  stripDataUrl,
} from "../lib/geminiImage.ts";
import assert from "node:assert/strict";

// stripDataUrl: data URL and raw base64
let d = stripDataUrl("data:image/png;base64,AAAA");
assert.equal(d.mimeType, "image/png");
assert.equal(d.bytes, "AAAA");
let j = stripDataUrl("data:image/jpeg;base64,SUFB");
assert.equal(j.mimeType, "image/jpeg");
assert.equal(j.bytes, "SUFB");
let raw = stripDataUrl("SUFB");
assert.equal(raw.mimeType, "image/png");
assert.equal(raw.bytes, "SUFB");
console.log("stripDataUrl: ok");

// imagePart round-trip
let p = imagePart("data:image/png;base64,AAAA");
assert.deepEqual(p, { inlineData: { data: "AAAA", mimeType: "image/png" } });
console.log("imagePart: ok");

// buildPrompt covers all modes + size injection
let g = buildPrompt("generate", "a cat", 512, 512);
assert.ok(g.includes("512x512"));
assert.ok(g.includes("seamlessly extending"));
let inp = buildPrompt("inpaint", "remove the hat", 0, 0);
assert.equal(inp, "remove the hat");
let u = buildPrompt("upscale", "", 2048, 2048);
assert.ok(u.includes("2048x2048"));
let empty = buildPrompt("inpaint", "");
assert.ok(empty.includes("Inpaint this region"));
console.log("buildPrompt: ok");

// extractImageUrl: inlineData path
let resp = {
  candidates: [
    { content: { parts: [
      { text: "x" },
      { inlineData: { data: "AAAA", mimeType: "image/png" } },
    ] } },
  ],
};
let r = extractImageUrl(resp);
assert.ok(r !== null);
assert.equal(r.dataUrl, "data:image/png;base64,AAAA");
assert.equal(r.mimeType, "image/png");
console.log("extractImageUrl (inline): ok");

// extractImageUrl: image.imageBytes path (fallback)
let resp2 = {
  candidates: [{ content: { parts: [
    { image: { imageBytes: "BBBB" } },
  ] } }],
};
let r2 = extractImageUrl(resp2);
assert.ok(r2 !== null);
assert.equal(r2.dataUrl, "data:image/png;base64,BBBB");
console.log("extractImageUrl (image): ok");

// extractImageUrl: no image -> null
assert.equal(extractImageUrl({ candidates: [] }), null);
assert.equal(extractImageUrl({}), null);
console.log("extractImageUrl (none): ok");

console.log("ALL TESTS PASSED");
