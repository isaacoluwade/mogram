/**
 * Animated WebP muxing (EX-5). Browsers can encode single WebP frames (canvas.toBlob) but not
 * animations, so each frame is encoded by the browser and its bitstream is wrapped in the RIFF
 * container with VP8X + ANIM + ANMF chunks (WebP container spec, "Extended file format").
 */

interface Chunk {
  readonly fourcc: string;
  readonly data: Uint8Array;
}

function readChunks(bytes: Uint8Array): Chunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number): string =>
    String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") throw new Error("Not a WebP file");
  const chunks: Chunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = tag(offset);
    const size = view.getUint32(offset + 4, true);
    chunks.push({ fourcc, data: bytes.subarray(offset + 8, offset + 8 + size) });
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

/** The image data (optional ALPH + VP8/VP8L) of a single-frame WebP. */
export function frameBitstream(webp: Uint8Array): Chunk[] {
  return readChunks(webp).filter(
    (chunk) => chunk.fourcc === "ALPH" || chunk.fourcc === "VP8 " || chunk.fourcc === "VP8L",
  );
}

class Writer {
  private readonly parts: Uint8Array[] = [];
  length = 0;

  bytes(data: Uint8Array): void {
    this.parts.push(data);
    this.length += data.length;
  }

  ascii(text: string): void {
    this.bytes(new Uint8Array([...text].map((c) => c.charCodeAt(0))));
  }

  u32(value: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value, true);
    this.bytes(b);
  }

  u24(value: number): void {
    this.bytes(new Uint8Array([value & 255, (value >> 8) & 255, (value >> 16) & 255]));
  }

  u16(value: number): void {
    this.bytes(new Uint8Array([value & 255, (value >> 8) & 255]));
  }

  u8(value: number): void {
    this.bytes(new Uint8Array([value & 255]));
  }

  chunk(fourcc: string, body: (w: Writer) => void): void {
    const inner = new Writer();
    body(inner);
    const data = inner.concat();
    this.ascii(fourcc);
    this.u32(data.length);
    this.bytes(data);
    if (data.length % 2 === 1) this.u8(0);
  }

  concat(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

export interface AnimatedWebpFrame {
  /** A complete single-frame WebP file (from canvas.toBlob). */
  readonly webp: Uint8Array;
  /** Display time in milliseconds. */
  readonly duration: number;
}

/** Builds an animated WebP that loops forever. All frames share the canvas size. */
export function muxAnimatedWebp(
  frames: readonly AnimatedWebpFrame[],
  width: number,
  height: number,
  background = 0xff000000,
): Uint8Array {
  if (frames.length === 0) throw new Error("No frames");
  const hasAlpha = frames.some((frame) =>
    frameBitstream(frame.webp).some((c) => c.fourcc === "ALPH" || c.fourcc === "VP8L"),
  );
  const body = new Writer();
  body.ascii("WEBP");
  body.chunk("VP8X", (w) => {
    // Flags: animation (bit 1) and alpha (bit 4).
    w.u8((hasAlpha ? 0x10 : 0) | 0x02);
    w.u24(0);
    w.u24(width - 1);
    w.u24(height - 1);
  });
  body.chunk("ANIM", (w) => {
    w.u32(background);
    w.u16(0); // loop forever
  });
  for (const frame of frames) {
    const bitstream = frameBitstream(frame.webp);
    body.chunk("ANMF", (w) => {
      w.u24(0); // x / 2
      w.u24(0); // y / 2
      w.u24(width - 1);
      w.u24(height - 1);
      w.u24(Math.max(0, Math.min(0xffffff, Math.round(frame.duration))));
      w.u8(0x02); // do not blend: every frame is a complete picture (keeps transparent frames clean)
      for (const chunk of bitstream) {
        w.ascii(chunk.fourcc);
        w.u32(chunk.data.length);
        w.bytes(chunk.data);
        if (chunk.data.length % 2 === 1) w.u8(0);
      }
    });
  }
  const payload = body.concat();
  const file = new Writer();
  file.ascii("RIFF");
  file.u32(payload.length);
  file.bytes(payload);
  return file.concat();
}
