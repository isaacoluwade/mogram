import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { computeLayout } from "../src/layout";
import {
  EditError,
  addComponent,
  addConnection,
  addContainer,
  addDecoration,
  addGroup,
  addScene,
  addTour,
  appendTourStep,
  copySnippet,
  deleteElements,
  deleteScene,
  moveElements,
  moveToFile,
  pasteSnippet,
  removeTourStep,
  renameElement,
  renameScene,
  reorderScenes,
  reorderZ,
  resizeElement,
  setCard,
  setConnectionPath,
  setSceneEntry,
  setSetting,
  setTourChoices,
  updateElement,
} from "../src/edit";
import { diffLines } from "../src/edit/diff";
import type { ProjectFiles } from "../src/model";

/** Lines that differ between two texts. */
function changedLines(before: string, after: string): { removed: string[]; added: string[] } {
  const a = before.split("\n");
  const b = after.split("\n");
  const removed: string[] = [];
  const added: string[] = [];
  const ops = diffLines(a, b);
  if (ops === null) throw new Error("The texts are too different to diff.");
  for (const op of ops) {
    if (op.kind === "delete") removed.push(a[op.a] ?? "");
    if (op.kind === "insert") added.push(b[op.b] ?? "");
  }
  return { removed, added };
}

const HAND_WRITTEN = `# Checkout — written by hand
mogram: 1
name: Checkout   # shown in the title bar

containers:
  vnet:
    type: vnet
    label: "Main VNet"   # quoted on purpose

components:
  # The web tier
  web_vm:
    type: azure/virtual-machine
    in: vnet
  db: azure/sql-database

connections:
  web_to_db: { from: web_vm, to: db, flow: traffic }

scenes:
  outage:
    db: down

layout:
  vnet: { at: [2, 6], size: [60, 30] }
  web_vm: [4, 6]
`;

const project = (files: ProjectFiles) => ({ files, diagram: parseDiagram(files).diagram });

describe("minimal diffs (FI-5, PRD journey 6)", () => {
  it("moving one element is a one-line change and leaves every comment and quirk alone", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = moveElements(files, diagram, [
      { name: "web_vm", parent: "vnet", at: { x: 10, y: 12 } },
    ]);
    const diff = changedLines(HAND_WRITTEN, result.files["mogram.yaml"]!);
    expect(diff).toEqual({ removed: ["  web_vm: [4, 6]"], added: ["  web_vm: [10, 12]"] });
  });

  it("changing a scene line is a one-line diff", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = setSceneEntry(files, diagram, {
      scene: "outage",
      target: "db",
      value: { state: "degraded" },
    });
    expect(changedLines(HAND_WRITTEN, result.files["mogram.yaml"]!)).toEqual({
      removed: ["    db: down"],
      added: ["    db: degraded"],
    });
  });

  it("updating a property adds one line and keeps quoting and inline comments", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = updateElement(files, diagram, { name: "web_vm", set: { motion: "pulse" } });
    const text = result.files["mogram.yaml"]!;
    expect(changedLines(HAND_WRITTEN, text)).toEqual({ removed: [], added: ["    motion: pulse"] });
    expect(text).toContain('label: "Main VNet"   # quoted on purpose');
    expect(text).toContain("name: Checkout   # shown in the title bar");
    expect(text).toContain("{ from: web_vm, to: db, flow: traffic }");
  });

  it("writing a default value removes the key instead (FI-3)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const withState = updateElement(files, diagram, { name: "web_vm", set: { state: "degraded" } });
    const back = project(withState.files);
    const healthy = updateElement(back.files, back.diagram, {
      name: "web_vm",
      set: { state: "healthy" },
    });
    expect(healthy.files["mogram.yaml"]).toBe(HAND_WRITTEN);
  });

  it("expands the `db: type` shorthand only when it needs more settings", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = updateElement(files, diagram, { name: "db", set: { state: "down" } });
    expect(result.files["mogram.yaml"]).toContain(
      "  db:\n    type: azure/sql-database\n    state: down\n",
    );
  });
});

