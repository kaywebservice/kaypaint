/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HistoryStep {
  id: number;
  name: string;
  timestamp: number;
  snap: string;
}

export class HistoryEngine {
  private stack: HistoryStep[] = [];
  private index = -1;
  private restoring = false;
  private max = 80;
  private stepIdCounter = 0;
  private totalBytes = 0;
  /** Rough memory budget for all undo snapshots combined. */
  private maxTotal = 128 * 1024 * 1024;
  /** Coalesce rapid pushes (within this window) into a single undo step. */
  private coalesceMs = 150;
  private lastPushAt = 0;

  constructor(
    private canvas: any,
    opts: { maxSteps?: number; maxTotal?: number; coalesceMs?: number } = {}
  ) {
    if (opts.maxSteps) this.max = opts.maxSteps;
    if (opts.maxTotal) this.maxTotal = opts.maxTotal;
    if (opts.coalesceMs !== undefined) this.coalesceMs = opts.coalesceMs;
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }

  get historyStack() {
    return this.stack;
  }

  get currentIndex() {
    return this.index;
  }

  /** Estimated total snapshot memory (JSON string bytes). */
  get usedBytes() {
    return this.totalBytes;
  }

  private addStep(name: string) {
    if (!this.canvas) return;
    const snap = JSON.stringify(this.canvas.toJSON());
    if (this.stack[this.index]?.snap === snap) return;

    const now = Date.now();
    const atTop = this.index === this.stack.length - 1;

    // Coalesce rapid pushes into the top step so rapid operations (drag,
    // slider tweaks, typing) don't serialize the whole canvas on every tick.
    if (
      atTop &&
      this.stack.length >= 2 &&
      now - this.lastPushAt < this.coalesceMs
    ) {
      const top = this.stack[this.stack.length - 1];
      this.totalBytes -= top.snap.length;
      top.snap = snap;
      top.name = name;
      top.timestamp = now;
      this.totalBytes += snap.length;
      this.lastPushAt = now;
      return;
    }

    this.stack = this.stack.slice(0, this.index + 1);

    const step: HistoryStep = {
      id: ++this.stepIdCounter,
      name,
      timestamp: now,
      snap,
    };

    // Memory-aware cap: the larger each snapshot is, the fewer we keep, so a
    // huge document never OOMs the undo stack.
    const effMax = Math.max(
      2,
      Math.min(this.max, Math.floor(this.maxTotal / Math.max(1, snap.length)))
    );

    this.stack.push(step);
    this.totalBytes += snap.length;

    // Drop the oldest snapshots until we respect the step cap and the budget.
    while (
      this.stack.length > effMax ||
      this.totalBytes > this.maxTotal
    ) {
      const dropped = this.stack.shift();
      if (dropped) this.totalBytes -= dropped.snap.length;
    }

    this.index = this.stack.length - 1;
    this.lastPushAt = now;
  }

  push(name = "Step") {
    if (this.restoring || !this.canvas) return;
    this.addStep(name);
  }

  undo() {
    if (this.index <= 0) return;
    this.index -= 1;
    this.restore();
  }

  redo() {
    if (this.index >= this.stack.length - 1) return;
    this.index += 1;
    this.restore();
  }

  jumpTo(index: number) {
    if (index < 0 || index >= this.stack.length || index === this.index) return;
    this.index = index;
    this.restore();
  }

  truncate(index: number) {
    if (index < 0 || index >= this.stack.length) return;
    this.stack = this.stack.slice(0, index + 1);
    if (this.index > index) this.index = index;
    if (this.stack.length > 0) {
      this.restore();
    }
  }

  snapshot(name: string) {
    if (!this.canvas) return;
    this.addStep(`Snapshot: ${name}`);
  }

  reset() {
    if (!this.canvas) return;
    const snap = JSON.stringify(this.canvas.toJSON());
    this.stack = [{
      id: ++this.stepIdCounter,
      name: "Initial",
      timestamp: Date.now(),
      snap,
    }];
    this.totalBytes = snap.length;
    this.index = 0;
  }

  clear() {
    this.stack = [];
    this.index = -1;
    this.stepIdCounter = 0;
    this.totalBytes = 0;
  }

  private restore() {
    if (!this.canvas) return;
    const step = this.stack[this.index];
    if (!step) return;

    this.restoring = true;

    const done = () => {
      this.canvas.requestRenderAll();
      this.restoring = false;
    };

    try {
      const promise = (this.canvas as any).loadFromJSON(
        JSON.parse(step.snap) as any
      );

      if (promise && typeof promise.then === "function") {
        promise.then(done).catch(done);
      } else {
        done();
      }
    } catch {
      done();
    }
  }
}
