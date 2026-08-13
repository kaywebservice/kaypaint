/**
 * Minimal ICC profile engine for CMYK soft-proof and conversion.
 *
 * Parses the v4 'mft2' LUT tag ('lutAtoBType') with curves + CLUT — the layout
 * used by most output (CMYK) profiles — and generates a synthetic CMYK profile
 * whose B2A0 CLUT is derived from our RGB->CMYK separation, so a working ICC
 * profile is always available. Also builds the ICC chunk for PSD embedding.
 */

const sig = (v: Uint8Array, o: number) =>
  String.fromCharCode(v[o], v[o + 1], v[o + 2], v[o + 3]);

class Reader {
  private v: Uint8Array;
  constructor(v: Uint8Array) {
    this.v = v;
  }
  u8(o: number) {
    return this.v[o];
  }
  u16(o: number) {
    return (this.v[o] << 8) | this.v[o + 1];
  }
  u32(o: number) {
    return (
      ((this.v[o] << 24) >>> 0) |
      ((this.v[o + 1] << 16) >>> 0) |
      ((this.v[o + 2] << 8) >>> 0) |
      this.v[o + 3]
    );
  }
  u16f(o: number) {
    return this.u16(o) / 65535;
  }
}

export interface IccCmykProfile {
  name: string;
  description: string;
  labToCmyk: (lab: [number, number, number]) => [number, number, number, number] | null;
  cmykToLab: (cmyk: [number, number, number, number]) => [number, number, number] | null;
}

export interface LutTransform {
  inputChannels: number;
  outputChannels: number;
  grid: number[];
  clut: Float32Array;
  aCurves: Float32Array[];
  bCurves: Float32Array[];
}

function curveAt(v: Uint8Array, o: number): { end: number; table: Float32Array } {
  if (sig(v, o) !== "curv") throw new Error("Expected 'curv'");
  const r = new Reader(v);
  const cnt = r.u32(o + 8);
  const table = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) table[i] = r.u16f(o + 12 + i * 2);
  return { end: o + 12 + cnt * 2, table };
}

function applyCurve(t: Float32Array, x: number) {
  if (t.length <= 1) return x;
  const f = Math.min(Math.max(x, 0), 1) * (t.length - 1);
  const i0 = Math.min(Math.floor(f), t.length - 2);
  const fr = f - i0;
  return t[i0] + (t[i0 + 1] - t[i0]) * fr;
}

function clutInterp(
  clut: Float32Array,
  grid: number[],
  outDim: number,
  input: number[]
): number[] {
  const n = grid.length;
  const cell = input.map((v, d) => Math.min(Math.max(v, 0), 1) * (grid[d] - 1));
  const base = cell.map((f, d) => Math.min(Math.floor(f), grid[d] - 1));
  const frac = cell.map((f) => f - Math.floor(f));
  const out = new Array(outDim).fill(0);

  let total = 1;
  const strides: number[] = [];
  for (let d = n - 1; d >= 0; d--) {
    strides[d] = total;
    total *= grid[d];
  }

  for (let corner = 0; corner < 1 << n; corner++) {
    let w = 1;
    let idx = 0;
    for (let d = 0; d < n; d++) {
      const hi = (corner >> d) & 1;
      const c = base[d] + hi;
      w *= hi ? frac[d] : 1 - frac[d];
      idx += c * strides[d];
    }
    if (idx < 0 || idx >= total) continue;
    const o = idx * outDim;
    for (let k = 0; k < outDim; k++) out[k] += w * clut[o + k];
  }
  return out;
}

/**
 * Parse a v4 'mft2' (lutAtoBType) tag into a transform. `o` is the tag's
 * offset within the profile buffer; `len` its length.
 * Layouts probed (signature byte indices):
 *   A: grid@6, offA@16, offClut@20, offB@24   (kaypaint generated)
 *   B: grid@6, offA@32, offClut@36, offB@40   (common real-world v4)
 *   C: grid@8, offA@32, offClut@36, offB@40   (v4 with 16-byte grid region)
 * The first variant whose A-curves table reads as 'curv' is accepted.
 */
