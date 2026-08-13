/**
 * Camera Raw import: accepts a RAW file as base64 + name, validates it, and
 * hands it to a pluggable decoder.
 *
 * The decode step is intentionally an injectable seam (`decodeRaw`) because the
 * actual demosaic must be implemented by a native/WASM decoder (e.g. a dcraw
 * WASM build) which is not available as a small npm package here. When a real
 * decoder is vendored, implement `decodeRaw` (or swap the exported default) and
 * the route `app/api/raw/route.ts` wires up with zero changes.
 *
 * Testable in Node (no Next runtime required): the pure helpers below cover
 * extension validation + error classification, and are exercised in
 * `scripts/test_raw.mjs`.
 */

import { demosaic, autoWhiteBalance } from "@/engine/rawDemosaic";
import { encodePng } from "@/engine/pngWriter";

export type RawFormat =
  | "image/x-adobe-dng"
  | "image/x-canon-cr2"
  | "image/x-nikon-nef"
  | "image/x-sony-arw"
  | "image/x-fuji-raf"
  | "image/x-olympus-orf"
  | "image/x-panasonic-rw2"
  | "image/x-canon-cr3"
  | "image/x-kodak-k25"
  | "image/x-kodak-mrw"
  | "image/x-raw";

export interface RawUpload {
  name: string;
  bytes: Uint8Array;
  /** Bayer layout metadata for the pure-JS demosaic decoder. */
  meta?: {
    width: number;
    height: number;
    pattern?: "RGGB" | "GBRG" | "GRBG" | "BGGR";
    blackLevel?: number;
    whiteLevel?: number;
    /** 16-bit samples instead of 8-bit */
    bits16?: boolean;
  };
}

export interface DecodedImage {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  mime: string;
  format: RawFormat;
}

export const RAW_EXTENSIONS = new Set(
  [".cr2", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2", ".cr3", ".k25", ".mrw"]
);

export class RawError extends Error {
  code: "NO_DECODER" | "NOT_RAW" | "BAD_REQUEST" | "DECODE_FAILED";
  constructor(code: RawError["code"], message: string) {
    super(message);
    this.name = "RawError";
    this.code = code;
  }
}

/**
 * Pluggable RAW decoder. The default implementation is a pure-JS Bayer
 * demosaic: it works for plain Bayer data when `meta` (width/height/pattern)
 * is supplied, and returns NO_DECODER otherwise. Replace/export-override this
 * with a libraw/dcraw WASM build to decode compressed CR2/NEF/ARW files.
 */
export let _decodeRawImpl: (upload: RawUpload) => Promise<DecodedImage> | DecodedImage =
  (upload: RawUpload) => {
    if (!upload.meta || upload.meta.width <= 0 || upload.meta.height <= 0) {
      throw new RawError(
        "NO_DECODER",
        "No RAW decoder installed. Vendor a demosaic/decoder (libraw WASM) or supply Bayer metadata."
      );
    }
    const meta = upload.meta;
    const w = meta.width;
    const h = meta.height;
    const expected = w * h * (meta.bits16 ? 2 : 1);
    if (upload.bytes.length < expected) {
      throw new RawError("BAD_REQUEST", "Bayer data is smaller than the declared dimensions.");
    }
    const bayer: Uint8Array | Uint16Array = meta.bits16
      ? new Uint16Array(upload.bytes.buffer, upload.bytes.byteOffset, w * h)
      : upload.bytes;
    const rgba = demosaic(
      bayer,
      w,
      h,
      meta.pattern ?? "RGGB",
      meta.blackLevel ?? 0,
      meta.whiteLevel ?? (meta.bits16 ? 65535 : 255)
    );
    const balanced = autoWhiteBalance(rgba, w, h);
    const png = encodePng(w, h, balanced);
    return {
      buffer: png.buffer as ArrayBuffer,
      width: w,
      height: h,
      mime: "image/png",
      format: "image/x-raw",
    };
  };

export function setDecodeRawImpl(impl: (upload: RawUpload) => Promise<DecodedImage> | DecodedImage): void {
  _decodeRawImpl = impl;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function mimeForExt(ext: string): RawFormat {
  switch (ext) {
    case ".dng": return "image/x-adobe-dng";
    case ".cr2": return "image/x-canon-cr2";
    case ".nef": return "image/x-nikon-nef";
    case ".arw": return "image/x-sony-arw";
    case ".raf": return "image/x-fuji-raf";
    case ".orf": return "image/x-olympus-orf";
    case ".rw2": return "image/x-panasonic-rw2";
    case ".cr3": return "image/x-canon-cr3";
    case ".k25": return "image/x-kodak-k25";
    case ".mrw": return "image/x-kodak-mrw";
    default: return "image/x-raw";
  }
}

export function isRaw(name: string): boolean {
  return RAW_EXTENSIONS.has(extOf(name));
}

export function parseBase64Input(input: string): { bytes: Uint8Array } {
  const s = input.replace(/^data:([a-z]+\/[a-z0-9.+-]+);base64,/i, "");
  const cleaned = s.replace(/\s/g, "");
  if (typeof Buffer !== "undefined") {
    return { bytes: new Uint8Array(Buffer.from(cleaned, "base64")) };
  }
  return { bytes: Uint8Array.from(globalThis.atob(cleaned), (c) => c.charCodeAt(0)) };
}

export async function decodeRaw(upload: RawUpload): Promise<DecodedImage> {
  const out = await _decodeRawImpl(upload);
  if (!out || !out.buffer || out.width <= 0 || out.height <= 0) {
    throw new RawError("DECODE_FAILED", "Decoder returned an invalid image.");
  }
  return out;
}
