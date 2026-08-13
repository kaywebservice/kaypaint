/**
 * Minimal, dependency-free PNG encoder with optional iCCP (ICC profile)
 * embedding. Uses stored (uncompressed) DEFLATE blocks so it runs identically
 * in Node and browsers with no zlib dependency. Pure & import-free so it can
 * be unit-tested in Node alongside the TIFF/ICC work.
 *
 * Chunk order produced: signature, IHDR, [iCCP], IDAT, IEND.
 */

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const head = u32be(data.length);
  const body = new TextEncoder().encode(type);
  const sig = new Uint8Array(4 + data.length);
  sig.set(body, 0);
  sig.set(data, 4);
  const crc = u32be(crc32(sig));
  out.set(head, 0);
  out.set(body, 4);
  out.set(data, 8);
  out.set(crc, 8 + data.length);
  return out;
}

export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Wrap `data` in a zlib stream using stored (BTYPE=00) blocks plus the
 * required Adler-32 trailer. Valid DEFLATE that any inflater (PNG decoders,
 * zlib, Node) can read — just not compressed.
 */
export function storedDeflate(data: Uint8Array): Uint8Array {
  const header = new Uint8Array([0x78, 0x01]);
  const parts: Uint8Array[] = [header];
  let pos = 0;
  while (true) {
    const len = Math.min(65535, data.length - pos);
    const finalBlock = pos + len >= data.length;
    const blockHead = new Uint8Array(5);
    blockHead[0] = finalBlock ? 1 : 0; // BFINAL=1 for last, BTYPE=00
    blockHead[1] = len & 0xff;
    blockHead[2] = (len >> 8) & 0xff;
    blockHead[3] = (~len) & 0xff;
    blockHead[4] = ((~len) >> 8) & 0xff;
    parts.push(blockHead);
    if (len > 0) parts.push(data.subarray(pos, pos + len));
    pos += len;
    if (pos >= data.length) break;
  }
  parts.push(u32be(adler32(data)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function pngIccpChunk(profile: Uint8Array, name = "sRGB ICC Profile"): Uint8Array {
  const nameBytes = new TextEncoder().encode(name.slice(0, 79));
  const method = new Uint8Array([0]); // compression method 0 = deflate
  const deflated = storedDeflate(profile);
  const data = new Uint8Array(nameBytes.length + 1 + 1 + deflated.length);
  data.set(nameBytes, 0);
  data[nameBytes.length] = 0; // null terminator
  data[nameBytes.length + 1] = method[0];
  data.set(deflated, nameBytes.length + 2);
  return chunk("iCCP", data);
}

export type PngEncodeOptions = {
  icc?: Uint8Array;
  iccName?: string;
};

export function encodePng(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  options: PngEncodeOptions = {}
): Uint8Array {
  if (width <= 0 || height <= 0) throw new Error("invalid PNG dimensions");
  if (rgba.length < width * height * 4) throw new Error("rgba too short");

  // IHDR: 8-bit, color type 6 (RGBA)
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Filter 0 (None) per scanline + raw pixels in IDAT
  const raw = new Uint8Array(width * height * 4 + height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    const rowStart = y * width * 4;
    raw.set(rgba.subarray(rowStart, rowStart + width * 4), p);
    p += width * 4;
  }
  const idat = storedDeflate(raw);

  const chunks: Uint8Array[] = [];
  chunks.push(chunk("IHDR", ihdr));
  if (options.icc && options.icc.length > 0) {
    chunks.push(pngIccpChunk(options.icc, options.iccName));
  }
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", new Uint8Array(0)));

  const total = 8 + chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  out.set(PNG_SIG, 0);
  let o = 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}