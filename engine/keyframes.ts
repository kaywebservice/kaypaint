/**
 * Keyframe interpolation with easing (pure, node-testable).
 *
 * A keyframe holds a time `t` (frames) and value `v`. Optional `ease` selects
 * the easing curve applied between this keyframe and the next. Values outside
 * the keyframe range hold the nearest endpoint.
 */

export type EaseName = "linear" | "easeIn" | "easeOut" | "easeInOut";

export interface Keyframe {
  t: number;
  v: number;
  ease?: EaseName;
}

export const EASES: Record<EaseName, (u: number) => number> = {
  linear: (u) => u,
  easeIn: (u) => u * u,
  easeOut: (u) => u * (2 - u),
  easeInOut: (u) => (u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u),
};

export function easeValue(name: EaseName | undefined, u: number): number {
  const fn = EASES[name ?? "linear"] ?? EASES.linear;
  const c = Math.max(0, Math.min(1, u));
  return fn(c);
}

export function interpolate(keyframes: Keyframe[], time: number): number | null {
  if (!keyframes.length) return null;
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (time <= sorted[0].t) return sorted[0].v;
  const last = sorted[sorted.length - 1];
  if (time >= last.t) return last.v;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.t && time <= b.t) {
      const span = b.t - a.t;
      const u = span === 0 ? 0 : (time - a.t) / span;
      const e = easeValue(a.ease, u);
      return a.v + (b.v - a.v) * e;
    }
  }
  return last.v;
}
