import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONT_SIZE_TOKENS, TRACKING_TOKENS, cn } from "./cn";

const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
const declared = (prefix: string) =>
  [...tokens.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))]
    .map((match) => match[1] ?? "")
    .filter((name) => !name.includes("--"));

describe("cn", () => {
  it("knows every font-size token, so sizes and colours never cancel out", () => {
    const sizes = declared("text").filter((name) => !name.endsWith("-line-height"));
    expect([...FONT_SIZE_TOKENS].sort()).toEqual(sizes.sort());
  });

  it("knows every tracking token", () => {
    expect([...TRACKING_TOKENS].sort()).toEqual(declared("tracking").sort());
  });

  it("keeps a size token next to a colour token", () => {
    expect(cn("text-pill text-fg-inverse")).toBe("text-pill text-fg-inverse");
    expect(cn("text-eyebrow text-fg-dim")).toBe("text-eyebrow text-fg-dim");
  });

  it("still resolves real conflicts", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
    expect(cn("tracking-snug", "tracking-display")).toBe("tracking-display");
  });
});
