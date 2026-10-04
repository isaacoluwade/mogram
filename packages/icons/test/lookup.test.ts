import { describe, expect, it } from "vitest";
import { ICONS } from "../src/catalog.generated";
import {
  LIBRARIES,
  SHORT_ICON_IDS,
  canonicalIconId,
  iconById,
  iconKind,
  iconUrl,
  isCatalogIcon,
  isLibraryId,
  libraryNamed,
  libraryRank,
  parseIconId,
} from "../src";

describe("LIBRARIES (IC-7)", () => {
  it("lists the cloud libraries, then generic icons and tool logos, in display order", () => {
    expect(LIBRARIES.map((library) => library.id)).toEqual([
      "azure",
      "aws",
      "gcp",
      "k8s",
      "generic",
      "tool",
    ]);
    expect(LIBRARIES.map((library) => library.name)).toEqual([
      "Azure",
      "AWS",
      "Google Cloud",
      "Kubernetes",
      "Generic",
      "Tool logos",
    ]);
    for (const library of LIBRARIES) expect(library.description).not.toBe("");
  });

  it("recognises library ids and ranks them in display order", () => {
    expect(isLibraryId("azure")).toBe(true);
    expect(isLibraryId("aws")).toBe(true);
    expect(isLibraryId("oci")).toBe(false);
    expect(isLibraryId("icons")).toBe(false);
    expect(LIBRARIES.map((library) => libraryRank(library.id))).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("libraryNamed", () => {
  it("reads a libraries setting by id, name or chip label", () => {
    expect(libraryNamed("gcp")).toBe("gcp");
    expect(libraryNamed("Google Cloud")).toBe("gcp");
    expect(libraryNamed("google-cloud")).toBe("gcp");
    expect(libraryNamed("kubernetes")).toBe("k8s");
    expect(libraryNamed("tools")).toBe("tool");
    expect(libraryNamed("Tool logos")).toBe("tool");
    expect(libraryNamed("oracle")).toBeNull();
  });
});

describe("parseIconId", () => {
  it("splits catalog ids", () => {
    expect(parseIconId("azure/virtual-machine")).toEqual({
      library: "azure",
      slug: "virtual-machine",
    });
  });

  it("rejects project paths, unknown libraries and malformed slugs", () => {
    for (const id of [
      "icons/my.svg",
      "oci/compute",
      "azure/Virtual-Machine",
      "azure/a/b",
      "azure/",
      "",
      "azure",
    ]) {
      expect(parseIconId(id), id).toBeNull();
    }
  });
});

describe("iconUrl", () => {
  it("points catalog ids at the synced asset folder", () => {
    expect(iconUrl("azure/virtual-machine")).toBe("/icons/azure/virtual-machine.svg");
    expect(iconUrl("aws/s3")).toBe("/icons/aws/s3.svg");
    expect(iconUrl("gcp/bigquery")).toBe("/icons/gcp/bigquery.svg");
    expect(iconUrl("k8s/pod")).toBe("/icons/k8s/pod.svg");
    expect(iconUrl("generic/server")).toBe("/icons/generic/server.svg");
    expect(iconUrl("tool/kubernetes")).toBe("/icons/tool/kubernetes.svg");
  });

  it("returns null for project icons and anything else", () => {
    expect(iconUrl("icons/my.svg")).toBeNull();
    expect(iconUrl("icons/sub/my.svg")).toBeNull();
    expect(iconUrl("../azure/virtual-machine")).toBeNull();
    expect(iconUrl("azure/../../secret")).toBeNull();
  });
});

describe("iconById", () => {
  it("finds catalog icons and returns undefined for unknown ids", () => {
    expect(iconById(ICONS, "azure/virtual-machine")?.name).toBe("Virtual Machine");
    expect(iconById(ICONS, "tool/kubernetes")?.color).toBe("#326ce5");
    expect(iconById(ICONS, "azure/nope")).toBeUndefined();
  });

  it("keeps a separate lookup per catalog array", () => {
    const [vm] = ICONS.filter((icon) => icon.id === "azure/virtual-machine");
    const small = [{ ...vm!, name: "Renamed" }];
    expect(iconById(small, "azure/virtual-machine")?.name).toBe("Renamed");
    expect(iconById(ICONS, "azure/virtual-machine")?.name).toBe("Virtual Machine");
  });
});

describe("short icon ids", () => {
  it("point at icons that exist in the catalog", () => {
    for (const [short, target] of Object.entries(SHORT_ICON_IDS)) {
      expect(iconById(ICONS, target), `${short} → ${target}`).toBeDefined();
      expect(iconById(ICONS, short)?.id).toBe(target);
    }
  });

  it("resolve the abbreviations people type for every provider", () => {
    expect(iconUrl("aws/alb")).toBe("/icons/aws/application-load-balancer.svg");
    expect(iconUrl("gcp/gcs")).toBe("/icons/gcp/cloud-storage.svg");
    expect(iconUrl("k8s/svc")).toBe("/icons/k8s/service.svg");
  });

  it("resolve the PRD's hand-written examples to real artwork", () => {
    expect(canonicalIconId("azure/aks")).toBe("azure/kubernetes-services");
    expect(iconUrl("azure/aks")).toBe("/icons/azure/kubernetes-services.svg");
    expect(iconUrl("azure/front-doors")).toBe("/icons/azure/front-door-and-cdn-profiles.svg");
    expect(canonicalIconId("azure/virtual-machine")).toBe("azure/virtual-machine");
  });
});

describe("iconUrl only for icons that exist", () => {
  it("returns a URL for catalog icons and their short ids", () => {
    expect(iconUrl("azure/virtual-machine")).toBe("/icons/azure/virtual-machine.svg");
    expect(iconUrl("azure/vm")).toBe("/icons/azure/virtual-machine.svg");
    expect(isCatalogIcon("generic/server")).toBe(true);
  });

  it("returns null while an id is half typed, or isn't in the catalog", () => {
    expect(iconUrl("generic/us")).toBeNull();
    expect(iconUrl("azure/not-a-real-icon")).toBeNull();
    expect(isCatalogIcon("icons/mine.svg")).toBe(false);
  });
});

describe("iconKind", () => {
  it("says which icons take the theme colour, without loading the catalog", () => {
    expect(iconKind("generic/server")).toBe("glyph");
    expect(iconKind("aws/user")).toBe("glyph");
    expect(iconKind("aws/aws-cloud")).toBe("glyph");
    expect(iconKind("aws/ec2")).toBe("artwork");
    expect(iconKind("azure/vm")).toBe("artwork");
    expect(iconKind("k8s/svc")).toBe("artwork");
    expect(iconKind("tool/github")).toBe("artwork");
  });

  it("agrees with the catalog for every icon", () => {
    for (const icon of ICONS) expect(iconKind(icon.id), icon.id).toBe(icon.kind);
  });

  it("returns null for anything not in the catalog", () => {
    expect(iconKind("icons/mine.svg")).toBeNull();
    expect(iconKind("aws/not-a-service")).toBeNull();
  });
});
