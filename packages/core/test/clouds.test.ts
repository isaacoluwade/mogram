import { describe, expect, it } from "vitest";
import { addContainer } from "../src/edit";
import { parseDiagram } from "../src/format";
import {
  CLOUD_CONTAINERS,
  CONTAINER_STYLES,
  containerIcon,
  containerName,
  diagramCloud,
} from "../src/presets";
import type { ProjectFiles } from "../src/model";

describe("containers by cloud", () => {
  it("names one kind the way each cloud does", () => {
    expect(containerName("network", "azure")).toBe("Virtual network");
    expect(containerName("network", "aws")).toBe("VPC");
    expect(containerName("network", "gcp")).toBe("VPC network");
    expect(containerName("network", null)).toBe("Network");
    expect(containerName("account", "azure")).toBe("Subscription");
    expect(containerName("account", "gcp")).toBe("Project");
    expect(containerName("availability-zone", "gcp")).toBe("Zone");
    expect(containerName("region", "aws")).toBe("Region");
  });

  it("uses each cloud's official group icon where it has one", () => {
    expect(containerIcon("network", "aws")).toBe("aws/vpc-group");
    expect(containerIcon("public-subnet", "aws")).toBe("aws/public-subnet");
    expect(containerIcon("account", "azure")).toBe("azure/subscriptions");
    expect(containerIcon("availability-zone", "aws")).toBeNull();
    expect(containerIcon("network", null)).toBeNull();
  });

  it("offers each cloud its own kinds, in its nesting order", () => {
    // AWS subnets live inside one zone; a Google Cloud network spans regions.
    const aws = CLOUD_CONTAINERS.aws;
    expect(aws.indexOf("availability-zone")).toBeLessThan(aws.indexOf("public-subnet"));
    const gcp = CLOUD_CONTAINERS.gcp;
    expect(gcp.indexOf("network")).toBeLessThan(gcp.indexOf("region"));
    expect(CLOUD_CONTAINERS.azure).toContain("resource-group");
    expect(aws).not.toContain("resource-group");
    expect([...CLOUD_CONTAINERS.any].sort()).toEqual([...CONTAINER_STYLES].sort());
  });

  it("reads vnet and vpc as the one network kind", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml":
        "mogram: 1\nname: Old\ncontainers:\n  a: { type: vnet }\n  b: { type: vpc }\n  c: { type: constructor }\n",
    });
    expect(diagram.containers.get("a")?.type).toBe("network");
    expect(diagram.containers.get("b")?.type).toBe("network");
    expect(diagram.containers.get("c")?.type).toBe("box");
    expect(diagnostics.map((d) => d.message).join(" ")).toContain("container type");
  });

  it("knows a diagram's cloud from its settings, else from its icons", () => {
    const parse = (yaml: string) => parseDiagram({ "mogram.yaml": yaml }).diagram;
    expect(diagramCloud(parse("mogram: 1\nlibraries: [generic, aws]\n"))).toBe("aws");
    expect(
      diagramCloud(
        parse(
          "mogram: 1\ncomponents:\n  a: gcp/gke\n  b: gcp/bigquery\n  c: azure/storage-accounts\n",
        ),
      ),
    ).toBe("gcp");
    expect(diagramCloud(parse("mogram: 1\ncomponents:\n  a: generic/users\n"))).toBeNull();
  });

  it("writes a cloud's icon with a new container", () => {
    const files: ProjectFiles = { "mogram.yaml": "mogram: 1\nname: Net\n" };
    const result = addContainer(files, parseDiagram(files).diagram, {
      type: "network",
      label: "VPC",
      icon: "aws/vpc-group",
    });
    expect(result.files["mogram.yaml"]).toContain("vpc: { type: network, icon: aws/vpc-group }");
  });
});
