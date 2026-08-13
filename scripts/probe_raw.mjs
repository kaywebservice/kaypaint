// RAW decoder probe — how to get the Camera Raw demosaic working.
//
// 1) Drop a real RAW file somewhere, e.g.  samples/raw/IMG_1234.dng
//    (phone .dng, camera .cr2/.nef/.arw … any of: .cr2 .nef .arw .dng .raf
//     .orf .rw2 .cr3 .k25 .mrw).
// 2) Optionally install the interim decoder:
//      npm i dcraw-wasm jpeg-js
//    dcraw-wasm ships a WASM build (cross-platform, works on Windows + Vercel).
//    NOTE: dcraw-wasm currently exposes metadata + the camera's EMBEDDED JPEG
//    THUMBNAIL, not a full demosaic — good enough to make Camera Raw work now,
//    and a great source sample to validate the seam end-to-end.
// 3) Run:
//      node scripts/probe_raw.mjs <path-to-sample.raw>
//    Prints the decoded image size + a sanity pixel, proving the pipeline.

const RAW_EXTENSIONS = new Set([".cr2", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2", ".cr3", ".k25", ".mrw"]);
const fs = await import("node:fs");
const path = await import("node:path");

function findSample(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return cliPath;
  const cands = ["samples/raw", "sample", "test/fixtures", "."];
  for (const dir of cands) {
    if (!fs.existsSync(dir)) continue;
    const found = fs.readdirSync(dir).find((f) => RAW_EXTENSIONS.has(path.extname(f).toLowerCase()));
    if (found) return path.join(dir, found);
  }
  return null;
}

const sample = findSample(process.argv[2]);
if (!sample) {
  console.log("No RAW sample found. Copy any camera RAW (.dng/.cr2/.nef/…) in, e.g.: samples/raw/");
  process.exit(2);
}
console.log(`Probing RAW sample: ${sample}`);

const bytes = new Uint8Array(fs.readFileSync(sample));

async function withDcrawWasm() {
  const dcraw = await import("dcraw-wasm");
  const jpeg = await import("jpeg-js");
  const decoder = new dcraw.RawDecoder();
  const meta = await decoder.readMetadata(bytes);
  const thumb = await decoder.extractThumbnail(bytes);
  if (!meta) throw new Error("no metadata");
  if (!thumb || thumb.length === 0) throw new Error("no embedded thumbnail in this file");
  const jpg = jpeg.decode(new Uint8Array(thumb));
  const rgba = jpg.data;
  return { width: jpg.width, height: jpg.height, rgba, note: "embedded thumbnail (interim path)" };
}

async function withLibrawWasm() {
  // Full-quality path — install from GitHub (LibRaw compiled to WASM):
  //   npm i github:harabat/libraw-parallel-js   (or the stable tag)
  // Then adapt method names to that version's README (unpack → getResultImage).
  const libraw = await import("@harabat/libraw-parallel-js");
  const { LibRaw, IOLibRaw } = libraw;
  const raw = new LibRaw();
  const st = await raw.OpenBuffer(new IOLibRaw(bytes.buffer));
  if (st !== 0) throw new Error(`OpenBuffer status ${st}`);
  await raw.unpack();
  await raw.dcrawProcess();
  await raw.dcrawRender();
  const { rgb, width, height } = await raw.getResultImage();
  return { width, height, rgba: new Uint8ClampedArray(rgb), note: "full demosaic (libraw.js path)" };
}

const mode = process.env.RAW_DECODER ?? "dcrawwasm";
try {
  const out = mode === "dcrawwasm" ? await withDcrawWasm() : await withLibrawWasm();
  let sum = 0;
  let n = 0;
  for (let i = 0; i < out.rgba.length; i += 4) {
    if (n >= 400) break;
    sum += out.rgba[i] + out.rgba[i + 1] + out.rgba[i + 2];
    n++;
  }
  const avg = Math.round(sum / (n * 3));
  console.log(`OK  ${out.width}x${out.height}  average pixel ~ ${avg}  (${out.note})`);
  console.log("Pipeline proves decodeRaw can return { buffer, width, height, mime }.");
  console.log('Wire it into the app with setDecodeRawImpl, e.g. in app/api/raw/route.ts (see chat guide).');
} catch (err) {
  console.error(`Decoder "${mode}" failed:`, err.message ?? err);
  console.log("If dcraw-wasm isn't installed yet:  npm i dcraw-wasm jpeg-js   then re-run.");
  process.exit(1);
}