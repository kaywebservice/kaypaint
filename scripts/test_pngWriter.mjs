import { inflateSync } from "node:zlib";
import { crc32, encodePng, pngIccpChunk, storedDeflate } from "../engine/pngWriter.ts";
import { sRgbProfile } from "../engine/iccEngine.ts";

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

function u32be(v, o) {
  return ((v[o] << 24) | (v[o + 1] << 16) | (v[o + 2] << 8) | v[o + 3]) >>> 0;
}
function ascii(v, o, n) {
  return String.fromCharCode(...Array.from(v.subarray(o, o + n)));
}
function parseChunks(bytes) {
  const out = [];
  let o = 8;
  while (o + 8 <= bytes.length) {
    const len = u32be(bytes, o);
    const type = ascii(bytes, o + 4, 4);
    out.push({ len, type, data: bytes.subarray(o + 8, o + 8 + len), crc: u32be(bytes, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}
function chunkOk(c) {
  const sig = new Uint8Array(4 + c.len);
  sig.set(new TextEncoder().encode(c.type), 0);
  sig.set(c.data, 4);
  return crc32(sig) === c.crc;
}

// ---- storedDeflate round-trips through real zlib ----
for (const size of [0, 1, 100, 65535, 70000, 200000]) {
  const src = new Uint8Array(size);
  for (let i = 0; i < size; i++) src[i] = (i * 7 + 3) & 0xff;
  check(`storedDeflate round-trip size=${size}`, (() => {
    const dec = inflateSync(storedDeflate(src));
    if (dec.length !== src.length) return false;
    for (let i = 0; i < src.length; i++) if (dec[i] !== src[i]) return false;
    return true;
  })());
}
check("storedDeflate empty", inflateSync(storedDeflate(new Uint8Array(0))).length === 0);

// ---- encodePng structure ----
const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
const profile = sRgbProfile();

const png = encodePng(2, 1, rgba, { icc: profile });
check("png starts with signature",
  png[0] === 0x89 && ascii(png, 1, 3) === "PNG");
const chunks = parseChunks(png);
check("chunk order IHDR,iCCP,IDAT,IEND",
  chunks.map((c) => c.type).join(",") === "IHDR,iCCP,IDAT,IEND");
check("all chunk CRCs valid", chunks.every(chunkOk));
check("IHDR dims 2x1 RGBA8", (() => {
  const h = chunks[0].data;
  return u32be(h, 0) === 2 && u32be(h, 4) === 1 && h[8] === 8 && h[9] === 6;
})());

// iCCP: name + null + method + deflate(profile)
const iccp = chunks[1];
const nameLen = iccp.data.indexOf(0);
check("iCCP name present", ascii(iccp.data, 0, nameLen).length > 0 && nameLen > 0);
check("iCCP method 0", iccp.data[nameLen + 1] === 0);
check("iCCP embeds exact profile", (() => {
  const dec = inflateSync(new Uint8Array(iccp.data.subarray(nameLen + 2)));
  if (dec.length !== profile.length) return false;
  for (let i = 0; i < profile.length; i++) if (dec[i] !== profile[i]) return false;
  return true;
})());

// IDAT: inflate -> filter 0 prefix + raw pixels
check("IDAT decodes to filtered raw", (() => {
  const dec = inflateSync(new Uint8Array(chunks[2].data));
  const expected = new Uint8Array(2 * 1 * 4 + 1);
  expected[0] = 0;
  expected.set(rgba, 1);
  if (dec.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) if (dec[i] !== expected[i]) return false;
  return true;
})());

// no-icc variant emits no iCCP chunk
check("no icc -> no iCCP chunk",
  parseChunks(encodePng(2, 1, rgba)).map((c) => c.type).join(",") === "IHDR,IDAT,IEND");

// pngIccpChunk (raw profile) produces a structurally valid iCCP chunk
check("pngIccpChunk chunk structure + CRC valid", (() => {
  const custom = pngIccpChunk(profile, "Test Profile");
  const len = u32be(custom, 0);
  const type = ascii(custom, 4, 4);
  const data = custom.subarray(8, 8 + len);
  const crc = u32be(custom, 8 + len);
  const sig = new Uint8Array(4 + len);
  sig.set(new TextEncoder().encode(type), 0);
  sig.set(data, 4);
  const nl = data.indexOf(0);
  return type === "iCCP" && data[nl + 1] === 0 &&
    inflateSync(new Uint8Array(data.subarray(nl + 2))).length === profile.length &&
    crc32(sig) === crc;
})());

console.log(failures === 0 ? "\nAll pngWriter tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);