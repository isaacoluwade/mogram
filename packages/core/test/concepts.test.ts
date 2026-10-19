import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyConcept, conceptInfo, insertConcept, suggestBindings } from "../src/concepts";
import { deleteElements, renameElement, setConcept } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { Diagram, ProjectFiles } from "../src/model";
import { resolveState } from "../src/state";

/** Mogram's own concepts, read from their files (@mogram/concepts checks them as content). */
const CONTENT = fileURLToPath(new URL("../../concepts/content/", import.meta.url));
const concept = (id: string): Diagram => {
  for (const topic of readdirSync(CONTENT))
    if (readdirSync(join(CONTENT, topic)).includes(`${id}.mogram.yaml`))
      return parseDiagram({
        "mogram.yaml": readFileSync(join(CONTENT, topic, `${id}.mogram.yaml`), "utf8"),
      }).diagram;
  throw new Error(`No concept ${id}`);
};

const open = (yaml: string) => {
  const files: ProjectFiles = { "mogram.yaml": yaml };
  return { files, diagram: parseDiagram(files).diagram };
};

/** The capacity plan of `files` in a scene. */
function planIn(files: ProjectFiles, scene: string | null) {
  const { diagram, diagnostics } = parseDiagram(files);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return resolveState({
    diagram,
    scene: diagram.scenes.find((s) => s.name === scene)?.entries ?? [],
  }).capacity;
}

/** The plans when its traffic patterns are quiet and when they're busy. */
function overTime(files: ProjectFiles) {
  const { diagram } = parseDiagram(files);
  const over = resolveState({ diagram }).capacityOverTime;
  if (over === null) throw new Error("no traffic pattern");
  return over;
}

const SHOP = `mogram: 1
name: Shop
components:
  people: { type: azure/users, label: Shoppers }
  front: { type: azure/front-door-and-cdn-profiles, label: Front door }
  web: { type: azure/virtual-machine, label: Web }
  orders: { type: azure/sql-database, label: Orders }
  east: { type: azure/app-services, label: East }
  west: { type: azure/app-services, label: West }
connections:
  people_to_front: { from: people, to: front }
  front_to_web: { from: front, to: web }
  web_to_orders: { from: web, to: orders }
  front_to_east: { from: front, to: east }
`;

