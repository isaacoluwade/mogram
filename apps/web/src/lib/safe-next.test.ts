import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/edit/123")).toBe("/edit/123");
    expect(safeNext("/draft/abc/view?scene=x")).toBe("/draft/abc/view?scene=x");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      "/a\nb",
      42,
      null,
    ]) {
      expect(safeNext(value)).toBe("/diagrams");
    }
  });
});
