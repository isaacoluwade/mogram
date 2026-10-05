import { describe, expect, it } from "vitest";
import {
  SIZE_PRESETS,
  defaultScale,
  nextSize,
  reindexSizes,
  suggestedSizes,
} from "../src/capacity";
import { setScale } from "../src/edit";
import { parseDiagram } from "../src/format";

const YAML = `mogram: 1
name: Presets
components:
  vm: { type: azure/virtual-machine }
  db: { type: azure/sql-database }
  api: { type: generic/server }
  fn: { type: azure/function-apps }
`;

describe("scaling presets", () => {
  it("suggests sizes that fit the element", () => {
    expect(suggestedSizes({ type: "azure/sql-database" }).id).toBe("database");
    expect(suggestedSizes({ type: "aws/rds" }).id).toBe("database");
    expect(suggestedSizes({ type: "azure/virtual-machine" }).id).toBe("vm");
    expect(suggestedSizes({ type: "aws/ec2" }).id).toBe("vm");
    expect(suggestedSizes({ type: "azure/function-apps" }).id).toBe("tiers");
  });

  it("writes every preset so it reads back the same", () => {
    const files = { "mogram.yaml": YAML };
    const { diagram } = parseDiagram(files);
    for (const preset of SIZE_PRESETS) {
      const result = setScale(files, diagram, {
        name: "vm",
        scale: { kind: "up", sizes: preset.sizes, target: 0.7 },
      });
      const after = parseDiagram(result.files);
      expect(after.diagnostics).toEqual([]);
      const scale = after.diagram.components.get("vm")?.scale;
      expect(scale).toEqual({ kind: "up", sizes: preset.sizes, target: 0.7 });
    }
    // Tiers are names only, so they're written as a short list.
    const tiers = setScale(files, diagram, {
      name: "vm",
      scale: defaultScale({ type: "generic/thing", scale: null }, "up"),
    });
    expect(tiers.files["mogram.yaml"]).toMatch(/scale: \{ sizes: \[ ?Small, Medium, Large ?\] \}/);
  });

  it("opens an element up into a block for sizes with cores and memory", () => {
    const files = { "mogram.yaml": YAML };
    const { diagram } = parseDiagram(files);
    const result = setScale(files, diagram, {
      name: "db",
      scale: defaultScale({ type: "azure/sql-database", scale: null }, "up"),
    });
    expect(result.files["mogram.yaml"]).toContain(`  db:
    type: azure/sql-database
    scale:
      sizes:
        - { name: Basic, cpu: 2, memory: 8, disks: 1 }
        - { name: Standard, cpu: 4, memory: 16, disks: 2 }
        - { name: Premium, cpu: 8, memory: 32, disks: 4 }
`);
  });

  it("keeps the target when switching between out and up", () => {
    const out = defaultScale({ type: "azure/virtual-machine", scale: null }, "out");
    expect(out).toEqual({ kind: "out", min: 2, max: 8, target: 0.7 });
    const up = defaultScale(
      { type: "azure/virtual-machine", scale: { ...out, target: 0.5 } },
      "up",
    );
    expect(up.target).toBe(0.5);
    expect(up.kind === "up" && up.sizes[0]?.name).toBe("2 vCPU");
  });

  it("adds the next size at twice the last", () => {
    const vm = suggestedSizes({ type: "azure/virtual-machine" }).sizes;
    expect(nextSize(vm)).toEqual({
      name: "32 vCPU",
      cpu: 32,
      memory: 128,
      disks: 16,
      capacity: 16,
    });
    const tiers = suggestedSizes({ type: "generic/thing" }).sizes;
    expect(nextSize(tiers)).toEqual({
      name: "Size 4",
      cpu: null,
      memory: null,
      disks: null,
      capacity: 8,
    });
  });

  it("moves default capacities with their place, and keeps ones that were given", () => {
    const [small, medium, large] = suggestedSizes({ type: "generic/thing" }).sizes;
    if (small === undefined || medium === undefined || large === undefined) throw new Error();
    // Remove the middle size: Large moves to second place and takes twice, not four times.
    expect(
      reindexSizes([
        { size: small, was: 0 },
        { size: large, was: 2 },
      ]).map((s) => s.capacity),
    ).toEqual([1, 2]);
    // A capacity that was written (3×) stays.
    expect(
      reindexSizes([
        { size: small, was: 0 },
        { size: { ...large, capacity: 3 }, was: 2 },
      ]).map((s) => s.capacity),
    ).toEqual([1, 3]);
  });
});