export function parseLutTag(
  v: Uint8Array,
  o: number,
  len: number
): LutTransform | null {
  if (len < 28) return null;
  const r = new Reader(v);
  const sigStr = sig(v, o);
  if (sigStr !== "mft2" && sigStr !== "mft1") return null;

  const tryVariant = (
    gridStart: number,
    chAt: number,
    offAAt: number,
    offClutAt: number,
    offBAt: number
  ): LutTransform | null => {
    const nIn = r.u8(o + chAt);
    const nOut = r.u8(o + chAt + 1);
    if (nIn < 1 || nOut < 1 || nIn > 15) return null;

    const grid: number[] = [];
    for (let i = 0; i < nIn; i++) grid.push(r.u8(o + gridStart + i));
    const offA = r.u32(o + offAAt);
    const offClut = r.u32(o + offClutAt);
    const offB = r.u32(o + offBAt);
    if (offA > len || offClut > len || offB > len) return null;

    // Validate A curves
    const aCurves: Float32Array[] = [];
    let p = o + offA;
    try {
      for (let i = 0; i < nIn; i++) {
        if (sig(v, p) !== "curv") return null;
        const c = curveAt(v, p);
        aCurves.push(c.table);
        p = c.end;
      }
    } catch {
      return null;
    }

    const bCurves: Float32Array[] = [];
    p = o + offB;
    try {
      for (let i = 0; i < nOut; i++) {
        if (sig(v, p) !== "curv") return null;
        const c = curveAt(v, p);
        bCurves.push(c.table);
        p = c.end;
      }
    } catch {
      return null;
    }

    let clutSize = 1;
    for (const g of grid) clutSize *= g;
    if (clutSize <= 0 || clutSize > 1e7) return null;
    const dataStart = o + offClut + 4 + nIn;
    const need = clutSize * nOut * 2;
    if (dataStart + need > o + len) return null;

    const clut = new Float32Array(clutSize * nOut);
    for (let k = 0; k < clutSize * nOut; k++)
      clut[k] = r.u16f(dataStart + k * 2);

    return {
      inputChannels: nIn,
      outputChannels: nOut,
      grid,
      clut,
      aCurves,
      bCurves,
    };
  };

  return (
    tryVariant(10, 8, 16, 20, 24) ?? // kaypaint generated: chans@8/9, grid@10+
    tryVariant(6, 6, 16, 20, 24) ?? // v2-style: chans@6/7, grid@8
    tryVariant(6, 6, 32, 36, 40) ?? // v4-style: chans@6/7, offsets@32+
    tryVariant(8, 8, 32, 36, 40) ?? // chans@8/9, offsets@32+
    null
  );
}

function applyLut(
  lut: LutTransform,
  input: number[],
  useACurves: boolean,
  useBCurves: boolean
): number[] {
  let x = input.map((v, i) =>
    lut.aCurves[i] && useACurves ? applyCurve(lut.aCurves[i], v) : v
  );
  x = clutInterp(lut.clut, lut.grid, lut.outputChannels, x);
  if (useBCurves) {
    x = x.map((v, i) => (lut.bCurves[i] ? applyCurve(lut.bCurves[i], v) : v));
  }
  return x;
}

/** Parse a full ICC profile file and extract the B2A0 (PCS Lab -> CMYK) transform. */
export function parseIccProfile(
  bytes: ArrayBuffer | Uint8Array
): IccCmykProfile | null {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (v.length < 132) return null;
  const r = new Reader(v);
  if (sig(v, 0) !== "acsp") return null;
  const size = r.u32(4);
  if (size > v.length) return null;

  const tagCount = r.u32(128);
  if (tagCount > 2000 || 132 + tagCount * 12 > v.length) return null;

  const tags: Record<string, [number, number]> = {};
  for (let i = 0; i < tagCount; i++) {
    const t = 132 + i * 12;
    tags[sig(v, t)] = [r.u32(t + 4), r.u32(t + 8)];
  }

  const b2a = tags["B2A0"] ?? tags["b2a0"] ?? tags["BToA0"];
  if (!b2a) return null;
  const [off, len] = b2a;
  if (off + len > v.length) return null;

  const lut = parseLutTag(v, off, len);
  if (!lut) return null;

  let description = "CMYK profile";
  const desc = tags["desc"] ?? tags["dscm"];
  if (desc) {
    const [doff] = desc;
    if (sig(v, doff) === "desc") {
      const dlen2 = r.u32(doff + 8);
      description = "";
      for (let i = 0; i < dlen2 && i < 200; i++)
        description += String.fromCharCode(v[doff + 12 + i]);
    }
  }

  return {
    name: description,
    description,
    labToCmyk: (lab) => {
      const input = [lab[0] / 100, (lab[1] + 128) / 255, (lab[2] + 128) / 255];
      const out = applyLut(lut, input, true, false);
      return [out[0], out[1], out[2], out[3]] as [number, number, number, number];
    },
    cmykToLab: null as unknown as IccCmykProfile["cmykToLab"],
  };
}

