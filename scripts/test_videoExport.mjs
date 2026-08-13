import {
  normalizeVideoOpts,
  pickVideoMime,
  extForMime,
  videoFileName,
} from "../engine/videoExportCore.ts";

let failures = 0;

function check(name, cond) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

function eq(a, b, name) {
  check(name, a === b);
  if (a !== b) console.log(`      expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
}

check("normalizeVideoOpts defaults", (() => {
  const o = normalizeVideoOpts();
  return o.fps === 30 && o.duration === 60 && o.scale === 0.5 && o.frameCount === 60;
})());

check("normalizeVideoOpts frameCount min 2", (() => {
  const o = normalizeVideoOpts({ duration: 1 });
  return o.duration === 1 && o.frameCount === 2;
})());

check("normalizeVideoOpts clamps fps", (() => {
  const o = normalizeVideoOpts({ fps: 120 });
  return o.fps === 60;
})());
check("normalizeVideoOpts clamps fps low", (() => {
  const o = normalizeVideoOpts({ fps: 0 });
  return o.fps === 1;
})());
check("normalizeVideoOpts clamps scale", (() => {
  const o = normalizeVideoOpts({ scale: 8 });
  return o.scale === 4;
})());
check("normalizeVideoOpts floors duration", (() => {
  const o = normalizeVideoOpts({ duration: 12.7 });
  return o.duration === 12;
})());

check("pickVideoMime supports everything -> mp4", pickVideoMime(() => true) === "video/mp4");
check("pickVideoMime no mp4 -> vp9", pickVideoMime((m) => m !== "video/mp4") === "video/webm;codecs=vp9");
check("pickVideoMime only generic webm", pickVideoMime((m) => m === "video/webm") === "video/webm");
check("pickVideoMime nothing supported -> empty", pickVideoMime(() => false) === "");

eq(extForMime("video/mp4"), "mp4", "extForMime mp4");
eq(extForMime("video/webm;codecs=vp9"), "webm", "extForMime vp9");
eq(extForMime("video/webm"), "webm", "extForMime webm");
eq(extForMime(""), "webm", "extForMime fallback");

eq(videoFileName("mp4"), "kaypaint-animation.mp4", "videoFileName mp4");
eq(videoFileName("webm"), "kaypaint-animation.webm", "videoFileName webm");

console.log(failures === 0 ? "\nAll videoExportCore tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);