describe("adding elements", () => {
  it("names elements after their label and writes only what differs (FI-1, FI-3)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = addComponent(files, diagram, {
      type: "azure/storage-accounts",
      label: "Storage account",
      parent: "vnet",
      at: { x: 20, y: 6 },
    });
    expect(result.select).toEqual(["storage_account"]);
    const reparsed = parseDiagram(result.files);
    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.diagram.components.get("storage_account")).toMatchObject({
      type: "azure/storage-accounts",
      parent: "vnet",
      hasExplicitLabel: false,
    });
    expect(result.files["mogram.yaml"]).toContain(
      "  storage_account:\n    type: azure/storage-accounts\n    in: vnet\n",
    );
    expect(result.files["mogram.yaml"]).toContain("  storage_account: [20, 6]");
  });

  it("puts new elements in the file of their container, else mogram.yaml (FI-12)", () => {
    const files = {
      "mogram.yaml": "name: Checkout\n",
      "network.mogram.yaml": "containers:\n  vnet:\n    type: vnet\n",
    };
    const { diagram } = project(files);
    const inside = addComponent(files, diagram, {
      type: "generic/server",
      label: "Web",
      parent: "vnet",
    });
    expect(inside.files["network.mogram.yaml"]).toContain("components:\n  web:");
    const outside = addComponent(files, diagram, { type: "generic/user", label: "User" });
    expect(outside.files["mogram.yaml"]).toContain("components:\n  user:");
  });

  it("keeps sections in canonical order with layout last in single-file mode (FI-4, FI-10)", () => {
    const files = { "mogram.yaml": "components:\n  a: generic/server\n\nlayout:\n  a: [0, 0]\n" };
    const { diagram } = project(files);
    const result = addContainer(files, diagram, {
      type: "region",
      label: "East US",
      at: { x: 1, y: 1 },
    });
    const text = result.files["mogram.yaml"]!;
    expect(text.indexOf("containers:")).toBeLessThan(text.indexOf("components:"));
    expect(text.indexOf("components:")).toBeLessThan(text.indexOf("layout:"));
    // The first entry of a new section is one line, as Mogram writes short entries.
    expect(text).toContain("  east_us: { type: region, label: East US }\n");
  });

  it("writes layout to layout.mogram.yaml in folder mode", () => {
    const files = {
      "mogram.yaml": "name: X\n",
      "compute.mogram.yaml": "components:\n  a: generic/server\n",
    };
    const { diagram } = project(files);
    const result = moveElements(files, diagram, [{ name: "a", parent: null, at: { x: 3, y: 4 } }]);
    expect(result.files["layout.mogram.yaml"]).toBe("layout:\n  a: [3, 4]\n");
    expect(result.files["compute.mogram.yaml"]).toBe(files["compute.mogram.yaml"]);
  });

  it("adds connections, groups and decorations", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const connected = addConnection(files, diagram, { from: "db", to: "web_vm", flow: "traffic" });
    expect(connected.select).toEqual(["db_to_web_vm"]);
    const grouped = addGroup(connected.files, parseDiagram(connected.files).diagram, {
      members: ["web_vm", "db"],
      label: "Tier",
    });
    expect(grouped.files["mogram.yaml"]).toContain("  tier:\n    members: [web_vm, db]");
    const decorated = addDecoration(grouped.files, parseDiagram(grouped.files).diagram, {
      variant: "zone",
      text: "Hot path",
      size: { w: 20, h: 10 },
      tone: "rose",
      at: { x: 1, y: 1 },
      parent: "vnet",
    });
    const reparsed = parseDiagram(decorated.files);
    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.diagram.decorations.get("hot_path")).toMatchObject({
      variant: "zone",
      tone: "rose",
      parent: "vnet",
    });
    expect(() => addConnection(files, diagram, { from: "db", to: "db" })).toThrow(EditError);
  });
});

describe("arranging", () => {
  it("re-parents on move and refuses to put a container inside itself", () => {
    const files = {
      "mogram.yaml":
        "containers:\n  outer: {}\n  inner:\n    in: outer\ncomponents:\n  a: generic/server\n",
    };
    const { diagram } = project(files);
    const moved = moveElements(files, diagram, [
      { name: "a", parent: "inner", at: { x: 3, y: 7 } },
    ]);
    expect(parseDiagram(moved.files).diagram.components.get("a")?.parent).toBe("inner");
    expect(() =>
      moveElements(files, diagram, [{ name: "outer", parent: "inner", at: { x: 0, y: 0 } }]),
    ).toThrow(/inside/);
  });

  it("saves a size only when resized by hand (ED-13)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = resizeElement(files, diagram, { name: "vnet", size: { w: 70, h: 40 } });
    expect(result.files["mogram.yaml"]).toContain("  vnet: { at: [2, 6], size: [70, 40] }");
  });

  it("brings to front and sends to back by writing z (ED-23)", () => {
    const files = {
      "mogram.yaml":
        "components:\n  a: generic/server\n  b: generic/server\nlayout:\n  a: [0, 0]\n  b: [2, 2]\n",
    };
    const { diagram } = project(files);
    const front = reorderZ(files, diagram, { names: ["a"], move: "front" });
    expect(front.files["mogram.yaml"]).toContain("  a: { at: [0, 0], z: 1 }");
    const back = project(front.files);
    const reset = reorderZ(back.files, back.diagram, { names: ["a"], move: "backward" });
    // Only the position is left, so it's back to the short form it was written in.
    expect(reset.files["mogram.yaml"]).toContain("  a: [0, 0]");
  });

  it("stores hand-bent paths and clears them again (ED-18)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const bent = setConnectionPath(files, diagram, { name: "web_to_db", via: [{ x: 30, y: 10 }] });
    expect(bent.files["mogram.yaml"]).toContain("  web_to_db: { via: [[30, 10]] }");
    const cleared = setConnectionPath(bent.files, parseDiagram(bent.files).diagram, {
      name: "web_to_db",
      via: null,
    });
    expect(cleared.files["mogram.yaml"]).toBe(HAND_WRITTEN);
  });
});

