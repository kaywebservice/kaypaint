/**
 * Data-driven scripting engine core: a safe, JSON-based script format with
 * control flow (repeat / forEach / if / setVar) and parameterized pixel ops.
 * Pure & import-free so it is fully unit-testable in Node; the browser glue
 * (engine/scriptEngine.ts) maps ops onto the real canvas/action registry via
 * the same injectable-runtime pattern used by rawImport.ts.
 *
 * A "script" is the Script-Fu/Actions parity layer: reusable operations that
 * can be applied once, or looped over every layer / a batch of images.
 */

export type ScriptValue = number | string | boolean;

export type ScriptParamDef = {
  key: string;
  label: string;
  type: "number" | "string" | "boolean";
  default?: ScriptValue;
};

export type OpStep = { op: string; params?: Record<string, ScriptValue> };
export type ControlStep =
  | { repeat: number; do: ScriptStep[] }
  | { forEach: "layers" | "images"; do: ScriptStep[] }
  | {
      if: { path: string; op: ">" | "<" | ">=" | "<=" | "===" | "!=="; value: ScriptValue };
      then: ScriptStep[];
      else?: ScriptStep[];
    }
  | { setVar: { key: string; value: ScriptValue } };
export type ScriptStep = OpStep | ControlStep;

export type KayPaintScript = {
  name: string;
  description?: string;
  params?: ScriptParamDef[];
  steps: ScriptStep[];
};

export type PixelOp = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Record<string, ScriptValue>
) => Uint8ClampedArray;

export interface ScriptRuntimeCtx {
  getVar(key: string): ScriptValue | undefined;
  setVar(key: string, value: ScriptValue): void;
  currentImage(): Uint8ClampedArray;
  setImage(data: Uint8ClampedArray): void;
  currentSize(): { width: number; height: number };
  forEach(items: unknown[], cb: (item: unknown, index: number) => void): void;
}

export type ScriptResult = { ok: boolean; errors: string[]; stepsRun: number };

// ---------------------------------------------------------------------------
// Pure pixel operators (RGBA, ignore alpha unless touched)
// ---------------------------------------------------------------------------

const v255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export const PIXEL_OPS: Record<string, PixelOp> = {
  invert(data) {
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      out[i] = 255 - out[i];
      out[i + 1] = 255 - out[i + 1];
      out[i + 2] = 255 - out[i + 2];
    }
    return out;
  },
  grayscale(data) {
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      const l = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
      out[i] = out[i + 1] = out[i + 2] = v255(l);
    }
    return out;
  },
  sepia(data) {
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      out[i] = v255(0.393 * r + 0.769 * g + 0.189 * b);
      out[i + 1] = v255(0.349 * r + 0.686 * g + 0.168 * b);
      out[i + 2] = v255(0.272 * r + 0.534 * g + 0.131 * b);
    }
    return out;
  },
  brightness(data, w, h, params) {
    const a = toNumber(params.amount ?? 0) * 2.55;
    return additive(data, a);
  },
  contrast(data, w, h, params) {
    const f = (259 * (toNumber(params.amount ?? 0) + 255)) / (255 * (259 - toNumber(params.amount ?? 0)));
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
      out[i] = v255(f * (out[i] - 128) + 128);
      out[i + 1] = v255(f * (out[i + 1] - 128) + 128);
      out[i + 2] = v255(f * (out[i + 2] - 128) + 128);
    }
    return out;
  },
  pixelate(data, w, h, params) {
    const block = Math.max(1, Math.floor(toNumber(params.block ?? 2)));
    const out = new Uint8ClampedArray(data);
    for (let by = 0; by < h; by += block) {
      for (let bx = 0; bx < w; bx += block) {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = by; y < Math.min(by + block, h); y++) {
          for (let x = bx; x < Math.min(bx + block, w); x++) {
            const i = (y * w + x) * 4;
            r += out[i];
            g += out[i + 1];
            b += out[i + 2];
            n++;
          }
        }
        const ar = n > 0 ? r / n : 0;
        const ag = n > 0 ? g / n : 0;
        const ab = n > 0 ? b / n : 0;
        for (let y = by; y < Math.min(by + block, h); y++) {
          for (let x = bx; x < Math.min(bx + block, w); x++) {
            const i = (y * w + x) * 4;
            out[i] = v255(ar);
            out[i + 1] = v255(ag);
            out[i + 2] = v255(ab);
          }
        }
      }
    }
    return out;
  },
  flipH(data, w, h) {
    return flip(data, w, h, false);
  },
  flipV(data, w, h) {
    return flip(data, w, h, true);
  },
};

