import { describe, expect, it } from "vitest";
import { insertYaml, nestElements } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const base: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Shop
containers:
  vnet: { type: network, label: Shop network }
components:
  api: { type: generic/service, label: Orders API, in: vnet }
layout:
  api: [2, 4]
`,
};

const insert = (text: string, files: ProjectFiles = base) =>
  insertYaml(files, parseDiagram(files).diagram, { text });

describe("adding a YAML snippet", () => {
  it("adds elements as written, connected to what's already there, placed automatically", () => {
    const result = insert(`components:
  cache: { type: generic/cache, label: Session cache, in: vnet }
  db: { type: generic/database, label: Orders DB }
connections:
  api_to_cache: { from: api, to: cache, label: reads }
  api_to_db: { from: api, to: db }
`);
    const { diagram, diagnostics } = parseDiagram(result.files);
    expect(diagnostics).toEqual([]);
    expect(diagram.components.get("cache")?.parent).toBe("vnet");
    expect(diagram.connections.get("api_to_cache")?.text).toBe("reads");
    expect(diagram.layout.has("cache")).toBe(false);
    expect(result.select).toEqual(["cache", "db", "api_to_cache", "api_to_db"]);
    expect(result.files["mogram.yaml"]).toContain(
      "cache: { type: generic/cache, label: Session cache, in: vnet }",
    );
  });

  it("takes containers, shapes, notes, positions, scenes, tours and styles", () => {
    const result = insert(`containers:
  data: { type: subnet, in: vnet }
shapes:
  queue: { shape: queue, label: Orders queue, in: data }
layout:
  data: { at: [30, 2], size: [24, 16] }
  api: [4, 4]
  decorations:
    todo: { note: Add retries, at: [60, 0] }
scenes:
  outage:
    api: down
tours:
  walk:
    title: Walk through
    start: api
    steps:
      api: { next: queue }
      queue: {}
styles:
  hot: { tone: rose }
`);
    const { diagram, diagnostics } = parseDiagram(result.files);
    expect(diagnostics).toEqual([]);
    expect(diagram.components.get("queue")?.shape).toBe("queue");
    expect(diagram.layout.get("api")?.at).toEqual({ x: 4, y: 4 });
    expect(diagram.decorations.has("todo")).toBe(true);
    expect(diagram.scenes.map((s) => s.name)).toEqual(["outage"]);
    expect(diagram.tours.map((t) => t.name)).toEqual(["walk"]);
    expect(diagram.styles.has("hot")).toBe(true);
  });

  it("refuses names that are taken, invalid YAML and other sections", () => {
    expect(() => insert("components:\n  api: { type: generic/service }\n")).toThrow(
      /"api" already exists/,
    );
    expect(() => insert("components:\n  9lives: { type: generic/service }\n")).toThrow(
      /isn't a valid name/,
    );
    expect(() => insert("components: [oops\n")).toThrow(/doesn't read/);
    expect(() => insert("name: Other\n")).toThrow(/"name" can't be added this way/);
    expect(() => insert("layout:\n  ghost: [1, 1]\n")).toThrow(/isn't in the diagram/);
    expect(() =>
      insert("scenes:\n  a: { api: down }\n", insert("scenes:\n  a: { api: down }\n").files),
    ).toThrow(/already a scene "a"/);
  });
});

describe("putting elements inside a container", () => {
  it("re-parents them and lets placement find them a spot", () => {
    const files = insertYaml(base, parseDiagram(base).diagram, {
      text: "shapes:\n  db: { shape: cylinder }\nlayout:\n  db: { at: [40, 4], size: [10, 10] }\n",
    }).files;
    const result = nestElements(files, parseDiagram(files).diagram, {
      names: ["db"],
      parent: "vnet",
    });
    const { diagram, diagnostics } = parseDiagram(result.files);
    expect(diagnostics).toEqual([]);
    expect(diagram.components.get("db")?.parent).toBe("vnet");
    expect(diagram.layout.get("db")?.at).toBeNull();
    expect(diagram.layout.get("db")?.size).toEqual({ w: 10, h: 10 });
    expect(() => nestElements(result.files, diagram, { names: ["vnet"], parent: "vnet" })).toThrow(
      /can't go inside/,
    );
  });
});
