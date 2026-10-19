import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PANEL, clearDeckLibrary, clearDeckRail, clearOf } from "./panel-sizes";

const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
const px = (name: string): number => {
  const match = new RegExp(`--spacing-${name}:\\s*(\\d+)px;`).exec(tokens);
  if (match?.[1] === undefined) throw new Error(`--spacing-${name} is not in tokens.css`);
  return Number(match[1]);
};

describe("panel sizes", () => {
  it("match the CSS tokens the layout uses", () => {
    expect(px("panel-library")).toBe(PANEL.library);
    expect(px("panel-deck-rail")).toBe(PANEL.deckRail);
    expect(px("panel-right")).toBe(PANEL.right);
    expect(px("panel-code")).toBe(PANEL.code);
    expect(px("panel-code-xl")).toBe(PANEL.codeXl);
    expect(px("clear-library")).toBe(clearOf(PANEL.library));
    expect(px("clear-deck-rail")).toBe(clearDeckRail);
    expect(px("clear-deck-library")).toBe(clearDeckLibrary);
    expect(px("clear-right")).toBe(clearOf(PANEL.right));
    expect(px("clear-code")).toBe(clearOf(PANEL.code));
    expect(px("clear-code-xl")).toBe(clearOf(PANEL.codeXl));
  });
});
