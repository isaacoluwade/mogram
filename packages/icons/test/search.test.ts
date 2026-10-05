import { describe, expect, it } from "vitest";
import { ICONS } from "../src/catalog.generated";
import { normalise, searchIcons, type IconEntry, type LibraryId } from "../src";

const ids = (results: readonly IconEntry[]): string[] => results.map((icon) => icon.id);
const first = (query: string): string | undefined => searchIcons(ICONS, query)[0]?.id;

function icon(library: LibraryId, name: string, aliases: readonly string[] = []): IconEntry {
  const slug = normalise(name).replace(/ /g, "-");
  return {
    id: `${library}/${slug}`,
    library,
    slug,
    name,
    category: "Test",
    otherCategories: [],
    aliases,
    kind: library === "generic" ? "glyph" : "artwork",
    color: null,
  };
}

describe("searchIcons on the real catalog (IC-5)", () => {
  it("finds Virtual Machine first for vm", () => {
    expect(first("vm")).toBe("azure/virtual-machine");
  });

  it("finds Kubernetes Services first for aks", () => {
    expect(first("aks")).toBe("azure/kubernetes-services");
  });

  it("finds both the Azure cache and the Redis logo for redis", () => {
    const results = ids(searchIcons(ICONS, "redis"));
    expect(results).toContain("azure/cache-redis");
    expect(results).toContain("tool/redis");
  });

  it("finds Kubernetes in every library for k8s, Azure first", () => {
    const results = ids(searchIcons(ICONS, "k8s"));
    expect(results[0]).toBe("azure/kubernetes-services");
    expect(results).toContain("tool/kubernetes");
    expect(results).toContain("generic/cluster");
  });

  it("finds AWS, Google Cloud and Kubernetes icons by the names people type", () => {
    expect(first("s3")).toBe("aws/s3");
    expect(first("lambda")).toBe("aws/lambda");
    expect(first("sqs")).toBe("aws/sqs");
    expect(first("simple queue service")).toBe("aws/sqs");
    // Azure Web PubSub's icon is named "PubSub", so Google's Pub/Sub leads only when preferred.
    expect(first("pubsub")).toBe("azure/pubsub");
    expect(ids(searchIcons(ICONS, "pubsub"))).toContain("gcp/pub-sub");
    expect(searchIcons(ICONS, "pubsub", { prefer: ["gcp"] })[0]?.id).toBe("gcp/pub-sub");
    expect(first("bigquery")).toBe("gcp/bigquery");
    expect(first("pvc")).toBe("k8s/persistent-volume-claim");
    expect(first("configmap")).toBe("k8s/configmap");
  });

  it("ranks the diagram's own providers first among equally good matches", () => {
    expect(first("vm")).toBe("azure/virtual-machine");
    expect(searchIcons(ICONS, "vm", { prefer: ["aws"] })[0]?.id).toBe("aws/ec2");
    expect(searchIcons(ICONS, "gke", { prefer: ["aws"] })[0]?.id).toBe("gcp/gke");
    const lb = ids(searchIcons(ICONS, "load balancer", { prefer: ["gcp", "aws"] }));
    expect(lb.indexOf("gcp/cloud-load-balancing")).toBeLessThan(lb.indexOf("azure/load-balancers"));
  });

  it("requires every word of a multi-word query to match", () => {
    const results = ids(searchIcons(ICONS, "sql db"));
    expect(results[0]).toBe("azure/sql-database");
    expect(results).not.toContain("azure/azure-sql");
  });

  it("ignores case and punctuation", () => {
    expect(first("VM")).toBe("azure/virtual-machine");
    expect(first("  v-m ")).toBe("azure/virtual-machine");
    expect(first("Key-Vault")).toBe("azure/key-vaults");
    expect(first("keyvault")).toBe("azure/key-vaults");
    expect(first("node.js")).toBe("tool/nodejs");
    expect(first("NODEJS")).toBe("tool/nodejs");
  });

  it("finds tools by their everyday names", () => {
    expect(first("postgres")).toBe("azure/azure-database-postgresql-server");
    expect(searchIcons(ICONS, "postgres", { library: "tool" })[0]?.id).toBe("tool/postgresql");
    expect(first("golang")).toBe("tool/go");
  });

  it("filters by library", () => {
    const results = searchIcons(ICONS, "redis", { library: "tool" });
    expect(ids(results)).toEqual(["tool/redis"]);
    expect(searchIcons(ICONS, "server", { library: "generic" })[0]?.id).toBe("generic/server");
  });

  it("returns at most limit results", () => {
    expect(searchIcons(ICONS, "a", { limit: 5 })).toHaveLength(5);
    expect(searchIcons(ICONS, "vm", { limit: 1 })[0]?.id).toBe("azure/virtual-machine");
    expect(searchIcons(ICONS, "vm", { limit: 0 })).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchIcons(ICONS, "")).toEqual([]);
    expect(searchIcons(ICONS, "   ")).toEqual([]);
    expect(searchIcons(ICONS, "?!/")).toEqual([]);
  });
});

