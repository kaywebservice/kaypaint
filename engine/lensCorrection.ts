/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function bilin(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  fx: number,
  fy: number,
  ch: number
): number {
  const x = clamp(fx, 0, w - 1);
  const y = clamp(fy, 0, h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const t = x - x0;
  const u = y - y0;
  const i00 = (y0 * w + x0) * 4 + ch;
  const i01 = (y0 * w + x1) * 4 + ch;
  const i10 = (y1 * w + x0) * 4 + ch;
  const i11 = (y1 * w + x1) * 4 + ch;
  const w00 = (1 - t) * (1 - u);
  const w01 = t * (1 - u);
  const w10 = (1 - t) * u;
  const w11 = t * u;
  return src[i00] * w00 + src[i01] * w01 + src[i10] * w10 + src[i11] * w11;
}

export async function lensCorrection(canvas: any): Promise<boolean> {
  const res = await showOptions({
    title: "Lens Correction",
    fields: [
      { key: "distortion", label: "Distortion", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "vignette", label: "Vignette", type: "slider", value: 0, min: -100, max: 100, suffix: "" },
      { key: "chromaticAberration", label: "Red/Cyan Fringe", type: "slider", value: 0, min: -10, max: 10, suffix: "" },
      { key: "scale", label: "Scale", type: "slider", value: 100, min: 95, max: 105, suffix: " %" },
    ],
  });
  if (!res) return false;
  const distortion = Number(res.distortion ?? 0);
  const vignette = Number(res.vignette ?? 0);
  const ca = Number(res.chromaticAberration ?? 0);
  const scale = Number(res.scale ?? 100);
  return applyPixelsToActiveLayer(canvas, (data, w, h) => {
    const src = new Uint8ClampedArray(data);
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const maxR = Math.hypot(cx, cy) || 1;
    const k = (distortion / 100) * 0.5;
    const scaleF = 100 / scale;
    const caF = ca * 0.005;
    const vigF = vignette / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const vx = x - cx;
        const vy = y - cy;
        const r = Math.hypot(vx, vy);
        const rn = r / maxR;
        const rs = rn * (1 + k * rn * rn) * maxR * scaleF;
        let dirX = 0;
        let dirY = 0;
        if (r > 1e-6) {
          dirX = vx / r;
          dirY = vy / r;
        }
        const o = (y * w + x) * 4;
        data[o] = bilin(src, w, h, cx + dirX * rs * (1 + caF), cy + dirY * rs * (1 + caF), 0);
        data[o + 1] = bilin(src, w, h, cx + dirX * rs, cy + dirY * rs, 1);
        data[o + 2] = bilin(src, w, h, cx + dirX * rs * (1 - caF), cy + dirY * rs * (1 - caF), 2);
        data[o + 3] = src[o + 3];
        const mul = 1 - vigF * rn * rn;
        if (mul !== 1) {
          data[o] *= mul;
          data[o + 1] *= mul;
          data[o + 2] *= mul;
        }
      }
    }
  });
}