// ---------------------------------------------------------------------------
// Synthetic profile generation
// ---------------------------------------------------------------------------

function u16byte(x: number) {
  return [(x >> 8) & 0xff, x & 0xff];
}
function u32byte(x: number) {
  return [
    (x >>> 24) & 0xff,
    (x >>> 16) & 0xff,
    (x >>> 8) & 0xff,
    x & 0xff,
  ];
}
function align4(n: number) {
  return Math.ceil(n / 4) * 4;
}

function identityCurvePoints(n = 3) {
  const t: number[] = [];
  for (let i = 0; i < n; i++) t.push(i / (n - 1));
  return t;
}

/** Lab (D50) -> sRGB (D65, Bradford-adapted). Values clamped to [0,1]. */
function labToSrgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const X = 0.9642 * Math.max(0, fx ** 3 > 0.008856 ? fx ** 3 : (116 * fx - 16) / 903.3);
  const Y = 1.0 * Math.max(0, fy ** 3 > 0.008856 ? fy ** 3 : (116 * fy - 16) / 903.3);
  const Z = 0.8249 * Math.max(0, fz ** 3 > 0.008856 ? fz ** 3 : (116 * fz - 16) / 903.3);
  const rl = X * 3.1338561 + Y * -1.6168667 + Z * -0.4906146;
  const gl = X * -0.9787684 + Y * 1.9161415 + Z * 0.033454;
  const bl = X * 0.0719453 + Y * -0.2289914 + Z * 1.4052427;
  const toSrgb = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return [
    Math.min(Math.max(toSrgb(rl), 0), 1),
    Math.min(Math.max(toSrgb(gl), 0), 1),
    Math.min(Math.max(toSrgb(bl), 0), 1),
  ];
}

/** RGB [0,1] -> CMYK [0,1] (our standard separation). */
function rgbToCmyk01(r: number, g: number, b: number): [number, number, number, number] {
  if (Math.max(r, g, b) < 0.006) return [0, 0, 0, 1];
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [
    Math.min(Math.max((1 - r - k) / (1 - k), 0), 1),
    Math.min(Math.max((1 - g - k) / (1 - k), 0), 1),
    Math.min(Math.max((1 - b - k) / (1 - k), 0), 1),
    k,
  ];
}

/**
 * Generate a synthetic CMYK ICC profile (v4 'mft2' B2A0) whose CLUT maps
 * Lab -> CMYK using our RGB->CMYK separation. The output is a valid,
 * self-consistent profile the proof pipeline can always use.
 */
