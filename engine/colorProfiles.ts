/* eslint-disable @typescript-eslint/no-explicit-any */
import { showOptions } from "@/components/Menu/OptionDialog";
import { useFeaturesStore } from "@/store/featuresStore";
import { applyPixelsToActiveLayer } from "@/engine/pixelOps";
import { cmykToRgb } from "@/engine/colorEngine";

export type ProfileId =
  | "srgb"
  | "adobergb"
  | "display-p3"
  | "prophoto"
  | "wide-gamut"
  | "gray-srgb"
  | "gray-gamma22"
  | "swop-v2";

interface ColorProfile {
  id: ProfileId;
  name: string;
  kind: "rgb" | "gray" | "cmyk";
  white: [number, number, number];
  curve?: { decode: (c: number) => number; encode: (c: number) => number };
  toXyz?: number[][];
  fromXyz?: number[][];
}

const WHITE_D65: [number, number, number] = [0.95047, 1, 1.08883];
const WHITE_D50: [number, number, number] = [0.96422, 1, 0.82521];

const SRGB_CURVE = {
  decode: (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)),
  encode: (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055),
};

const GAMMA22_CURVE = {
  decode: (c: number) => Math.pow(c, 2.2),
  encode: (c: number) => Math.pow(c, 1 / 2.2),
};

const GAMMA12_CURVE = {
  decode: (c: number) => Math.pow(c, 1.2),
  encode: (c: number) => Math.pow(c, 1 / 1.2),
};

const PROPHOTO_CURVE = {
  decode: (c: number) => (c <= 1 / 32 ? c / 16 : Math.pow(c, 1.8)),
  encode: (c: number) => (c <= 1 / 512 ? c * 16 : Math.pow(c, 1 / 1.8)),
};

const SRGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const XYZ_TO_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];

const ADOBE_TO_XYZ = [
  [0.5767309, 0.185554, 0.1881852],
  [0.2973769, 0.6273491, 0.0752741],
  [0.0270343, 0.0706872, 0.9911085],
];
const XYZ_TO_ADOBE = [
  [2.041369, -0.5649464, -0.3446944],
  [-0.969266, 1.8760108, 0.041556],
  [0.0134474, -0.1183897, 1.0154096],
];

