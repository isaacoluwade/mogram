import { describe, expect, it } from "vitest";
import {
  bothKinds,
  choosePlatform,
  defaultPlatform,
  filterConcepts,
  loadEntry,
  parseTags,
  platformChoices,
  shelfLabel,
  topicShelves,
  type ConceptFilter,
} from "./browse";
import type { ConceptEntry } from "./catalog";

const entry = (over: Partial<ConceptEntry> & Pick<ConceptEntry, "id" | "title">): ConceptEntry => ({
  key: `builtin:${over.id}`,
  source: "builtin",
  summary: "",
  topic: "scaling",
  platform: "any",
  tags: [],
  kind: "pattern",
  load: async () => ({ "mogram.yaml": `name: ${over.title}` }),
  ...over,
});

const ENTRIES: readonly ConceptEntry[] = [
  entry({ id: "scale-out", title: "Scaling out", tags: ["autoscaling"] }),
  entry({ id: "vmss", title: "VM scale sets", platform: "azure", tags: ["vmss"] }),
  entry({ id: "asg", title: "Auto Scaling groups", platform: "aws" }),
  entry({
    id: "dns",
    title: "How DNS resolves",
    topic: "networking",
    kind: "explainer",
    summary: "From a name to an address",
  }),
  entry({
    key: "draft:1",
    source: "draft",
    id: "1",
    title: "Our failover",
    topic: null,
  }),
];

const ALL: ConceptFilter = { text: "", platform: "all", shelf: null, kind: "all" };
const titles = (list: readonly ConceptEntry[]) => list.map((e) => e.title);

describe("browsing concepts", () => {
  it("lists everything by title, or a platform's own with the general ones", () => {
    expect(titles(filterConcepts(ENTRIES, ALL))).toEqual([
      "Auto Scaling groups",
      "How DNS resolves",
      "Our failover",
      "Scaling out",
      "VM scale sets",
    ]);
    // Azure's own first, then the general ones.
    expect(titles(filterConcepts(ENTRIES, { ...ALL, platform: "azure" }))).toEqual([
      "VM scale sets",
      "How DNS resolves",
      "Our failover",
      "Scaling out",
    ]);
  });

  it("offers only the platforms with concepts of their own, and kinds when there are two", () => {
    expect(platformChoices(ENTRIES)).toEqual([
      { value: "all", label: "All platforms" },
      { value: "azure", label: "Azure (1)" },
      { value: "aws", label: "AWS (1)" },
    ]);
    const general = ENTRIES.filter((e) => e.platform === "any");
    expect(platformChoices(general)).toEqual([]);
    expect(choosePlatform(platformChoices(ENTRIES), "gcp")).toBe("all");
    expect(choosePlatform(platformChoices(ENTRIES), "aws")).toBe("aws");
    expect(choosePlatform([], "azure")).toBe("all");
    expect(bothKinds(ENTRIES)).toBe(true);
    expect(bothKinds(ENTRIES.filter((e) => e.kind === "pattern"))).toBe(false);
  });

  it("narrows to a topic, yours, ones without a topic, or a kind", () => {
    expect(titles(filterConcepts(ENTRIES, { ...ALL, shelf: "networking" }))).toEqual([
      "How DNS resolves",
    ]);
    expect(titles(filterConcepts(ENTRIES, { ...ALL, shelf: "yours" }))).toEqual(["Our failover"]);
    expect(titles(filterConcepts(ENTRIES, { ...ALL, shelf: "other" }))).toEqual(["Our failover"]);
    expect(titles(filterConcepts(ENTRIES, { ...ALL, kind: "explainer" }))).toEqual([
      "How DNS resolves",
    ]);
  });

  it("keeps recently used in the order they were used, skipping ones that are gone", () => {
    const recent = ["builtin:dns", "builtin:gone", "builtin:scale-out"];
    expect(titles(filterConcepts(ENTRIES, { ...ALL, shelf: "recent" }, recent))).toEqual([
      "How DNS resolves",
      "Scaling out",
    ]);
  });

  it("searches titles first, then tags and summaries, within the shelf", () => {
    expect(titles(filterConcepts(ENTRIES, { ...ALL, text: "scal" }))).toEqual([
      "Scaling out",
      "Auto Scaling groups",
      "VM scale sets",
    ]);
    expect(titles(filterConcepts(ENTRIES, { ...ALL, text: "vmss" }))).toEqual(["VM scale sets"]);
    expect(titles(filterConcepts(ENTRIES, { ...ALL, text: "address" }))).toEqual([
      "How DNS resolves",
    ]);
    expect(filterConcepts(ENTRIES, { ...ALL, text: "scal", shelf: "networking" })).toEqual([]);
  });

  it("counts the topics that have concepts, in their usual order, with other last", () => {
    expect(topicShelves(ENTRIES, "all")).toEqual([
      { shelf: "scaling", label: "Scaling & performance", count: 3 },
      { shelf: "networking", label: "Networking", count: 1 },
      { shelf: "other", label: "Other", count: 1 },
    ]);
    expect(topicShelves(ENTRIES, "aws")[0]).toEqual({
      shelf: "scaling",
      label: "Scaling & performance",
      count: 2,
    });
    expect(shelfLabel("recent")).toBe("Recently used");
  });

  it("opens on the diagram's cloud", () => {
    expect(defaultPlatform("azure")).toBe("azure");
    expect(defaultPlatform(null)).toBe("all");
  });

  it("loads a concept's files once, and again after a failure", async () => {
    let calls = 0;
    const flaky = entry({
      id: "flaky",
      title: "Flaky",
      load: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({ "mogram.yaml": "name: Flaky" });
      },
    });
    await expect(loadEntry(flaky)).rejects.toThrow("offline");
    await Promise.resolve();
    expect(await loadEntry(flaky)).toEqual({ "mogram.yaml": "name: Flaky" });
    await loadEntry(flaky);
    expect(calls).toBe(2);
  });

  it("reads tags as typed", () => {
    expect(parseTags("DNS, failover , dns,,")).toEqual(["dns", "failover"]);
    expect(parseTags("  ")).toEqual([]);
  });
});
