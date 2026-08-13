/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";

function lumaAt(data: Uint8ClampedArray, i: number) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

export async function selectSubject(canvas: any): Promise<void> {
  await applyPixelsToActiveLayer(canvas, (data, w, h) => {
    const size = w * h;
    const visited = new Uint8Array(size);
    const queue: number[] = [];
    const seedR = new Float32Array(size);
    const seedG = new Float32Array(size);
    const seedB = new Float32Array(size);
    const seedL = new Float32Array(size);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          const idx = y * w + x;
          if (visited[idx]) continue;
          visited[idx] = 1;
          queue.push(idx);
          const i = idx * 4;
          seedR[idx] = data[i];
          seedG[idx] = data[i + 1];
          seedB[idx] = data[i + 2];
          seedL[idx] = lumaAt(data, i);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const x = idx % w;
      const y = (idx / w) | 0;
      const i = idx * 4;
      data[i + 3] = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (visited[nIdx]) continue;
          const ni = nIdx * 4;
          let bg = data[ni + 3] === 0;
          if (!bg) {
            const dr = data[ni] - seedR[idx];
            const dg = data[ni + 1] - seedG[idx];
            const db = data[ni + 2] - seedB[idx];
            bg =
              Math.abs(dr) + Math.abs(dg) + Math.abs(db) <= 28 &&
              Math.abs(lumaAt(data, ni) - seedL[idx]) <= 80;
          }
          if (bg) {
            visited[nIdx] = 1;
            seedR[nIdx] = seedR[idx];
            seedG[nIdx] = seedG[idx];
            seedB[nIdx] = seedB[idx];
            seedL[nIdx] = seedL[idx];
            queue.push(nIdx);
          }
        }
      }
    }
  });
}
