/* eslint-disable @typescript-eslint/no-explicit-any */
import { rgbToCmyk, cmykToRgb } from "@/engine/colorEngine";
import { generateCmykProfile, psdIccChunk } from "@/engine/iccEngine";

export interface PSDLayer {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  rgba: Uint8Array;
}

export interface PSDDoc {
  width: number;
  height: number;
  layers: PSDLayer[];
}

class Cursor {
  private view: DataView;
  private u8: Uint8Array;
  pos = 0;

  constructor(bytes: ArrayBuffer | Uint8Array) {
    if (bytes instanceof Uint8Array) {
      this.u8 = bytes;
      this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } else {
      this.u8 = new Uint8Array(bytes);
      this.view = new DataView(bytes);
    }
  }

  u8b() {
    return this.u8[this.pos++];
  }

  u16() {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  i16() {
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  u32() {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  i32() {
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  skip(n: number) {
    this.pos += n;
  }

  bytes(n: number) {
    const out = this.u8.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

class Writer {
  private parts: Uint8Array[] = [];

  u16(v: number) {
    this.parts.push(new Uint8Array([(v >> 8) & 0xff, v & 0xff]));
  }

  u32(v: number) {
    this.parts.push(
      new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff])
    );
  }

  i32(v: number) {
    this.u32(v >>> 0);
  }

  raw(bytes: Uint8Array) {
    this.parts.push(bytes);
  }

  u8(v: number) {
    this.parts.push(new Uint8Array([v]));
  }

  sig(s: string) {
    this.raw(ascii(s));
  }

  concat() {
    const len = this.parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}

function ascii(s: string) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function pstring(s: string) {
  const b = ascii(s);
  const pad = (b.length + 1) % 2 === 1 ? 0 : 1;
  const out = new Uint8Array(b.length + 1 + pad);
  out[0] = b.length;
  out.set(b, 1);
  return out;
}

function rleEncodeRow(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = row.length;

  while (i < n) {
    let runLen = 1;
    while (i + runLen < n && row[i + runLen] === row[i] && runLen < 128) {
      runLen++;
    }

    if (runLen >= 3) {
      out.push(257 - runLen, row[i]);
      i += runLen;
      continue;
    }

    const litStart = i;
    i += runLen;
    let litLen = runLen;
    while (i < n && litLen < 128) {
      let ahead = 1;
      while (i + ahead < n && row[i + ahead] === row[i] && ahead < 128) ahead++;
      if (ahead >= 3) break;
      i += 1;
      litLen += 1;
    }
    out.push(litLen - 1);
    for (let k = litStart; k < litStart + litLen; k++) out.push(row[k]);
  }

  return new Uint8Array(out);
}

function rleDecodeRow(bytes: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  let o = 0;
  let i = 0;
  while (i < bytes.length && o < expected) {
    const control = bytes[i++];
    if (control <= 127) {
      const len = control + 1;
      for (let k = 0; k < len && o < expected; k++) out[o++] = bytes[i++];
    } else if (control >= 129) {
      const val = bytes[i++];
      const len = 257 - control;
      for (let k = 0; k < len && o < expected; k++) out[o++] = val;
    }
  }
  return out;
}

export function decodePSD(data: ArrayBuffer | Uint8Array, docName = "Imported PSD"): PSDDoc {
  const c = new Cursor(data);

  if (ascii("8BPS").join(",") !== Array.from(c.bytes(4)).join(",")) {
    throw new Error("Not a valid PSD file");
  }

  const version = c.u16();
  if (version !== 1 && version !== 2) throw new Error("Unsupported PSD version");
  c.skip(6);
  const channels = c.u16();
  const height = c.u32();
  const width = c.u32();
  const depth = c.u16();
  const colorMode = c.u16();

  if (depth !== 8) throw new Error("Only 8-bit PSD files are supported");
  if (colorMode !== 3 && colorMode !== 4)
    throw new Error("Only RGB (3) or CMYK (4) PSD files are supported");
  if (!width || !height || width > 30000 || height > 30000) {
    throw new Error("Unreasonable PSD dimensions");
  }

  const cmLen = c.u32();
  c.skip(cmLen);
  const irLen = c.u32();
  c.skip(irLen);

  const layers: PSDLayer[] = [];

  const lmLen = c.u32();
  const lmEnd = c.pos + lmLen;

  if (lmLen > 8) {
    c.u32();
    const layerCount = Math.abs(c.i32());

    const records: {
      left: number;
      top: number;
      right: number;
      bottom: number;
      opacity: number;
      visible: boolean;
      name: string;
      channelIds: number[];
    }[] = [];

    for (let l = 0; l < layerCount; l++) {
      const top = c.i32();
      const left = c.i32();
      const bottom = c.i32();
      const right = c.i32();
      const chCount = c.u16();
      const channelIds: number[] = [];
      for (let ch = 0; ch < chCount; ch++) {
        const id = c.i16();
        const len = c.u32();
        channelIds.push(id);
        void len;
      }
      c.skip(4);
      const blendKey = ascii("norm");
      const key = Array.from(c.bytes(4)).join(",");
      if (key !== Array.from(blendKey).join(",")) {
        /* non-normal blend: still import, we ignore blend key */
      }
      const opacity = c.u8b();
      const clipping = c.u8b();
      const flags = c.u8b();
      c.skip(1);
      void clipping;
      const extraLen = c.u32();
      const extraStart = c.pos;

      let name = "Layer";
      if (extraLen > 0) {
        const maskLen = c.u16();
        c.skip(maskLen);
        const rangesLen = c.u32();
        c.skip(rangesLen);
        if (c.pos - extraStart < extraLen) {
          const nameLen = c.u16();
          if (nameLen > 0 && c.pos - extraStart + nameLen <= extraLen) {
            name = String.fromCharCode(...Array.from(c.bytes(nameLen)));
          }
        }
      }
      c.pos = extraStart + extraLen;

      records.push({
        left,
        top,
        right,
        bottom,
        opacity,
        visible: (flags & 0x02) === 0,
        name,
        channelIds,
      });
    }

    const compression = c.u16();
    const chData: Uint8Array[] = [];
    for (const rec of records) {
      const w = Math.max(0, rec.right - rec.left);
      const h = Math.max(0, rec.bottom - rec.top);
      for (const id of rec.channelIds) {
        void id;
        const bytes = w * h;
        if (compression === 1) {
          const rowLens: number[] = [];
          for (let r = 0; r < h; r++) rowLens.push(c.u16());
          const ch = new Uint8Array(bytes);
          let o = 0;
          for (let r = 0; r < h; r++) {
            const row = rleDecodeRow(c.bytes(rowLens[r]), w);
            ch.set(row, o);
            o += w;
          }
          chData.push(ch);
        } else {
          chData.push(new Uint8Array(c.bytes(bytes)));
        }
      }
    }

    for (let l = 0; l < records.length; l++) {
      const rec = records[l];
      const w = Math.max(0, rec.right - rec.left);
      const h = Math.max(0, rec.bottom - rec.top);
      if (w === 0 || h === 0) continue;

      const rgba = new Uint8Array(w * h * 4);
      let rCh: Uint8Array | null = null;
      let gCh: Uint8Array | null = null;
      let bCh: Uint8Array | null = null;
      let cCh: Uint8Array | null = null;
      let mCh: Uint8Array | null = null;
      let yCh: Uint8Array | null = null;
      let kCh: Uint8Array | null = null;
      let aCh: Uint8Array | null = null;
      let idx = 0;
      for (let l2 = 0; l2 < records.length; l2++) {
        const other = records[l2];
        if (other !== rec) {
          const w2 = Math.max(0, other.right - other.left);
          const h2 = Math.max(0, other.bottom - other.top);
          idx += other.channelIds.length * w2 * h2;
          continue;
        }
        break;
      }
      void idx;

      for (const id of rec.channelIds) {
        const ch = chData[idx++];
        if (id === 0 && colorMode === 4) cCh = ch;
        else if (id === 1 && colorMode === 4) mCh = ch;
        else if (id === 2 && colorMode === 4) yCh = ch;
        else if (id === 3 && colorMode === 4) kCh = ch;
        else if (id === 0) rCh = ch;
        else if (id === 1) gCh = ch;
        else if (id === 2) bCh = ch;
        else if (id === -1) aCh = ch;
      }

      for (let p = 0; p < w * h; p++) {
        if (colorMode === 4) {
          const cmykVal = {
            c: (cCh ?? new Uint8Array(w * h))[p] / 255,
            m: (mCh ?? new Uint8Array(w * h))[p] / 255,
            y: (yCh ?? new Uint8Array(w * h))[p] / 255,
            k: (kCh ?? new Uint8Array(w * h))[p] / 255,
          };
          const rgb = cmykToRgb(cmykVal.c, cmykVal.m, cmykVal.y, cmykVal.k);
          rgba[p * 4] = Math.round(rgb.r * 255);
          rgba[p * 4 + 1] = Math.round(rgb.g * 255);
          rgba[p * 4 + 2] = Math.round(rgb.b * 255);
          rgba[p * 4 + 3] = aCh?.[p] ?? 255;
        } else {
          rgba[p * 4] = rCh?.[p] ?? 0;
          rgba[p * 4 + 1] = gCh?.[p] ?? 0;
          rgba[p * 4 + 2] = bCh?.[p] ?? 0;
          rgba[p * 4 + 3] = aCh?.[p] ?? 255;
        }
      }

      layers.push({
        name: rec.name || "Layer",
        left: rec.left,
        top: rec.top,
        width: w,
        height: h,
        opacity: rec.opacity,
        visible: rec.visible,
        rgba,
      });
    }

    c.pos = lmEnd;
  }

  c.skip(8);

  const composite = readComposite(c, channels, width, height);

  if (layers.length === 0) {
    layers.push({
      name: docName,
      left: 0,
      top: 0,
      width,
      height,
      opacity: 255,
      visible: true,
      rgba: composite,
    });
  }

  return { width, height, layers };
}

function readComposite(c: Cursor, channels: number, width: number, height: number) {
  const rgba = new Uint8Array(width * height * 4).fill(255);
  const comp = c.u16();
  if (comp === 1) {
    for (let ch = 0; ch < 4 && ch < channels; ch++) {
      const rowLens: number[] = [];
      for (let r = 0; r < height; r++) rowLens.push(c.u16());
      for (let r = 0; r < height; r++) {
        const row = rleDecodeRow(c.bytes(rowLens[r]), width);
        setChannelRow(rgba, ch, r, width, row);
      }
    }
  } else {
    for (let ch = 0; ch < 4 && ch < channels; ch++) {
      for (let r = 0; r < height; r++) {
        const row = c.bytes(width);
        setChannelRow(rgba, ch, r, width, row);
      }
    }
  }
  return rgba;
}

function setChannelRow(rgba: Uint8Array, channel: number, row: number, width: number, bytes: Uint8Array) {
  for (let x = 0; x < width; x++) {
    const idx = (row * width + x) * 4;
    if (channel === 3) {
      rgba[idx + 3] = bytes[x];
    } else {
      rgba[idx + channel] = bytes[x];
    }
  }
}

export interface PSDWriteLayer {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  rgba: Uint8Array;
  cmyk?: Uint8Array;
}

/** Options for PSD encoding. */
export interface PSDWriteOptions {
  /** Emit a CMYK (color mode 4) document instead of RGB. */
  cmyk?: boolean;
}

export function encodePSD(
  width: number,
  height: number,
  layers: PSDWriteLayer[],
  options: PSDWriteOptions = {}
) {
  const w = new Writer();

  w.sig("8BPS");
  w.u16(1);
  w.raw(new Uint8Array(6));
  w.u16(4);
  w.u32(height);
  w.u32(width);
  w.u16(8);
  w.u16(options.cmyk ? 4 : 3);

  w.u32(0);
  if (options.cmyk) {
    const icc = psdIccChunk(generateCmykProfile());
    w.u32(icc.length);
    w.raw(icc);
  } else {
    w.u32(0);
  }

  const used = layers.filter(
    (l) => l.visible && l.left < width && l.top < height && l.left + l.width > 0 && l.top + l.height > 0
  );
  const fileOrder = [...used].reverse();

  const channelDataAll: Uint8Array[] = [];

  for (const layer of fileOrder) {
    const left = layer.left;
    const top = layer.top;
    const right = Math.min(width, left + layer.width);
    const bottom = Math.min(height, top + layer.height);
    const wPix = Math.max(0, right - left);
    const hPix = Math.max(0, bottom - top);

    const source = options.cmyk ? (layer.cmyk ?? layer.rgba) : layer.rgba;

    for (const ch of [0, 1, 2, 3]) {
      const bytes = new Uint8Array(wPix * hPix);
      const srcW = layer.width;
      const srcH = layer.height;
      const ox = Math.max(0, -left);
      const oy = Math.max(0, -top);

      for (let y = 0; y < hPix; y++) {
        for (let x = 0; x < wPix; x++) {
          const sx = x + ox;
          const sy = y + oy;
          if (sx >= srcW || sy >= srcH) continue;
          const srcIdx = (sy * srcW + sx) * 4;
          let raw = source[srcIdx + ch];
          if (!options.cmyk && ch === 3 && layer.opacity < 255 && layer.opacity > 0) {
            raw = Math.round((raw * layer.opacity) / 255);
          }
          bytes[y * wPix + x] = raw;
        }
      }

      if (wPix === 0 || hPix === 0) {
        channelDataAll.push(new Uint8Array(0));
        continue;
      }

      const rows: Uint8Array[] = [];
      for (let y = 0; y < hPix; y++) {
        rows.push(rleEncodeRow(bytes.subarray(y * wPix, (y + 1) * wPix)));
      }
      const total = rows.reduce((n, r) => n + r.length, 0);
      const out = new Uint8Array(hPix * 2 + total);
      let o = 0;
      for (const r of rows) {
        out[o++] = (r.length >> 8) & 0xff;
        out[o++] = r.length & 0xff;
      }
      for (const r of rows) {
        out.set(r, o);
        o += r.length;
      }
      channelDataAll.push(out);
    }
  }

  let chIndex = 0;
  const layerDataWriterFinal = new Writer();
  layerDataWriterFinal.i32(fileOrder.length);

  chIndex = 0;
  for (const layer of fileOrder) {
    const left = layer.left;
    const top = layer.top;
    const right = Math.min(width, left + layer.width);
    const bottom = Math.min(height, top + layer.height);

    layerDataWriterFinal.i32(top);
    layerDataWriterFinal.i32(left);
    layerDataWriterFinal.i32(bottom);
    layerDataWriterFinal.i32(right);
    layerDataWriterFinal.u16(4);
    const channelIds = options.cmyk ? [0, 1, 2, 3] : [0, 1, 2, -1];
    for (const id of channelIds) {
      layerDataWriterFinal.u16(id);
      layerDataWriterFinal.u32(channelDataAll[chIndex++].length);
    }
    layerDataWriterFinal.sig("8BIM");
    layerDataWriterFinal.sig("norm");
    layerDataWriterFinal.u8(layer.opacity);
    layerDataWriterFinal.u8(0);
    layerDataWriterFinal.u8(0);
    layerDataWriterFinal.u8(0);

    const nameBytes = pstring(layer.name || "Layer");
    const extraLen = 2 + nameBytes.length;
    layerDataWriterFinal.u32(extraLen);
    layerDataWriterFinal.u16(0);
    layerDataWriterFinal.raw(nameBytes);
  }

  layerDataWriterFinal.u16(1);
  for (const ch of channelDataAll) layerDataWriterFinal.raw(ch);

  const ldr = layerDataWriterFinal.concat();

  w.u32(4 + ldr.length);
  w.u32(ldr.length);
  w.raw(ldr);
  w.u32(0);

  w.sig("8BIM");
  w.sig("norm");

  const comp = compositeRgba(width, height, fileOrder, used);
  const compBytes = encodeComposite(comp, width, height, !!options.cmyk);

  const header = w.concat();
  const out = new Uint8Array(header.length + compBytes.length);
  out.set(header, 0);
  out.set(compBytes, header.length);
  return out;
}

function encodeComposite(rgba: Uint8Array, width: number, height: number, cmyk = false) {
  const channels: Uint8Array[] = [];
  if (cmyk) {
    const c = new Uint8Array(width * height);
    const m = new Uint8Array(width * height);
    const y = new Uint8Array(width * height);
    const k = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p++) {
      const r = rgba[p * 4] / 255;
      const g = rgba[p * 4 + 1] / 255;
      const b = rgba[p * 4 + 2] / 255;
      const cmykVal = rgbToCmyk(r, g, b);
      const i = p;
      c[i] = Math.round(cmykVal.c * 255);
      m[i] = Math.round(cmykVal.m * 255);
      y[i] = Math.round(cmykVal.y * 255);
      k[i] = Math.round(cmykVal.k * 255);
    }
    channels.push(c, m, y, k);
  } else {
    for (const ch of [0, 1, 2, 3]) {
      const bytes = new Uint8Array(width * height);
      for (let p = 0; p < width * height; p++) bytes[p] = rgba[p * 4 + ch];
      channels.push(bytes);
    }
  }

  const compW = new Writer();
  compW.u16(1);

  for (const ch of channels) {
    const rows: Uint8Array[] = [];
    for (let y = 0; y < height; y++) {
      rows.push(rleEncodeRow(ch.subarray(y * width, (y + 1) * width)));
    }
    for (const r of rows) compW.u16(r.length);
    for (const r of rows) compW.raw(r);
  }

  return compW.concat();
}

function compositeRgba(width: number, height: number, fileOrder: PSDWriteLayer[], allLayers: PSDWriteLayer[]) {
  const out = new Uint8Array(width * height * 4);

  const paint = (layer: PSDWriteLayer) => {
    const left = Math.max(0, layer.left);
    const top = Math.max(0, layer.top);
    const right = Math.min(width, layer.left + layer.width);
    const bottom = Math.min(height, layer.top + layer.height);
    const alpha = layer.opacity / 255;

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const srcIdx = ((y - layer.top) * layer.width + (x - layer.left)) * 4;
        const a = (layer.rgba[srcIdx + 3] / 255) * alpha;
        if (a <= 0) continue;
        const dstIdx = (y * width + x) * 4;
        const dstA = out[dstIdx + 3] / 255;
        const outA = a + dstA * (1 - a);
        if (outA <= 0) continue;
        for (let c = 0; c < 3; c++) {
          out[dstIdx + c] = Math.round(
            (layer.rgba[srcIdx + c] * a + out[dstIdx + c] * dstA * (1 - a)) / outA
          );
        }
        out[dstIdx + 3] = Math.round(outA * 255);
      }
    }
  };

  for (let i = fileOrder.length - 1; i >= 0; i--) {
    const layer = allLayers.find((l) => l === fileOrder[i]);
    if (layer) paint(layer);
  }

  return out;
}

export function rgbaToDataURL(rgba: Uint8Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function exportPSD(
  canvas: any,
  filename = "kaypaint.psd",
  options: PSDWriteOptions = {}
) {
  if (!canvas) return;
  const { StaticCanvas, Image: FabricImage } = await import("fabric");
  const { useLayerStore } = await import("@/store/layerStore");
  void FabricImage;

  const width = canvas.width;
  const height = canvas.height;

  const layerRecords = useLayerStore.getState().layers;
  const objects = canvas.getObjects().filter((o: any) => {
    if (o.type === "SAdjustment") return false;
    return !o.isGuideLine;
  });

  const outLayers: PSDWriteLayer[] = [];

  for (const obj of objects) {
    const layerRecord = layerRecords.find((l) => l.objectId === (obj.kaypaintId ?? obj.id));
    const sc = new StaticCanvas(document.createElement("canvas"), {
      width,
      height,
      backgroundColor: "transparent",
    });
    sc.add(obj as any);
    const url = sc.toDataURL({ format: "png", multiplier: 1 });
    sc.dispose();

    const img = await loadImage(url);

    const rgba = new Uint8Array(width * height * 4);
    const c2 = document.createElement("canvas");
    c2.width = width;
    c2.height = height;
    const g = c2.getContext("2d")!;
    g.drawImage(img, 0, 0);
    rgba.set(g.getImageData(0, 0, width, height).data);

    const layerName =
      layerRecord?.name ??
      obj.name ??
      obj.kaypaintName ??
      obj.type ??
      "Layer";

    const record: PSDWriteLayer = {
      name: layerName,
      left: 0,
      top: 0,
      width,
      height,
      opacity: Math.max(0, Math.min(255, Math.round((obj.opacity ?? 1) * 255))),
      visible: obj.visible !== false,
      rgba,
    };

    if (options.cmyk) {
      const cmyk = new Uint8Array(width * height * 4);
      for (let p = 0; p < width * height; p++) {
        const px = p * 4;
        const cmykVal = rgbToCmyk(
          rgba[px] / 255,
          rgba[px + 1] / 255,
          rgba[px + 2] / 255
        );
        cmyk[px] = Math.round(cmykVal.c * 255);
        cmyk[px + 1] = Math.round(cmykVal.m * 255);
        cmyk[px + 2] = Math.round(cmykVal.y * 255);
        cmyk[px + 3] = Math.round(cmykVal.k * 255);
      }
      record.cmyk = cmyk;
    }

    outLayers.push(record);
  }

  const bytes = encodePSD(width, height, outLayers, options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/vnd.adobe.photoshop" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function openPSDFile(file: File, canvas: any) {
  if (!canvas) throw new Error("Canvas not ready");
  const { Image: FabricImage } = await import("fabric");
  const { useLayerStore } = await import("@/store/layerStore");
  const { useEditorStore } = await import("@/store/editorStore");

  const buffer = await file.arrayBuffer();
  const doc = decodePSD(buffer, file.name.replace(/\.psd$/i, ""));

  const images: any[] = [];
  const ordered = [...doc.layers].reverse();

  for (const layer of ordered) {
    if (!layer.visible) continue;

    const url = rgbaToDataURL(layer.rgba, layer.width, layer.height);
    const img = await new Promise<any>((resolve, reject) => {
      FabricImage.fromURL(url, { crossOrigin: "anonymous" }, {})
        .then((i: any) => resolve(i))
        .catch(reject);
    });
    const objectId = `object-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    img.set({
      left: layer.left,
      top: layer.top,
      opacity: Math.max(0, Math.min(1, layer.opacity / 255)),
      selectable: true,
      evented: true,
      kaypaintId: objectId,
    });
    img.setCoords();
    images.push(img);

    useLayerStore.getState().addCanvasLayer(layer.name || "Layer", objectId);
  }

  canvas.add(...images);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  useEditorStore.getState().history?.push?.();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}