import assert from "node:assert/strict";
import {
  RAW_EXTENSIONS,
  RawError,
  _decodeRawImpl,
  decodeRaw,
  extOf,
  isRaw,
  mimeForExt,
  parseBase64Input,
  setDecodeRawImpl,
} from "../engine/rawImport.ts";

// extOf + isRaw
assert.equal(extOf("DSC_1234.NEF"), ".nef");
assert.equal(extOf("IMG.CR2"), ".cr2");
assert.equal(extOf("noext"), "");
assert.equal(extOf("UPPER.ARW"), ".arw");
assert.ok(isRaw("a.nef"));
assert.ok(isRaw("a.DNG"));
assert.ok(!isRaw("a.jpg"));
assert.ok(!isRaw("noext"));
assert.equal(RAW_EXTENSIONS.size, 10);
console.log("ext/isRaw: ok");

// mimeForExt
assert.equal(mimeForExt(".dng"), "image/x-adobe-dng");
assert.equal(mimeForExt(".nef"), "image/x-nikon-nef");
assert.equal(mimeForExt(".bin"), "image/x-raw");
console.log("mimeForExt: ok");

// parseBase64Input: data URL + raw b64
{
  const { bytes } = parseBase64Input("data:image/x-nikon-nef;base64,SGVsbG8=");
  assert.deepEqual(Array.from(bytes), Array.from(Buffer.from("Hello", "ascii")));
  const { bytes: raw } = parseBase64Input("SGVsbG8=");
  assert.deepEqual(Array.from(raw), Array.from(Buffer.from("Hello", "ascii")));
  console.log("parseBase64Input: ok");
}

// decodeRaw seam: default throws NO_DECODER
{
  let threw = false;
  try {
    await decodeRaw({ name: "x.nef", bytes: new Uint8Array() });
  } catch (e) {
    threw = true;
    assert.ok(e instanceof RawError);
    assert.equal(e.code, "NO_DECODER");
    assert.ok(/No RAW decoder/.test(e.message));
  }
  assert.ok(threw, "decodeRaw default should throw");
  console.log("decodeRaw default(NO_DECODER): ok");
}

// decodeRaw: injected impl returns a valid image
{
  setDecodeRawImpl((_u) => ({
    buffer: new Uint8Array([1, 2, 3]).buffer,
    width: 2,
    height: 2,
    mime: "image/png",
    format: "image/x-raw",
  }));
  const d = await decodeRaw({ name: "x.arw", bytes: new Uint8Array() });
  assert.equal(d.width, 2);
  assert.equal(d.height, 2);
  assert.equal(d.mime, "image/png");
  assert.equal(typeof _decodeRawImpl, "function");
  console.log("decodeRaw injected: ok");
}

// decodeRaw: injected impl returns invalid -> DECODE_FAILED
{
  setDecodeRawImpl(() => ({ buffer: new ArrayBuffer(0), width: 0, height: 0, mime: "image/x-raw", format: "image/x-raw" }));
  let threw = false;
  try {
    await decodeRaw({ name: "x.cr2", bytes: new Uint8Array() });
  } catch (e) {
    threw = true;
    assert.ok(e instanceof RawError);
    assert.equal(e.code, "DECODE_FAILED");
  }
  assert.ok(threw);
  console.log("decodeRaw invalid->DECODE_FAILED: ok");
}

console.log("ALL RAW TESTS PASSED");
