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
  region: {
    label: "Region",
    description: "A cloud region such as East US.",
    tone: "neutral",
    border: "solid",
    fill: 0.5,
    icon: "generic/globe",
  },
  vnet: {
    label: "Virtual network",
    description: "A VNet or VPC network boundary.",
    tone: "green",
    border: "solid",
    fill: 0.5,
    icon: "generic/network",
  },
  subnet: {
    label: "Subnet",
    description: "A subnet inside a virtual network.",
    tone: "green",
    border: "dashed",
    fill: 0.35,
    icon: "generic/brackets",
  },
  "resource-group": {
    label: "Resource group",
    description: "A logical grouping of resources.",
    tone: "neutral",
    border: "dashed",
    fill: 0.25,
    icon: "generic/folder",
  },
  "availability-zone": {
    label: "Availability zone",
    description: "A physically separate zone within a region.",
    tone: "amber",
    border: "dashed",
    fill: 0.25,
    icon: "generic/layers",
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
  vpc: {
    label: "VPC",
    description: "An AWS-style virtual private cloud.",
    tone: "orange",
    border: "solid",
    fill: 0.4,
    icon: "generic/cloud",
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
