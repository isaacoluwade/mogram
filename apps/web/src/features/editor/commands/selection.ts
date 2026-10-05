import type { Diagram } from "@mogram/core/model";

/**
 * What is selected, by kind: computed once per diagram and selection and shared by commands,
 * menus, the quick bar and the inspector (draw.io's `getSelectionState`, 01-architecture P0-6).
 */
export interface SelectionInfo {
  readonly names: readonly string[];
  readonly components: readonly string[];
  readonly containers: readonly string[];
  readonly connections: readonly string[];
  readonly decorations: readonly string[];
  readonly groups: readonly string[];
  /** Components and containers: what has a state and can be grouped. */
  readonly placeables: readonly string[];
  /** Whether anything selected has a z-order (connections and groups don't). */
  readonly stackable: boolean;
  /** The one selected name, or null. */
  readonly single: string | null;
  readonly kind:
    "none" | "component" | "container" | "connection" | "decoration" | "group" | "mixed";
}

const cache = new WeakMap<Diagram, Map<string, SelectionInfo>>();

export function selectionInfo(diagram: Diagram, names: readonly string[]): SelectionInfo {
  const key = names.join("\n");
  let byNames = cache.get(diagram);
  if (byNames === undefined) {
    byNames = new Map();
    cache.set(diagram, byNames);
  }
  const hit = byNames.get(key);
  if (hit !== undefined) return hit;

  const components = names.filter((n) => diagram.components.has(n));
  const containers = names.filter((n) => diagram.containers.has(n));
  const connections = names.filter((n) => diagram.connections.has(n));
  const decorations = names.filter((n) => diagram.decorations.has(n));
  const groups = names.filter((n) => diagram.groups.has(n));
  const kinds = [
    ["component", components],
    ["container", containers],
    ["connection", connections],
    ["decoration", decorations],
    ["group", groups],
  ] as const;
  const present = kinds.filter(([, list]) => list.length > 0);
  const info: SelectionInfo = {
    names,
    components,
    containers,
    connections,
    decorations,
    groups,
    placeables: names.filter((n) => diagram.components.has(n) || diagram.containers.has(n)),
    stackable: components.length + containers.length + decorations.length > 0,
    single: names.length === 1 ? (names[0] ?? null) : null,
    kind:
      present.length === 0 ? "none" : present.length === 1 ? (present[0]?.[0] ?? "mixed") : "mixed",
  };
  byNames.set(key, info);
  return info;
}
