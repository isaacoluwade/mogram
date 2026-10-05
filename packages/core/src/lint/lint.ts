import type { Diagram } from "../model/types";
import type { ContainerStyleName } from "../presets/names";
import {
  CLOUDS,
  CLOUD_CONTAINERS,
  CLOUD_LABELS,
  containerName,
  diagramCloud,
  isCloud,
  type Cloud,
} from "../presets/clouds";

/**
 * Architecture review: what parses but an architect wouldn't draw that way (a subnet outside any
 * network, icons from two clouds, a component nothing talks to). Shown as suggestions beside the
 * file problems, and handed to the assistant after each change so it can fix what it got wrong.
 * Rules are cautious: each says what it saw and why it matters, never that the diagram is wrong.
 */

export type LintRule =
  | "subnet-outside-network"
  | "subnet-outside-zone"
  | "zone-outside-region"
  | "nesting-order"
  | "mixed-clouds"
  | "unconnected"
  | "empty-container";

export interface LintFinding {
  readonly rule: LintRule;
  /** Warnings are probably mistakes; notes are worth a look. */
  readonly severity: "warning" | "note";
  /** The element it's about first, then any others involved. */
  readonly elements: readonly string[];
  /** What was seen, in plain words. */
  readonly message: string;
  /** What would usually fix it. */
  readonly fix: string;
}

const SUBNETS = new Set<ContainerStyleName>(["subnet", "public-subnet", "private-subnet"]);

/** Kinds that group things by ownership or place rather than by network: they nest any way. */
const ANY_ORDER = new Set<ContainerStyleName>(["resource-group", "on-premises", "box"]);

/** Where a kind comes in a cloud's nesting order (outermost 0); -1 when it has no place. */
function rankIn(cloud: Cloud, type: ContainerStyleName): number {
  if (ANY_ORDER.has(type)) return -1;
  const order = CLOUD_CONTAINERS[cloud];
  if (!SUBNETS.has(type)) return order.indexOf(type);
  // Public and private subnets sit side by side.
  const ranks = [...SUBNETS].map((kind) => order.indexOf(kind)).filter((i) => i >= 0);
  return ranks.length === 0 ? -1 : Math.min(...ranks);
}

