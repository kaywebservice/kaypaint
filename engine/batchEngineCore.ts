/**
 * Pure batch-engine helpers — no `@/` imports, fully node-testable.
 */

export type BatchOutputFormat = "png" | "jpeg" | "webp" | "tiff";

export interface BatchOptions {
  actionId: string;
  source: "open" | "document";
  format: BatchOutputFormat;
  quality: number;
  namingTemplate: string;
  saveToFolder: boolean;
  onProgress?: (done: number, total: number, currentFile: string) => void;
}

export interface BatchResult {
  processed: number;
  failed: number;
  outputs: { name: string; blob: Blob }[];
}

export function resolveTemplate(tpl: string, ctx: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "");
}

export function normalizeOptions(input: Record<string, unknown>): BatchOptions | null {
  const actionId = String(input.actionId ?? "");
  const source = String(input.source ?? "open");
  if (source !== "open" && source !== "document") return null;
  const format = String(input.format ?? "png") as BatchOutputFormat;
  if (!["png", "jpeg", "webp", "tiff"].includes(format)) return null;
  const quality = Number(input.quality ?? 0.92);
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1) return null;
  const namingTemplate = String(input.namingTemplate ?? "{name}-{action}.{ext}");
  const saveToFolder = Boolean(input.saveToFolder);
  return { actionId, source, format, quality, namingTemplate, saveToFolder };
}

export function extForFormat(fmt: BatchOutputFormat): string {
  return fmt === "jpeg" ? "jpg" : fmt;
}