const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const XYZ_TO_P3 = [
  [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
  [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
  [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
];

const PROPHOTO_TO_XYZ = [
  [0.7976749, 0.1351917, 0.0313534],
  [0.2880402, 0.7118741, 0.0000857],
  [0, 0, 0.82521],
];
const XYZ_TO_PROPHOTO = [
  [1.3459433, -0.2556075, -0.0511118],
  [-0.5445989, 1.5081673, 0.0205351],
  [0, 0, 1.2118128],
];

const WIDE_TO_XYZ = [
  [0.7161046, 0.1009296, 0.1473858],
  [0.2581874, 0.7249378, 0.0168748],
  [0, 0.0517813, 0.7734287],
];
const XYZ_TO_WIDE = [
  [1.4628067, -0.1840623, -0.2743606],
  [-0.5217933, 1.4472381, 0.0677227],
  [0.0349342, -0.096893, 1.2884099],
];

export const COLOR_PROFILES: Record<string, ColorProfile> = {
  srgb: {
    id: "srgb",
    name: "sRGB IEC61966-2.1",
    kind: "rgb",
    white: WHITE_D65,
    curve: SRGB_CURVE,
    toXyz: SRGB_TO_XYZ,
    fromXyz: XYZ_TO_SRGB,
  },
  adobergb: {
    id: "adobergb",
    name: "Adobe RGB (1998)",
    kind: "rgb",
    white: WHITE_D65,
    curve: GAMMA22_CURVE,
    toXyz: ADOBE_TO_XYZ,
    fromXyz: XYZ_TO_ADOBE,
  },
  "display-p3": {
    id: "display-p3",
    name: "Display P3",
    kind: "rgb",
    white: WHITE_D65,
    curve: SRGB_CURVE,
    toXyz: P3_TO_XYZ,
    fromXyz: XYZ_TO_P3,
  },
  prophoto: {
    id: "prophoto",
    name: "ProPhoto RGB",
    kind: "rgb",
    white: WHITE_D50,
    curve: PROPHOTO_CURVE,
    toXyz: PROPHOTO_TO_XYZ,
    fromXyz: XYZ_TO_PROPHOTO,
  },
  "wide-gamut": {
    id: "wide-gamut",
    name: "Wide Gamut RGB",
    kind: "rgb",
    white: WHITE_D65,
    curve: GAMMA12_CURVE,
    toXyz: WIDE_TO_XYZ,
    fromXyz: XYZ_TO_WIDE,
  },
  "gray-srgb": {
    id: "gray-srgb",
    name: "Gray sRGB",
    kind: "gray",
    white: WHITE_D65,
    curve: SRGB_CURVE,
  },
  "gray-gamma22": {
    id: "gray-gamma22",
    name: "Gray Gamma 2.2",
    kind: "gray",
    white: WHITE_D65,
    curve: GAMMA22_CURVE,
  },
  "swop-v2": {
    id: "swop-v2",
    name: "U.S. Web Coated (SWOP) v2",
    kind: "cmyk",
    white: WHITE_D65,
  },
};

export const PROFILE_OPTIONS = Object.values(COLOR_PROFILES).map((p) => ({
  value: p.id,
  label: p.name,
}));

const BRADFORD = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const BRADFORD_INV = [
  [0.9869929, -0.1470543, 0.1599627],
  [0.4323053, 0.5183603, 0.0492912],
  [-0.0085287, 0.0400428, 0.9684867],
];

function matMul3(m: number[][], v: number[]): number[] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function matMul3x3(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return out;
}

function adaptationMatrix(fromW: number[], toW: number[]): number[][] {
  const f = matMul3(BRADFORD, fromW);
  const t = matMul3(BRADFORD, toW);
  const d = [
    [t[0] / f[0], 0, 0],
    [0, t[1] / f[1], 0],
    [0, 0, t[2] / f[2]],
  ];
  return matMul3x3(BRADFORD_INV, d);
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function softClip(x: number) {
  if (x <= 0.9) return x;
  const t = Math.min(1, (x - 0.9) / 0.7);
  return 0.9 + 0.1 * (t * t * (3 - 2 * t));
}

function applyIntent(v: number[], intent: string): number[] {
  if (intent === "perceptual") return v.map(softClip);
  return v.map(clamp01);
}

function sourceXyz(r: number, g: number, b: number, source: ColorProfile): number[] {
  if (source.kind === "gray") {
    const v = source.curve!.decode(r);
    return [source.white[0] * v, source.white[1] * v, source.white[2] * v];
  }
  const d = source.curve!.decode;
  return matMul3(source.toXyz!, [d(r), d(g), d(b)]);
}

function toRgbPx(r: number, g: number, b: number, source: ColorProfile, target: ColorProfile, adapt: number[][] | null, intent: string): number[] {
  const xyz = sourceXyz(r, g, b, source);
  const a = adapt ? matMul3(adapt, xyz) : xyz;
  const lin = matMul3(target.fromXyz!, a);
  const e = target.curve!.encode;
  return applyIntent([e(lin[0]), e(lin[1]), e(lin[2])], intent);
}

function toGrayPx(r: number, g: number, b: number, source: ColorProfile, target: ColorProfile, adapt: number[][] | null): number[] {
  const xyz = sourceXyz(r, g, b, source);
  const a = adapt ? matMul3(adapt, xyz) : xyz;
  const v = target.curve!.encode(a[1]);
  return [v, v, v];
}

function toCmykPx(r: number, g: number, b: number, source: ColorProfile): number[] {
  const d = source.kind === "gray" ? source.curve!.decode : (source.curve ?? SRGB_CURVE).decode;
  const rl = d(clamp01(r));
  const gl = d(clamp01(g));
  const bl = d(clamp01(b));
  const c0 = 1 - rl;
  const m0 = 1 - gl;
  const y0 = 1 - bl;
  const k = Math.min(c0, m0, y0);
  const c = clamp01(c0 - k);
  const m = clamp01(m0 - k);
  const y = clamp01(y0 - k);
  const back = cmykToRgb(c, m, y, clamp01(k));
  return [back.r, back.g, back.b];
}

function convertPixels(
  data: Uint8ClampedArray,
  source: ColorProfile,
  target: ColorProfile,
  intent: string
) {
  const adapt =
    source.white[0] !== target.white[0] || source.white[1] !== target.white[1]
      ? adaptationMatrix(source.white, target.white)
      : null;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    let out: number[];
    if (target.kind === "cmyk") out = toCmykPx(r, g, b, source);
    else if (target.kind === "gray") out = toGrayPx(r, g, b, source, target, adapt);
    else out = toRgbPx(r, g, b, source, target, adapt, intent);
    data[i] = Math.round(clamp01(out[0]) * 255);
    data[i + 1] = Math.round(clamp01(out[1]) * 255);
    data[i + 2] = Math.round(clamp01(out[2]) * 255);
  }
}

export async function assignProfileDialog(canvas: any) {
  if (!canvas) return;
  const res = await showOptions({
    title: "Assign Profile",
    okLabel: "Assign",
    text: "Assigning a profile tags the document with a color-space description. Pixel values are not changed.",
    fields: [
      {
        key: "profile",
        label: "Profile",
        type: "select",
        value: "srgb",
        options: PROFILE_OPTIONS,
      },
    ],
  });
  if (!res) return;
  const id = String(res.profile);
  useFeaturesStore.getState().setAssignedProfile(id);
  window.alert(`Document tagged with ${COLOR_PROFILES[id]?.name ?? id}.\nNo pixels were changed.`);
}

export async function convertToProfileDialog(canvas: any) {
  if (!canvas) return;
  const res = await showOptions({
    title: "Convert to Profile",
    okLabel: "Convert",
    text: "Converts the active layer's pixels into the destination profile's color space.",
    fields: [
      {
        key: "profile",
        label: "Destination Profile",
        type: "select",
        value: "adobergb",
        options: PROFILE_OPTIONS,
      },
      {
        key: "intent",
        label: "Rendering Intent",
        type: "select",
        value: "relative",
        options: [
          { value: "perceptual", label: "Perceptual" },
          { value: "relative", label: "Relative Colorimetric" },
          { value: "absolute", label: "Absolute Colorimetric" },
          { value: "saturation", label: "Saturation" },
        ],
      },
    ],
  });
  if (!res) return;
  const targetId = String(res.profile);
  const intent = String(res.intent ?? "relative");
  const target = COLOR_PROFILES[targetId];
  if (!target) return;
  const assigned = useFeaturesStore.getState().assignedProfile;
  const rawSource = COLOR_PROFILES[assigned ?? "srgb"] ?? COLOR_PROFILES.srgb;
  const source = rawSource.kind === "cmyk" ? COLOR_PROFILES.srgb : rawSource;
  const ok = await applyPixelsToActiveLayer(canvas, (data) => {
    convertPixels(data, source, target, intent);
  });
  if (ok) useFeaturesStore.getState().setAssignedProfile(targetId);
}
