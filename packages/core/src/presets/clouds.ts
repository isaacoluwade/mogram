import type { Diagram } from "../model/types";
import type { ContainerStyleName } from "./names";
import { CONTAINER_STYLE_INFO } from "./containers";

/**
 * The three clouds name the same container kinds differently, and some kinds only exist on one
 * (docs/file-format.md, Containers). A diagram's cloud decides what its containers are called,
 * which official group icon they get, and which the library offers, in that cloud's usual
 * nesting order.
 */
export const CLOUDS = ["azure", "aws", "gcp"] as const;
export type Cloud = (typeof CLOUDS)[number];

export const CLOUD_LABELS: Readonly<Record<Cloud, string>> = {
  azure: "Azure",
  aws: "AWS",
  gcp: "Google Cloud",
};

/** What each kind is called on each cloud, where it differs from the neutral name. */
const NAMES: Readonly<Partial<Record<ContainerStyleName, Partial<Record<Cloud, string>>>>> = {
  cloud: { azure: "Azure", aws: "AWS Cloud", gcp: "Google Cloud" },
  account: { azure: "Subscription", aws: "AWS account", gcp: "Project" },
  "availability-zone": { aws: "Availability Zone", gcp: "Zone" },
  network: { azure: "Virtual network", aws: "VPC", gcp: "VPC network" },
  "scaling-group": {
    azure: "VM scale set",
    aws: "Auto Scaling group",
    gcp: "Managed instance group",
  },
  "on-premises": { aws: "Corporate data center" },
  cluster: { azure: "AKS cluster", aws: "EKS cluster", gcp: "GKE cluster" },
};

/** The official group icons each cloud draws its containers with. */
const ICONS: Readonly<Record<Cloud, Partial<Record<ContainerStyleName, string>>>> = {
  azure: {
    account: "azure/subscriptions",
    "resource-group": "azure/resource-groups",
    network: "azure/virtual-networks",
    subnet: "azure/subnet",
    "scaling-group": "azure/vm-scale-sets",
    cluster: "azure/kubernetes-services",
  },
  aws: {
    cloud: "aws/aws-cloud",
    account: "aws/aws-account",
    region: "aws/region",
    network: "aws/vpc-group",
    "public-subnet": "aws/public-subnet",
    "private-subnet": "aws/private-subnet",
    "scaling-group": "aws/auto-scaling-group",
    "on-premises": "aws/corporate-data-center",
    cluster: "aws/eks",
  },
  gcp: {
    network: "gcp/virtual-private-cloud",
    cluster: "gcp/gke",
  },
};

/**
 * The kinds each cloud's diagrams use, outermost first. AWS subnets live in one zone, so its
 * zones come before its subnets; a Google Cloud network is global, so it comes before regions.
 */
export const CLOUD_CONTAINERS: Readonly<Record<Cloud | "any", readonly ContainerStyleName[]>> = {
  azure: [
    "account",
    "resource-group",
    "region",
    "network",
    "subnet",
    "availability-zone",
    "scaling-group",
    "cluster",
    "namespace",
    "on-premises",
    "box",
  ],
  aws: [
    "cloud",
    "account",
    "region",
    "network",
    "availability-zone",
    "public-subnet",
    "private-subnet",
    "security-group",
    "scaling-group",
    "cluster",
    "namespace",
    "on-premises",
    "box",
  ],
  gcp: [
    "account",
    "network",
    "region",
    "availability-zone",
    "subnet",
    "scaling-group",
    "cluster",
    "namespace",
    "on-premises",
    "box",
  ],
  any: [
    "cloud",
    "account",
    "region",
    "availability-zone",
    "network",
    "subnet",
    "public-subnet",
    "private-subnet",
    "security-group",
    "scaling-group",
    "cluster",
    "namespace",
    "on-premises",
    "resource-group",
    "box",
  ],
};

/** A container kind's name on `cloud` (the neutral name when there's none). */
export function containerName(type: ContainerStyleName, cloud: Cloud | null): string {
  return (cloud === null ? undefined : NAMES[type]?.[cloud]) ?? CONTAINER_STYLE_INFO[type].label;
}

/** The official group icon for a kind on `cloud`, or null where it has none. */
export function containerIcon(type: ContainerStyleName, cloud: Cloud | null): string | null {
  return (cloud === null ? undefined : ICONS[cloud][type]) ?? null;
}

export function isCloud(value: unknown): value is Cloud {
  return typeof value === "string" && (CLOUDS as readonly string[]).includes(value);
}

/** The cloud a library or `libraries:` name means ("google cloud" and "gcp" are the same). */
function cloudNamed(name: string): Cloud | null {
  const key = name.trim().toLowerCase();
  if (key === "azure" || key === "microsoft azure") return "azure";
  if (key === "aws" || key === "amazon web services") return "aws";
  if (key === "gcp" || key === "google" || key === "google cloud") return "gcp";
  return null;
}

/**
 * The cloud a diagram is drawn for: the first one its `libraries:` setting names, else the one
 * most of its icons come from, else none (neutral names).
 */
export function diagramCloud(diagram: Diagram): Cloud | null {
  for (const name of diagram.settings.libraries ?? []) {
    const cloud = cloudNamed(name);
    if (cloud !== null) return cloud;
  }
  const counts = new Map<Cloud, number>();
  const count = (id: string | null) => {
    const prefix = id?.split("/", 1)[0] ?? "";
    if (isCloud(prefix)) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  };
  for (const component of diagram.components.values()) count(component.type);
  for (const container of diagram.containers.values()) count(container.icon);
  let best: Cloud | null = null;
  for (const cloud of CLOUDS) {
    if ((counts.get(cloud) ?? 0) > (best === null ? 0 : (counts.get(best) ?? 0))) best = cloud;
  }
  return best;
}
