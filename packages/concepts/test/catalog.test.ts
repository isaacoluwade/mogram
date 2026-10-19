import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import { lintDiagram } from "@mogram/core/lint";
import { resolveState } from "@mogram/core/state";
import { CONCEPT_CATALOG, findConcepts, forPlatform, loadConcept } from "../src";
import { ALL_CONCEPTS } from "../src/all.generated";
import { buildCatalog } from "../scripts/catalog";
import { readSources } from "../scripts/build-catalog";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("the concept catalog", () => {
  it("is what the content builds (run pnpm build:catalog after changing a concept)", async () => {
    const { files } = buildCatalog(await readSources(join(ROOT, "content")));
    for (const [path, text] of Object.entries(files))
      expect(await readFile(join(ROOT, "src", path), "utf8"), path).toBe(text);
  });

  it("lists every concept once, with its file", () => {
    const ids = CONCEPT_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(ALL_CONCEPTS).sort()).toEqual([...ids].sort());
  });

  it("refuses a concept with problems, saying which and why", () => {
    expect(() =>
      buildCatalog([
        {
          path: "scaling/odd.mogram.yaml",
          text: "mogram: 1\nname: Odd\nconcept: { topic: networking }\ncomponents:\n  a: { type: generic/server }\n",
        },
      ]),
    ).toThrow(
      /scaling\/odd\.mogram\.yaml: say what it explains[\s\S]*belongs in content\/networking\/[\s\S]*tells no story/,
    );
  });

  it("loads a concept's file when it's opened", async () => {
    const yaml = await loadConcept("horizontal-scaling");
    expect(yaml).toContain("name: Horizontal scaling");
    expect(await loadConcept("no-such-thing")).toBeNull();
  });
});

describe("every concept", () => {
  it("reads cleanly, passes the review, and its story changes something", () => {
    for (const card of CONCEPT_CATALOG) {
      const files = { "mogram.yaml": ALL_CONCEPTS[card.id] ?? "" };
      const { diagram, diagnostics } = parseDiagram(files);
      expect(diagnostics, card.id).toEqual([]);
      expect(
        lintDiagram(diagram).filter((f) => f.severity === "warning"),
        card.id,
      ).toEqual([]);
      const plan = (scene: string | null) =>
        resolveState({
          diagram,
          scene: diagram.scenes.find((s) => s.name === scene)?.entries ?? [],
        });
      const over = plan(null).capacityOverTime;
      if (over !== null)
        expect(JSON.stringify([...over.busy.elements]), card.id).not.toBe(
          JSON.stringify([...over.quiet.elements]),
        );
      const normal = JSON.stringify([...plan(null).capacity.connections]);
      for (const scene of diagram.scenes) {
        const changed =
          JSON.stringify([...plan(scene.name).capacity.connections]) !== normal ||
          scene.entries.some(
            (e) =>
              e.state !== null ||
              e.capacity?.hit !== undefined ||
              e.show !== undefined ||
              e.label !== undefined ||
              e.mark !== undefined ||
              e.place !== undefined ||
              e.value !== undefined,
          );
        expect(changed, `${card.id} ${scene.name}`).toBe(true);
      }
      // What the catalog says about it is what its file says.
      expect(card.title).toBe(diagram.settings.name);
      expect(card.parts.map((p) => p.element)).toEqual(
        diagram.settings.concept?.roles.map((r) => r.element),
      );
    }
  });
});

describe("finding concepts", () => {
  it("matches every word, best in the title, and filters by topic, platform and kind", () => {
    expect(findConcepts(CONCEPT_CATALOG, { text: "scaling" })[0]?.title).toMatch(/scaling/i);
    expect(findConcepts(CONCEPT_CATALOG, { text: "redis" })[0]?.id).toBe("caching");
    expect(findConcepts(CONCEPT_CATALOG, { text: "cache hit nothing-like-this" })).toEqual([]);
    // The library grows: a filter is checked by what it lets through, not by a count.
    const reliable = findConcepts(CONCEPT_CATALOG, { topic: "reliability" });
    expect(reliable.map((c) => c.id)).toContain("failover");
    expect(reliable.every((c) => c.topic === "reliability")).toBe(true);
    const explainers = findConcepts(CONCEPT_CATALOG, { kind: "explainer" });
    expect(explainers.map((c) => c.id)).toContain("blue-green-deployment");
    expect(explainers.every((c) => c.kind === "explainer")).toBe(true);
    // A platform's concepts include the ones for any platform.
    expect(forPlatform({ platform: "any" }, "aws")).toBe(true);
    expect(forPlatform({ platform: "azure" }, "aws")).toBe(false);
    expect(findConcepts(CONCEPT_CATALOG, { platform: "aws" })).toHaveLength(CONCEPT_CATALOG.length);
  });
});
