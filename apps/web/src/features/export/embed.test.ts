import { describe, expect, it } from "vitest";
import { embedInPng, embedInSvg, filesFromPng, filesFromSvg } from "./embed";
import { jpegToPdf } from "./pdf";

const FILES = { "mogram.yaml": "name: Café ☕\ncomponents:\n  a: generic/service\n" };

/** The smallest PNG the chunk reader accepts: the signature and an IEND chunk. */
const PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

describe("editable exports", () => {
  it("round-trips the files through an SVG", () => {
    const svg = embedInSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', FILES);
    expect(svg).toMatch(/^<svg [^>]+><metadata data-mogram="files">/);
    expect(filesFromSvg(svg)).toEqual(FILES);
    expect(filesFromSvg("<svg></svg>")).toBeNull();
  });

  it("round-trips the files through a PNG text chunk, before IEND", () => {
    const png = embedInPng(PNG, FILES);
    expect(png.length).toBeGreaterThan(PNG.length);
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe("IEND");
    expect(filesFromPng(png)).toEqual(FILES);
    expect(filesFromPng(PNG)).toBeNull();
  });
});

describe("PDF export", () => {
  it("writes a one-page PDF whose cross-reference table points at each object", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = jpegToPdf(
      jpeg,
      { width: 200, height: 100 },
      { width: 100, height: 50 },
      "My (diagram)",
    );
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 75.00 37.50]");
    expect(text).toContain("/Title (My \\(diagram\\))");
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    offsets.forEach((offset, i) => {
      const header = `${i + 1} 0 obj`;
      expect(text.slice(offset, offset + header.length)).toBe(header);
    });
  });
});