describe("rename and delete", () => {
  const STORY = `components:
  web_vm: azure/virtual-machine
  db: azure/sql-database
  aks: { opens: ./aks }
connections:
  web_to_db: { from: web_vm, to: db }
  web_to_aks: { from: web_vm, to: aks.web }
groups:
  tier: { members: [web_vm, db] }
scenes:
  outage:
    db: down
    aks.ingress: down
tours:
  flow:
    start: web_vm
    steps:
      web_vm:
        next: db
      db:
        choices:
          Fine: web_vm
layout:
  web_vm: [1, 1]
`;
  const files = {
    "mogram.yaml": STORY,
    "aks/mogram.yaml": "ports:\n  web: ingress\ncomponents:\n  ingress: tool/nginx\n",
  };

  it("renames everywhere it's referenced", () => {
    const { diagram } = project(files);
    const result = renameElement(files, diagram, { from: "web_vm", to: "frontend" });
    const text = result.files["mogram.yaml"]!;
    expect(text).not.toMatch(/web_vm/);
    expect(text).toContain("web_to_db: { from: frontend, to: db }");
    expect(text).toContain("members: [frontend, db]");
    expect(text).toContain("start: frontend");
    expect(text).toContain("      frontend:\n        next: db");
    expect(text).toContain("Fine: frontend");
    expect(text).toContain("  frontend: [1, 1]");
    expect(parseDiagram(result.files).diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );

    const nested = renameElement(files, diagram, { from: "aks", to: "cluster" });
    expect(nested.files["mogram.yaml"]).toContain("to: cluster.web");
    expect(nested.files["mogram.yaml"]).toContain("cluster.ingress: down");
    expect(() => renameElement(files, diagram, { from: "db", to: "web_vm" })).toThrow(
      /already used/,
    );
    expect(() => renameElement(files, diagram, { from: "db", to: "9lives" })).toThrow(/valid name/);
  });

  it("deletes cleanly: connections, scene lines, tour steps, group members and layout", () => {
    const { diagram } = project(files);
    const result = deleteElements(files, diagram, ["db"]);
    const reparsed = parseDiagram(result.files);
    expect(reparsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(reparsed.diagram.connections.has("web_to_db")).toBe(false);
    expect(reparsed.diagram.groups.get("tier")?.members).toEqual(["web_vm"]);
    expect(reparsed.diagram.scenes[0]?.entries.map((e) => e.target)).toEqual(["aks.ingress"]);
    expect(reparsed.diagram.tours[0]?.steps.get("web_vm")?.next).toBeNull();
    expect(reparsed.diagram.tours[0]?.steps.has("db")).toBe(false);
  });

  it("deleting a container deletes what's inside it", () => {
    const local = {
      "mogram.yaml":
        "containers:\n  vnet: {}\ncomponents:\n  a: { in: vnet }\n  b: generic/server\nconnections:\n  a_to_b: { from: a, to: b }\n",
    };
    const { diagram } = project(local);
    const reparsed = parseDiagram(deleteElements(local, diagram, ["vnet"]).files).diagram;
    expect([...reparsed.components.keys()]).toEqual(["b"]);
    expect(reparsed.connections.size).toBe(0);
  });
});

describe("scenes and tours", () => {
  it("adds, duplicates, renames, reorders and deletes scenes (SC-6)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const added = addScene(files, diagram, { label: "Traffic spike" });
    // Scene names are reported separately: they aren't canvas elements to select.
    expect(added.named).toBe("traffic_spike");
    expect(added.select).toBeUndefined();
    const again = addScene(added.files, parseDiagram(added.files).diagram, {
      label: "Traffic spike",
    });
    expect(again.named).toBe("traffic_spike_2");
    const copy = addScene(added.files, parseDiagram(added.files).diagram, {
      label: "Outage copy",
      copyFrom: "outage",
    });
    expect(parseDiagram(copy.files).diagram.scenes.map((s) => s.name)).toEqual([
      "outage",
      "traffic_spike",
      "outage_copy",
    ]);
    const reordered = reorderScenes(copy.files, parseDiagram(copy.files).diagram, [
      "outage_copy",
      "outage",
      "traffic_spike",
    ]);
    expect(parseDiagram(reordered.files).diagram.scenes.map((s) => s.name)).toEqual([
      "outage_copy",
      "outage",
      "traffic_spike",
    ]);
    const renamed = renameScene(reordered.files, parseDiagram(reordered.files).diagram, {
      from: "outage",
      to: "region_outage",
    });
    const deleted = deleteScene(
      renamed.files,
      parseDiagram(renamed.files).diagram,
      "traffic_spike",
    );
    expect(parseDiagram(deleted.files).diagram.scenes.map((s) => s.name)).toEqual([
      "outage_copy",
      "region_outage",
    ]);
  });

  it("records only differences from normal in a scene (SC-5)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const same = setSceneEntry(files, diagram, {
      scene: "outage",
      target: "db",
      value: { state: "healthy" },
    });
    expect(same.files["mogram.yaml"]).toContain("scenes:\n  outage:\n\nlayout:");
    const motion = setSceneEntry(files, diagram, {
      scene: "outage",
      target: "web_vm",
      value: { state: "overloaded", motion: "shake" },
    });
    expect(motion.files["mogram.yaml"]).toContain("web_vm: { state: overloaded, motion: shake }");
  });

  it("builds a tour by clicking elements, then branches it (TO-6, TO-9)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const tour = addTour(files, diagram, { title: "How a request flows" });
    let current = project(tour.files);
    for (const target of ["web_vm", "db", "vnet"]) {
      current = project(
        appendTourStep(current.files, current.diagram, { tour: "how_a_request_flows", target })
          .files,
      );
    }
    expect(current.diagram.tours[0]?.steps.get("web_vm")?.next).toBe("db");
    expect(current.diagram.tours[0]?.steps.get("db")?.next).toBe("vnet");
    // Clicking a part already on the path doesn't loop the tour back to it.
    expect(() =>
      appendTourStep(current.files, current.diagram, { tour: "how_a_request_flows", target: "db" }),
    ).toThrow("already step 2");

    const branched = setTourChoices(current.files, current.diagram, {
      tour: "how_a_request_flows",
      step: "db",
      choices: [
        { label: "Normal read", next: "vnet" },
        { label: "Region outage", next: "web_vm", scene: "outage" },
      ],
    });
    const parsed = parseDiagram(branched.files);
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(parsed.diagram.tours[0]?.steps.get("db")?.choices).toEqual([
      { label: "Normal read", next: "vnet", scene: null },
      { label: "Region outage", next: "web_vm", scene: "outage" },
    ]);

    const removed = removeTourStep(current.files, current.diagram, {
      tour: "how_a_request_flows",
      target: "db",
    });
    expect(parseDiagram(removed.files).diagram.tours[0]?.steps.get("web_vm")?.next).toBe("vnet");
  });
});

