/**
 * PDF export (07-document-workflow §18 P0-7): pages the size of the diagram, each holding it as a
 * JPEG image (PDF reads JPEG as is, with the DCTDecode filter), so a PDF needs no library. Pages
 * are in points (1 px = 0.75 pt) and images are drawn at higher resolution for print. A deck is
 * a page per slide or per beat (D-106).
 */

export interface PdfPage {
  readonly jpeg: Uint8Array;
  /** The image's own size, in px. */
  readonly image: { readonly width: number; readonly height: number };
  /** The page's size, in px at scale 1. */
  readonly page: { readonly width: number; readonly height: number };
}

/** A PDF of one page or many. */
export function jpegsToPdf(pages: readonly PdfPage[], title: string): Uint8Array {
  if (pages.length === 0) throw new Error("A PDF needs a page.");
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | (() => void)) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body();
    push("\nendobj\n");
  };
  // PDF text strings: escape the three characters that end or break them; keep ASCII only.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, (c) => `\\${c}`);

  // 1 catalog, 2 page tree, then three objects a page (page, image, contents), then the info.
  const pageId = (index: number) => 3 + index * 3;
  const info = 3 + pages.length * 3;
  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageId(index)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  pages.forEach((page, index) => {
    const id = pageId(index);
    const w = (page.page.width * 0.75).toFixed(2);
    const h = (page.page.height * 0.75).toFixed(2);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    object(id + 1, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${page.image.width} /Height ${page.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      );
      push(page.jpeg);
      push("\nendstream");
    });
    object(id + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  object(info, `<< /Title (${safeTitle}) /Producer (Mogram) >>`);

  const xref = length;
  const count = offsets.length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++)
    push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A one-page PDF of a diagram. */
export function jpegToPdf(
  jpeg: Uint8Array,
  image: { readonly width: number; readonly height: number },
  page: { readonly width: number; readonly height: number },
  title: string,
): Uint8Array {
  return jpegsToPdf([{ jpeg, image, page }], title);
}
