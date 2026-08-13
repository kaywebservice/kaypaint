/**
 * Pure-JS Bayer demosaic (default RAW decoder backend).
 *
 * Real compressed camera RAW (CR2/NEF/ARW…) still needs a libraw/dcraw WASM
 * build, but *plain Bayer data* — e.g. from an uncompressed DNG or a test
 * frame — can be decoded here with bilinear interpolation, making the RAW
 * import seam genuinely functional for that path.
 *
 * `pattern` letters index the 2x2 tile: R=red, G=green, B=blue.
 * RGGB is the most common camera pattern.
 */

export type BayerPattern = "RGGB" | "GBRG" | "GRBG" | "BGGR";

function valueAt(
  bayer: Uint8Array | Uint16Array,
  w: number,
  h: number,
  x: number,
  y: number
): number {
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x >= w) x = w - 1;
  if (y >= h) y = h - 1;
  return bayer[y * w + x];
}

/** Which color channel does the given sensor cell sample? */
function channelFor(pattern: BayerPattern, x: number, y: number): "R" | "G" | "B" {
  const row = y % 2 === 0 ? pattern.slice(0, 2) : pattern.slice(2, 4);
  return row[x % 2 === 0 ? 0 : 1] as "R" | "G" | "B";
}

/**
 * Demosaic a single-channel Bayer array into RGBA (8-bit).
 * `whiteLevel` (default 255) normalizes sensor values; a black level is
 * subtracted first.
 */
export function demosaic(
  bayer: Uint8Array | Uint16Array,
  w: number,
  h: number,
  pattern: BayerPattern = "RGGB",
  blackLevel = 0,
  whiteLevel = 255
): Uint8ClampedArray {
  const scale = 255 / Math.max(1, whiteLevel - blackLevel);
  const out = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = Math.max(0, valueAt(bayer, w, h, x, y) - blackLevel) * scale;
      const own = channelFor(pattern, x, y);
      let r = 0;
      let g = 0;
      let b = 0;
      if (own === "R") {
        // Green via horizontal+vertical neighbors, blue via diagonals.
        r = raw;
        g = (valueAt(bayer, w, h, x - 1, y) + valueAt(bayer, w, h, x + 1, y) + valueAt(bayer, w, h, x, y - 1) + valueAt(bayer, w, h, x, y + 1)) / 4;
        b = (valueAt(bayer, w, h, x - 1, y - 1) + valueAt(bayer, w, h, x + 1, y - 1) + valueAt(bayer, w, h, x - 1, y + 1) + valueAt(bayer, w, h, x + 1, y + 1)) / 4;
      } else if (own === "B") {
        b = raw;
        g = (valueAt(bayer, w, h, x - 1, y) + valueAt(bayer, w, h, x + 1, y) + valueAt(bayer, w, h, x, y - 1) + valueAt(bayer, w, h, x, y + 1)) / 4;
        r = (valueAt(bayer, w, h, x - 1, y - 1) + valueAt(bayer, w, h, x + 1, y - 1) + valueAt(bayer, w, h, x - 1, y + 1) + valueAt(bayer, w, h, x + 1, y + 1)) / 4;
      } else {
        // Green sample: the red and blue samples sit on the horizontal and
        // vertical axes (not diagonals); pick the smoother axis for each.
        const horizontalIsR = channelFor(pattern, x - 1, y) === "R";
        const hVal = (valueAt(bayer, w, h, x - 1, y) + valueAt(bayer, w, h, x + 1, y)) / 2;
        const vVal = (valueAt(bayer, w, h, x, y - 1) + valueAt(bayer, w, h, x, y + 1)) / 2;
        const dh = Math.abs(valueAt(bayer, w, h, x - 1, y) - valueAt(bayer, w, h, x + 1, y));
        const dv = Math.abs(valueAt(bayer, w, h, x, y - 1) - valueAt(bayer, w, h, x, y + 1));
        g = raw;
        if (horizontalIsR === (dh <= dv)) {
          r = hVal;
          b = vVal;
        } else {
          r = vVal;
          b = hVal;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = Math.max(0, Math.min(255, Math.round(r)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Auto white balance: scale R/B channels so their means match green. */
export function autoWhiteBalance(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    sr += rgba[i * 4];
    sg += rgba[i * 4 + 1];
    sb += rgba[i * 4 + 2];
    n++;
  }
  if (!n) return rgba;
  const gr = sr / n, gg = sg / n, gb = sb / n;
  if (gg <= 0) return rgba;
  const kr = gg / (gr || 1);
  const kb = gg / (gb || 1);
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = Math.max(0, Math.min(255, Math.round(out[i * 4] * kr)));
    out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(out[i * 4 + 2] * kb)));
  }
  return out;
}
