import { describe, expect, it } from "vitest";
import {
  addShape,
  NEW_LISTING,
  copySnippet,
  pasteSnippet,
  renameElement,
  resizeElement,
  updateElement,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import { computeLayout } from "../src/layout";
import type { ProjectFiles } from "../src/model";
import { SHAPES, SHAPE_ADJUST, shapeGeometry, shapeParam } from "../src/presets";
import { routeConnections } from "../src/routing";

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Shapes
components:
  app: generic/service
shapes:
  decide: { shape: diamond, label: Approved?, tone: amber, bold: true }
  orders: cylinder
  box: { label: Box, fill: "#1e293b", stroke: none, stroke_width: 2, dash: dashed, corner: 8, shadow: true, opacity: 80, text_color: "#ffffff" }
connections:
  app_to_decide: { from: app, to: decide, route: straight }
layout:
  app: [0, 0]
  decide: [30, 0]
  orders: [30, 20]
  box: { at: [50, 0], size: [20, 10] }
`,
};

describe("shapes (M4)", () => {
  it("sizes images from pointer proportions and preserves source and fit through edits", () => {
    const source: ProjectFiles = {
      "mogram.yaml":
        "mogram: 1\nshapes:\n  picture: { shape: image, src: images/test.png, fit: cover }\n",
      "images/test.png": `mogram-asset 1 sha256:${"a".repeat(64)} image/png 16 1200x600`,
    };
    const { diagram, diagnostics } = parseDiagram(source);
    expect(diagnostics).toEqual([]);
    expect(diagram.components.get("picture")?.image).toEqual({
      src: "images/test.png",
      path: "images/test.png",
      fit: "cover",
      natural: { width: 1200, height: 600 },
    });
    // 80 cells wide at the picture's own proportions (D-102).
    expect(computeLayout(diagram).elements.get("picture")?.size).toEqual({ w: 80, h: 40 });
    const added = addShape(source, diagram, {
      shape: "image",
      label: "Second",
      src: "images/test.png",
      fit: "contain",
    });
    expect(parseDiagram(added.files).diagram.components.get("second")?.image?.src).toBe(
      "images/test.png",
    );
  });
  it("reads shapes as components drawn as outlines, with their look", () => {
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const decide = diagram.components.get("decide");
    expect(decide).toMatchObject({ shape: "diamond", label: "Approved?", type: "shape/diamond" });
    expect(decide?.look).toMatchObject({ tone: "amber", text: { bold: true, align: "center" } });
    expect(diagram.components.get("orders")?.shape).toBe("cylinder");
    expect(diagram.components.get("box")?.look).toMatchObject({
      fill: { kind: "solid", color: "#1e293b" },
      stroke: "none",
      strokeWidth: 2,
      dash: "dashed",
      corner: 8,
      shadow: true,
      opacity: 80,
      text: { color: "#ffffff" },
    });
    expect(diagram.components.get("app")?.shape).toBeNull();
  });

  it("sizes shapes from the layout or their kind, and gives them no icon tile", () => {
    const { diagram } = parseDiagram(files);
    const layout = computeLayout(diagram);
    expect(layout.elements.get("box")?.size).toEqual({ w: 20, h: 10 });
    expect(layout.elements.get("orders")?.size).toEqual({ w: 10, h: 12 });
    expect(layout.tiles.has("decide")).toBe(false);
    expect(layout.tiles.has("app")).toBe(true);
  });

  it("ends lines on the drawn outline, not the bounding box", () => {
    const { diagram } = parseDiagram(files);
    const layout = computeLayout(diagram);
    const route = routeConnections(diagram, layout).get("app_to_decide");
    const box = layout.elements.get("decide")?.box;
    if (route === undefined || box === undefined) throw new Error("missing");
    const end = route.points[route.points.length - 1];
    if (end === undefined) throw new Error("no end");
    // A diamond's outline: |x−cx|/(w/2) + |y−cy|/(h/2) = 1.
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const onOutline = Math.abs(end.x - cx) / (box.w / 2) + Math.abs(end.y - cy) / (box.h / 2);
    expect(onOutline).toBeCloseTo(1, 1);
  });

  it("adds a listing that says what it's for, with no label", () => {
    const { diagram } = parseDiagram(files);
    const added = addShape(files, diagram, { shape: "code", label: "", at: { x: 2, y: 60 } });
    const listing = parseDiagram(added.files).diagram.components.get("code");
    expect(listing?.code?.listing.lines).toEqual([NEW_LISTING]);
    expect(listing?.hasExplicitLabel).toBe(false);
  });

  it("adds, resizes, restyles and renames shapes in the shapes section", () => {
    const { diagram } = parseDiagram(files);
    const added = addShape(files, diagram, {
      shape: "hexagon",
      label: "Edge",
      at: { x: 2, y: 30 },
    });
    // All it says is its shape, and a neighbour is written short, so it is too.
    expect(added.files["mogram.yaml"]).toMatch(/shapes:[\s\S]*\n {2}edge: hexagon\n/);
    const resized = resizeElement(added.files, parseDiagram(added.files).diagram, {
      name: "edge",
      size: { w: 18, h: 9 },
    });
    expect(resized.files["mogram.yaml"]).toContain("edge: { at: [2, 30], size: [18, 9] }");
    const toned = updateElement(resized.files, parseDiagram(resized.files).diagram, {
      name: "orders",
      set: { tone: "blue" },
    });
    expect(parseDiagram(toned.files).diagram.components.get("orders")?.look?.tone).toBe("blue");
    const renamed = renameElement(toned.files, parseDiagram(toned.files).diagram, {
      from: "decide",
      to: "approval",
    });
    expect(renamed.files["mogram.yaml"]).toContain("approval: { shape: diamond");
    expect(renamed.files["mogram.yaml"]).toContain("from: app, to: approval");
  });

  it("copies and pastes a shape with its look", () => {
    const { diagram } = parseDiagram(files);
    const layout = computeLayout(diagram);
    const positions = new Map([...layout.elements].map(([n, e]) => [n, e.rel]));
    const text = copySnippet(diagram, ["box"], positions);
    expect(text).toContain("shapes:");
    const pasted = pasteSnippet(files, diagram, { text, parent: null, at: { x: 0, y: 40 } });
    const copy = parseDiagram(pasted.files).diagram.components.get("box_2");
    expect(copy?.shape).toBe("rectangle");
    expect(copy?.look).toMatchObject({ corner: 8, shadow: true, dash: "dashed", opacity: 80 });
  });

  it("gives every shape a closed outline and a label box", () => {
    for (const shape of SHAPES) {
      const geometry = shapeGeometry(shape, 120, 80);
      expect(geometry.outline.startsWith("M"), shape).toBe(true);
      expect(geometry.polygon.length, shape).toBeGreaterThanOrEqual(4);
      expect(geometry.label.w, shape).toBeGreaterThan(0);
    }
  });

  it("has one adjustable measure where draw.io has a handle, and the handle round-trips", () => {
    expect(Object.keys(SHAPE_ADJUST).sort()).toEqual([
      "cylinder",
      "document",
      "hexagon",
      "queue",
      "rectangle",
      "rounded",
    ]);
    for (const [shape, adjust] of Object.entries(SHAPE_ADJUST)) {
      const value = adjust.max(120, 80) / 2;
      expect(adjust.from(120, 80, adjust.at(120, 80, value)), shape).toBeCloseTo(value);
    }
    // Written values change the outline; too much is held to the most that draws.
    const deep = shapeGeometry("cylinder", 80, 120, { lid: 30 });
    expect(deep.label.y).toBe(62);
    expect(shapeParam("cylinder", 80, 120, { lid: 500 })).toEqual({ key: "lid", value: 40 });
    expect(shapeParam("hexagon", 120, 80, {})).toEqual({ key: "slant", value: 20 });
    expect(shapeParam("ellipse", 120, 80, {})).toBeNull();
  });

  it("reads lid, slant and wave like corner", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml": `mogram: 1
name: Adjust
shapes:
  db: { shape: cylinder, lid: 18 }
  fn: { shape: hexagon, slant: 8 }
  doc: { shape: document, wave: -2 }
`,
    });
    expect(diagram.components.get("db")?.look?.lid).toBe(18);
    expect(diagram.components.get("fn")?.look?.slant).toBe(8);
    expect(diagram.components.get("doc")?.look?.wave).toBeNull();
    expect(diagnostics.map((d) => d.message)).toEqual([
      'The wave of "doc" should be a depth in px, like 10.',
    ]);
  });
});
