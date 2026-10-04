import type { Diagram } from "../model";
import { ancestorsOf, byZThenOrder, type LayoutResult, type PlacedElement } from "./compute";

export type PaintKind = "zone" | "container" | "group" | "connection" | "component" | "text";

export interface PaintEntry {
  readonly kind: PaintKind;
  readonly name: string;
}

/**
 * Back-to-front drawing order (ED-23). Every container is a stacking context: `z` orders
 * siblings, and a container's `z` carries everything inside it, so whatever is in front on the
 * canvas matches the file. Within one level the bands are: highlight zones, child containers
 * (each followed by all of its contents), groups, connections, components, then text. Each band
 * is sorted by `z`, then document order.
 *
 * A connection is drawn in the innermost container holding both of its ends (a container end
 * counts as holding itself), a group in the innermost container holding all of its members, so
 * neither is hidden by the containers it spans.
 */
export function paintOrder(diagram: Diagram, layout: LayoutResult): PaintEntry[] {
  const groupsAt = new Map<string | null, string[]>();
  const connectionsAt = new Map<string | null, string[]>();
  const add = (map: Map<string | null, string[]>, level: string | null, name: string): void => {
    const list = map.get(level);
    if (list === undefined) map.set(level, [name]);
    else list.push(name);
  };

  // Containers that hold an element, innermost first; a container also holds itself.
  const holders = (element: string): string[] => {
    const placed = layout.elements.get(element);
    if (placed === undefined) return [];
    const ancestors = ancestorsOf(layout, element);
    return placed.kind === "container" ? [element, ...ancestors] : ancestors;
  };
  const innermost = (chains: readonly (readonly string[])[]): string | null => {
    const [first, ...rest] = chains;
    if (first === undefined) return null;
    return first.find((name) => rest.every((chain) => chain.includes(name))) ?? null;
  };

  for (const connection of diagram.connections.values()) {
    const { from, to } = connection;
    if (!layout.elements.has(from.element) || !layout.elements.has(to.element)) continue;
    add(connectionsAt, innermost([holders(from.element), holders(to.element)]), connection.name);
  }
  for (const group of diagram.groups.values()) {
    if (!layout.groups.has(group.name)) continue;
    const members = group.members.filter((member) => layout.elements.has(member));
    add(groupsAt, innermost(members.map((member) => ancestorsOf(layout, member))), group.name);
  }

  const out: PaintEntry[] = [];
  const placedChildren = (parent: string | null): PlacedElement[] =>
    (layout.children.get(parent) ?? [])
      .map((name) => layout.elements.get(name))
      .filter((element): element is PlacedElement => element !== undefined)
      .sort(byZThenOrder);

  const visit = (parent: string | null): void => {
    const kids = placedChildren(parent);
    const decorations = (variant: "zone" | "other") =>
      kids.filter((kid) => {
        if (kid.kind !== "decoration") return false;
        const zone = diagram.decorations.get(kid.name)?.variant === "zone";
        return variant === "zone" ? zone : !zone;
      });

    for (const zone of decorations("zone")) out.push({ kind: "zone", name: zone.name });
    for (const kid of kids) {
      if (kid.kind !== "container") continue;
      out.push({ kind: "container", name: kid.name });
      visit(kid.name);
    }
    for (const name of groupsAt.get(parent) ?? []) out.push({ kind: "group", name });
    for (const name of connectionsAt.get(parent) ?? []) out.push({ kind: "connection", name });
    for (const kid of kids)
      if (kid.kind === "component") out.push({ kind: "component", name: kid.name });
    for (const text of decorations("other")) out.push({ kind: "text", name: text.name });
  };
  visit(null);
  return out;
}
