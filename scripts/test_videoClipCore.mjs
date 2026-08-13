import { normalizeClip, validateClip, clipDuration, frameToClipTime, clipTimeToFrame, clipFitsFrameBudget } from "../engine/videoClipCore.ts";

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
function eq(a, b, name) {
  check(name, a === b);
  if (a !== b) console.log(`      expected ${JSON.stringify(a)} got ${JSON.stringify(b)}`);
}

// ---- normalizeClip ----
eq(normalizeClip({ duration: 10 }).out, 10, "default out = duration");
eq(normalizeClip({ duration: 10 }).in, 0, "default in = 0");
eq(normalizeClip({ duration: 10 }).speed, 1, "default speed = 1");
check("invalid duration rejected", normalizeClip({ duration: 0 }) === null);
check("negative duration rejected", normalizeClip({ duration: -3 }) === null);
check("out > duration clamped", (() => {
  const c = normalizeClip({ duration: 10, in: 1, out: 99 });
  return c && c.out === 10;
})());
check("in >= out rejected", normalizeClip({ duration: 10, in: 5, out: 5 }) === null);
check("in clamped to >= 0", (() => {
  const c = normalizeClip({ duration: 10, in: -4 });
  return c && c.in === 0;
})());
check("speed <= 0 falls back to 1", normalizeClip({ duration: 10, speed: -1 }).speed === 1);

// ---- validateClip ----
eq(validateClip({ in: 0, out: 8, speed: 1, duration: 10 }).length, 0, "valid clip ok");
check("out > in required", validateClip({ in: 8, out: 4, speed: 1, duration: 10 }).length > 0);
check("out <= duration", validateClip({ in: 0, out: 11, speed: 1, duration: 10 }).length > 0);
check("speed > 0", validateClip({ in: 0, out: 4, speed: 0, duration: 10 }).length > 0);

// ---- duration / mapping ----
const clip = normalizeClip({ duration: 10, in: 2, out: 8, speed: 2 });
eq(clipDuration(clip), 3, "clipDuration (8-2)/2 = 3s");

eq(frameToClipTime(0, 30, clip), 2, "frame 0 -> clip.in");
eq(frameToClipTime(30, 30, clip), 4, "1s at 2x speed moves +2s in video");
eq(frameToClipTime(90, 30, clip), 8, "3s timeline -> clip.out");
eq(frameToClipTime(500, 30, clip), 8, "past out clamps to out");

check("frame<->time roundtrip", (() => {
  const c = normalizeClip({ duration: 10, in: 1.5, out: 9, speed: 1 });
  for (const f of [0, 7, 30, 61, 200]) {
    const t = frameToClipTime(f, 30, c);
    const back = clipTimeToFrame(t, 30, c);
    if (Math.abs(back - f) > 0.001) return false;
  }
  return true;
})());

// ---- budget ----
eq(clipFitsFrameBudget(120, 30, clip), true, "3s clip fits in 4s timeline");
eq(clipFitsFrameBudget(30, 30, clip), false, "3s clip does not fit in 1s timeline");
eq(clipFitsFrameBudget(0, 30, clip), false, "fps default applied when timeline 0");

console.log(failures === 0 ? "\nAll videoClipCore tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);