import { describe, expect, it } from "vitest";
import { formatPointer, isPointer, parsePointer, type AssetPointer } from "../src/assets";

const HASH = "9f".repeat(32);

describe("asset pointers (D-101)", () => {
  it("writes and reads a picture's pointer with its size", () => {
    const pointer: AssetPointer = {
      hash: HASH,
      type: "image/png",
      bytes: 482113,
      width: 1920,
      height: 1080,
    };
    const line = formatPointer(pointer);
    expect(line).toBe(`mogram-asset 1 sha256:${HASH} image/png 482113 1920x1080`);
    expect(parsePointer(line)).toEqual(pointer);
    expect(parsePointer(`  ${line}\n`)).toEqual(pointer);
    expect(isPointer(line)).toBe(true);
  });

  it("writes a recording's length and skip to the millisecond, never as an exponent", () => {
    const line = formatPointer({
      hash: HASH,
      type: "audio/webm",
      bytes: 81234,
      seconds: 6.1904999,
      skip: 0.21,
    });
    expect(line).toBe(`mogram-asset 1 sha256:${HASH} audio/webm 81234 6.19s skip=0.21`);
    expect(parsePointer(line)).toMatchObject({ seconds: 6.19, skip: 0.21 });
    expect(formatPointer({ hash: HASH, type: "audio/webm", bytes: 9, seconds: 120 })).toContain(
      " 120s",
    );
    // A length too small to write isn't a length.
    expect(() =>
      formatPointer({ hash: HASH, type: "audio/webm", bytes: 9, seconds: 1e-7 }),
    ).toThrow();
  });

  it("isn't fooled by anything that isn't exactly a pointer", () => {
    const bad = [
      "",
      "a picture",
      `mogram-asset 2 sha256:${HASH} image/png 1`,
      `mogram-asset 1 sha256:${"x".repeat(64)} image/png 1`,
      `mogram-asset 1 sha256:${HASH} image/svg+xml 1`,
      `mogram-asset 1 sha256:${HASH} text/html 1`,
      `mogram-asset 1 sha256:${HASH} image/png 0`,
      `mogram-asset 1 sha256:${HASH} image/png 1 1920x0`,
      `mogram-asset 1 sha256:${HASH} image/png 1 2s`,
      `mogram-asset 1 sha256:${HASH} audio/webm 1 64x64`,
      `mogram-asset 1 sha256:${HASH} audio/webm 1 2s skip=3`,
      `mogram-asset 1 sha256:${HASH} image/png 1 extra`,
    ];
    for (const line of bad) expect(parsePointer(line), line).toBeNull();
  });

  it("won't write a pointer that couldn't be read back", () => {
    expect(() => formatPointer({ hash: "abc", type: "image/png", bytes: 1 })).toThrow();
    expect(() => formatPointer({ hash: HASH, type: "image/png", bytes: 1, width: 10 })).toThrow();
  });
});
