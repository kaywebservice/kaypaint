/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pure, testable helpers shared by the Gemini image route.
 * Kept framework-free so they can be exercised in unit tests without a server.
 */

export type GeminiMode = "generate" | "inpaint" | "upscale";

export interface Body {
  mode: GeminiMode;
  prompt: string;
  imageBase64?: string;
  width?: number;
  height?: number;
}

export interface ImagePart {
  inlineData: { data: string; mimeType: string };
}

/** Split a data URL (or raw base64) into bytes + mime type. */
export function stripDataUrl(input: string): {
  bytes: string;
  mimeType: string;
} {
  const m = input.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (m) return { mimeType: m[1], bytes: m[2] };
  return { mimeType: "image/png", bytes: input.replace(/\s/g, "") };
}

/** Build a generateContent inlineData part from a data URL / raw b64. */
export function imagePart(input: string): ImagePart {
  const { bytes, mimeType } = stripDataUrl(input);
  return { inlineData: { data: bytes, mimeType } };
}

/** Construct the user-facing text prompt for the model given the mode. */
export function buildPrompt(
  mode: GeminiMode,
  prompt: string,
  w?: number,
  h?: number
): string {
  switch (mode) {
    case "inpaint":
      return (
        prompt ||
        "Inpaint this region to match the surrounding content, blending edges seamlessly."
      );
    case "upscale": {
      const size = w && h ? ` at ${w}x${h} pixels` : "";
      return `${prompt || "Upscale this image"} ${size}, high resolution, sharp details, no blur, upscale`.trim();
    }
    default: {
      const size = w && h ? ` at ${w}x${h} pixels` : "";
      return `${prompt || "Continue and extend this scene"} ${size}, seamlessly extending the canvas to fill the borders`.trim();
    }
  }
}

export interface ExtractedImage {
  dataUrl: string;
  mimeType: string;
}

/** Pull the first image out of a generateContent response. */
export function extractImageUrl(response: unknown): ExtractedImage | null {
  const parts = (response as any)?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts as any[]) {
    if (part?.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
      return {
        dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        mimeType: part.inlineData.mimeType,
      };
    }
    if (part?.image?.imageBytes) {
      return {
        dataUrl: `data:image/png;base64,${part.image.imageBytes}`,
        mimeType: "image/png",
      };
    }
  }
  return null;
}
