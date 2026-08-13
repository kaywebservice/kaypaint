import { Object as FabricObject, classRegistry } from "fabric";

export interface PathTextProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  letterSpacing: number;
  curve: number;
  length: number;
}

const TEXTPATH_PROPS = [
  "text",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fill",
  "letterSpacing",
  "curve",
  "length",
];

/**
 * Text drawn along a quadratic path from (0,0) to (length,0),
 * bowing upward by `curve * length` pixels. The object itself can be
 * positioned/rotated like any other fabric object.
 */
export class STextOnPath extends FabricObject {
  static type = "STextOnPath";

  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  letterSpacing: number;
  curve: number;

  constructor(props: any = {}) {
    super(props);
    this.text = props.text ?? "Type on path";
    this.fontFamily = props.fontFamily ?? "Arial";
    this.fontSize = props.fontSize ?? 28;
    this.fontWeight = props.fontWeight ?? "normal";
    this.fontStyle = props.fontStyle ?? "normal";
    this.fill = props.fill ?? "#000000";
    this.letterSpacing = props.letterSpacing ?? 0;
    this.curve = props.curve ?? 0;
    this.length = props.length ?? 300;
    this.width = this.length;
    this.height = Math.max(this.fontSize * 1.8, this.length * 0.5 + this.fontSize);
    this.originX = "left";
    this.originY = "top";
    this.selectable = true;
    this.evented = true;
  }

  static fromObject(object: any) {
    return Promise.resolve(new STextOnPath(object));
  }

  get length() {
    return this._length;
  }

  set length(v: number) {
    this._length = v;
  }

  private _length = 300;

  _curvePoint() {
    return { x: this._length / 2, y: -this.curve * this._length };
  }

  _samplePath(t: number) {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: this._length, y: 0 };
    const c = this._curvePoint();
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    };
  }

  _pathTangent(t: number) {
    const c = this._curvePoint();
    const dx = 2 * (1 - t) * (c.x - 0) + 2 * t * (this._length - c.x);
    const dy = 2 * (1 - t) * (c.y - 0) + 2 * t * (0 - c.y);
    return Math.atan2(dy, dx);
  }

  _arcLengthTotal() {
    const N = 200;
    let len = 0;
    let prev = this._samplePath(0);
    for (let i = 1; i <= N; i++) {
      const p = this._samplePath(i / N);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return len;
  }

  _render(ctx: CanvasRenderingContext2D) {
    const { text, fontFamily, fontSize, fontWeight, fontStyle, fill, letterSpacing } = this;
    if (!text) return;

    ctx.save();
    ctx.fillStyle = fill;
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const total = this._arcLengthTotal();
    const N = 400;
    let s = 0;
    let prevPt = this._samplePath(0);
    let prevT = 0;

    for (const ch of Array.from(text)) {
      const w = ctx.measureText(ch).width + letterSpacing;
      const target = s + w / 2;
      let placed = false;

      for (let i = 1; i <= N; i++) {
        const t = i / N;
        const p = this._samplePath(t);
        const dLen = Math.hypot(p.x - prevPt.x, p.y - prevPt.y);
        if (s + dLen >= target) {
          const seg = dLen > 0 ? (target - s) / dLen : 0;
          const px = prevPt.x + (p.x - prevPt.x) * seg;
          const py = prevPt.y + (p.y - prevPt.y) * seg;
          const frac = t - (1 - seg) * (t - prevT) || t;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(this._pathTangent(frac));
          ctx.fillText(ch, 0, 0);
          ctx.restore();
          placed = true;
          break;
        }
        prevPt = p;
        s += dLen;
        prevT = t;
      }

      if (!placed) break;
      s += w / 2;
    }

    ctx.restore();
  }

  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([...TEXTPATH_PROPS, ...propertiesToInclude]);
  }
}

if (typeof window !== "undefined") {
  classRegistry.setClass(STextOnPath);
}