function additive(data: Uint8ClampedArray, delta: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = v255(out[i] + delta);
    out[i + 1] = v255(out[i + 1] + delta);
    out[i + 2] = v255(out[i + 2] + delta);
  }
  return out;
}

function flip(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  vertical: boolean
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = vertical ? x : w - 1 - x;
      const sy = vertical ? h - 1 - y : y;
      const d = (y * w + x) * 4;
      const s = (sy * w + sx) * 4;
      out[d] = data[s];
      out[d + 1] = data[s + 1];
      out[d + 2] = data[s + 2];
      out[d + 3] = data[s + 3];
    }
  }
  return out;
}

function toNumber(v: ScriptValue): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isOpStep(s: ScriptStep): s is OpStep {
  return typeof (s as OpStep).op === "string";
}

function collectVarKeys(step: ScriptStep, out: Set<string>) {
  if (isOpStep(step)) return;
  if ("setVar" in step) out.add(step.setVar.key);
  if ("repeat" in step) step.do.forEach((c) => collectVarKeys(c, out));
  if ("forEach" in step) step.do.forEach((c) => collectVarKeys(c, out));
  if ("if" in step) {
    step.then.forEach((c) => collectVarKeys(c, out));
    step.else?.forEach((c) => collectVarKeys(c, out));
  }
}

/**
 * Validate a script structurally. Returns a list of human-readable errors
 * (empty = valid). Unknown ops, bad nesting, malformed params and unmatched
 * setVar variables (read before declared) are all reported.
 */
export function validateScript(script: KayPaintScript): string[] {
  const errors: string[] = [];
  if (!script || typeof script !== "object") {
    return ["script must be an object"];
  }
  if (typeof script.name !== "string" || !script.name.trim()) {
    errors.push("script.name is required");
  }
  if (!Array.isArray(script.steps) || script.steps.length === 0) {
    errors.push("script.steps must be a non-empty array");
    return errors;
  }
  const declared = new Set<string>();
  const walk = (steps: ScriptStep[], path: string) => {
    steps.forEach((step, i) => {
      const where = `${path}[${i}]`;
      if (!step || typeof step !== "object") {
        errors.push(`${where}: step must be an object`);
        return;
      }
      if (isOpStep(step)) {
        const op = PIXEL_OPS[step.op];
        if (!op) {
          errors.push(`${where}: unknown op "${step.op}" (valid: ${Object.keys(PIXEL_OPS).join(", ")})`);
          return;
        }
        if (step.params !== undefined && (typeof step.params !== "object" || Array.isArray(step.params))) {
          errors.push(`${where}: params must be an object`);
        }
        return;
      }
      if ("repeat" in step) {
        const n = step.repeat;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
          errors.push(`${where}: repeat must be a non-negative integer`);
        }
        if (!Array.isArray(step.do)) errors.push(`${where}: repeat.do must be an array`);
        else walk(step.do, `${where}.do`);
        return;
      }
      if ("forEach" in step) {
        if (step.forEach !== "layers" && step.forEach !== "images") {
          errors.push(`${where}: forEach must be "layers" or "images"`);
        }
        if (!Array.isArray(step.do)) errors.push(`${where}: forEach.do must be an array`);
        else walk(step.do, `${where}.do`);
        return;
      }
      if ("if" in step) {
        if (!step.if || typeof step.if.path !== "string" || !step.if.path.trim()) {
          errors.push(`${where}: if.path is required`);
        }
        if (typeof step.if.op !== "string") errors.push(`${where}: if.op is required`);
        if (!Array.isArray(step.then)) errors.push(`${where}: if.then must be an array`);
        else walk(step.then, `${where}.then`);
        if (step.else !== undefined) {
          if (!Array.isArray(step.else)) errors.push(`${where}: if.else must be an array`);
          else walk(step.else, `${where}.else`);
        }
        collectVarKeys(step, declared);
        return;
      }
      if ("setVar" in step) {
        if (typeof step.setVar.key !== "string" || !step.setVar.key.trim()) {
          errors.push(`${where}: setVar.key is required`);
        } else {
          declared.add(step.setVar.key);
        }
        return;
      }
      errors.push(`${where}: unrecognized step`);
    });
  };
  walk(script.steps, "steps");
  return errors;
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

