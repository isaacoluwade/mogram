import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ICONS } from "../src/catalog.generated";
import { ICON_ALIASES, ICON_SLUG_PATTERN, LIBRARIES, iconById, libraryRank } from "../src";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const svgOf = (library: string, slug: string): string =>
  readFileSync(join(ASSETS, library, `${slug}.svg`), "utf8");

/** Icons `@mogram/core` uses by id: container header presets and the default component type. */
const IDS_THE_APP_USES = [
  "generic/globe",
  "generic/network",
  "generic/brackets",
  "generic/folder",
  "generic/layers",
  "generic/cluster",
  "generic/tag",
  "generic/cloud",
  "generic/square",
  "generic/service",
  "azure/virtual-machine",
  "azure/kubernetes-services",
  "azure/storage-accounts",
  "azure/sql-database",
];

const inLibrary = (library: string) => ICONS.filter((icon) => icon.library === library);

describe("catalog entries", () => {
  it("has icons in every library (IC-1, IC-2, IC-3, IC-7)", () => {
    const least = { azure: 600, aws: 750, gcp: 200, k8s: 35, generic: 60, tool: 40 };
    for (const library of LIBRARIES) {
      expect(inLibrary(library.id).length, library.id).toBeGreaterThanOrEqual(least[library.id]);
    }
  });

  it("gives every icon a unique id shaped library/slug", () => {
    const ids = new Set<string>();
    for (const icon of ICONS) {
      expect(icon.id).toBe(`${icon.library}/${icon.slug}`);
      expect(icon.slug).toMatch(ICON_SLUG_PATTERN);
      expect(ids.has(icon.id)).toBe(false);
      ids.add(icon.id);
    }
  });

  it("has a name, a category and lowercase aliases on every icon", () => {
    for (const icon of ICONS) {
      expect(icon.name.trim()).not.toBe("");
      expect(icon.category.trim()).not.toBe("");
      expect(icon.otherCategories).not.toContain(icon.category);
      for (const alias of icon.aliases) expect(alias).toBe(alias.trim().toLowerCase());
    }
  });

  it("marks generic icons and AWS's single-colour general icons as glyphs", () => {
    for (const icon of inLibrary("generic")) expect(icon.kind, icon.id).toBe("glyph");
    for (const icon of inLibrary("aws").filter((entry) => entry.category === "General")) {
      expect(icon.kind, icon.id).toBe("glyph");
    }
    for (const icon of ICONS.filter((entry) => entry.kind === "glyph")) {
      expect(["generic", "aws"], icon.id).toContain(icon.library);
    }
  });

  it("gives only tool logos a brand colour", () => {
    for (const icon of ICONS) {
      if (icon.library === "tool") expect(icon.color).toMatch(/^#[0-9a-f]{6}$/);
      else expect(icon.color).toBeNull();
    }
  });

  it("is sorted by library, then category, then name", () => {
    const key = (index: number) => {
      const icon = ICONS[index]!;
      return [libraryRank(icon.library), icon.category.toLowerCase(), icon.name.toLowerCase()];
    };
    for (let index = 1; index < ICONS.length; index += 1) {
      const [rankA, categoryA, nameA] = key(index - 1);
      const [rankB, categoryB, nameB] = key(index);
      const inOrder =
        rankA! < rankB! ||
        (rankA === rankB && categoryA! < categoryB!) ||
        (rankA === rankB && categoryA === categoryB && nameA! <= nameB!);
      expect(inOrder, `${ICONS[index - 1]!.id} before ${ICONS[index]!.id}`).toBe(true);
    }
  });

  it("lists Azure icons Microsoft files in several folders under each of them", () => {
    const aks = iconById(ICONS, "azure/kubernetes-services")!;
    expect(aks.category).toBe("Compute");
    expect(aks.otherCategories).toContain("Containers");
  });

  it("files Azure icons Microsoft leaves in its other folder under a real area", () => {
    expect(iconById(ICONS, "azure/container-apps-environments")?.category).toBe("Containers");
    expect(iconById(ICONS, "azure/private-endpoints")?.category).toBe("Networking");
    expect(iconById(ICONS, "azure/prometheus")?.category).toBe("Monitor");
    // Only Microsoft's codenames, with no public product behind them, are left.
    const other = inLibrary("azure").filter((icon) => icon.category === "Other");
    expect(other.map((icon) => icon.slug).sort()).toEqual([
      "aquila",
      "breeze",
      "ceres",
      "fiji",
      "icm-troubleshooting",
      "targets-management",
    ]);
  });

  it("contains every id the app and core presets refer to", () => {
    for (const id of IDS_THE_APP_USES) expect(iconById(ICONS, id), id).toBeDefined();
  });
});

describe("AWS library", () => {
  const aws = inLibrary("aws");

  it("files services and resources in AWS's categories, plus groups and category icons", () => {
    const categories = new Set(aws.map((icon) => icon.category));
    for (const category of [
      "Analytics",
      "Compute",
      "Containers",
      "Databases",
      "General",
      "Groups",
      "Categories",
      "Networking & Content Delivery",
      "Security, Identity & Compliance",
      "Storage",
    ]) {
      expect(categories, category).toContain(category);
    }
    expect(iconById(ICONS, "aws/lambda")?.category).toBe("Compute");
    expect(iconById(ICONS, "aws/region")?.category).toBe("Groups");
    expect(iconById(ICONS, "aws/compute")?.category).toBe("Categories");
  });

  it("uses AWS's own short names, keeping the long name searchable", () => {
    const s3 = iconById(ICONS, "aws/s3")!;
    expect(s3.name).toBe("Amazon S3");
    expect(s3.aliases).toEqual(expect.arrayContaining(["s3", "amazon simple storage service"]));
    expect(iconById(ICONS, "aws/sqs")?.name).toBe("Amazon SQS");
    expect(iconById(ICONS, "aws/eks")?.name).toBe("Amazon EKS");
  });

  it("names resources without repeating the service", () => {
    expect(iconById(ICONS, "aws/lambda-function")?.name).toBe("AWS Lambda Function");
    expect(iconById(ICONS, "aws/msk-connect")?.name).toBe("Amazon MSK Connect");
    expect(iconById(ICONS, "aws/s3-bucket")?.name).toBe("Amazon S3 Bucket");
    expect(iconById(ICONS, "aws/application-load-balancer")?.name).toBe(
      "Application Load Balancer",
    );
    // A resource icon for the service as a whole keeps the service's name, marked as such.
    expect(iconById(ICONS, "aws/s3-on-outposts-resource")?.name).toBe(
      "Amazon S3 on Outposts (resource)",
    );
  });

  it("lists a service AWS files in two areas once, under both", () => {
    const optimizer = iconById(ICONS, "aws/compute-optimizer")!;
    expect([optimizer.category, ...optimizer.otherCategories].sort()).toEqual([
      "Compute",
      "Management & Governance",
    ]);
  });

  it("ships no dark-background duplicates", () => {
    for (const icon of aws) expect(icon.slug, icon.id).not.toMatch(/dark/);
  });
});

describe("Google Cloud library", () => {
  const artwork = (slug: string) => svgOf("gcp", slug).replaceAll(slug, "SLUG");

  it("draws the 19 core products with their own icons", () => {
    const core = [
      "ai-hypercomputer",
      "alloydb",
      "anthos",
      "apigee",
      "bigquery",
      "cloud-run",
      "cloud-sql",
      "cloud-storage",
      "compute-engine",
      "distributed-cloud",
      "gke",
      "hyperdisk",
      "looker",
      "mandiant",
      "security-command-center",
      "security-operations",
      "spanner",
      "threat-intelligence",
      "vertex-ai",
    ];
    expect(new Set(core.map(artwork)).size).toBe(core.length);
  });

  it("draws every other product with its category's icon, as Google's guide directs", () => {
    expect(artwork("pub-sub")).toBe(artwork("data-analytics"));
    expect(artwork("memorystore")).toBe(artwork("databases"));
    expect(artwork("cloud-load-balancing")).toBe(artwork("networking"));
    expect(artwork("looker-studio")).toBe(artwork("looker"));
    expect(iconById(ICONS, "gcp/pub-sub")?.category).toBe("Data Analytics");
  });

  it("has an icon in each of Google's 26 categories", () => {
    expect(new Set(inLibrary("gcp").map((icon) => icon.category)).size).toBe(26);
  });
});

describe("Kubernetes library", () => {
  it("names icons after Kubernetes kinds and components", () => {
    expect(iconById(ICONS, "k8s/pod")?.name).toBe("Pod");
    expect(iconById(ICONS, "k8s/configmap")?.name).toBe("ConfigMap");
    expect(iconById(ICONS, "k8s/api-server")?.category).toBe("Control plane");
    expect(iconById(ICONS, "k8s/kubelet")?.category).toBe("Nodes");
  });
});

describe("aliases (IC-5)", () => {
  it("only names icons that exist", () => {
    for (const id of Object.keys(ICON_ALIASES)) expect(iconById(ICONS, id), id).toBeDefined();
  });

  it("are merged into the catalog entries", () => {
    for (const [id, aliases] of Object.entries(ICON_ALIASES)) {
      expect(iconById(ICONS, id)!.aliases).toEqual(expect.arrayContaining([...aliases]));
    }
    expect(iconById(ICONS, "azure/virtual-machine")!.aliases).toContain("vm");
  });
});

describe("asset files", () => {
  it("exist for every catalog entry and nothing else", () => {
    for (const library of LIBRARIES) {
      const files = readdirSync(join(ASSETS, library.id)).filter((file) => file.endsWith(".svg"));
      const slugs = ICONS.filter((icon) => icon.library === library.id).map((icon) => icon.slug);
      expect(files.map((file) => file.slice(0, -4)).sort()).toEqual([...slugs].sort());
    }
  });

  it("are SVG documents with a viewBox and no fixed size", () => {
    for (const icon of ICONS) {
      const svg = svgOf(icon.library, icon.slug);
      expect(svg.startsWith("<svg "), icon.id).toBe(true);
      const root = /^<svg[^>]*>/.exec(svg)![0];
      expect(root, icon.id).toMatch(/ viewBox="[\d.\s-]+"/);
      expect(root, icon.id).not.toMatch(/ (width|height)=/);
      expect(svg.trimEnd().endsWith("</svg>"), icon.id).toBe(true);
    }
  });

  it("contain nothing that can run code or load outside content", () => {
    for (const icon of ICONS) {
      const svg = svgOf(icon.library, icon.slug);
      expect(svg, icon.id).not.toMatch(/<script/i);
      expect(svg, icon.id).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg, icon.id).not.toMatch(/javascript:/i);
      expect(svg, icon.id).not.toMatch(/<foreignObject/i);
      expect(svg, icon.id).not.toMatch(/href\s*=\s*["']?\s*https?:/i);
      expect(svg, icon.id).not.toMatch(/<style|\sstyle=|\sclass=/);
    }
  });

  it("never repeat an element id within a library, so many can be inlined in one page", () => {
    for (const library of LIBRARIES) {
      const seen = new Map<string, string>();
      for (const icon of inLibrary(library.id)) {
        for (const [, id] of svgOf(icon.library, icon.slug).matchAll(/\sid="([^"]+)"/g)) {
          expect(seen.get(id!), `${id!} in ${icon.id}`).toBeUndefined();
          expect(id!.startsWith(`${icon.slug}-`), `${id!} in ${icon.id}`).toBe(true);
          seen.set(id!, icon.id);
        }
      }
    }
  });

  it("only reference ids defined in the same file", () => {
    for (const icon of ICONS) {
      const svg = svgOf(icon.library, icon.slug);
      const defined = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
      const references = [
        ...svg.matchAll(/url\(#([^)]+)\)/g),
        ...svg.matchAll(/href="#([^"]+)"/g),
      ].map((match) => match[1]);
      for (const reference of references) {
        expect(defined.has(reference), `${reference!} in ${icon.id}`).toBe(true);
      }
    }
  });

  it("draw glyphs in currentColor only, and artwork never in currentColor", () => {
    for (const icon of ICONS) {
      const svg = svgOf(icon.library, icon.slug);
      if (icon.kind === "artwork") {
        expect(svg, icon.id).not.toContain("currentColor");
        continue;
      }
      expect(svg, icon.id).toContain("currentColor");
      const colours = [...svg.matchAll(/(?:fill|stroke|color)="(#[^"]+)"/g)].map((m) => m[1]);
      // Only the black and white of a cut-out mask may remain.
      for (const colour of colours) expect(["#000", "#fff"], icon.id).toContain(colour);
    }
  });

  it("cut the mark out of AWS's dark-square icons so they work on any canvas", () => {
    for (const slug of ["aws-cloud", "aws-cloud-logo", "marketplace"]) {
      const svg = svgOf("aws", slug);
      expect(svg, slug).toContain(`<mask id="${slug}-cutout">`);
      expect(svg, slug).toContain(`mask="url(#${slug}-cutout)"`);
    }
  });

  it("contain no editor leftovers", () => {
    for (const icon of ICONS) {
      const svg = svgOf(icon.library, icon.slug);
      expect(svg, icon.id).not.toMatch(/inkscape|sodipodi|xmlns:(?!xlink)|<metadata|<title|<!--/);
      expect(svg, icon.id).not.toMatch(/<defs\/>|<g\/>/);
    }
  });

  it("draw generic icons as theme-coloured line glyphs on a 24 grid", () => {
    for (const icon of ICONS.filter((entry) => entry.library === "generic")) {
      expect(svgOf("generic", icon.slug), icon.id).toMatch(
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1\.75" stroke-linecap="round" stroke-linejoin="round">/,
      );
    }
  });

  it("draw tool logos as one path in the brand colour", () => {
    for (const icon of ICONS.filter((entry) => entry.library === "tool")) {
      const svg = svgOf("tool", icon.slug);
      expect(svg, icon.id).toMatch(/viewBox="0 0 24 24"/);
      expect(svg.match(/<path /g), icon.id).toHaveLength(1);
      expect(svg, icon.id).toContain(`fill="${icon.color!}"`);
    }
  });

  it("ship the licence and trademark notices beside the icons", () => {
    expect(readFileSync(join(ASSETS, "azure", "LICENSE-NOTICE.md"), "utf8")).toContain(
      "Microsoft permits the use of these icons in architectural diagrams",
    );
    expect(readFileSync(join(ASSETS, "aws", "LICENSE-NOTICE.md"), "utf8")).toContain(
      "We allow customers and partners to use these toolkits and assets",
    );
    expect(readFileSync(join(ASSETS, "gcp", "LICENSE-NOTICE.md"), "utf8")).toContain(
      "Core products carry their own unique icons",
    );
    expect(readFileSync(join(ASSETS, "k8s", "LICENSE-NOTICE.md"), "utf8")).toContain(
      "Mogram uses the icons under CC BY 4.0",
    );
    expect(readFileSync(join(ASSETS, "generic", "LICENSE"), "utf8")).toContain("ISC License");
    expect(readFileSync(join(ASSETS, "tool", "NOTICE.md"), "utf8")).toContain(
      "never suggest that any brand endorses Mogram",
    );
  });
});

describe("ids.generated", () => {
  it("lists exactly the catalog's icons and glyphs (regenerate with pnpm build:catalog)", async () => {
    const { GLYPH_SLUGS, ICON_SLUGS } = await import("../src/ids.generated");
    const list = (table: Readonly<Record<string, string>>) =>
      Object.entries(table).flatMap(([library, slugs]) =>
        slugs
          .split(" ")
          .filter(Boolean)
          .map((slug) => `${library}/${slug}`),
      );
    expect(list(ICON_SLUGS).sort()).toEqual(ICONS.map((icon) => icon.id).sort());
    expect(list(GLYPH_SLUGS).sort()).toEqual(
      ICONS.filter((icon) => icon.kind === "glyph")
        .map((icon) => icon.id)
        .sort(),
    );
  });
});