export function generateCmykProfile(name = "Synthetic SWOP Coated (kaypaint)"): Uint8Array {
  const grid = 9; // 9^3 CLUT
  const nIn = 3;
  const nOut = 4;

  // CLUT entries: Lab -> CMYK
  const clutVals: number[] = [];
  for (let li = 0; li < grid; li++) {
    for (let ai = 0; ai < grid; ai++) {
      for (let bi = 0; bi < grid; bi++) {
        const L = (li / (grid - 1)) * 100;
        const a = (ai / (grid - 1)) * 255 - 128;
        const b = (bi / (grid - 1)) * 255 - 128;
        const [r, g, bb] = labToSrgb(L, a, b);
        const [c, m, y, k] = rgbToCmyk01(r, g, bb);
        clutVals.push(c, m, y, k);
      }
    }
  }

  const aCurveBytes = nIn * (12 + 3 * 2); // 54
  const clutchHeader = 4 + nIn; // 7
  const clutDataBytes = clutVals.length * 2;
  const bCurveBytes = nOut * (12 + 3 * 2); // 72
  const lutLen = 28 + aCurveBytes + clutchHeader + clutDataBytes + bCurveBytes;
  const lutAligned = align4(lutLen);

  // Assemble B2A0
  const lut = new Uint8Array(lutAligned);
  lut.set([0x6d, 0x66, 0x74, 0x32], 0); // 'mft2'
  lut.set(u32byte(0), 4);
  lut[8] = nIn;
  lut[9] = nOut;
  for (let i = 0; i < nIn; i++) lut[10 + i] = grid;
  lut.set(u32byte(0), 14);
  const offA = 28;
  const offClut = align4(28 + aCurveBytes);
  const offB = offClut + clutchHeader + clutDataBytes;
  lut.set(u32byte(offA), 16);
  lut.set(u32byte(offClut), 20);
  lut.set(u32byte(offB), 24);

  // A curves (identity, 3 points)
  let p = offA;
  const ident = identityCurvePoints(3);
  for (let i = 0; i < nIn; i++) {
    lut.set([0x63, 0x75, 0x72, 0x76], p); // 'curv'
    lut.set(u32byte(0), p + 4);
    lut.set(u32byte(3), p + 8);
    for (let k = 0; k < 3; k++)
      lut.set(u16byte(Math.round(ident[k] * 65535)), p + 12 + k * 2);
    p += 12 + 3 * 2;
  }

  // CLUT header: 4 reserved + grid bytes
  p = offClut;
  lut.set(u32byte(0), p);
  p += 4;
  for (let i = 0; i < nIn; i++) lut[p++] = grid;

  // CLUT data
  for (let k = 0; k < clutVals.length; k++)
    lut.set(u16byte(Math.round(clutVals[k] * 65535)), p + k * 2);

  // B curves (identity, 3 points)
  p = offB;
  for (let i = 0; i < nOut; i++) {
    lut.set([0x63, 0x75, 0x72, 0x76], p);
    lut.set(u32byte(0), p + 4);
    lut.set(u32byte(3), p + 8);
    for (let k = 0; k < 3; k++)
      lut.set(u16byte(Math.round(ident[k] * 65535)), p + 12 + k * 2);
    p += 12 + 3 * 2;
  }

  // ---- Profile file ----
  const tagCount = 3;
  const lutOff = 132 + tagCount * 12;
  const descTagLen = align4(12 + Math.min(255, name.length));
  const descOff = lutOff + lutAligned;
  const wtptOff = descOff + descTagLen;
  const totalLen = wtptOff + 24;
  const profile = new Uint8Array(totalLen);

  profile.set([0x61, 0x63, 0x73, 0x70], 0); // 'acsp'
  profile.set(u32byte(totalLen), 4);
  profile.set([0x4c, 0x43, 0x4d, 0x53], 8); // 'LCMS'
  profile.set([0x00, 0x02, 0x10, 0x00], 12); // v4
  profile.set([0x6d, 0x6e, 0x74, 0x72], 16); // 'mntr'
  profile.set([0x43, 0x4d, 0x59, 0x4b], 20); // 'CMYK'
  profile.set([0x58, 0x59, 0x5a, 0x20], 24); // 'XYZ '
  profile.set([0x07, 0xe8, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 28);
  profile.set([0x61, 0x63, 0x73, 0x70], 36);
  profile.set([0x4c, 0x43, 0x4d, 0x53], 40);
  profile.set([0x00, 0x00, 0x00, 0x00], 44);
  profile.set([0x6d, 0x6e, 0x66, 0x74], 48);
  profile.set([0x43, 0x4d, 0x59, 0x4b], 52);
  profile.set([0x00, 0x00, 0x00, 0x00], 56);
  profile.set([0x00, 0x00, 0x00, 0x00], 60);
  profile.set([0x00, 0x00, 0x00, 0x00], 64); // perceptual intent
  // XYZ illuminant D50
  {
    const s15 = (f: number) => Math.max(0, Math.min(0xffffffff, Math.round(f * 65536)));
    const set = (o: number, f: number) => profile.set(u32byte(s15(f)), o);
    profile.set([0x58, 0x59, 0x5a, 0x20], 68);
    profile.set(u32byte(0), 72);
    profile.set(u32byte(24), 76);
    set(80, 0.9642);
    set(84, 1.0);
    set(88, 0.8249);
  }
  profile.set([0x00, 0x00, 0x00, 0x00], 92);

  profile.set(u32byte(tagCount), 128); // tag count

  // B2A0 tag data
  profile.set(lut, lutOff);

  // desc tag (v2 style stringType)
  {
    p = descOff;
    profile.set([0x64, 0x65, 0x73, 0x63], p); // 'desc'
    profile.set(u32byte(0), p + 4);
    const ml = Math.min(255, name.length);
    profile.set(u32byte(ml), p + 8);
    for (let i = 0; i < ml; i++) profile[p + 12 + i] = name.charCodeAt(i);
  }

  // wtpt tag (minimal XYZNumber)
  {
    p = wtptOff;
    profile.set([0x58, 0x59, 0x5a, 0x20], p);
    profile.set(u32byte(0), p + 4);
    profile.set(u32byte(24), p + 8);
    const s15 = (f: number) => Math.round(f * 65536);
    const set = (o: number, f: number) => profile.set(u32byte(s15(f) & 0xffffffff), o);
    set(p + 12, 0.9642);
    set(p + 16, 1.0);
    set(p + 20, 0.8249);
  }

  // Tag table
  let ti = 0;
  const putTag = (id: string, off: number, len: number) => {
    const o = 132 + ti * 12;
    profile.set(
      [id.charCodeAt(0), id.charCodeAt(1), id.charCodeAt(2), id.charCodeAt(3)],
      o
    );
    profile.set(u32byte(off), o + 4);
    profile.set(u32byte(len), o + 8);
    ti++;
  };
  putTag("B2A0", lutOff, lutAligned);
  putTag("desc", descOff, descTagLen);
  putTag("wtpt", wtptOff, 24);

  return profile;
}

/**
 * Build the ICC resource chunk for PSD embedding:
 * '8BIM' + resource id 0x040F (1039, "ICC Profile") + pascal name + data.
 */
export function psdIccChunk(profile: Uint8Array): Uint8Array {
  const payload = profile.length;
  const out = new Uint8Array(12 + payload);
  out.set([0x38, 0x42, 0x49, 0x4d], 0); // '8BIM'
  out[4] = 0x04;
  out[5] = 0x0f;
  out[6] = 0; // empty pascal name
  // pad name to even length (1 byte) -> the 8BIM field is name(1)+pad(1)
  out[7] = 0;
  out.set(u32byte(payload), 8);
  out.set(profile, 12);
  return out;
}

// ---------------------------------------------------------------------------
// sRGB profile generation for embedding in exports
// ---------------------------------------------------------------------------

function ascii4(s: string): number[] {
  return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];
}

