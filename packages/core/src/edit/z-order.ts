import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditResult } from "./context";
import { setKey } from "./session";

export type ZOrderMove = "front" | "back" | "forward" | "backward";

interface Ranked {
  readonly name: string;
  readonly z: number;
  /** Document order within the kind: breaks z ties exactly as the renderer does. */
  readonly order: number;
}

const before = (a: { z: number; order: number }, b: { z: number; order: number }): boolean =>
  a.z < b.z || (a.z === b.z && a.order < b.order);

/**
 * Elements that stack against each other (ED-23): same kind, same parent container. Highlight
 * zones and text decorations stack separately, as they are drawn in separate bands.
 * Connections and groups have no z-order.
 */
function stackOf(diagram: Diagram, name: string): Ranked[] | null {
  const layoutZ = (n: string): number => diagram.layout.get(n)?.z ?? 0;
  const rank = <T extends { name: string }>(items: readonly T[], z: (item: T) => number) =>
    items.map((item, order) => ({ name: item.name, z: z(item), order }));

  const component = diagram.components.get(name);
  if (component !== undefined) {
    const all = rank([...diagram.components.values()], (c) => layoutZ(c.name));
    const parentOf = (n: string) => diagram.components.get(n)?.parent ?? null;
    return all.filter((r) => parentOf(r.name) === component.parent);
  }
  const container = diagram.containers.get(name);
  if (container !== undefined) {
    const all = rank([...diagram.containers.values()], (c) => layoutZ(c.name));
    const parentOf = (n: string) => diagram.containers.get(n)?.parent ?? null;
    return all.filter((r) => parentOf(r.name) === container.parent);
  }
  const decoration = diagram.decorations.get(name);
  if (decoration !== undefined) {
    const zone = decoration.variant === "zone";
    const all = [...diagram.decorations.values()];
    return rank(all, (d) => d.z).filter((r, i) => {
      const other = all[i];
      return (
        other !== undefined &&
        other.parent === decoration.parent &&
        (other.variant === "zone") === zone
      );
    });
  }
  return null;
}

/** The stack after the move: selected members go to an end, or one step past their neighbour. */
function reorder(
  stack: readonly Ranked[],
  selected: ReadonlySet<string>,
  move: ZOrderMove,
): Ranked[] {
  const list = [...stack];
  const picked = (r: Ranked | undefined) => r !== undefined && selected.has(r.name);
  switch (move) {
    case "front":
      return [...list.filter((r) => !picked(r)), ...list.filter((r) => picked(r))];
    case "back":
      return [...list.filter((r) => picked(r)), ...list.filter((r) => !picked(r))];
    case "forward":
      for (let i = list.length - 2; i >= 0; i--) {
        const a = list[i];
        const b = list[i + 1];
        if (a !== undefined && b !== undefined && picked(a) && !picked(b)) {
          list[i] = b;
          list[i + 1] = a;
        }
      }
      return list;
    case "backward":
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (a !== undefined && b !== undefined && !picked(a) && picked(b)) {
          list[i - 1] = b;
          list[i] = a;
        }
      }
      return list;
  }
}

/**
 * New z values that sort `target` in its listed order, changing as few as possible. Two greedy
 * passes (raise later items, or lower earlier ones); the plan writing fewer values wins, then the
 * one touching only the moved elements, then the one leaving more z values at 0 (unwritten).
 */
function assign(target: readonly Ranked[], selected: ReadonlySet<string>): Map<string, number> {
  const raise = new Map<string, number>();
  let last: { z: number; order: number } | null = null;
  for (const item of target) {
    let z = item.z;
    if (last !== null && !before(last, { z, order: item.order }))
      z = item.order > last.order ? last.z : last.z + 1;
    if (z !== item.z) raise.set(item.name, z);
    last = { z, order: item.order };
  }
  const lower = new Map<string, number>();
  let next: { z: number; order: number } | null = null;
  for (let i = target.length - 1; i >= 0; i--) {
    const item = target[i];
    if (item === undefined) continue;
    let z = item.z;
    if (next !== null && !before({ z, order: item.order }, next))
      z = item.order < next.order ? next.z : next.z - 1;
    if (z !== item.z) lower.set(item.name, z);
    next = { z, order: item.order };
  }
  const cost = (plan: ReadonlyMap<string, number>): [number, number, number] => [
    plan.size,
    [...plan.keys()].filter((name) => !selected.has(name)).length,
    [...plan.values()].filter((z) => z !== 0).length,
  ];
  const [a, b] = [cost(raise), cost(lower)];
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y ? raise : lower;
  }
  return raise;
}

/**
 * The z values a move would write, by element name. Empty when the move changes nothing (the
 * element is already in front, or has nothing to stack against), so the UI can disable it.
 */
export function planZOrder(
  diagram: Diagram,
  names: readonly string[],
  move: ZOrderMove,
): ReadonlyMap<string, number> {
  const changes = new Map<string, number>();
  const done = new Set<string>();
  const selected = new Set(names);
  for (const name of names) {
    if (done.has(name)) continue;
    const stack = stackOf(diagram, name);
    if (stack === null) continue;
    for (const item of stack) done.add(item.name);
    const sorted = [...stack].sort((a, b) => a.z - b.z || a.order - b.order);
    for (const [key, z] of assign(reorder(sorted, selected, move), selected)) changes.set(key, z);
  }
  return changes;
}

/** Z-order among siblings (ED-23). Only non-zero z values are written. */
export function reorderZ(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly move: ZOrderMove },
): EditResult {
  const changes = planZOrder(diagram, args.names, args.move);
  return edit(files, diagram, (ctx) => {
    for (const [name, z] of changes) {
      const value = z === 0 ? undefined : z;
      if (diagram.decorations.has(name)) setKey(ctx.decoration(name), "z", value);
      else ctx.setLayoutField(name, "z", value);
    }
  });
}
