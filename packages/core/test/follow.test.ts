import { describe, expect, it } from "vitest";
import { followTerminals, moveElements, splitConnection } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";
import { followVia } from "../src/routing";

const project = (route: string, via: string): ProjectFiles => ({
  "mogram.yaml": `mogram: 1
name: Follow
components:
  app: generic/service
  db: generic/database
connections:
  app_to_db: { from: app, to: db, route: ${route} }
layout:
  app: [0, 0]
  db: [30, 0]
  app_to_db: { via: ${via} }
`,
});

function moved(files: ProjectFiles, name: string, at: { x: number; y: number }) {
  const diagram = parseDiagram(files).diagram;
  const result = followTerminals(
    diagram,
    moveElements(files, diagram, [{ name, at, parent: null }]),
  );
  return parseDiagram(result.files).diagram.layout.get("app_to_db")?.via;
}

describe("bends follow their ends (ED-29)", () => {
  it("translates bends exactly when both ends move together", () => {
    const box = (x: number) => ({ x, y: 0, w: 40, h: 40 });
    const via = followVia(
      "straight",
      [{ x: 100, y: 80 }],
      { source: box(0), target: box(200) },
      { source: { ...box(0), y: 16 }, target: { ...box(200), y: 16 } },
    );
    expect(via).toEqual([{ x: 100, y: 96 }]);
  });

  it("stretches a straight line's bend along when one end moves away", () => {
    // Tile centres sit at x = 6 and 36 cells, so the bend at 16 is a third of the way along,
    // 10 cells below the line. db moves 20 cells right: a third of the way is now 22.7 cells.
    const via = moved(project("straight", "[[16, 10]]"), "db", { x: 50, y: 0 });
    expect(via).toEqual([{ x: 23, y: 10 }]);
  });

  it("keeps an orthogonal route square: the first run moves with its element", () => {
    // app → right to x=16 → down to y=10 → right to db, which sits 10 cells lower.
    const files: ProjectFiles = {
      "mogram.yaml": (project("orthogonal", "[[16, 2], [16, 12]]")["mogram.yaml"] ?? "").replace(
        "db: [30, 0]",
        "db: [30, 10]",
      ),
    };
    const via = moved(files, "app", { x: 0, y: 4 });
    // The first corner rides with app (down 4); the second stays level with db.
    expect(via).toEqual([
      { x: 16, y: 6 },
      { x: 16, y: 12 },
    ]);
  });

  it("leaves bends alone when neither end moved", () => {
    const files = project("straight", "[[16, 10]]");
    const diagram = parseDiagram(files).diagram;
    const result = moveElements(files, diagram, [
      { name: "app", at: { x: 0, y: 0 }, parent: null },
    ]);
    expect(followTerminals(diagram, result).files).toEqual(result.files);
  });
});

describe("splitting a connection (ED-29)", () => {
  const files: ProjectFiles = {
    "mogram.yaml": `mogram: 1
name: Split
components:
  app: generic/service
  fw: generic/firewall
  db: generic/database
connections:
  app_to_db: { from: app, to: db, flow: traffic, label: SQL, line: dashed }
layout:
  app: [0, 0]
  fw: [20, 20]
  db: [40, 0]
  app_to_db: { via: [[10, 26], [30, 26]], to_anchor: left }
`,
  };

  it("ends the connection at the dropped element and carries on with a copy", () => {
    const diagram = parseDiagram(files).diagram;
    const result = splitConnection(files, diagram, { name: "app_to_db", element: "fw" });
    const after = parseDiagram(result.files).diagram;
    const first = after.connections.get("app_to_db");
    const second = after.connections.get("fw_to_db");
    expect(first).toMatchObject({ from: { element: "app" }, to: { element: "fw" }, text: "SQL" });
    expect(second).toMatchObject({
      from: { element: "fw" },
      to: { element: "db" },
      text: null,
      flow: "traffic",
      line: "dashed",
    });
    // One bend each side of the firewall; the fixed end moves to the second part.
    expect(after.layout.get("app_to_db")?.via).toHaveLength(1);
    expect(after.layout.get("app_to_db")?.toAnchor ?? null).toBeNull();
    expect(after.layout.get("fw_to_db")?.via).toHaveLength(1);
    expect(after.layout.get("fw_to_db")?.toAnchor).toEqual({ x: 0, y: 0.5 });
    expect(result.select).toEqual(["fw"]);
  });

  it("refuses an element the connection already ends at", () => {
    const diagram = parseDiagram(files).diagram;
    expect(() => splitConnection(files, diagram, { name: "app_to_db", element: "db" })).toThrow(
      /already ends there/,
    );
  });
});
