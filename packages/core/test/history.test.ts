import { describe, expect, it } from "vitest";
import {
  addComponent,
  deleteElements,
  moveElements,
  restoreElements,
  updateElement,
} from "../src/edit";
import { diffProjects, diffStats, summarizeDiff } from "../src/diff";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const base: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Shop
containers:
  vnet: { type: network, label: Shop network }
components:
  web: { type: generic/web-app, label: Web, in: vnet }
  api: { type: generic/service, label: Orders API, in: vnet }
  db: { type: generic/database, label: Orders DB }
connections:
  web_to_api: { from: web, to: api, label: HTTPS }
  api_to_db: { from: api, to: db }
scenes:
  outage:
    db: down
layout:
  web: [2, 4]
  api: [16, 4]
  db: [40, 4]
`,
  "docs/api.md": "# Orders API\\n",
};

const diagramOf = (files: ProjectFiles) => parseDiagram(files).diagram;

describe("what changed between versions", () => {
  it("names what was added and counts the rest", () => {
    let files = addComponent(base, diagramOf(base), {
      type: "generic/cache",
      label: "Payments API",
      parent: null,
    }).files;
    files = addComponent(files, diagramOf(files), {
      type: "generic/queue",
      label: "Events",
      parent: null,
    }).files;
    files = updateElement(files, diagramOf(files), {
      name: "api",
      set: { state: "degraded" },
    }).files;
    files = deleteElements(files, diagramOf(files), ["web_to_api"]).files;
    files = moveElements(files, diagramOf(files), [
      { name: "db", parent: null, at: { x: 40, y: 20 } },
    ]).files;
    const diff = diffProjects(base, files);
    expect(diffStats(diff)).toEqual({ added: 2, removed: 1, changed: 1, moved: 1 });
    expect(summarizeDiff(diff)).toBe(
      "Added Payments API and Events · removed 1 · changed 1 · moved 1",
    );
    // On its own, one change is named.
    const one = updateElement(base, diagramOf(base), { name: "api", set: { state: "down" } }).files;
    expect(summarizeDiff(diffProjects(base, one))).toBe("Changed Orders API");
    const api = diff.changes.find((c) => c.name === "api");
    expect(api?.fields).toEqual(["state"]);
    expect(diff.changes.find((c) => c.name === "db")?.fields).toEqual(["position"]);
  });

  it("covers scenes, settings and the other files", () => {
    const files = {
      ...base,
      "mogram.yaml": (base["mogram.yaml"] ?? "")
        .replace("db: down", "db: degraded")
        .replace("name: Shop", "name: Shop\ntheme: paper"),
      "docs/api.md": "# Orders API v2\\n",
    };
    const diff = diffProjects(base, files);
    expect(diff.changes.map((c) => `${c.thing}:${c.name}:${c.change}`).sort()).toEqual([
      "file:docs/api.md:changed",
      "scene:outage:changed",
      "settings:settings:changed",
    ]);
    expect(diff.changes.find((c) => c.thing === "settings")?.fields).toEqual(["theme"]);
    expect(summarizeDiff({ changes: [] })).toBe("No changes");
    const renamed = {
      ...base,
      "mogram.yaml": (base["mogram.yaml"] ?? "").replace("Shop", "Store"),
    };
    expect(summarizeDiff(diffProjects(base, renamed))).toBe("Renamed the diagram");
  });
});

describe("what changed in a story", () => {
  it("counts a beat's new words as a change to its story", () => {
    const base: ProjectFiles = {
      "mogram.yaml":
        "mogram: 1\nshapes:\n  a: { label: A }\nstories:\n  main:\n    - say: One\nlayout:\n  a: [0, 0]\n",
    };
    const after = {
      "mogram.yaml": base["mogram.yaml"]!.replace(
        "- say: One",
        "- say: One\n      script: Said aloud.",
      ),
    };
    const diff = diffProjects(base, after);
    expect(diff.changes).toEqual([
      expect.objectContaining({ thing: "story", name: "main", change: "changed" }),
    ]);
    expect(summarizeDiff(diff)).toBe("Changed Main");
  });
});

describe("bringing elements back", () => {
  it("brings back a deleted element with its connections, as it was written", () => {
    const now = deleteElements(base, diagramOf(base), ["db"]).files;
    expect(diagramOf(now).connections.has("api_to_db")).toBe(false);
    const restored = restoreElements(now, diagramOf(now), { from: base, names: ["db"] });
    const after = diagramOf(restored.files);
    expect(after.components.get("db")?.label).toBe("Orders DB");
    expect(after.connections.has("api_to_db")).toBe(true);
    expect(after.layout.get("db")?.at).toEqual({ x: 40, y: 4 });
    expect(restored.select).toEqual(["db"]);
    expect(parseDiagram(restored.files).diagnostics).toEqual([]);
  });

  it("puts an element that still exists back as it was, leaving the rest alone", () => {
    let now = updateElement(base, diagramOf(base), {
      name: "api",
      set: { label: "Renamed", state: "down" },
    }).files;
    now = updateElement(now, diagramOf(now), { name: "web", set: { label: "Storefront" } }).files;
    const restored = restoreElements(now, diagramOf(now), { from: base, names: ["api"] });
    const after = diagramOf(restored.files);
    expect(after.components.get("api")?.label).toBe("Orders API");
    expect(after.components.get("api")?.state).toBe("healthy");
    expect(after.components.get("web")?.label).toBe("Storefront");
  });

  it("brings a container back with the children that went with it", () => {
    const now = deleteElements(base, diagramOf(base), ["vnet"]).files;
    const gone = diagramOf(now);
    expect(gone.containers.has("vnet")).toBe(false);
    const restored = restoreElements(now, gone, { from: base, names: ["vnet"] });
    const after = diagramOf(restored.files);
    expect(after.containers.has("vnet")).toBe(true);
    for (const name of ["web", "api"]) expect(after.components.get(name)?.parent).toBe("vnet");
    expect(parseDiagram(restored.files).diagnostics).toEqual([]);
  });

  it("brings back a scene, and says when something isn't in that version", () => {
    const now = {
      ...base,
      "mogram.yaml": (base["mogram.yaml"] ?? "").replace("db: down", "db: degraded"),
    };
    const restored = restoreElements(now, diagramOf(now), {
      from: base,
      names: [],
      scenes: ["outage"],
    });
    expect(restored.files["mogram.yaml"]).toContain("db: down");
    expect(() => restoreElements(now, diagramOf(now), { from: base, names: ["nope"] })).toThrow(
      /isn't in that version/,
    );
  });
});
