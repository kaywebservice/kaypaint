export type VideoExportOpts = {
  fps?: number;
  duration?: number;
  scale?: number;
};

export type NormalizedVideoOpts = {
  fps: number;
  duration: number;
  scale: number;
  frameCount: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function normalizeVideoOpts(opts: VideoExportOpts = {}): NormalizedVideoOpts {
  const fps = clamp(
    Number.isFinite(opts.fps) ? (opts.fps as number) : 30,
    1,
    60
  );
  const duration = Math.max(1, Math.floor(Number.isFinite(opts.duration) ? (opts.duration as number) : 60));
  const scale = clamp(
    Number.isFinite(opts.scale) ? (opts.scale as number) : 0.5,
    0.1,
    4
  );
  return { fps, duration, scale, frameCount: Math.max(2, duration) };
}

export const VIDEO_MIME_ORDER = [
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function pickVideoMime(
  isSupported: (mime: string) => boolean
): string {
  for (const mime of VIDEO_MIME_ORDER) {
    if (isSupported(mime)) return mime;
  }
  return "";
}

export function extForMime(mime: string): string {
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("video/webm")) return "webm";
  return "webm";
}

export function videoFileName(ext: string): string {
  return `kaypaint-animation.${ext}`;
}