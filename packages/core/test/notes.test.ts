import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { computeLayout } from "../src/layout";
import { addDecoration, resizeElement, updateElement } from "../src/edit";
import { linear, noteInk, solid } from "../src/presets";
import type { Decoration, ProjectFiles } from "../src/model";

const BASE = `mogram: 1
name: Notes

components:
  web: azure/app-service
`;

function decoration(files: ProjectFiles, name: string): Decoration {
  const parsed = parseDiagram(files);
  const found = parsed.diagram.decorations.get(name);
  if (found === undefined) throw new Error(`${name} wasn't parsed`);
  return found;
}

describe("sticky notes (ED-25)", () => {
  it("reads a note with rich text, a gradient fill and typography", () => {
    const files = {
      "mogram.yaml": `${BASE}
layout:
  decorations:
    follow_ups:
      note: |
        **Follow-ups**
        - Rate limit the API
        - Move sessions to Redis
      fill: "linear-gradient(135deg, #fef3a0, #fed7aa)"
      font: geist
      font_size: 16
      bold: true
      align: center
      color: "#1e3a8a"
      at: [40, 4]
      size: [24, 16]
`,
    };
    const parsed = parseDiagram(files);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.diagram.decorations.get("follow_ups")).toMatchObject({
      variant: "note",
      text: "**Follow-ups**\n- Rate limit the API\n- Move sessions to Redis",
      size: { w: 24, h: 16 },
      fill: linear(135, "#fef3a0", "#fed7aa"),
      look: {
        font: "geist",
        fontSize: 16,
        bold: true,
        italic: false,
        align: "center",
        color: "#1e3a8a",
      },
    });
    expect(computeLayout(parsed.diagram).elements.get("follow_ups")?.box).toMatchObject({
      w: 24 * 8,
      h: 16 * 8,
    });
  });

  it("defaults to a yellow note of the standard size with automatic type", () => {
    const files = {
      "mogram.yaml": `${BASE}
layout:
  decorations:
    idea: { note: Try a CDN, at: [4, 20] }
`,
    };
    const note = decoration(files, "idea");
    expect(note).toMatchObject({
      variant: "note",
      size: { w: 22, h: 18 },
      fill: solid("#fef3a0"),
      look: { font: null, fontSize: null, bold: false, align: "left", color: null },
    });
  });

  it("explains typography mistakes, and ignores note keys on labels", () => {
    const files = {
      "mogram.yaml": `${BASE}
layout:
  decorations:
    idea: { note: Hi, at: [4, 20], font: comic, font_size: 400, bold: yes please, fill: red }
    other:
      note: Hi
      at: [30, 20]
      fill: linear-gradient(135deg, #fef3a0, #fed7aa)
    tag: { label: Beta, at: [4, 4], font: geist }
`,
    };
    const messages = parseDiagram(files).diagnostics.map((d) => d.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`"comic" isn't a font preset for "idea".`),
        expect.stringContaining(`The font size of "idea" should be a number from 6 to 200`),
        expect.stringContaining(`"bold" for "idea" should be true or false.`),
        expect.stringContaining(`The fill of "idea":`),
        expect.stringContaining(`"font" is for text and sticky notes, not labels`),
        expect.stringContaining(`The fill of "other": Put the gradient in quotes`),
      ]),
    );
  });

  it("adds a note as a block, writes several lines as a | block, and drops defaults", () => {
    const files = { "mogram.yaml": BASE };
    const added = addDecoration(files, parseDiagram(files).diagram, {
      variant: "note",
      text: "",
      size: { w: 22, h: 18 },
      at: { x: 30, y: 2 },
    });
    expect(added.select).toEqual(["note"]);
    expect(added.files["mogram.yaml"]).toContain(
      `  decorations:\n    note:\n      note: ""\n      at: [30, 2]\n      size: [22, 18]\n`,
    );

    const typed = updateElement(added.files, parseDiagram(added.files).diagram, {
      name: "note",
      set: { label: "**Plan**\n- one\n- two" },
    });
    expect(typed.files["mogram.yaml"]).toContain(
      `      note: |-\n        **Plan**\n        - one\n        - two\n`,
    );
    expect(decoration(typed.files, "note").text).toBe("**Plan**\n- one\n- two");

    const styled = updateElement(typed.files, parseDiagram(typed.files).diagram, {
      name: "note",
      set: { fill: "#bfdbfe", bold: true, align: "center", font: "mono", font_size: 20 },
    });
    const yaml = styled.files["mogram.yaml"] ?? "";
    expect(yaml).toContain(`fill: "#bfdbfe"`);
    expect(yaml).toContain("bold: true");
    expect(yaml).toContain("font_size: 20");

    const reset = updateElement(styled.files, parseDiagram(styled.files).diagram, {
      name: "note",
      set: { fill: "#fef3a0", bold: false, align: "left", font_size: "auto" },
    });
    const after = reset.files["mogram.yaml"] ?? "";
    expect(after).not.toContain("fill:");
    expect(after).not.toContain("bold:");
    expect(after).not.toContain("align:");
    expect(after).not.toContain("font_size:");
    expect(decoration(reset.files, "note")).toMatchObject({ look: { font: "mono" } });
  });

  it("resizes notes like zones", () => {
    const files = {
      "mogram.yaml": `${BASE}
layout:
  decorations:
    idea: { note: Hi, at: [4, 20] }
`,
    };
    const resized = resizeElement(files, parseDiagram(files).diagram, {
      name: "idea",
      size: { w: 30, h: 12 },
    });
    expect(decoration(resized.files, "idea")).toMatchObject({ size: { w: 30, h: 12 } });
  });

  it("sizes multi-line text by its widest line and line count, at its own font size", () => {
    const files = {
      "mogram.yaml": `${BASE}
layout:
  decorations:
    heading: { text: "One\\nTwo\\nThree", font_size: 20, at: [4, 4] }
`,
    };
    const parsed = parseDiagram(files);
    expect(parsed.diagnostics).toEqual([]);
    const box = computeLayout(parsed.diagram).elements.get("heading")?.box;
    expect(box?.h).toBe(Math.ceil((20 * 1.4 * 3) / 8) * 8);
  });

  it("picks dark ink on light fills and white on dark ones", () => {
    expect(noteInk(solid("#fef3a0"))).toBe("#1c1917");
    expect(noteInk(solid("#1e3a8a"))).toBe("#ffffff");
    expect(noteInk(linear(135, "#0f172a", "#334155"))).toBe("#ffffff");
  });
});
