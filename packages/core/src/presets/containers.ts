import type { Tone } from "../model/types";
import type { ContainerStyleName } from "./names";

/**
 * One look per container type (ED-14, PR-4). Nothing visual is written to the file unless
 * the user overrides `color:`.
 */
export interface ContainerStyleInfo {
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  readonly border: "solid" | "dashed" | "dotted";
  /** Fill strength 0..1 relative to the tone fill. */
  readonly fill: number;
  /** Icon shown in the header, as a generic icon id (`generic/<id>`). */
  readonly icon: string;
}

export const CONTAINER_STYLE_INFO: Readonly<Record<ContainerStyleName, ContainerStyleInfo>> = {
  cloud: {
    label: "Cloud",
    description: "The cloud provider's boundary, around everything it runs.",
    tone: "neutral",
    border: "solid",
    fill: 0.2,
    icon: "generic/cloud",
  },
  account: {
    label: "Account",
    description: "The billing and ownership boundary: a subscription, account or project.",
    tone: "rose",
    border: "solid",
    fill: 0.25,
    icon: "generic/identity",
  },
  "resource-group": {
    label: "Resource group",
    description: "A folder for managing resources together; not a network boundary.",
    tone: "neutral",
    border: "dashed",
    fill: 0.25,
    icon: "generic/folder",
  },
  region: {
    label: "Region",
    description: "A cloud region such as East US.",
    tone: "neutral",
    border: "solid",
    fill: 0.5,
    icon: "generic/globe",
  },
  "availability-zone": {
    label: "Availability zone",
    description: "A physically separate zone within a region.",
    tone: "amber",
    border: "dashed",
    fill: 0.25,
    icon: "generic/layers",
  },
  network: {
    label: "Network",
    description: "A private network: an Azure VNet, an AWS VPC or a Google Cloud VPC network.",
    tone: "green",
    border: "solid",
    fill: 0.5,
    icon: "generic/network",
  },
  subnet: {
    label: "Subnet",
    description: "A range of addresses inside a network.",
    tone: "green",
    border: "dashed",
    fill: 0.35,
    icon: "generic/brackets",
  },
  "public-subnet": {
    label: "Public subnet",
    description: "A subnet with a route to the internet.",
    tone: "green",
    border: "dashed",
    fill: 0.35,
    icon: "generic/internet",
  },
  "private-subnet": {
    label: "Private subnet",
    description: "A subnet with no direct route from the internet.",
    tone: "blue",
    border: "dashed",
    fill: 0.35,
    icon: "generic/lock",
  },
  "security-group": {
    label: "Security group",
    description: "A firewall around the servers inside it.",
    tone: "rose",
    border: "dashed",
    fill: 0.15,
    icon: "generic/shield",
  },
  "scaling-group": {
    label: "Scaling group",
    description: "Identical servers that grow and shrink with load.",
    tone: "orange",
    border: "dashed",
    fill: 0.15,
    icon: "generic/server",
  },
  "on-premises": {
    label: "On-premises",
    description: "Your own data centre or office network.",
    tone: "neutral",
    border: "solid",
    fill: 0.35,
    icon: "generic/building",
  },
  cluster: {
    label: "Cluster",
    description: "A Kubernetes or compute cluster.",
    tone: "violet",
    border: "solid",
    fill: 0.45,
    icon: "generic/cluster",
  },
  namespace: {
    label: "Namespace",
    description: "A namespace inside a cluster.",
    tone: "violet",
    border: "dotted",
    fill: 0.25,
    icon: "generic/tag",
  },
  box: {
    label: "Box",
    description: "A plain boundary with no special meaning.",
    tone: "neutral",
    border: "solid",
    fill: 0.3,
    icon: "generic/square",
  },
};
