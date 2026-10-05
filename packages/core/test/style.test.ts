import { describe, expect, it } from "vitest";
import {
  applyStyle,
  isLocked,
  readProperties,
  readStyle,
  setLocked,
  setProperty,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Style
components:
  app: { type: generic/service, color: "#ff8800", motion: pulse, state: degraded }
  db: { type: generic/database, motion: glow }
  cache: generic/database
connections:
  a: { from: app, to: db, arrows: { start: diamond, end: block }, line: dashed, width: 3 }
  b: { from: app, to: cache, label: Reads }
`,
};

describe("copy and paste style", () => {
  it("copies how a connection looks onto another, leaving what it says alone", () => {
    const diagram = parseDiagram(files).diagram;
    const style = readStyle(files, diagram, "a");
    if (style === null) throw new Error("no style");
    const result = applyStyle(files, diagram, { names: ["b"], style });
    const b = parseDiagram(result.files).diagram.connections.get("b");
    expect(b).toMatchObject({
      arrows: { start: "diamond", end: "block" },
      line: "dashed",
      width: 3,
      text: "Reads",
    });
    expect(result.files["mogram.yaml"]).toContain(
      "b: { from: app, to: cache, label: Reads, arrows: { start: diamond, end: block }, line: dashed, width: 3 }",
    );
  });

  it("makes the targets match: keys the source leaves out are removed, state is kept", () => {
    const diagram = parseDiagram(files).diagram;
    const style = readStyle(files, diagram, "cache");
    if (style === null) throw new Error("no style");
    const result = applyStyle(files, diagram, { names: ["app", "db"], style });
    const after = parseDiagram(result.files).diagram;
    expect(after.components.get("app")).toMatchObject({
      color: null,
      motion: "none",
      state: "degraded",
    });
    expect(after.components.get("db")?.motion).toBe("none");
  });

  it("carries only shared keys between kinds", () => {
    const diagram = parseDiagram(files).diagram;
    const style = readStyle(files, diagram, "app");
    if (style === null) throw new Error("no style");
    const result = applyStyle(files, diagram, { names: ["b"], style });
    const b = parseDiagram(result.files).diagram.connections.get("b");
    expect(b?.color).toBe("#ff8800");
    expect(b?.route).toBe("orthogonal");
  });
});

describe("locking", () => {
  it("locks and unlocks elements in their layout entries", () => {
    const project: ProjectFiles = {
      "mogram.yaml": `mogram: 1
name: Lock
components:
  app: generic/service
layout:
  app: [2, 2]
  decorations:
    title: { text: Hello, at: [0, -6] }
`,
    };
    const diagram = parseDiagram(project).diagram;
    const locked = setLocked(project, diagram, { names: ["app", "title"], locked: true });
    expect(locked.files["mogram.yaml"]).toContain("app: { at: [2, 2], locked: true }");
    expect(locked.files["mogram.yaml"]).toContain(
      "title: { text: Hello, at: [0, -6], locked: true }",
    );
    const after = parseDiagram(locked.files).diagram;
    expect(isLocked(after, "app")).toBe(true);
    expect(isLocked(after, "title")).toBe(true);
    const unlocked = setLocked(locked.files, after, { names: ["app", "title"], locked: false });
    expect(unlocked.files["mogram.yaml"]).toBe(project["mogram.yaml"]);
  });
});

describe("all properties", () => {
  it("lists every key a connection takes with what the file says, and writes YAML back", () => {
    const diagram = parseDiagram(files).diagram;
    const rows = readProperties(files, diagram, "a");
    expect(rows.find((r) => r.key === "arrows")?.value).toBe("{ start: diamond, end: block }");
    expect(rows.find((r) => r.key === "route")?.value).toBeNull();
    expect(() => setProperty(files, diagram, { name: "a", key: "arrows", text: "[x" })).toThrow(
      /isn't a YAML value/,
    );
    const routed = setProperty(files, diagram, { name: "a", key: "route", text: "curved" });
    expect(parseDiagram(routed.files).diagram.connections.get("a")?.route).toBe("curved");
    const cleared = setProperty(routed.files, parseDiagram(routed.files).diagram, {
      name: "a",
      key: "line",
      text: "",
    });
    expect(parseDiagram(cleared.files).diagram.connections.get("a")?.line).toBe("solid");
  });
});