describe("searchIcons ranking", () => {
  const exact = icon("tool", "Gateway Zeta");
  const prefix = icon("tool", "Gateway Zeta Pro");
  const wordPrefix = icon("tool", "Main Gateway Zetas");
  const substring = icon("tool", "Apigateway Zetaservice");
  const subsequence = icon("tool", "Grand Atlas Tower Eastway Zeta");
  const catalog = [subsequence, substring, wordPrefix, prefix, exact];

  it("orders exact > prefix > word prefix > substring > subsequence", () => {
    expect(ids(searchIcons(catalog, "gateway zeta"))).toEqual(
      ids([exact, prefix, wordPrefix, substring, subsequence]),
    );
  });

  it("treats an exact alias like an exact name", () => {
    const aliased = icon("tool", "Something Else", ["gateway zeta"]);
    expect(ids(searchIcons([prefix, aliased], "gateway zeta"))).toEqual(ids([aliased, prefix]));
  });

  it("matches an alias prefix and alias words", () => {
    const aliased = icon("tool", "Plain", ["application gateway"]);
    expect(ids(searchIcons([aliased], "applic"))).toEqual([aliased.id]);
    expect(ids(searchIcons([aliased], "gate"))).toEqual([aliased.id]);
  });

  it("breaks ties by library order, then name", () => {
    const tool = icon("tool", "Queue");
    const generic = icon("generic", "Queue");
    const azureQueue = icon("azure", "Queue");
    const azureQueues = icon("azure", "Queues", ["queue"]);
    expect(ids(searchIcons([tool, generic, azureQueues, azureQueue], "queue"))).toEqual(
      ids([azureQueue, azureQueues, generic, tool]),
    );
  });

  it("puts preferred libraries first, in the order given, within a tier", () => {
    const tool = icon("tool", "Queue");
    const generic = icon("generic", "Queue");
    const azureQueue = icon("azure", "Queue");
    const awsPrefix = icon("aws", "Queue Service");
    const catalog = [tool, generic, azureQueue, awsPrefix];
    expect(ids(searchIcons(catalog, "queue", { prefer: ["tool", "generic"] }))).toEqual(
      ids([tool, generic, azureQueue, awsPrefix]),
    );
  });

  it("skips subsequence matching for queries shorter than three letters", () => {
    const spread = icon("tool", "Very Many");
    expect(searchIcons([spread], "vy")).toEqual([]);
    expect(ids(searchIcons([spread], "vym"))).toEqual([spread.id]);
  });

  it("falls back to the words that do match when no icon has every word", () => {
    expect(ids(searchIcons([exact], "gateway omega"))).toEqual(ids([exact]));
  });

  it("gives the same answer when the catalog is searched again", () => {
    expect(ids(searchIcons(catalog, "zeta"))).toEqual(ids(searchIcons(catalog, "zeta")));
  });
});

describe("normalise", () => {
  it("lowercases, strips accents and collapses punctuation", () => {
    expect(normalise("  Café--Front_Door (Classic) ")).toBe("cafe front door classic");
    expect(normalise(".NET")).toBe("net");
  });
});

describe("searchIcons falls back to any word", () => {
  it("offers what matches some words when nothing matches all of them", () => {
    const icons = [icon("tool", "PostgreSQL", ["postgres"]), icon("tool", "Redis", ["cache"])];
    expect(ids(searchIcons(icons, "postgres cache"))).toEqual(["tool/postgresql", "tool/redis"]);
    expect(ids(searchIcons(icons, "postgres zebra"))).toEqual(["tool/postgresql"]);
  });
});
