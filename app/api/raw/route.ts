/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  decodeRaw,
  extOf,
  isRaw,
  mimeForExt,
  parseBase64Input,
  RawError,
} from "@/engine/rawImport";

export const maxDuration = 120;
export const runtime = "nodejs";

interface Body {
  name: string;
  imageBase64: string;
}

/**
 * POST /api/raw
 * Body: { name: "DSC_1234.NEF", imageBase64: "<base64|data:...> of the RAW bytes" }
 * 200 -> streams the decoded image bytes (Content-Type: image/<fmt>)
 * 400 -> invalid payload
 * 501 -> a decoder is not installed (RAW_DECODER_MISSING)
 * 502 -> decoder present but failed
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, imageBase64 } = body ?? {};
  if (typeof name !== "string" || !name || typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json({ error: "name and imageBase64 are required" }, { status: 400 });
  }

  const ext = extOf(name);
  if (!ext) {
    return NextResponse.json({ error: "Missing file extension" }, { status: 400 });
  }
  if (!isRaw(name)) {
    return NextResponse.json(
      { error: `Not a supported RAW format. Expected one of: ${[".cr2", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2", ".cr3", ".k25", ".mrw"].join(", ")}` },
      { status: 400 }
    );
  }

  const { bytes } = parseBase64Input(imageBase64);
  const upload = { name, bytes };
  const mime = mimeForExt(ext);

  try {
    const decoded = await decodeRaw(upload);
    const buf = Buffer.isBuffer(decoded.buffer)
      ? decoded.buffer
      : Buffer.from(decoded.buffer);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": decoded.mime || mime,
        "Content-Length": String(buf.length),
        "X-Kaypaint-Raw": "decoded",
      },
    });
  } catch (e: any) {
    if (e instanceof RawError) {
      if (e.code === "NO_DECODER") {
        return NextResponse.json(
          { error: e.message, code: "RAW_DECODER_MISSING" },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: e.message, code: e.code }, { status: 502 });
    }
    return NextResponse.json(
      { error: e?.message ?? "RAW decode failed", code: "DECODE_FAILED" },
      { status: 502 }
    );
  }
}
