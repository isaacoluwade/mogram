import { describe, expect, it } from "vitest";
import { setSetting } from "../src/edit";
import { parseDiagram } from "../src/format";
import { computeLayout, frameOf } from "../src/layout";
import { lintDiagram } from "../src/lint";
import { PAGES, pageSize } from "../src/presets";

const yaml = (page: string) => `mogram: 1
name: A slide
${page}shapes:
  title: { label: Terraform }
  aside: { label: A note to myself }
layout:
  title: [10, 10]
  aside: [300, 10]
`;
const read = (page: string) => parseDiagram({ "diagram.mogram.yaml": yaml(page) });

describe("pages (D-98)", () => {
  it("reads each page, and a diagram without one has none", () => {
    expect(read("").diagram.settings.page).toBeNull();
    expect(read("page: none\n").diagram.settings.page).toBeNull();
    expect(read("page: none\n").diagnostics).toEqual([]);
    for (const page of PAGES) {
      const result = read(`page: ${page}\n`);
      expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(result.diagram.settings.page).toBe(page);
    }
  });

  it("says what a page can be when it isn't one", () => {
    const result = read("page: 21:9\n");
    expect(result.diagram.settings.page).toBeNull();
    expect(result.diagnostics.map((d) => d.message)).toContain(
      `"page" should be 16:9, 4:3, 1:1, 9:16 or none.`,
    );
  });

  it("is 1080 px on its short side, with its corner at the origin", () => {
    expect(pageSize("16:9")).toEqual({ w: 240, h: 135 });
    expect(computeLayout(read("page: 16:9\n").diagram).page).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 1080,
    });
    expect(computeLayout(read("page: 9:16\n").diagram).page).toEqual({
      x: 0,
      y: 0,
      w: 1080,
      h: 1920,
    });
    expect(computeLayout(read("page: 4:3\n").diagram).page).toEqual({
      x: 0,
      y: 0,
      w: 1440,
      h: 1080,
    });
    expect(computeLayout(read("page: 1:1\n").diagram).page).toEqual({
      x: 0,
      y: 0,
      w: 1080,
      h: 1080,
    });
  });

  it("is what's framed when there is one; otherwise the contents are", () => {
    const paged = computeLayout(read("page: 16:9\n").diagram);
    expect(frameOf(paged)).toBe(paged.page);
    // The contents reach past the page, and the bounds still say so.
    expect(paged.bounds.x + paged.bounds.w).toBeGreaterThan(1920);
    const loose = computeLayout(read("").diagram);
    expect(loose.page).toBeNull();
    expect(frameOf(loose)).toBe(loose.bounds);
  });

  it("is written with the other settings, and taken away by none", () => {
    const { diagram } = read("");
    const files = { "diagram.mogram.yaml": yaml("") };
    const set = setSetting(files, diagram, { key: "page", value: "16:9" });
    const text = set.files["diagram.mogram.yaml"] ?? "";
    expect(text).toContain("name: A slide\npage: 16:9\n");
    const again = parseDiagram(set.files);
    expect(again.diagram.settings.page).toBe("16:9");
    const unset = setSetting(set.files, again.diagram, { key: "page", value: "none" });
    expect(unset.files["diagram.mogram.yaml"]).toBe(yaml(""));
  });

  it("suggests moving what nobody watching will see", () => {
    const findings = lintDiagram(read("page: 16:9\n").diagram).filter((f) => f.rule === "off-page");
    expect(findings.map((f) => f.message)).toEqual([
      `"A note to myself" sits outside the page, so nobody watching will see it.`,
    ]);
    expect(lintDiagram(read("").diagram).some((f) => f.rule === "off-page")).toBe(false);
  });
});
