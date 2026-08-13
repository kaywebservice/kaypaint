/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  type Body,
  type GeminiMode,
  buildPrompt,
  extractImageUrl,
  imagePart,
} from "@/lib/geminiImage";

export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * Server-only proxy for KayPaint's generative AI tools.
 *
 * The GEMINI_API_KEY lives ONLY in process.env (server-side) — it is never sent
 * to the browser. The browser calls `geminiGenerate(...)` (see
 * `lib/geminiClient.ts`) which POSTs here and falls back to a client-side
 * heuristic when this proxy returns a non-200 response.
 *
 * IMPORTANT (SDK v2.16):
 *  - `ai.models.generateImages`   -> text-to-image only (no image input).
 *  - `ai.models.editImage`        -> DEPRECATED and Enterprise/Vertex-only;
 *                                     throws on standard Gemini API keys.
 *  - `ai.models.upscaleImage`     -> Enterprise/Vertex-only; throws here.
 *  The supported way to do image-conditioned generation / editing on the
 *  standard Gemini API is `ai.models.generateContent` with an Imagen model
 *  (per the SDK deprecation notice): pass the source image as an `inlineData`
 *  part and request `responseModalities: ["image"]`.
 *
 * Body: { mode, prompt, imageBase64, width?, height? }
 * Response: { dataUrl: "data:image/png;base64,..." }
 */

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-3.0-generate-001";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: "GEMINI_API_KEY not configured" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { mode, prompt, imageBase64, width, height } = body;
  if (!["generate", "inpaint", "upscale"].includes(mode as GeminiMode)) {
    return json(400, { error: `unknown mode: ${String(mode)}` });
  }
  if (!prompt) return json(400, { error: "prompt is required" });

  const ai = new GoogleGenAI({ apiKey: key });

  try {
    const parts: any[] = [];
    if (imageBase64) parts.push(imagePart(imageBase64));
    parts.push({ text: buildPrompt(mode, prompt, width, height) });

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: { responseModalities: [Modality.IMAGE] },
    });

    const found = extractImageUrl(response);
    if (found) return json(200, { dataUrl: found.dataUrl });
    return json(502, { error: "gemini returned no image" });
  } catch (e: any) {
    const msg = e?.message ?? "gemini call failed";
    const status = /401|api key|unauthorized/i.test(msg) ? 401 : 502;
    return json(status, { error: msg });
  }
}