describe("cards, settings, files and clipboard", () => {
  it("writes inline cards and file cards (CA-3)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const inline = setCard(files, diagram, {
      name: "db",
      card: { kind: "inline", title: null, body: "Line one\nLine two" },
    });
    expect(parseDiagram(inline.files).diagram.components.get("db")?.card).toEqual({
      kind: "inline",
      title: null,
      body: "Line one\nLine two",
    });
    const file = setCard(files, diagram, {
      name: "web_vm",
      card: { kind: "file", title: null, path: "docs/web-vm.md" },
      fileContent: "# Web VM\n\nServes the storefront.",
    });
    expect(file.files["docs/web-vm.md"]).toContain("Serves the storefront");
    expect(file.files["mogram.yaml"]).toContain("    card: docs/web-vm.md");
  });

  it("changes settings in place (FI-8)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const themed = setSetting(files, diagram, { key: "theme", value: "forest" });
    expect(changedLines(HAND_WRITTEN, themed.files["mogram.yaml"]!).added).toEqual([
      "theme: forest",
    ]);
    const reset = setSetting(themed.files, parseDiagram(themed.files).diagram, {
      key: "theme",
      value: "midnight",
    });
    expect(reset.files["mogram.yaml"]).toBe(HAND_WRITTEN);
  });

  it("moves elements to another file and splits layout out of a single file (FI-10, FI-13)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const result = moveToFile(files, diagram, { names: ["db"], file: "data.mogram.yaml" });
    expect(result.files["data.mogram.yaml"]).toBe("components:\n  db: azure/sql-database\n");
    expect(result.files["layout.mogram.yaml"]).toContain("layout:\n  vnet:");
    expect(result.files["mogram.yaml"]).not.toContain("layout:");
    const reparsed = parseDiagram(result.files);
    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.diagram.mode).toBe("folder");
    expect(reparsed.diagram.components.get("db")?.source.file).toBe("data.mogram.yaml");
  });

  it("copies and pastes with fresh names and internal references (ED-4)", () => {
    const { files, diagram } = project({ "mogram.yaml": HAND_WRITTEN });
    const positions = new Map(
      [...computeLayout(diagram).elements].map(([name, element]) => [name, element.rel]),
    );
    const snippet = copySnippet(diagram, ["web_vm", "db"], positions);
    expect(snippet).toContain("mogram: clipboard");
    const pasted = pasteSnippet(files, diagram, {
      text: snippet,
      parent: null,
      at: { x: 80, y: 0 },
    });
    const reparsed = parseDiagram(pasted.files);
    expect(reparsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(reparsed.diagram.components.has("web_vm_2")).toBe(true);
    expect(reparsed.diagram.components.has("db_2")).toBe(true);
    expect(reparsed.diagram.connections.get("web_to_db_2")).toMatchObject({
      from: { element: "web_vm_2", port: null },
      to: { element: "db_2", port: null },
    });
    expect(pasted.select).toEqual(expect.arrayContaining(["web_vm_2", "db_2"]));
  });

  it("refuses to edit a file with broken YAML, with a helpful message", () => {
    const files = {
      "mogram.yaml": "components:\n  a: generic/server\n",
      "broken.mogram.yaml": "components:\n  b: [oops\n",
    };
    const { diagram } = project(files);
    expect(() =>
      updateElement(files, diagram, { name: "a", set: { state: "down" } }),
    ).not.toThrow();
    const brokenFiles = { "mogram.yaml": "components:\n  a: [oops\n  b: generic/server\n" };
    const broken = parseDiagram(brokenFiles).diagram;
    expect(() => addComponent(brokenFiles, broken, { type: "generic/server", label: "C" })).toThrow(
      /code view/,
    );
  });
});

