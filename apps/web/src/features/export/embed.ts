import type { ProjectFiles } from "@mogram/core/model";

/**
 * Editable exports (07-document-workflow §18 P0-6, draw.io's "Include a copy of my diagram"):
 * the project's files travel inside the PNG (a `tEXt` chunk) or SVG (a `<metadata>` element), so
 * opening the image in Mogram gives the diagram back. The payload is base64 of UTF-8 JSON, which
 * PNG text chunks (Latin-1) and XML both carry safely.
 */

const KEYWORD = "mogram";
const SVG_MARKER = 'data-mogram="files"';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeFiles(files: ProjectFiles): string {
  return toBase64(JSON.stringify({ mogram: 1, files }));
}

/** The files, if `payload` is a Mogram payload made of text files; otherwise null. */
function decodeFiles(payload: string): ProjectFiles | null {
  try {
    const value: unknown = JSON.parse(fromBase64(payload.trim()));
    if (typeof value !== "object" || value === null || !("files" in value)) return null;
    const files = (value as { files: unknown }).files;
    if (typeof files !== "object" || files === null) return null;
    const entries = Object.entries(files as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([, text]) => typeof text !== "string")) return null;
    return Object.fromEntries(entries) as ProjectFiles;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------------------------------
// SVG

export function embedInSvg(svg: string, files: ProjectFiles): string {
  const open = svg.indexOf(">", svg.indexOf("<svg"));
  if (open < 0) return svg;
  const metadata = `<metadata ${SVG_MARKER}>${encodeFiles(files)}</metadata>`;
  return `${svg.slice(0, open + 1)}${metadata}${svg.slice(open + 1)}`;
}

export function filesFromSvg(svg: string): ProjectFiles | null {
  const match = new RegExp(`<metadata ${SVG_MARKER}>([A-Za-z0-9+/=\\s]+)</metadata>`).exec(svg);
  return match?.[1] === undefined ? null : decodeFiles(match[1]);
}

// -------------------------------------------------------------------------------------------------
// PNG

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (crcTable === null) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((value, i) => bytes[i] === value);
}

/** The PNG's chunks: [type, data offset, data length], with where each chunk starts. */
function chunks(
  bytes: Uint8Array,
): { type: string; start: number; data: number; length: number }[] {
  const out: { type: string; start: number; data: number; length: number }[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = SIGNATURE.length;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    out.push({ type, start: at, data: at + 8, length });
    at += 12 + length;
    if (type === "IEND") break;
  }
  return out;
}

export function embedInPng(png: Uint8Array, files: ProjectFiles): Uint8Array {
  if (!isPng(png)) return png;
  const end = chunks(png).find((chunk) => chunk.type === "IEND");
  if (end === undefined) return png;
  const text = new TextEncoder().encode(`${KEYWORD}\0${encodeFiles(files)}`);
  const chunk = new Uint8Array(12 + text.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, text.length);
  chunk.set(new TextEncoder().encode("tEXt"), 4);
  chunk.set(text, 8);
  view.setUint32(8 + text.length, crc32(chunk.subarray(4, 8 + text.length)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, end.start), 0);
  out.set(chunk, end.start);
  out.set(png.subarray(end.start), end.start + chunk.length);
  return out;
}

export function filesFromPng(png: Uint8Array): ProjectFiles | null {
  if (!isPng(png)) return null;
  for (const chunk of chunks(png)) {
    if (chunk.type !== "tEXt") continue;
    const data = png.subarray(chunk.data, chunk.data + chunk.length);
    const zero = data.indexOf(0);
    if (zero < 0) continue;
    const keyword = String.fromCharCode(...data.subarray(0, zero));
    if (keyword !== KEYWORD) continue;
    let payload = "";
    for (const byte of data.subarray(zero + 1)) payload += String.fromCharCode(byte);
    return decodeFiles(payload);
  }
  return null;
}
