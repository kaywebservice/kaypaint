/**
 * Browser-side client for the local KayPaint Gemini proxy.
 * Calls the server-only route `/api/gemini` so the API key never reaches
 * the browser. Each generative engine can call geminiGenerate(...) and fall
 * back to its heuristic implementation when the proxy is unavailable.
 */

export interface GeminiRequest {
  prompt: string;
  imageBase64?: string;
  maskBase64?: string;
  mode: "generate" | "inpaint" | "upscale";
  width?: number;
  height?: number;
}

export interface GeminiResponse {
  dataUrl: string;
}

export async function geminiGenerate(opts: GeminiRequest): Promise<GeminiResponse | null> {
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("gemini proxy failed:", res.status, t);
      return null;
    }
    const json = (await res.json()) as Partial<GeminiResponse>;
    if (!json.dataUrl) return null;
    return json as GeminiResponse;
  } catch (e) {
    console.warn("gemini unavailable:", e);
    return null;
  }
}