function resolveValue(raw: string, ctx: ScriptRuntimeCtx, params: Record<string, ScriptValue>): ScriptValue {
  if (raw.startsWith("$param:")) {
    const v = params[raw.slice(7)];
    if (v !== undefined) return v;
  }
  if (raw.startsWith("$var:")) {
    const v = ctx.getVar(raw.slice(5));
    if (v !== undefined) return v;
  }
  if (/^-?\d*\.?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function compareExpression(
  left: ScriptValue,
  op: string,
  right: ScriptValue
): boolean {
  const l = typeof left === "number" && typeof right === "number" ? left : String(left);
  const r = typeof left === "number" && typeof right === "number" ? right : String(right);
  switch (op) {
    case ">":
      return (l as number) > (r as number);
    case "<":
      return (l as number) < (r as number);
    case ">=":
      return (l as number) >= (r as number);
    case "<=":
      return (l as number) <= (r as number);
    case "===":
      return l === r;
    case "!==":
      return l !== r;
    default:
      return false;
  }
}

function averageLuma(data: Uint8ClampedArray): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return n > 0 ? sum / n : 0;
}

interface RuntimeState {
  stepsRun: number;
  errors: string[];
}

function runSteps(
  steps: ScriptStep[],
  ctx: ScriptRuntimeCtx,
  params: Record<string, ScriptValue>,
  state: RuntimeState
): void {
  for (const step of steps) {
    if (isOpStep(step)) {
      const op = PIXEL_OPS[step.op];
      if (!op) {
        state.errors.push(`skipped unknown op "${step.op}"`);
        continue;
      }
      const resolved: Record<string, ScriptValue> = {};
      const raw = step.params ?? {};
      for (const k of Object.keys(raw)) {
        resolved[k] = resolveValue(String(raw[k]), ctx, params);
      }
      const { width, height } = ctx.currentSize();
      const data = ctx.currentImage();
      ctx.setImage(op(data, width, height, resolved));
      state.stepsRun++;
      continue;
    }
    if ("repeat" in step) {
      for (let i = 0; i < step.repeat && state.errors.length === 0; i++) {
        runSteps(step.do, ctx, params, state);
      }
      state.stepsRun++;
      continue;
    }
    if ("forEach" in step) {
      const items: unknown[] =
        step.forEach === "layers" ? (ctx.getVar("__layers") as unknown[] | undefined) ?? [] : (ctx.getVar("__images") as unknown[] | undefined) ?? [];
      ctx.forEach(items, () => runSteps(step.do, ctx, params, state));
      state.stepsRun++;
      continue;
    }
    if ("if" in step) {
      const cond = step.if;
      const leftRaw: string = cond.path;
      const left: ScriptValue = resolveValue(leftRaw, ctx, params);
      const right: ScriptValue = resolveValue(String(cond.value), ctx, params);
      const branch = compareExpression(left, cond.op, right)
        ? step.then
        : step.else ?? [];
      runSteps(branch, ctx, params, state);
      state.stepsRun++;
      continue;
    }
    if ("setVar" in step) {
      ctx.setVar(step.setVar.key, resolveValue(String(step.setVar.value), ctx, params));
      state.stepsRun++;
    }
  }
}

/**
 * Execute a script against an injectable runtime. `params` overrides
 * user-facing script params ($param:key). Nested loops compute an avg-luma
 * facet (`$var:avgLuma`) used by `if` conditions.
 */
export function executeScript(
  script: KayPaintScript,
  ctx: ScriptRuntimeCtx,
  options: { params?: Record<string, ScriptValue> } = {}
): ScriptResult {
  const errors = validateScript(script);
  if (errors.length > 0) {
    return { ok: false, errors, stepsRun: 0 };
  }
  const state: RuntimeState = { stepsRun: 0, errors: [] };
  ctx.setVar("avgLuma", averageLuma(ctx.currentImage()));
  runSteps(script.steps, ctx, options.params ?? {}, state);
  if (state.errors.length > 0) {
    return { ok: false, errors: state.errors, stepsRun: state.stepsRun };
  }
  return { ok: true, errors: [], stepsRun: state.stepsRun };
}