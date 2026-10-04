import { describe, expect, it } from "vitest";
import { frameBitstream, muxAnimatedWebp } from "./webp-mux";

/** A minimal single-frame WebP container around a fake VP8 bitstream (enough for the muxer). */
function fakeFrame(payload: number[], alpha = false): Uint8Array {
  const chunk = (fourcc: string, data: number[]): number[] => {
    const size = data.length;
    const padded = size % 2 === 1 ? [...data, 0] : data;
    return [
      ...[...fourcc].map((c) => c.charCodeAt(0)),
      size & 255,
      (size >> 8) & 255,
      0,
      0,
      ...padded,
    ];
  };
  const body = [...(alpha ? chunk("ALPH", [1, 2, 3]) : []), ...chunk("VP8 ", payload)];
  const size = body.length + 4;
  return new Uint8Array(
    [..."RIFF"]
      .map((c) => c.charCodeAt(0))
      .concat(
        [size & 255, (size >> 8) & 255, 0, 0],
        [..."WEBP"].map((c) => c.charCodeAt(0)),
        body,
      ),
  );
}

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

describe("animated WebP muxing (EX-5)", () => {
  it("extracts the image chunks of a single frame", () => {
    expect(frameBitstream(fakeFrame([9, 9, 9, 9], true)).map((c) => c.fourcc)).toEqual([
      "ALPH",
      "VP8 ",
    ]);
  });

  it("writes RIFF/WEBP with VP8X, a looping ANIM, and one ANMF per frame", () => {
    const out = muxAnimatedWebp(
      [
        { webp: fakeFrame([1, 2, 3, 4]), duration: 50 },
        { webp: fakeFrame([5, 6, 7]), duration: 50 },
      ],
      640,
      400,
    );
    expect(ascii(out, 0)).toBe("RIFF");
    expect(ascii(out, 8)).toBe("WEBP");
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    expect(ascii(out, 12)).toBe("VP8X");
    // Canvas size is stored minus one, in 24 bits.
    expect(out[24]! | (out[25]! << 8) | (out[26]! << 16)).toBe(639);
    expect(out[27]! | (out[28]! << 8) | (out[29]! << 16)).toBe(399);
    const text = new TextDecoder("latin1").decode(out);
    expect(text.indexOf("ANIM")).toBeGreaterThan(0);
    expect(text.split("ANMF").length - 1).toBe(2);
    // Loop count 0 = forever (EX-7).
    const anim = text.indexOf("ANIM");
    expect(new DataView(out.buffer).getUint16(anim + 8 + 4, true)).toBe(0);
  });

  it("refuses to make an animation with no frames", () => {
    expect(() => muxAnimatedWebp([], 10, 10)).toThrow();
  });
});
