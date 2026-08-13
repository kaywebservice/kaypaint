/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client for the pixel worker (public/workers/pixelWorker.js).
 *
 * Offloads heavy pixel math off the main thread. Falls back to the synchronous
 * TS engines when a Worker isn't available (SSR, older contexts, node tests),
 * so callers get the same results everywhere.
 */
import { inpaintFallback } from "@/engine/inpaintFallback";
import { demosaic, autoWhiteBalance } from "@/engine/rawDemosaic";
import { findHealOffset, healStamp } from "@/engine/healEngine";
import { combineMasks, traceMask } from "@/engine/shapeBoolean";
import { applyLevels, applyCurves, applyHueSat } from "@/engine/adjustmentCore";

export interface AdjustStep {
  type: "levels" | "curves" | "hueSat";
  params: Record<string, unknown>;
}

export interface WorkerDispatch {
  inpaint(src: Uint8ClampedArray, mask: Uint8ClampedArray, w: number, h: number): Promise<Uint8ClampedArray>;
  demosaic(bayer: Uint8ClampedArray | Uint16Array, w: number, h: number, pattern?: string, blackLevel?: number, whiteLevel?: number): Promise<Uint8ClampedArray>;
  whiteBalance(rgba: Uint8ClampedArray, w: number, h: number): Promise<Uint8ClampedArray>;
  healOffset(data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number): Promise<{ dx: number; dy: number }>;
  healStamp(data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number, dx: number, dy: number): Promise<Uint8ClampedArray>;
  combineMasks(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number, op: "union" | "intersect" | "subtract"): Promise<Uint8ClampedArray>;
  trace(mask: Uint8ClampedArray, w: number, h: number): Promise<{ x: number; y: number }[][]>;
  adjust(data: Uint8ClampedArray, adjustments: AdjustStep[]): Promise<Uint8ClampedArray>;
}

let worker: Worker | null | undefined; // undefined = not yet probed
let nextId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function workerAvailable(): boolean {
  if (worker !== undefined) return worker !== null;
  try {
    if (typeof Worker !== "undefined") {
      worker = new Worker("/workers/pixelWorker.js");
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error || "pixel worker error"));
      };
      worker.onerror = () => {
        // Fall back to sync for all queued calls.
        for (const p of pending.values()) p.reject(new Error("pixel worker failed"));
        pending.clear();
        worker?.terminate();
        worker = null;
      };
      return true;
    }
  } catch {
    /* fall through */
  }
  worker = null;
  return false;
}

function call<T>(op: string, payload: any, transfer: Transferable[]): Promise<T> {
  if (workerAvailable()) {
    return new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      (worker as Worker).postMessage({ id, op, payload }, transfer);
    });
  }
  // Synchronous fallback using the same algorithms.
  return Promise.resolve(sync(op, payload) as T);
}

function sync(op: string, p: any): unknown {
  switch (op) {
    case "inpaint":
      return inpaintFallback(p.src, p.mask, p.w, p.h).data;
    case "demosaic":
      return demosaic(p.bayer, p.w, p.h, p.pattern ?? "RGGB", p.blackLevel ?? 0, p.whiteLevel ?? 255);
    case "whiteBalance":
      return autoWhiteBalance(p.rgba, p.w, p.h);
    case "healOffset":
      return findHealOffset(p.data, p.w, p.h, p.cx, p.cy, p.r);
    case "healStamp": {
      const out = new Uint8ClampedArray(p.data);
      healStamp({ width: p.w, height: p.h, data: out } as ImageData, p.w, p.h, p.cx, p.cy, p.r, p.dx, p.dy);
      return out;
    }
    case "combineMasks":
      return combineMasks(p.a, p.b, p.w, p.h, p.op);
    case "trace":
      return traceMask(p.mask, p.w, p.h);
    case "adjust": {
      const out = new Uint8ClampedArray(p.data);
      for (const adj of p.adjustments) {
        const pr = adj.params ?? {};
        if (adj.type === "levels") applyLevels(out, Number(pr.black ?? 0), Number(pr.gamma ?? 1), Number(pr.white ?? 255));
        else if (adj.type === "curves") applyCurves(out, (pr.curve ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]) as { x: number; y: number }[]);
        else if (adj.type === "hueSat") applyHueSat(out, Number(pr.hue ?? 0), Number(pr.saturation ?? 0), Number(pr.lightness ?? 0));
      }
      return out;
    }
    default:
      throw new Error("unknown op: " + op);
  }
}

function toBuf(ta: ArrayBufferView): Transferable {
  return ta.buffer as Transferable;
}

export const px: WorkerDispatch = {
  inpaint(src, mask, w, h) {
    return call("inpaint", { src, mask, w, h }, [toBuf(src), toBuf(mask)]);
  },
  demosaic(bayer, w, h, pattern = "RGGB", blackLevel = 0, whiteLevel = 255) {
    return call("demosaic", { bayer, w, h, pattern, blackLevel, whiteLevel }, [toBuf(bayer)]);
  },
  whiteBalance(rgba, w, h) {
    return call("whiteBalance", { rgba, w, h }, [toBuf(rgba)]);
  },
  healOffset(data, w, h, cx, cy, r) {
    return call("healOffset", { data, w, h, cx, cy, r }, [toBuf(data)]);
  },
  healStamp(data, w, h, cx, cy, r, dx, dy) {
    return call("healStamp", { data, w, h, cx, cy, r, dx, dy }, [toBuf(data)]);
  },
  combineMasks(a, b, w, h, op) {
    return call("combineMasks", { a, b, w, h, op }, [toBuf(a), toBuf(b)]);
  },
  trace(mask, w, h) {
    return call("trace", { mask, w, h }, [toBuf(mask)]);
  },
  adjust(data, adjustments) {
    return call("adjust", { data, adjustments }, [toBuf(data)]);
  },
};

export function isWorkerActive(): boolean {
  return workerAvailable();
}