function u16Fixed(x: number): number[] {
  return u32byte(Math.max(0, Math.min(0xffffffff, Math.round(x * 65536))));
}

function gammaCurve(gamma: number, points = 256): Uint8Array {
  const t = new Uint8Array(12 + points * 2);
  t.set([0x63, 0x75, 0x72, 0x76], 0);
  t.set(u32byte(0), 4);
  t.set(u32byte(points), 8);
  for (let i = 0; i < points; i++)
    t.set(u16byte(Math.pow(i / (points - 1), gamma) * 65535) as number[], 12 + i * 2);
  return t;
}

function textType(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const t = new Uint8Array(12 + bytes.length);
  t.set([0x74, 0x65, 0x78, 0x74], 0);
  t.set(u32byte(0), 4);
  t.set(u32byte(bytes.length), 8);
  t.set(bytes, 12);
  return t;
}

function xyzType(x: number, y: number, z: number): Uint8Array {
  const t = new Uint8Array(24);
  t.set([0x58, 0x59, 0x5a, 0x20], 0);
  t.set(u32byte(0), 4);
  t.set(u32byte(24), 8);
  t.set(u16Fixed(x), 12);
  t.set(u16Fixed(y), 16);
  t.set(u16Fixed(z), 20);
  return t;
}

/**
 * Generate a minimal but valid v2 sRGB display ICC profile (RGB, D50 PCS)
 * with matrix + TRC tags, suitable for embedding in TIFF/PNG export.
 */
