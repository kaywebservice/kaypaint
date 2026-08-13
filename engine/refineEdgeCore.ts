/**
 * Pure refine-edge pixel helpers (node-testable). Operate on RGBA
 * Uint8ClampedArray where +3 is the selection/mask alpha.
 */

export function blurAlpha(data: Uint8ClampedArray, w: number, h: number, passes: number) {
  const size = w * h;
  const src = new Float32Array(size);
  const tmp = new Float32Array(size);
  for (let i = 0; i < size; i++) src[i] = data[i * 4 + 3];
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            sum += src[ny * w + nx];
            n++;
          }
        }
        tmp[y * w + x] = sum / n;
      }
    }
    src.set(tmp);
  }
  for (let i = 0; i < size; i++) data[i * 4 + 3] = Math.round(src[i]);
}

function lumaOf(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Edge-aware feather: a bilateral blur on the alpha channel guided by the
 * image colors. The selection edge feathers within similar-tone regions but
 * stays sharp across strong color edges, so it doesn't bleed into the subject.
 */
export function edgeFeatherAlpha(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  passes: number,
  colorK = 40
) {
  const size = w * h;
  const src = new Float32Array(size);
  const tmp = new Float32Array(size);
  for (let i = 0; i < size; i++) src[i] = data[i * 4 + 3];
  const r = Math.max(1, Math.round(radius));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cIdx = y * w + x;
        const co = cIdx * 4;
        const L0 = lumaOf(data[co], data[co + 1], data[co + 2]);
        let sum = 0;
        let ws = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = (ny * w + nx) * 4;
            const spatial = 1 - Math.sqrt(dx * dx + dy * dy) / (r * Math.SQRT2 + 0.001);
            const dL = Math.abs(L0 - lumaOf(data[ni], data[ni + 1], data[ni + 2]));
            // Squared linear falloff: strong edges stop the feather hard,
            // subtle tone variation still feathers smoothly.
            const t = Math.max(0, 1 - dL / colorK);
            const color = t * t;
            const weight = Math.max(0, spatial) * color;
            sum += src[ny * w + nx] * weight;
            ws += weight;
          }
        }
        tmp[cIdx] = ws > 0 ? sum / ws : src[cIdx];
      }
    }
    src.set(tmp);
  }
  for (let i = 0; i < size; i++) data[i * 4 + 3] = Math.round(src[i]);
}

export function morphAlpha(data: Uint8ClampedArray, w: number, h: number, passes: number, mode: "erode" | "dilate") {
  const size = w * h;
  let cur = new Uint8ClampedArray(size);
  const next = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i++) cur[i] = data[i * 4 + 3];
  const pick = mode === "dilate" ? Math.max : Math.min;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = cur[y * w + x];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            v = pick(v, cur[ny * w + nx]);
          }
        }
        next[y * w + x] = v;
      }
    }
    const t = cur;
    cur = next;
    next.set(t);
  }
  for (let i = 0; i < size; i++) data[i * 4 + 3] = cur[i];
}

export function applyContrast(data: Uint8ClampedArray, w: number, h: number, contrast: number) {
  const k = contrast / 20;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    data[i * 4 + 3] = Math.round(255 / (1 + Math.exp(-k * (a - 0.5))));
  }
}

export function decontaminateColors(data: Uint8ClampedArray, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0 || a === 255) continue;
      let grad = 0;
      if (x > 0) grad = Math.max(grad, Math.abs(a - data[i - 4 + 3]));
      if (x < w - 1) grad = Math.max(grad, Math.abs(a - data[i + 4 + 3]));
      if (y > 0) grad = Math.max(grad, Math.abs(a - data[i - w * 4 + 3]));
      if (y < h - 1) grad = Math.max(grad, Math.abs(a - data[i + w * 4 + 3]));
      if (grad <= 20) continue;
      let found: number | null = null;
      let bestAlpha = 0;
      for (let d = 1; d <= 20 && found === null; d++) {
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = (ny * w + nx) * 4;
            const na = data[ni + 3];
            if (na === 255) {
              found = ni;
              bestAlpha = 255;
              break;
            }
            if (na > bestAlpha) {
              bestAlpha = na;
              found = ni;
            }
          }
        }
        if (bestAlpha === 255) break;
        if (found !== null && d >= 2 && bestAlpha > 128) break;
      }
      if (found === null) continue;
      const strength = 0.25 + (bestAlpha / 255) * 0.35;
      data[i] += (data[found] - data[i]) * strength;
      data[i + 1] += (data[found + 1] - data[i + 1]) * strength;
      data[i + 2] += (data[found + 2] - data[i + 2]) * strength;
    }
  }
}
