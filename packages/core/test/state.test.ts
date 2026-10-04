import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { resolveState, rollupState, sceneEntries, worstState } from "../src/state";
import type { SceneEntry } from "../src/model";

const diagramOf = (yaml: string) => {
  const result = parseDiagram({ "mogram.yaml": yaml });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return result.diagram;
};

const entry = (
  target: string,
  state: SceneEntry["state"],
  flow: SceneEntry["flow"] = null,
): SceneEntry => ({
  target,
  state,
  flow,
  motion: null,
  source: { file: "test", line: 1 },
});

const OUTAGE = `components:
  app: azure/app-service
  db_primary: azure/sql-database
  db_replica: azure/sql-database
connections:
  app_to_primary: { from: app, to: db_primary, flow: traffic }
  app_to_replica: { from: app, to: db_replica, backup_for: app_to_primary }
scenes:
  region_outage:
    db_primary: down
    app_to_primary: blocked
    db_replica: active
`;

describe("resolveState", () => {
  it("defaults everything to normal (SC-1)", () => {
    const resolved = resolveState({ diagram: diagramOf(OUTAGE) });
    expect(resolved.elements.get("app")).toEqual({
      state: "healthy",
      motion: "none",
      reason: "normal",
    });
    expect(resolved.connections.get("app_to_primary")).toEqual({ flow: "traffic", reason: "base" });
    expect(resolved.connections.get("app_to_replica")).toEqual({ flow: "idle", reason: "normal" });
  });

  it("applies the PRD's region outage scene (journey 2)", () => {
    const diagram = diagramOf(OUTAGE);
    const resolved = resolveState({ diagram, scene: sceneEntries(diagram, "region_outage") });
    expect(resolved.elements.get("db_primary")?.state).toBe("down");
    expect(resolved.elements.get("db_replica")?.state).toBe("active");
    expect(resolved.connections.get("app_to_primary")).toEqual({
      flow: "blocked",
      reason: "scene",
    });
    expect(resolved.connections.get("app_to_replica")).toEqual({
      flow: "rerouted",
      reason: "backup",
    });
  });

  it("reroutes traffic when a viewer breaks a component (journey 8, SH-3)", () => {
    const diagram = diagramOf(OUTAGE);
    const resolved = resolveState({ diagram, viewer: [entry("db_primary", "down")] });
    expect(resolved.elements.get("db_primary")).toMatchObject({ state: "down", reason: "viewer" });
    expect(resolved.connections.get("app_to_primary")).toEqual({
      flow: "blocked",
      reason: "endpoint-down",
    });
    expect(resolved.connections.get("app_to_replica")).toEqual({
      flow: "rerouted",
      reason: "backup",
    });
  });

  it("lets the viewer override the scene", () => {
    const diagram = diagramOf(OUTAGE);
    const resolved = resolveState({
      diagram,
      scene: sceneEntries(diagram, "region_outage"),
      viewer: [entry("db_primary", "healthy")],
    });
    expect(resolved.elements.get("db_primary")).toMatchObject({
      state: "healthy",
      reason: "viewer",
    });
  });

  it("cascades a down container to everything inside (SC-3)", () => {
    const resolved = resolveState({
      diagram: diagramOf(`containers:
  region: { type: region, state: down }
  vnet: { in: region }
components:
  vm: { in: vnet, motion: pulse }
  outside: generic/server
`),
    });
    expect(resolved.elements.get("vnet")).toMatchObject({ state: "down", reason: "cascade" });
    expect(resolved.elements.get("vm")).toEqual({
      state: "down",
      motion: "none",
      reason: "cascade",
    });
    expect(resolved.elements.get("outside")?.state).toBe("healthy");
  });

  it("rolls the worst child state up to containers, softened to degraded (SC-4)", () => {
    const resolved = resolveState({
      diagram: diagramOf(`containers:
  region: {}
  subnet: { in: region }
components:
  vm1: { in: subnet, state: down }
  vm2: { in: subnet }
`),
    });
    expect(resolved.elements.get("subnet")).toMatchObject({ state: "degraded", reason: "rollup" });
    expect(resolved.elements.get("region")).toMatchObject({ state: "degraded", reason: "rollup" });
  });

  it("lets authors change the roll-up rule", () => {
    const yaml = (rule: string) => `containers:
  pool: { rollup: ${rule} }
components:
  a: { in: pool, state: down }
  b: { in: pool }
`;
    expect(resolveState({ diagram: diagramOf(yaml("best")) }).elements.get("pool")?.state).toBe(
      "healthy",
    );
    expect(resolveState({ diagram: diagramOf(yaml("none")) }).elements.get("pool")?.state).toBe(
      "healthy",
    );
    expect(resolveState({ diagram: diagramOf(yaml("worst")) }).elements.get("pool")?.state).toBe(
      "degraded",
    );
  });

  it("puts a nested diagram down when its owner is down (NE-11)", () => {
    const resolved = resolveState({
      diagram: diagramOf("components:\n  ingress: tool/nginx\n"),
      ownerDown: true,
    });
    expect(resolved.elements.get("ingress")).toMatchObject({ state: "down", reason: "cascade" });
  });

  it("shows the owner as degraded when something inside breaks (NE-12) and passes paths down (SC-10)", () => {
    const files = {
      "mogram.yaml":
        "components:\n  aks:\n    opens: ./aks\nscenes:\n  s:\n    aks.ingress: down\n",
      "aks/mogram.yaml": "components:\n  ingress: tool/nginx\n",
    };
    const parent = parseDiagram(files).diagram;
    const child = parseDiagram(files, "aks").diagram;
    const resolved = resolveState({
      diagram: parent,
      scene: sceneEntries(parent, "s"),
      nestedWorst: (_component, entries) =>
        worstState(resolveState({ diagram: child, scene: entries.scene, viewer: entries.viewer })),
    });
    expect(resolved.nested.get("aks")?.scene.map((e) => e.target)).toEqual(["ingress"]);
    expect(resolved.elements.get("aks")).toMatchObject({ state: "degraded", reason: "rollup" });
  });

  it("rollupState maps severities", () => {
    expect(rollupState(["healthy", "active"], "worst")).toBe("healthy");
    expect(rollupState(["scaling"], "worst")).toBe("scaling");
    expect(rollupState(["overloaded", "healthy"], "worst")).toBe("degraded");
    expect(rollupState([], "worst")).toBe("healthy");
  });
});
