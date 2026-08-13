/**
 * Vector pathfinder core (pure, node-testable).
 *
 * Boolean ops on binary masks (union / intersect / subtract), then contour
 * tracing via unit boundary edges. Tracing yields ALL closed loops — outer
 * contours and hole contours alike — so subtract-with-hole is handled by
 * emitting every loop and filling with `evenodd`.
 */

export type BooleanOp = "union" | "intersect" | "subtract";

export function combineMasks(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  op: BooleanOp
): Uint8ClampedArray {
  const n = w * h;
  const out = new Uint8ClampedArray(n);
  const set = (i: number) => a[i] > 16 && (op === "union" ? b[i] > 16 : op === "intersect" ? b[i] > 16 : b[i] <= 16);
  if (op === "union") {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 || b[i] > 16 ? 255 : 0;
  } else if (op === "intersect") {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 && b[i] > 16 ? 255 : 0;
  } else {
    for (let i = 0; i < n; i++) out[i] = a[i] > 16 && b[i] <= 16 ? 255 : 0;
  }
  void set;
  return out;
}

interface Edge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  used: boolean;
  dx: number;
  dy: number;
}

const vkey = (x: number, y: number) => `${x},${y}`;

export function traceMask(mask: Uint8ClampedArray, w: number, h: number): { x: number; y: number }[][] {
  const edges: Edge[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] <= 16) continue;
      if (y === 0 || mask[(y - 1) * w + x] <= 16) {
        // north edge, direction = west -> east
        edges.push({ ax: x, ay: y, bx: x + 1, by: y, used: false, dx: 1, dy: 0 });
      }
      if (y === h - 1 || mask[(y + 1) * w + x] <= 16) {
        // south edge, direction = east -> west
        edges.push({ ax: x + 1, ay: y + 1, bx: x, by: y + 1, used: false, dx: -1, dy: 0 });
      }
      if (x === 0 || mask[y * w + x - 1] <= 16) {
        // west edge, direction = south -> north
        edges.push({ ax: x, ay: y + 1, bx: x, by: y, used: false, dx: 0, dy: -1 });
      }
      if (x === w - 1 || mask[y * w + x + 1] <= 16) {
        // east edge, direction = north -> south
        edges.push({ ax: x + 1, ay: y, bx: x + 1, by: y + 1, used: false, dx: 0, dy: 1 });
      }
    }
  }

  // Adjacency: vertex -> edges leaving that vertex.
  const adj = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = vkey(e.ax, e.ay);
    let list = adj.get(k);
    if (!list) {
      list = [];
      adj.set(k, list);
    }
    list.push(e);
  }

  const loops: { x: number; y: number }[][] = [];

  const startEdge = (): Edge | null => {
    for (const e of edges) if (!e.used) return e;
    return null;
  };

  let e0 = startEdge();
  while (e0) {
    const loop: { x: number; y: number }[] = [];
    let cur: Edge | null = e0;
    let guard = 0;
    const maxGuard = edges.length + 4;
    while (cur && !cur.used && guard++ < maxGuard) {
      cur.used = true;
      loop.push({ x: cur.ax, y: cur.ay });
      // Find the next edge at vertex (cur.bx, cur.by) making the sharpest
      // clockwise turn from the incoming direction.
      const vk = vkey(cur.bx, cur.by);
      const candidates = (adj.get(vk) ?? []).filter((e) => !e.used);
      if (!candidates.length) break;
      const ix = cur.dx;
      const iy = cur.dy;
      let best: Edge | null = null;
      let bestTurn = -Infinity;
      for (const c of candidates) {
        // clockwise angle from incoming to candidate, in [0, 2pi)
        const cross = ix * c.dy - iy * c.dx;
        const dot = ix * c.dx + iy * c.dy;
        let ang = Math.atan2(-cross, dot);
        if (ang < 0) ang += Math.PI * 2;
        if (ang > bestTurn) {
          bestTurn = ang;
          best = c;
        }
      }
      cur = best;
    }
    if (loop.length >= 3) loops.push(loop);
    e0 = startEdge();
  }

  return loops;
}

export function loopsToPath(loops: { x: number; y: number }[][]): string {
  const parts: string[] = [];
  for (const loop of loops) {
    if (loop.length < 2) continue;
    parts.push(`M ${loop[0].x} ${loop[0].y}`);
    for (let i = 1; i < loop.length; i++) {
      parts.push(`L ${loop[i].x} ${loop[i].y}`);
    }
    parts.push("Z");
  }
  return parts.join(" ");
}