describe("new entries follow their neighbours' style", () => {
  it("writes a one-line connection when the file's connections are one-liners", () => {
    const files = {
      "mogram.yaml": `components:
  web: generic/server
  db: generic/database
  cache: generic/cache
connections:
  web_db: { from: web, to: db, flow: traffic }
`,
    };
    const { diagram } = parseDiagram(files);
    const result = addConnection(files, diagram, { from: "web", to: "cache", flow: "traffic" });
    expect(result.files["mogram.yaml"]).toContain(
      "  web_to_cache: { from: web, to: cache, flow: traffic }\n",
    );
  });

  it("keeps block style when the neighbours are blocks", () => {
    const files = {
      "mogram.yaml": `components:
  web: generic/server
  db: generic/database
connections:
  web_db:
    from: web
    to: db
`,
    };
    const { diagram } = parseDiagram(files);
    const result = addConnection(files, diagram, { from: "db", to: "web" });
    expect(result.files["mogram.yaml"]).toContain("  db_to_web:\n    from: db\n    to: web\n");
  });
});

describe("tour authoring writes the documented format (TO-9)", () => {
  it("records the start, then links each step to the next, in block style", () => {
    let files: ProjectFiles = {
      "mogram.yaml": `components:
  users: generic/users
  gateway: generic/gateway
  app: generic/web-app
`,
    };
    const step = (
      run: (
        f: ProjectFiles,
        d: ReturnType<typeof parseDiagram>["diagram"],
      ) => { files: ProjectFiles },
    ) => {
      files = run(files, parseDiagram(files).diagram).files;
    };
    step((f, d) => addTour(f, d, { title: "How it works" }));
    for (const target of ["users", "gateway", "app"])
      step((f, d) => appendTourStep(f, d, { tour: "how_it_works", target }));
    expect(files["mogram.yaml"]).toContain(`tours:
  how_it_works:
    start: users
    steps:
      users:
        next: gateway
      gateway:
        next: app
`);
    expect(parseDiagram(files).diagnostics).toEqual([]);
  });
});
