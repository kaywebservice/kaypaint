import { generateSrgbProfile, sRgbProfile } from "../engine/iccEngine.ts";
import { buildTiff16, TIFF_ICCPROFILE_TAG } from "../engine/tiffWriter.ts";

let failures = 0;

function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

function le16(v, o) {
  return v[o] | (v[o + 1] << 8);
}
function le32(v, o) {
  return (
    (v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0
  );
}
function be32(v, o) {
  return (
    ((v[o] << 24) | (v[o + 1] << 16) | (v[o + 2] << 8) | v[o + 3]) >>> 0
  );
}
function sig4(v, o) {
  return String.fromCharCode(v[o], v[o + 1], v[o + 2], v[o + 3]);
}
function parseTiffIfd(bytes) {
  const count = le16(bytes, 8);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const p = 10 + i * 12;
    entries.push({
      tag: le16(bytes, p),
      type: le16(bytes, p + 2),
      count: le32(bytes, p + 4),
      value: le32(bytes, p + 8),
    });
  }
  return entries;
}
function findEntry(entries, tag) {
  return entries.find((e) => e.tag === tag);
}
function entryKey(entries) {
  return entries.map((e) => e.tag).join(",");
}

// ---- sRGB profile structure (ICC is big-endian) ----
const profile = generateSrgbProfile();
check("profile starts with acsp", sig4(profile, 0) === "acsp");
check("profile size field matches length", be32(profile, 4) === profile.length);
const pTagCount = be32(profile, 128);
check("profile tag count sane", pTagCount === 9);
check("profile header is RGB display",
  sig4(profile, 16) === "mntr" && sig4(profile, 20) === "RGB " && sig4(profile, 24) === "XYZ ");
const pTags = {};
for (let i = 0; i < pTagCount; i++) {
  const t = 132 + i * 12;
  pTags[sig4(profile, t)] = [be32(profile, t + 4), be32(profile, t + 8)];
}
check("profile has required tags",
  ["rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC", "wtpt", "desc", "cprt"]
    .every((id) => id in pTags));
check("profile tag offsets in-bounds and 4-aligned",
  Object.entries(pTags).every(([, [off, len]]) =>
    off >= 132 + pTagCount * 12 && off + len <= profile.length && off % 4 === 0
  ));
check("wtpt is D50",
  be32(profile, pTags.wtpt[0] + 12) >= Math.round(0.9642 * 65536) - 2 &&
  be32(profile, pTags.wtpt[0] + 12) <= Math.round(0.9642 * 65536) + 2);
check("rTRC is a curv tag with 256 points",
  sig4(profile, pTags.rTRC[0]) === "curv" &&
  be32(profile, pTags.rTRC[0] + 8) === 256);
check("sRgbProfile singleton stable", sRgbProfile().length === profile.length);

// ---- TIFF without icc: previous layout preserved ----
const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
const tiffPlain = buildTiff16(2, 1, 300, rgba);
const plainEntries = parseTiffIfd(tiffPlain);
check("plain tiff has 12 IFD entries", plainEntries.length === 12);
check("plain tiff has no ICCPROFILE tag", !findEntry(plainEntries, TIFF_ICCPROFILE_TAG));
check("plain tiff is little-endian II/42",
  tiffPlain[0] === 0x49 && tiffPlain[1] === 0x49 && le16(tiffPlain, 2) === 42);
check("plain tiff width/height tags", (() => {
  const w = findEntry(plainEntries, 256);
  const h = findEntry(plainEntries, 257);
  return w.value === 2 && h.value === 1;
})());

// ---- TIFF with icc: embedded profile ----
const tiff = buildTiff16(2, 1, 300, rgba, profile);
const entries = parseTiffIfd(tiff);
check("tiff with icc has 13 IFD entries", entries.length === 13);
check("tiff with icc tag present", !!findEntry(entries, TIFF_ICCPROFILE_TAG));
const iccEntry = findEntry(entries, TIFF_ICCPROFILE_TAG);
check("ICC entry type UNDEFINED(7) and count matches", iccEntry.type === 7 && iccEntry.count === profile.length);
check("ICC data offset in bounds",
  iccEntry.value + iccEntry.count <= tiff.length && iccEntry.value >= 170);
check("ICC data offset 4-aligned", iccEntry.value % 4 === 0);
let payloadMatch = true;
for (let i = 0; i < profile.length; i++) {
  if (tiff[iccEntry.value + i] !== profile[i]) {
    payloadMatch = false;
    break;
  }
}
check("ICC payload bytes match profile exactly", payloadMatch);
check("tiff ends exactly at data end", iccEntry.value + iccEntry.count === tiff.length);
check("entry keys differ only by ICC tag",
  entryKey(plainEntries) === "256,257,258,259,262,273,277,278,279,282,283,296" &&
  entryKey(entries) === "256,257,258,259,262,273,277,278,279,282,283,296,34675");

console.log(failures === 0 ? "\nAll ICC/TIFF tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);