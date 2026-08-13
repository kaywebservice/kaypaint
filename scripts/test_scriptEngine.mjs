import {
  executeScript,
  validateScript,
  PIXEL_OPS,
} from "../engine/scriptEngineCore.ts";

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

// 2x2 RGBA image: white, black, red, alpha-only
const img = new Uint8ClampedArray([
  255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0,
]);

function makeCtx() {
  let data = new Uint8ClampedArray(img);
  const vars = new Map();
  return {
    getVar: (k) => vars.get(k),
    setVar: (k, v) => vars.set(k, v),
    currentImage: () => data,
    setImage: (d) => (data = d),
    currentSize: () => ({ width: 2, height: 2 }),
    forEach: (items, cb) => items.forEach((it, i) => cb(it, i)),
    _data: () => data,
    _vars: vars,
  };
}

// ---- pure ops ----
check("invert flips RGB, keeps alpha", (() => {
  const inv = PIXEL_OPS.invert(new Uint8ClampedArray(img), 2, 2, {});
  return inv[0] === 0 && inv[4] === 255 && inv[12] === 255 && inv[15] === 0;
})());

check("grayscale equalizes channels", (() => {
  const g = PIXEL_OPS.grayscale(new Uint8ClampedArray([200, 100, 50, 255]), 1, 1, {});
  return g[0] === g[1] && g[1] === g[2];
})());

check("pixelate block=2 makes all pixels uniform blend", (() => {
  const p = PIXEL_OPS.pixelate(new Uint8ClampedArray(img), 2, 2, { block: 2 });
  const red = Math.round((255 + 0 + 255 + 0) / 4); // 128
  const chan = Math.round((255 + 0 + 0 + 0) / 4); // 64
  for (let i = 0; i < 16; i += 4) {
    if (p[i] !== red || p[i + 1] !== chan || p[i + 2] !== chan) return false;
  }
  return true;
})());

check("flipH mirrors horizontally", (() => {
  const f = PIXEL_OPS.flipH(new Uint8ClampedArray(img), 2, 2, {});
  return f[0] === 0 && f[4] === 255;
})());

check("brightness adds factor", (() => {
  const b = PIXEL_OPS.brightness(new Uint8ClampedArray([100, 0, 0, 255]), 1, 1, { amount: 20 });
  return b[0] === 151;
})());

// ---- validator ----
eq(validateScript({ name: "x", steps: [{ op: "invert" }] }).length, 0, "valid script ok");
check("unknown op reported", (() => {
  const e = validateScript({ name: "x", steps: [{ op: "nope" }] });
  return e.length === 1 && e[0].includes("unknown op");
})());
check("missing steps rejected", validateScript({ name: "x" }).length > 0);
check("bad nested forEach rejected", (() => {
  const e = validateScript({
    name: "x",
    steps: [{ forEach: "nope", do: [{ op: "invert" }] }],
  });
  return e.length === 1 && e[0].includes("forEach");
})());
check("repeat must be integer", (() => {
  const e = validateScript({ name: "x", steps: [{ repeat: 1.5, do: [{ op: "invert" }] }] });
  return e.length === 1 && e[0].includes("non-negative integer");
})());

// ---- interpreter ----
eq(executeScript({ name: "x", steps: [{ op: "invert" }] }, makeCtx()).stepsRun, 1, "single op runs");
eq(executeScript({ name: "x", steps: [{ op: "invert" }] }, makeCtx()).ok, true, "single op ok");

// repeat invert twice = identity
eq((() => {
  const c = makeCtx();
  const r = executeScript(
    { name: "x", steps: [{ repeat: 2, do: [{ op: "invert" }] }] },
    c
  );
  return r.ok && c._data().every((v, i) => v === img[i]) ? "pass" : "fail";
})(), "pass", "repeat invert x2 is identity");

// brightness param from script param default
eq((() => {
  const c = makeCtx();
  executeScript(
    {
      name: "x",
      params: [{ key: "amount", label: "Amount", type: "number", default: -100 }],
      steps: [{ op: "brightness", params: { amount: "$param:amount" } }],
    },
    c,
    { params: { amount: 0 } }
  );
  return c._data()[0];
})(), 255, "param override 0 keeps 255");

// if branch on avgLuma
eq((() => {
  const dark = makeCtx();
  dark.setVar("__layers", ["a", "b"]);
  const r = executeScript(
    {
      name: "x",
      steps: [
        {
          if: { path: "$var:avgLuma", op: ">", value: 100 },
          then: [{ op: "invert" }],
          else: [{ op: "grayscale" }],
        },
      ],
    },
    dark
  );
  return r.ok && dark._data()[0] === 255; // avgLuma ~64 < 100 -> grayscale keeps white at 255
})(), true, "if avgLuma<100 hits else branch");

// setVar + conditional
eq((() => {
  const c = makeCtx();
  executeScript({
    name: "x",
    steps: [
      { setVar: { key: "tone", value: 10 } },
      {
        if: { path: "$var:tone", op: "<", value: 20 },
        then: [{ op: "brightness", params: { amount: 10 } }],
      },
    ],
  }, c);
  return c._data()[0]; // 255 + 25.5 clamped -> 255
})(), 255, "setVar drives if branch");

// forEach layers applies per item
eq((() => {
  const c = makeCtx();
  c.setVar("__layers", ["L1"]);
  const r = executeScript(
    { name: "x", steps: [{ forEach: "layers", do: [{ op: "grayscale" }] }] },
    c
  );
  return r.ok && r.stepsRun === 2 ? "pass" : "fail";
})(), "pass", "forEach layers runs + counts");

// errors abort repeat loop
eq((() => {
  const c = makeCtx();
  const r = executeScript(
    { name: "x", steps: [{ repeat: 3, do: [{ op: "doesNotExist" }] }] },
    c
  );
  return r.ok === false && r.errors.length >= 1 ? "pass" : "fail";
})(), "pass", "unknown op inside repeat reported");

console.log(failures === 0 ? "\nAll scriptEngineCore tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);