describe("applying a concept", () => {
  it("makes the picked element scale out, and brings its waves of traffic to where people come in", () => {
    const { files, diagram } = open(SHOP);
    const result = applyConcept(files, diagram, {
      concept: concept("horizontal-scaling"),
      bindings: { app: "web", lb: "front" },
    });
    const after = parseDiagram(result.files).diagram;
    expect(after.components.get("web")?.scale).toEqual({
      kind: "out",
      min: 1,
      max: 8,
      target: 0.7,
    });
    // The waves start where shoppers come in, and reach the web tier: no scenes needed.
    expect(after.scenes).toEqual([]);
    expect(after.connections.get("people_to_front")?.pattern?.kind).toBe("waves");
    expect(result.files["mogram.yaml"]).toContain(
      "people_to_front: { from: people, to: front, traffic: waves }",
    );
    // The front door splits between Web and East, so Web sees half of it: 1 copy, then 4.
    const over = overTime(result.files);
    expect(over.quiet.elements.get("web")?.copies).toBe(1);
    expect(over.busy.elements.get("web")?.copies).toBe(4);
    expect(result.report.join(" ")).toMatch(
      /Traffic on Shoppers → Front door rises and falls between 1× and 5× every 10 s/,
    );
    expect(result.select).toEqual(["web", "front"]);
    expect(result.report.join(" ")).toMatch(/Web scales out, 1 to 8 copies/);
  });

  it("gives a database sizes that fit it when it scales up", () => {
    const { files, diagram } = open(SHOP);
    const result = applyConcept(files, diagram, {
      concept: concept("vertical-scaling"),
      bindings: { db: "orders" },
    });
    const scale = parseDiagram(result.files).diagram.components.get("orders")?.scale;
    expect(scale?.kind === "up" && scale.sizes.map((s) => s.name)).toEqual([
      "Basic",
      "Standard",
      "Premium",
    ]);
    // Half the shoppers reach Orders (the front door splits): Basic, then up to Premium.
    expect(planIn(result.files, null).elements.get("orders")?.size).toBe(0);
    expect(planIn(result.files, "too_busy").elements.get("orders")?.size).toBe(2);
  });

  it("joins a standby the way the concept does, so it takes over in the outage", () => {
    const { files, diagram } = open(SHOP);
    const result = applyConcept(files, diagram, {
      concept: concept("failover"),
      bindings: { primary: "east", standby: "west", switch: "front" },
    });
    const after = parseDiagram(result.files).diagram;
    const backup = [...after.connections.values()].find(
      (c) => c.from.element === "front" && c.to.element === "west",
    );
    expect(backup?.backupFor).toBe("front_to_east");
    expect(result.report.join(" ")).toMatch(/A new connection from Front door to West/);
    expect(result.report).toContain("Front door → West takes over when East is down.");
    const outage = planIn(result.files, "outage");
    expect(outage.connections.get(backup?.name ?? "")).toBeGreaterThan(0);
    expect(outage.connections.get("front_to_east")).toBe(0);
  });

  it("keeps what's already set, and merges scenes of the same name", () => {
    const { files, diagram } = open(`${SHOP.replace(
      "orders: { type: azure/sql-database, label: Orders }",
      "orders: { type: azure/sql-database, label: Orders, scale: { sizes: [S1, S2] } }",
    ).replace(
      "people_to_front: { from: people, to: front }",
      "people_to_front: { from: people, to: front, traffic: 2x }",
    )}scenes:
  too_busy:
    web: degraded
`);
    const result = applyConcept(files, diagram, {
      concept: concept("vertical-scaling"),
      bindings: { db: "orders" },
    });
    const after = parseDiagram(result.files).diagram;
    // Its own sizes and its own traffic stay.
    const scale = after.components.get("orders")?.scale;
    expect(scale?.kind === "up" && scale.sizes.map((s) => s.name)).toEqual(["S1", "S2"]);
    expect(after.connections.get("people_to_front")).toMatchObject({ traffic: 2, pattern: null });
    const busy = after.scenes.find((s) => s.name === "too_busy");
    expect(busy?.entries.map((e) => e.target).sort()).toEqual(["people_to_front", "web"]);
    expect(result.report.join(" ")).toMatch(/The scene Too busy includes what you picked/);
  });

  it("asks for the parts it needs, and refuses shapes for scaling", () => {
    const { files, diagram } = open(`${SHOP}shapes:
  box: { shape: rectangle, label: Box }
`);
    expect(() =>
      applyConcept(files, diagram, { concept: concept("failover"), bindings: { primary: "east" } }),
    ).toThrow(/Pick what plays "What takes over"/);
    expect(() =>
      applyConcept(files, diagram, {
        concept: concept("horizontal-scaling"),
        bindings: { app: "box" },
      }),
    ).toThrow(/shapes don't scale/);
  });

  it("suggests who plays each part from the selection", () => {
    const shop = parseDiagram({
      "mogram.yaml": SHOP.replace(
        "connections:",
        "  cache: { type: azure/cache-redis, label: Cache, hit: 70% }\nconnections:",
      ),
    }).diagram;
    // Whatever the order they were selected in, the cache plays the cache.
    expect(suggestBindings(concept("caching"), shop, ["orders", "cache"])).toEqual({
      cache: "cache",
      db: "orders",
    });
  });
});

describe("inserting a concept", () => {
  it("adds its example under fresh names, with its traffic and scenes", () => {
    const { files, diagram } = open(`mogram: 1
name: Mine
components:
  users: { type: generic/users, label: My users }
`);
    const result = insertConcept(files, diagram, {
      concept: concept("queue-load-levelling"),
      at: { x: 10, y: 10 },
    });
    const after = parseDiagram(result.files);
    expect(after.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(after.diagram.components.get("users")?.label).toBe("My users");
    expect(after.diagram.components.get("queue")?.type).toBe("generic/queue");
    expect(after.diagram.connections.get("orders_to_queue")?.pattern?.kind).toBe("bursts");
    // A burst is more than the workers can take: they scale to their most and the queue fills.
    const busy = overTime(result.files).busy;
    expect(busy.elements.get("workers")?.copies).toBe(4);
    expect(busy.elements.get("queue")?.backlogRate).toBeGreaterThan(0);
  });
});

describe("inserting a concept with a scale set", () => {
  it("renames what clashes, keeps it in its scale set, and its traffic comes from its own users", () => {
    const { files, diagram } = open(`mogram: 1
name: Mine
components:
  app: { type: generic/server, label: My app }
  users: { type: generic/users, label: My users }
`);
    const result = insertConcept(files, diagram, {
      concept: concept("horizontal-scaling"),
      at: { x: 30, y: 0 },
    });
    const after = parseDiagram(result.files);
    expect(after.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const copy = [...after.diagram.components.values()].find((c) => c.label === "App server");
    expect(copy?.name).not.toBe("app");
    expect(copy?.parent).not.toBeNull();
    expect(after.diagram.containers.get(copy?.parent ?? "")?.type).toBe("scaling-group");
    expect(after.diagram.components.get("app")?.label).toBe("My app");
    const waves = [...after.diagram.connections.values()].find((c) => c.pattern !== null);
    // Its traffic comes from its own users, not mine.
    expect(waves?.from.element).not.toBe("users");
    expect(after.diagram.components.get(waves?.from.element ?? "")?.label).toBe("Users");
    expect(overTime(result.files).busy.elements.get(copy?.name ?? "")?.copies).toBe(8);
  });
});

describe("the concept section", () => {
  it("is written, follows renames and forgets deleted elements", () => {
    const { files, diagram } = open(SHOP);
    const written = setConcept(files, diagram, {
      concept: {
        summary: "Two regions.",
        topic: "reliability",
        platform: "azure",
        tags: ["DR", "regions", "dr"],
        roles: [
          { element: "east", label: "What usually serves", optional: false },
          { element: "west", label: "What takes over", optional: true },
        ],
      },
    });
    expect(written.files["mogram.yaml"]).toContain(`name: Shop
concept:
  summary: Two regions.
  topic: reliability
  platform: azure
  tags: [dr, regions]
  roles:
    east: What usually serves
    west: { label: What takes over, optional: true }
`);
    const read = parseDiagram(written.files).diagram;
    expect(read.settings.concept?.roles.map((r) => r.element)).toEqual(["east", "west"]);
    expect(conceptInfo(written.files)).toEqual({
      name: "Shop",
      summary: "Two regions.",
      topic: "reliability",
      platform: "azure",
      tags: ["dr", "regions"],
      kind: "pattern",
    });
    const renamed = renameElement(written.files, read, { from: "east", to: "primary" });
    const afterRename = parseDiagram(renamed.files).diagram;
    expect(afterRename.settings.concept?.roles.map((r) => r.element)).toEqual(["primary", "west"]);
    const deleted = deleteElements(renamed.files, afterRename, ["west"]);
    expect(parseDiagram(deleted.files).diagram.settings.concept?.roles).toHaveLength(1);
  });

  it("says when a topic or platform isn't one there is, and keeps the tags tidy", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml": `mogram: 1
concept:
  topic: netwrking
  platform: azur
  tags: [DNS, dns, " Latency "]
components:
  web: { type: generic/server }
`,
    });
    expect(diagram.settings.concept).toMatchObject({
      topic: null,
      platform: "any",
      tags: ["dns", "latency"],
      roles: [],
    });
    expect(diagnostics.map((d) => d.message)).toEqual([
      `"netwrking" isn't a concept topic, so it's left out. Did you mean "networking"? Topics: fundamentals, scaling, reliability, networking, security, data, messaging, containers, delivery, git, architecture, observability or ai.`,
      `"azur" isn't a platform, so the concept is for any. Did you mean "azure"? Platforms: any, azure, aws, gcp or kubernetes.`,
    ]);
  });

  it("says when a role names something that isn't there", () => {
    const { diagnostics } = parseDiagram({
      "mogram.yaml": `mogram: 1
concept:
  roles:
    webb: What scales
components:
  web: { type: generic/server }
`,
    });
    expect(diagnostics.map((d) => d.message)).toEqual([
      `The concept's role "webb" should name an element in this diagram. Did you mean "web"?`,
    ]);
  });
});
