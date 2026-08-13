/**
 * Pure movie-clip timing model for timeline movie layers.
 * Import-free so it is fully unit-testable in Node; the browser glue hooks it
 * into the animation engine so `<video>` elements follow the timeline clock.
 */
export type VideoClip = {
  in: number;
  out: number;
  speed: number;
  duration: number;
};

export type VideoClipInput = {
  in?: number;
  out?: number;
  speed?: number;
  duration: number;
};

export function normalizeClip(input: VideoClipInput): VideoClip | null {
  const duration = Number(input.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const speed = Number.isFinite(input.speed) && (input.speed as number) > 0
    ? (input.speed as number)
    : 1;

  const iv = Math.max(0, Number(input.in ?? 0) || 0);
  const rawOut = Number(input.out ?? duration) || duration;
  const ov = Math.min(rawOut, duration);
  if (!(ov > iv)) return null;

  return { in: iv, out: ov, speed, duration };
}

export function validateClip(c: VideoClip): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(c.duration) || c.duration <= 0) errors.push("duration must be > 0");
  if (!Number.isFinite(c.in) || c.in < 0) errors.push("in must be >= 0");
  if (!Number.isFinite(c.out) || !(c.out > c.in)) errors.push("out must be > in");
  if (c.out > c.duration) errors.push("out must be <= duration");
  if (!Number.isFinite(c.speed) || c.speed <= 0) errors.push("speed must be > 0");
  return errors;
}

/** Effective duration of the clip on the timeline (seconds, after trim + speed). */
export function clipDuration(c: VideoClip): number {
  return (c.out - c.in) / c.speed;
}

function safeFps(fps: number): number {
  return Number.isFinite(fps) && fps > 0 ? fps : 30;
}

/** Map a timeline frame -> video element currentTime (respects trim + speed). */
export function frameToClipTime(frame: number, fps: number, c: VideoClip): number {
  const local = (frame / safeFps(fps)) * c.speed;
  const t = c.in + local;
  return Math.max(c.in, Math.min(t, c.out));
}

/** Map a video element currentTime -> timeline frame (inverse). */
export function clipTimeToFrame(time: number, fps: number, c: VideoClip): number {
  const local = (Math.min(Math.max(time, c.in), c.out) - c.in) / c.speed;
  return Math.max(0, local * safeFps(fps));
}

/** Does this clip's effective length fit inside the given timeline frame budget? */
export function clipFitsFrameBudget(timelineDuration: number, fps: number, c: VideoClip): boolean {
  const timelineSeconds = timelineDuration / safeFps(fps);
  return clipDuration(c) <= timelineSeconds + 1e-6;
}