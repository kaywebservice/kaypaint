export const TIFF_ICCPROFILE_TAG = 34675;

export function buildTiff16(
  width: number,
  height: number,
  dpi: number,
  rgba: Uint8ClampedArray,
  icc?: Uint8Array
): Uint8Array {
  const TYPE_SHORT = 3;
  const TYPE_LONG = 4;
  const TYPE_RATIONAL = 5;
  const TYPE_UNDEFINED = 7;

  const bytesPerRow = width * 6;
  const stripBytes = bytesPerRow * height;

  const bitsPerSample = new Uint8Array(6);
  const bpsView = new DataView(bitsPerSample.buffer);
  for (let i = 0; i < 3; i++) bpsView.setUint16(i * 2, 16, true);

  const xres = new Uint8Array(8);
  const yres = new Uint8Array(8);
  const xv = new DataView(xres.buffer);
  const yv = new DataView(yres.buffer);
  xv.setUint32(0, dpi, true);
  xv.setUint32(4, 1, true);
  yv.setUint32(0, dpi, true);
  yv.setUint32(4, 1, true);

  const pixels = new Uint8Array(stripBytes);
  const pv = new DataView(pixels.buffer);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const p16 = (y * bytesPerRow + x * 6) / 2;
      pv.setUint16(p16, rgba[si] * 257, false);
      pv.setUint16(p16 + 1, rgba[si + 1] * 257, false);
      pv.setUint16(p16 + 2, rgba[si + 2] * 257, false);
    }
  }

  const chunks: { data: Uint8Array; align: number; key: string }[] = [
    { data: bitsPerSample, align: 2, key: "bits" },
    { data: xres, align: 4, key: "xres" },
    { data: yres, align: 4, key: "yres" },
    { data: pixels, align: 2, key: "pixels" },
  ];
  if (icc && icc.length > 0) {
    chunks.push({ data: icc, align: 4, key: "icc" });
  }

  const entryCount = 12 + (icc && icc.length > 0 ? 1 : 0);

  const offsets: Record<string, number> = {};
  let cursor = 8 + 2 + 12 * entryCount + 4;
  for (const c of chunks) {
    while (cursor % c.align !== 0) cursor++;
    offsets[c.key] = cursor;
    cursor += c.data.length;
  }
  const total = cursor;

  type Entry = { tag: number; type: number; count: number; value: number };
  const dim = (v: number) => (v > 65535 ? TYPE_LONG : TYPE_SHORT);
  const entries: Entry[] = [
    { tag: 256, type: dim(width), count: 1, value: width },
    { tag: 257, type: dim(height), count: 1, value: height },
    { tag: 258, type: TYPE_SHORT, count: 3, value: offsets.bits },
    { tag: 259, type: TYPE_SHORT, count: 1, value: 1 },
    { tag: 262, type: TYPE_SHORT, count: 1, value: 2 },
    { tag: 273, type: TYPE_LONG, count: 1, value: offsets.pixels },
    { tag: 277, type: TYPE_SHORT, count: 1, value: 3 },
    { tag: 278, type: dim(height), count: 1, value: height },
    { tag: 279, type: TYPE_LONG, count: 1, value: stripBytes },
    { tag: 282, type: TYPE_RATIONAL, count: 1, value: offsets.xres },
    { tag: 283, type: TYPE_RATIONAL, count: 1, value: offsets.yres },
    { tag: 296, type: TYPE_SHORT, count: 1, value: 2 },
  ];
  if (icc && icc.length > 0) {
    entries.push({
      tag: TIFF_ICCPROFILE_TAG,
      type: TYPE_UNDEFINED,
      count: icc.length,
      value: offsets.icc,
    });
  }

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, 0x49);
  dv.setUint8(1, 0x49);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true);
  dv.setUint16(8, entries.length, true);
  entries.forEach((e, i) => {
    const p = 8 + 2 + i * 12;
    dv.setUint16(p, e.tag, true);
    dv.setUint16(p + 2, e.type, true);
    dv.setUint32(p + 4, e.count, true);
    if (e.type === TYPE_SHORT) dv.setUint16(p + 8, e.value, true);
    else dv.setUint32(p + 8, e.value, true);
  });
  dv.setUint32(8 + 2 + entries.length * 12, 0, true);

  let pos = 8 + 2 + entries.length * 12 + 4;
  for (const c of chunks) {
    while (pos % c.align !== 0) pos++;
    out.set(c.data, pos);
    pos += c.data.length;
  }
  return out;
}