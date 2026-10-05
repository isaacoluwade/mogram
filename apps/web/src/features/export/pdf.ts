/**
 * PDF export (07-document-workflow §18 P0-7): one page the size of the diagram, holding it as a
 * JPEG image (PDF reads JPEG as is, with the DCTDecode filter), so a PDF needs no library. The
 * page is in points (1 px = 0.75 pt) and the image is drawn at higher resolution for print.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  image: { readonly width: number; readonly height: number },
  page: { readonly width: number; readonly height: number },
  title: string,
): Uint8Array {
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
  const w = (page.width * 0.75).toFixed(2);
  const h = (page.height * 0.75).toFixed(2);
  // PDF text strings: escape the three characters that end or break them; keep ASCII only.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, (c) => `\\${c}`);
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;

  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push("\nendstream");
  });
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title (${safeTitle}) /Producer (Mogram) >>`);

  const xref = length;
  const count = offsets.length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++)
    push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
