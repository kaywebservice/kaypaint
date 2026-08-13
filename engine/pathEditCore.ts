/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Path anchor editing (pure parse/serialize + browser editor).
 *
 * Fabric paths store commands like `[["M",x,y],["C",..,..,..,..,x,y],["L",..],["Z"]]`.
 * This module turns that into editable nodes (anchors + control handles),
 * lets the editor mutate them, and serializes back to fabric path data —
 * mirroring the Pen tool's own command generation.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface PathNode {
  x: number;
  y: number;
  ctrlIn: Pt | null;
  ctrlOut: Pt | null;
  linked: boolean;
}

export function parsePathNodes(pathData: any[]): { nodes: PathNode[]; closed: boolean } {
  const nodes: PathNode[] = [];
  let closed = false;
  let prev: PathNode | null = null;
  for (const cmd of pathData ?? []) {
    const op = cmd[0];
    if (op === "M") {
      const n: PathNode = { x: cmd[1], y: cmd[2], ctrlIn: null, ctrlOut: null, linked: true };
      nodes.push(n);
      prev = n;
    } else if (op === "L") {
      const n: PathNode = { x: cmd[1], y: cmd[2], ctrlIn: null, ctrlOut: null, linked: true };
      nodes.push(n);
      prev = n;
    } else if (op === "Q") {
      const n: PathNode = { x: cmd[3], y: cmd[4], ctrlIn: { x: cmd[1], y: cmd[2] }, ctrlOut: null, linked: true };
      nodes.push(n);
      prev = n;
    } else if (op === "C") {
      if (prev) prev.ctrlOut = { x: cmd[1], y: cmd[2] };
      const n: PathNode = { x: cmd[5], y: cmd[6], ctrlIn: { x: cmd[3], y: cmd[4] }, ctrlOut: null, linked: true };
      nodes.push(n);
      prev = n;
    } else if (op === "Z") {
      closed = true;
    }
  }
  return { nodes, closed };
}

export function serializePathNodes(nodes: PathNode[], closed: boolean): any[] {
  if (!nodes.length) return [];
  const out: any[] = [["M", nodes[0].x, nodes[0].y]];
  for (let i = 1; i < nodes.length; i++) {
    const p = nodes[i - 1];
    const c = nodes[i];
    if (p.ctrlOut && c.ctrlIn) {
      out.push(["C", p.ctrlOut.x, p.ctrlOut.y, c.ctrlIn.x, c.ctrlIn.y, c.x, c.y]);
    } else if (p.ctrlOut) {
      out.push(["Q", p.ctrlOut.x, p.ctrlOut.y, c.x, c.y]);
    } else if (c.ctrlIn) {
      out.push(["Q", c.ctrlIn.x, c.ctrlIn.y, c.x, c.y]);
    } else {
      out.push(["L", c.x, c.y]);
    }
  }
  if (closed) out.push(["Z"]);
  return out;
}
