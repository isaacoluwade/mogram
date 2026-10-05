import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import type { ProjectFiles } from "@mogram/core/model";
import { ICONS } from "@mogram/icons/catalog";
import { isCatalogIcon, isLibraryId, searchIcons } from "@mogram/icons";
import { CONCEPT_CATALOG, findConcepts } from "@mogram/concepts";
import { ALL_CONCEPTS } from "@mogram/concepts/all";
import { applyOp, runTool, TOOL_SPECS, type ToolEnv } from "./tools";

const env: ToolEnv = {
  searchIcons: (query, options) =>
    searchIcons(ICONS, query, {
      limit: options.limit,
      ...(options.library !== undefined && isLibraryId(options.library)
        ? { library: options.library }
        : {}),
    }),
  isIcon: isCatalogIcon,
  findConcepts: (query, limit) => findConcepts(CONCEPT_CATALOG, query).slice(0, limit),
  conceptFile: (id) => ALL_CONCEPTS[id] ?? null,
};

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Shop
containers:
  vnet: { type: network, label: Shop network }
components:
  web: { type: azure/app-services, label: Web, in: vnet }
  api: { type: azure/function-apps, label: Orders API, in: vnet }
connections:
  web_to_api: { from: web, to: api }
`,
};
const state = { files, folder: "" };
const diagram = (f: ProjectFiles) => parseDiagram(f).diagram;

describe("the assistant's tools", () => {
  it("adds YAML, says what changed, and replays to the same files", () => {
    const result = runTool(env, state, {
      name: "add_elements",
      input: {
        yaml: "components:\n  db: { type: azure/sql-database, label: Orders DB, in: vnet }\nconnections:\n  api_to_db: { from: api, to: db }\n",
      },
    });
    expect(result.isError).toBe(false);
    expect(result.content).toMatch(/^Done: Added Orders DB/);
    const event = result.events[0];
    expect(event?.type).toBe("op");
    if (event?.type !== "op") return;
    expect(event.select).toEqual(["db", "api_to_db"]);
    // The browser applies the same op to the same files and gets the same result.
    expect(applyOp(files, event.op).files).toEqual(result.files);
  });

  it("refuses icons that don't exist, naming the closest ones", () => {
    const result = runTool(env, state, {
      name: "add_elements",
      input: { yaml: "components:\n  cache: { type: azure/redis-cache-service }\n" },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('"azure/redis-cache-service" isn\'t an icon Mogram has.');
    expect(result.content).toMatch(/Closest: azure\//);
    expect(result.files).toBe(files);
  });

  it("refuses a change that would break the diagram, with the problem", () => {
    const result = runTool(env, state, {
      name: "add_elements",
      input: { yaml: "components:\n  db: { type: azure/sql-database, in: subnett }\n" },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/Not applied: it would break the diagram/);
    expect(result.content).toContain("subnett");
  });

  it("explains bad input and names that are taken", () => {
    expect(runTool(env, state, { name: "remove_elements", input: { names: [] } }).content).toMatch(
      /The input isn't right: names/,
    );
    expect(
      runTool(env, state, {
        name: "add_elements",
        input: { yaml: "components:\n  web: { type: azure/app-services }\n" },
      }).content,
    ).toMatch(/"web" already exists/);
    expect(runTool(env, state, { name: "fly", input: {} }).content).toMatch(/no tool called/);
  });

  it("asks before removing a lot", () => {
    const many = Array.from({ length: 10 }, (_, i) => `c${i}: { type: generic/server }`).join(
      "\n  ",
    );
    const big = runTool(env, state, {
      name: "add_elements",
      input: { yaml: `components:\n  ${many}\n` },
    }).files;
    const names = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const refused = runTool(
      env,
      { files: big, folder: "" },
      {
        name: "remove_elements",
        input: { names },
      },
    );
    expect(refused.isError).toBe(true);
    expect(refused.content).toMatch(/Ask the person first/);
    const done = runTool(
      env,
      { files: big, folder: "" },
      {
        name: "remove_elements",
        input: { names, confirmed: true },
      },
    );
    expect(done.isError).toBe(false);
    expect(diagram(done.files).components.size).toBe(2);
  });

  it("updates keys, maps and containers in one call", () => {
    const result = runTool(env, state, {
      name: "update_elements",
      input: {
        updates: [
          { name: "api", set: { state: "degraded", data: { owner: "payments", tier: 1 } } },
          { name: "web", set: { in: null } },
        ],
      },
    });
    expect(result.isError).toBe(false);
    const d = diagram(result.files);
    expect(d.components.get("api")?.state).toBe("degraded");
    expect(Object.fromEntries(d.components.get("api")?.data ?? [])).toEqual({
      owner: "payments",
      tier: 1,
    });
    expect(d.components.get("web")?.parent).toBeNull();
    expect(result.files["mogram.yaml"]).toContain("data: { owner: payments, tier: 1 }");
  });

  it("writes scenes, creating them as needed", () => {
    const result = runTool(env, state, {
      name: "update_scene",
      input: { scene: "outage", entries: { api: "down", web_to_api: "blocked" } },
    });
    expect(result.isError).toBe(false);
    const scene = diagram(result.files).scenes.find((s) => s.name === "outage");
    expect(scene?.entries.map((e) => `${e.target}:${e.state ?? e.flow ?? ""}`)).toEqual([
      "api:down",
      "web_to_api:blocked",
    ]);
  });

  it("puts traffic, shares, hit rates and held copies in scenes", () => {
    const result = runTool(env, state, {
      name: "update_scene",
      input: {
        scene: "spike",
        entries: { web_to_api: "5x", api: { state: "active", hit: "20%" } },
      },
    });
    expect(result.isError).toBe(false);
    expect(result.files["mogram.yaml"]).toContain("web_to_api: 5x");
    const scene = diagram(result.files).scenes.find((s) => s.name === "spike");
    expect(scene?.entries.find((e) => e.target === "api")).toMatchObject({
      state: "active",
      capacity: { hit: 0.2 },
    });
  });

  it("makes things scale, with sizes that fit them", () => {
    const out = runTool(env, state, {
      name: "set_scaling",
      input: { name: "api", kind: "out", max: 6 },
    });
    expect(out.isError).toBe(false);
    expect(diagram(out.files).components.get("api")?.scale).toEqual({
      kind: "out",
      min: 2,
      max: 6,
      target: 0.7,
    });
    const up = runTool(env, state, {
      name: "set_scaling",
      input: {
        name: "web",
        kind: "up",
        sizes: [
          { name: "P1", cpu: 1 },
          { name: "P2", cpu: 2 },
        ],
      },
    });
    const scale = diagram(up.files).components.get("web")?.scale;
    expect(scale?.kind === "up" && scale.sizes.map((s) => [s.name, s.cpu, s.capacity])).toEqual([
      ["P1", 1, 1],
      ["P2", 2, 2],
    ]);
    const bad = runTool(env, state, { name: "set_scaling", input: { name: "vnet", kind: "out" } });
    expect(bad.isError).toBe(true);
    expect(bad.content).toMatch(/isn't a component/);
  });

  it("applies a concept to the person's elements, and replays the same", () => {
    const result = runTool(env, state, {
      name: "apply_concept",
      input: { concept: "horizontal-scaling", roles: { app: "api" } },
    });
    expect(result.isError).toBe(false);
    const d = diagram(result.files);
    expect(d.components.get("api")?.scale?.kind).toBe("out");
    expect(d.connections.get("web_to_api")?.pattern?.kind).toBe("waves");
    const change = result.events.find((e) => e.type === "op");
    expect(change).toBeDefined();
    if (change?.type === "op") expect(applyOp(files, change.op).files).toEqual(result.files);
    const missing = runTool(env, state, {
      name: "apply_concept",
      input: { concept: "failover", roles: { primary: "api" } },
    });
    expect(missing.content).toMatch(/Pick what plays "What takes over"/);
    const unknown = runTool(env, state, {
      name: "apply_concept",
      input: { concept: "teleportation", roles: {} },
    });
    expect(unknown.content).toMatch(/There's no concept "teleportation"\. Use find_concepts/);
  });

  it("finds concepts by words, topic and platform, with the parts to pick", () => {
    const found = runTool(env, state, {
      name: "find_concepts",
      input: { query: "scale out" },
    });
    expect(found.isError).toBe(false);
    expect(found.content).toMatch(
      /^horizontal-scaling — Horizontal scaling \(scaling\): .* Parts: app = /m,
    );
    const reliability = runTool(env, state, {
      name: "find_concepts",
      input: { topic: "reliability" },
    });
    expect(reliability.content.split("\n").every((line) => line.includes("(reliability"))).toBe(
      true,
    );
    const none = runTool(env, state, { name: "find_concepts", input: { query: "zzzz" } });
    expect(none.content).toMatch(/No concepts match/);
    expect(none.events).toEqual([]);
  });

  it("passes on the architecture review of what it just did", () => {
    const result = runTool(env, state, {
      name: "add_elements",
      input: { yaml: "containers:\n  data: { type: subnet, label: Data subnet }\n" },
    });
    expect(result.isError).toBe(false);
    expect(result.content).toContain("Review");
    expect(result.content).toContain(
      "Data subnet is a subnet that isn't inside a virtual network.",
    );
  });

  it("ends the turn with a question or a plan", () => {
    const asked = runTool(env, state, {
      name: "ask_user",
      input: {
        question: "Which database?",
        options: [{ label: "Azure SQL" }, { label: "Cosmos DB", description: "Global" }],
      },
    });
    expect(asked.ends).toBe("question");
    expect(asked.events[0]).toEqual({
      type: "question",
      question: "Which database?",
      options: [{ label: "Azure SQL" }, { label: "Cosmos DB", description: "Global" }],
      multiSelect: false,
    });
    const planned = runTool(env, state, {
      name: "propose_plan",
      input: { summary: "A three-tier app", steps: ["Add the network", "Add the tiers"] },
    });
    expect(planned.ends).toBe("plan");
  });

  it("finds icons", () => {
    const found = runTool(env, state, {
      name: "search_icons",
      input: { query: "redis", library: "azure" },
    });
    expect(found.content).toMatch(/^azure\//m);
  });

  it("describes every tool with an object schema", () => {
    for (const spec of TOOL_SPECS) {
      expect(spec.inputSchema.type, spec.name).toBe("object");
      expect(spec.inputSchema.$schema).toBeUndefined();
      expect(spec.description.length).toBeGreaterThan(20);
    }
  });
});
