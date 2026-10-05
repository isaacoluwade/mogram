import { describe, expect, it } from "vitest";
import {
  createNamedStyle,
  deleteNamedStyle,
  resetToNamedStyle,
  setNamedStyle,
  styleOverrides,
  updateNamedStyle,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Styles
styles:
  critical: { tone: rose, stroke_width: 2, shadow: true, color: "#f43f5e" }
  async: { line: dashed, arrows: none }
shapes:
  pay: { shape: rounded, style: critical }
  refund: { shape: rounded, style: critical, tone: amber }
components:
  api: { type: generic/service, style: critical }
connections:
  pay_to_refund: { from: pay, to: refund, style: async }
`,
};

describe("named styles (03-shapes-styles-library §4)", () => {
  it("gives each element its style's keys, under its own", () => {
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagnostics).toEqual([]);
    expect([...diagram.styles.keys()]).toEqual(["critical", "async"]);
    expect(diagram.styles.get("critical")?.keys).toEqual([
      "tone",
      "stroke_width",
      "shadow",
      "color",
    ]);
    const pay = diagram.components.get("pay");
    expect(pay?.style).toBe("critical");
    expect(pay?.look).toMatchObject({ tone: "rose", strokeWidth: 2, shadow: true });
    // Its own tone wins.
    expect(diagram.components.get("refund")?.look?.tone).toBe("amber");
    // A component takes only what a component has: its colour.
    expect(diagram.components.get("api")?.color).toBe("#f43f5e");
    const line = diagram.connections.get("pay_to_refund");
    expect(line?.style).toBe("async");
    expect(line?.line).toBe("dashed");
  });

  it("says when a style is missing, and reports a bad style value once, where it is", () => {
    const { diagnostics } = parseDiagram({
      "mogram.yaml": `mogram: 1
name: Broken
styles:
  loud: { tone: purple }
shapes:
  a: { shape: rectangle, style: loud }
  b: { shape: rectangle, style: loud }
  c: { shape: rectangle, style: lowd }
`,
    });
    const messages = diagnostics.map((d) => `${d.line}: ${d.message}`);
    expect(messages.filter((m) => m.startsWith("4:"))).toHaveLength(1);
    expect(messages.some((m) => m.includes(`takes style "lowd"`) && m.includes("loud"))).toBe(true);
  });

  it("reads styles first without reporting the file's other keys twice", () => {
    const { diagnostics } = parseDiagram({
      "mogram.yaml": "mogram: 1\nname: Keys\n[a, b]: x\nstyles:\n  quiet: { tone: blue }\n",
    });
    expect(diagnostics.filter((d) => d.message === "Keys here must be plain names.")).toHaveLength(
      1,
    );
  });

  it("works across the files of a folder diagram", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml": "mogram: 1\nname: Folder\nstyles:\n  quiet: { tone: purple }\n",
      "app.mogram.yaml": "shapes:\n  a: { shape: rectangle, style: quiet }\n",
    });
    expect(diagram.components.get("a")?.style).toBe("quiet");
    expect(diagnostics.find((d) => d.severity === "error")).toMatchObject({
      file: "mogram.yaml",
      line: 4,
    });
  });

  it("makes a style from an element, which then takes it", () => {
    const plain: ProjectFiles = {
      "mogram.yaml": `mogram: 1
name: Plain
shapes:
  a: { shape: diamond, tone: violet, dash: dashed, label: Decide }
  b: { shape: rectangle }
`,
    };
    const made = createNamedStyle(plain, parseDiagram(plain).diagram, {
      from: "a",
      style: "choice",
    });
    expect(made.files["mogram.yaml"]).toBe(`mogram: 1
name: Plain

styles:
  choice: { tone: violet, dash: dashed }
shapes:
  a: { shape: diamond, label: Decide, style: choice }
  b: { shape: rectangle }
`);
    const next = parseDiagram(made.files).diagram;
    expect(next.components.get("a")?.look?.tone).toBe("violet");
    const both = setNamedStyle(made.files, next, { names: ["b"], style: "choice" });
    expect(parseDiagram(both.files).diagram.components.get("b")?.look?.dash).toBe("dashed");
    expect(() => createNamedStyle(made.files, next, { from: "b", style: "choice" })).toThrow(
      /already a style/,
    );
  });

  it("updates a style from an element, resets one to its style, and deletes a style", () => {
    const { diagram } = parseDiagram(files);
    expect(styleOverrides(files, diagram, "refund")).toEqual(["tone"]);
    const updated = updateNamedStyle(files, diagram, { from: "refund" });
    const after = parseDiagram(updated.files).diagram;
    // Every element with the style follows.
    expect(after.components.get("pay")?.look?.tone).toBe("amber");
    expect(updated.files["mogram.yaml"]).toContain(
      `critical: { tone: amber, stroke_width: 2, shadow: true, color: "#f43f5e" }`,
    );

    const reset = resetToNamedStyle(files, diagram, { names: ["refund"] });
    expect(parseDiagram(reset.files).diagram.components.get("refund")?.look?.tone).toBe("rose");

    const deleted = deleteNamedStyle(files, diagram, { style: "async" });
    expect(deleted.files["mogram.yaml"]).not.toContain("async");
    expect(parseDiagram(deleted.files).diagnostics).toEqual([]);
  });
});