export function generateSrgbProfile(
  name = "sRGB IEC61966-2.1 (kaypaint)",
  copyright = "Copyright (c) kaypaint"
): Uint8Array {
  const D50_W = 0.9642;
  const D50_N = 1.0;
  const D50_B = 0.8249;

  const tags: { id: string; data: Uint8Array }[] = [];
  tags.push({ id: "desc", data: textType(name) });
  tags.push({ id: "cprt", data: textType(copyright) });
  tags.push({ id: "wtpt", data: xyzType(D50_W, D50_N, D50_B) });
  tags.push({
    id: "rXYZ",
    data: xyzType(0.4360747, 0.3850649, 0.1430804),
  });
  tags.push({
    id: "gXYZ",
    data: xyzType(0.2225045, 0.7168786, 0.0606169),
  });
  tags.push({
    id: "bXYZ",
    data: xyzType(0.0139322, 0.0971045, 0.7141733),
  });
  for (const id of ["rTRC", "gTRC", "bTRC"]) tags.push({ id, data: gammaCurve(2.4) });

  const tagTableLen = tags.length * 12;
  const dataStart = 132 + tagTableLen;

  const offsets: number[] = [];
  let cursor = dataStart;
  for (const t of tags) {
    cursor = align4(cursor);
    offsets.push(cursor);
    cursor += t.data.length;
  }
  const totalLen = cursor;

  const profile = new Uint8Array(totalLen);

  // ICC header (v2, RGB display)
  profile.set([0x61, 0x63, 0x73, 0x70], 0); // 'acsp'
  profile.set(u32byte(totalLen), 4);
  profile.set([0x4c, 0x43, 0x4d, 0x53], 8); // 'LCMS'
  profile.set([0x02, 0x40, 0x00, 0x00], 12); // v2.4
  profile.set([0x6d, 0x6e, 0x74, 0x72], 16); // 'mntr'
  profile.set([0x52, 0x47, 0x42, 0x20], 20); // 'RGB '
  profile.set([0x58, 0x59, 0x5a, 0x20], 24); // 'XYZ '
  profile.set(
    [0x07, 0xe8, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    28
  );
  profile.set([0x61, 0x63, 0x73, 0x70], 36);
  profile.set([0x4c, 0x43, 0x4d, 0x53], 40);
  profile.set([0x00, 0x00, 0x00, 0x00], 44);
  profile.set([0x6d, 0x6e, 0x66, 0x74], 48);
  profile.set([0x52, 0x47, 0x42, 0x20], 52);
  profile.set([0x00, 0x00, 0x00, 0x00], 56);
  profile.set([0x00, 0x00, 0x00, 0x00], 60);
  profile.set([0x00, 0x00, 0x00, 0x00], 64); // perceptual intent
  {
    profile.set([0x58, 0x59, 0x5a, 0x20], 68);
    profile.set(u32byte(0), 72);
    profile.set(u32byte(24), 76);
    profile.set(u16Fixed(D50_W), 80);
    profile.set(u16Fixed(D50_N), 84);
    profile.set(u16Fixed(D50_B), 88);
  }
  profile.set([0x00, 0x00, 0x00, 0x00], 92);

  profile.set(u32byte(tags.length), 128); // tag count

  tags.forEach((t, i) => {
    const o = 132 + i * 12;
    profile.set(ascii4(t.id), o);
    profile.set(u32byte(offsets[i]), o + 4);
    profile.set(u32byte(t.data.length), o + 8);
  });

  tags.forEach((t, i) => {
    let p = offsets[i];
    while (p < offsets[i] + t.data.length) {
      profile[p] = t.data[p - offsets[i]];
      p++;
    }
  });

  return profile;
}

let cachedSrgbProfile: Uint8Array | null = null;

/** Singleton sRGB profile for embedding in exports. */
export function sRgbProfile(): Uint8Array {
  if (!cachedSrgbProfile) cachedSrgbProfile = generateSrgbProfile();
  return cachedSrgbProfile;
}