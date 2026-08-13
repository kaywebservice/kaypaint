import {
  fileToDataURL,
  pickImages,
  downloadBlob,
} from "@/engine/actionsEngine";
import { loadImageCanvas } from "@/engine/pixelOps";
import { showOptions } from "@/components/Menu/OptionDialog";

interface PdfPage {
  w: number;
  h: number;
  jpeg: Uint8Array;
}

function binaryString(bytes: Uint8Array): string {
  let s = "";
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)) as number[]);
  }
  return s;
}

function buildPdf(
  pages: PdfPage[],
  opts: { transition: string; duration: number; loop: boolean }
): Uint8Array {
  const chunks: string[] = [];
  let offset = 0;
  const push = (s: string) => {
    chunks.push(s);
    offset += s.length;
  };
  const offsets: number[] = [];

  push("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");

  const obj = (id: number, body: string) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const n = pages.length;
  obj(1, `<< /Type /Catalog /Pages 2 0 R /PageMode /UseNone >>`);

  const kids = pages.map((_, i) => `${3 + i * 4} 0 R`).join(" ");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);

  const trans =
    opts.transition === "None"
      ? ""
      : ` /Trans << /S /${opts.transition === "Slide" ? "Slide" : "Fade"} /D ${opts.duration} >> /Dur ${opts.duration}`;

  pages.forEach((page, i) => {
    const pageId = 3 + i * 4;
    const contentId = 4 + i * 4;
    const imageId = 5 + i * 4;
    obj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.w} ${page.h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R${trans} >>`
    );
    const stream = `q\n${page.w} 0 0 ${page.h} 0 0 cm\n/Im0 Do\nQ\n`;
    obj(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
    );
    const jpeg = binaryString(page.jpeg);
    obj(
      imageId,
      `<< /Type /XObject /Subtype /Image /Width ${page.w} /Height ${page.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n${jpeg}\nendstream`
    );
  });

  const xrefOffset = offset;
  const total = 2 + 3 * n;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= total; id++) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const full = chunks.join("");
  const bytes = new Uint8Array(full.length);
  for (let i = 0; i < full.length; i++) bytes[i] = full.charCodeAt(i) & 0xff;
  return bytes;
}

export async function pdfPresentationDialog(): Promise<void> {
  const res = await showOptions({
    title: "PDF Presentation",
    text: "Turn picked images into a full-page PDF slide deck (JPEG-embedded, pure JS).",
    fields: [
      {
        key: "transition",
        label: "Transition",
        type: "select",
        value: "None",
        options: [
          { value: "None", label: "None" },
          { value: "Fade", label: "Fade" },
          { value: "Slide", label: "Slide" },
        ],
      },
      { key: "duration", label: "Slide Duration", type: "slider", min: 1, max: 20, step: 1, value: 5, suffix: " s" },
      { key: "loop", label: "Loop", type: "checkbox", value: false },
    ],
    okLabel: "OK",
  });
  if (!res) return;

  const files = await pickImages(true);
  if (!files.length) {
    window.alert("No files selected.");
    return;
  }

  const pages: PdfPage[] = [];
  for (const file of files) {
    try {
      const c = await loadImageCanvas(await fileToDataURL(file));
      const dataUrl = c.toDataURL("image/jpeg", 0.9);
      const b64 = dataUrl.split(",")[1] ?? "";
      const bin = atob(b64);
      const jpeg = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
      pages.push({ w: c.width, h: c.height, jpeg });
    } catch {
      window.alert(`Skipped unreadable file "${file.name}".`);
    }
  }
  if (!pages.length) return;

  const pdf = buildPdf(pages, {
    transition: String(res.transition ?? "None"),
    duration: Math.max(1, Number(res.duration ?? 5)),
    loop: !!res.loop,
  });
  downloadBlob(new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }), "presentation.pdf");
  window.alert(`Presentation with ${pages.length} slide${pages.length === 1 ? "" : "s"} saved as presentation.pdf.`);
}