/** Every finding for one diagram (one folder), most important first. */
export function lintDiagram(diagram: Diagram): LintFinding[] {
  const cloud = diagramCloud(diagram);
  const out: LintFinding[] = [];
  const containers = diagram.containers;
  const nameOf = (name: string): string =>
    containers.get(name)?.label ?? diagram.components.get(name)?.label ?? name;
  const kindName = (type: ContainerStyleName) => containerName(type, cloud);

  /** The containers around an element, innermost first. */
  const ancestors = (parent: string | null): ContainerStyleName[] => {
    const kinds: ContainerStyleName[] = [];
    const seen = new Set<string>();
    for (let at = parent; at !== null && !seen.has(at); at = containers.get(at)?.parent ?? null) {
      seen.add(at);
      const container = containers.get(at);
      if (container === undefined) break;
      kinds.push(container.type);
    }
    return kinds;
  };

  for (const container of containers.values()) {
    const around = ancestors(container.parent);
    const label = nameOf(container.name);
    if (SUBNETS.has(container.type) && !around.includes("network")) {
      out.push({
        rule: "subnet-outside-network",
        severity: "warning",
        elements: [container.name],
        message: `${label} is a ${kindName(container.type).toLowerCase()} that isn't inside a ${kindName("network").toLowerCase()}.`,
        fix: `Subnets belong to one network: put it inside a ${kindName("network").toLowerCase()} container.`,
      });
    }
    if (cloud === "aws" && SUBNETS.has(container.type) && around.includes("network")) {
      const zones = [...containers.values()].filter((c) => c.type === "availability-zone");
      if (zones.length > 0 && !around.includes("availability-zone")) {
        out.push({
          rule: "subnet-outside-zone",
          severity: "note",
          elements: [container.name],
          message: `${label} isn't inside an Availability Zone, though this diagram has zones.`,
          fix: "In AWS a subnet lives in exactly one Availability Zone: put it inside one.",
        });
      }
    }
    if (container.type === "availability-zone" && !around.includes("region")) {
      const regions = [...containers.values()].some((c) => c.type === "region");
      if (regions) {
        out.push({
          rule: "zone-outside-region",
          severity: "note",
          elements: [container.name],
          message: `${label} isn't inside a region, though this diagram has regions.`,
          fix: "Zones belong to a region: put it inside its region.",
        });
      }
    }
    // A kind inside one that usually goes inside it (a network inside a subnet). Only for a
    // known cloud: their orders differ (an AWS zone holds subnets, an Azure subnet holds zones).
    const parent = container.parent === null ? undefined : containers.get(container.parent);
    const rank = cloud === null ? -1 : rankIn(cloud, container.type);
    const parentRank = cloud === null || parent === undefined ? -1 : rankIn(cloud, parent.type);
    if (parent !== undefined && rank >= 0 && parentRank > rank) {
      out.push({
        rule: "nesting-order",
        severity: "warning",
        elements: [container.name, parent.name],
        message: `${label} (a ${kindName(container.type).toLowerCase()}) is inside ${nameOf(parent.name)} (a ${kindName(parent.type).toLowerCase()}).`,
        fix: `It's usually the other way round: a ${kindName(parent.type).toLowerCase()} goes inside a ${kindName(container.type).toLowerCase()}.`,
      });
    }
  }

  // Icons from more than one cloud: the fewer ones are probably meant to be the main cloud's.
  const byCloud = new Map<Cloud, string[]>();
  for (const component of diagram.components.values()) {
    const prefix = component.type.split("/", 1)[0] ?? "";
    if (isCloud(prefix)) byCloud.set(prefix, [...(byCloud.get(prefix) ?? []), component.name]);
  }
  if (byCloud.size > 1) {
    const main =
      cloud !== null && byCloud.has(cloud)
        ? cloud
        : [...byCloud.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
    const others = CLOUDS.filter((c) => c !== main && byCloud.has(c));
    const strays = others.flatMap((c) => byCloud.get(c) ?? []);
    if (main !== undefined && strays.length > 0) {
      out.push({
        rule: "mixed-clouds",
        severity: "note",
        elements: strays,
        message: `This diagram mixes ${CLOUD_LABELS[main]} icons with ${others.map((c) => CLOUD_LABELS[c]).join(" and ")} icons (${strays.map(nameOf).join(", ")}).`,
        fix: `If it's all on ${CLOUD_LABELS[main]}, use the ${CLOUD_LABELS[main]} icon for each; leave them if it really spans clouds.`,
      });
    }
  }

  // Components nothing connects to, in a diagram that has connections (a diagram without any is
  // an inventory, not a flow). A connection to a container counts for what's inside it.
  if (diagram.connections.size > 0) {
    const touched = new Set<string>();
    for (const connection of diagram.connections.values()) {
      touched.add(connection.from.element);
      touched.add(connection.to.element);
    }
    for (const group of diagram.groups.values()) {
      if (touched.has(group.name)) for (const member of group.members) touched.add(member);
    }
    const reached = (name: string, parent: string | null): boolean => {
      if (touched.has(name)) return true;
      const seen = new Set<string>();
      for (let at = parent; at !== null && !seen.has(at); at = containers.get(at)?.parent ?? null) {
        seen.add(at);
        if (touched.has(at)) return true;
      }
      return false;
    };
    for (const component of diagram.components.values()) {
      if (component.shape !== null || reached(component.name, component.parent)) continue;
      out.push({
        rule: "unconnected",
        severity: "note",
        elements: [component.name],
        message: `Nothing connects to ${nameOf(component.name)}.`,
        fix: "Connect it to what uses it, or remove it if it isn't part of this design.",
      });
    }
  }

  for (const container of containers.values()) {
    const holds =
      [...diagram.components.values()].some((c) => c.parent === container.name) ||
      [...containers.values()].some((c) => c.parent === container.name) ||
      [...diagram.decorations.values()].some((d) => d.parent === container.name);
    if (!holds) {
      out.push({
        rule: "empty-container",
        severity: "note",
        elements: [container.name],
        message: `${nameOf(container.name)} is empty.`,
        fix: "Put what runs there inside it, or remove it.",
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1));
}
