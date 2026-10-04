import type { Decoration, Diagram, GridPoint, GridSize, TextStyle } from "../model/types";
import {
  COMPONENT_UNITS,
  CONTAINER_UNITS,
  GROUP_PADDING,
  PLACEMENT_UNITS,
  estimateTextWidth,
  inflate,
  tileOf,
  toPx,
  translate,
  union,
  type Box,
} from "./geometry";

export type PlacedKind = "component" | "container" | "decoration";

export interface PlacedElement {
  readonly name: string;
  readonly kind: PlacedKind;
  readonly parent: string | null;
  /** Absolute footprint in pixels. */
  readonly box: Box;
  /** Position relative to the parent's top-left, in grid units (stored or computed). */
  readonly rel: GridPoint;
  /** Size in grid units. */
  readonly size: GridSize;
  /** True when the layout has a stored position (ED-11). */
  readonly pinned: boolean;
  /** True when a container's size was set by hand (ED-13). */
  readonly sized: boolean;
  readonly depth: number;
  readonly z: number;
  /** Stable document order, used to break z ties. */
  readonly order: number;
}

export interface LayoutResult {
  readonly elements: ReadonlyMap<string, PlacedElement>;
  /** Icon tiles of components (connections attach here). */
  readonly tiles: ReadonlyMap<string, Box>;
  /** Dashed group outlines (ED-15). */
  readonly groups: ReadonlyMap<string, Box>;
  /** Children per parent (`null` = canvas), in document order. */
  readonly children: ReadonlyMap<string | null, readonly string[]>;
  readonly bounds: Box;
}

export interface LayoutOverrides {
  /** Container sizes while a resize gesture is in progress (grid units). */
  readonly sizes?: ReadonlyMap<string, GridSize>;
  /** Positions relative to the parent while a resize or nudge is previewed (grid units). */
  readonly positions?: ReadonlyMap<string, GridPoint>;
  /** Pixel translation of elements (and their contents) while a drag is in progress. */
  readonly translate?: {
    readonly names: ReadonlySet<string>;
    readonly dx: number;
    readonly dy: number;
  };
}

const TEXT_SIZES: Readonly<Record<TextStyle, number>> = {
  title: 28,
  heading: 20,
  body: 14,
  caption: 12,
};

/** Line height of free text and notes, as a multiple of the font size. */
export const TEXT_LINE_HEIGHT = 1.4;

export function textStyleSize(style: TextStyle): number {
  return TEXT_SIZES[style];
}

/** Size of a decoration in grid units. Text sizes are estimates (rendering measures exactly). */
export function decorationSize(decoration: Decoration): GridSize {
  switch (decoration.variant) {
    case "zone":
      return decoration.size;
    case "label":
      return { w: Math.max(4, Math.ceil((estimateTextWidth(decoration.text, 12) + 24) / 8)), h: 3 };
    case "note":
      return decoration.size;
    case "text": {
      const fontSize = decoration.look.fontSize ?? TEXT_SIZES[decoration.style];
      const lines = decoration.text.split("\n");
      const widest = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)));
      return {
        w: Math.max(2, Math.ceil(widest / 8)),
        h: Math.max(2, Math.ceil((fontSize * TEXT_LINE_HEIGHT * lines.length) / 8)),
      };
    }
  }
}

interface Node {
  readonly name: string;
  readonly kind: PlacedKind;
  readonly parent: string | null;
  readonly order: number;
}

/**
 * Computes every element's position and size. Containers size themselves to their children plus
 * padding unless resized by hand (ED-13); unpinned elements are placed automatically in reading
 * order of the traffic (ED-11): sources left, destinations right.
 */
export function computeLayout(diagram: Diagram, overrides: LayoutOverrides = {}): LayoutResult {
  const nodes = new Map<string, Node>();
  const children = new Map<string | null, string[]>([[null, []]]);
  let order = 0;
  const addNode = (name: string, kind: PlacedKind, parent: string | null): void => {
    nodes.set(name, { name, kind, parent, order: order++ });
    const list = children.get(parent) ?? [];
    list.push(name);
    children.set(parent, list);
  };
  for (const container of diagram.containers.values())
    addNode(container.name, "container", container.parent);
  for (const component of diagram.components.values())
    addNode(component.name, "component", component.parent);
  for (const decoration of diagram.decorations.values())
    addNode(decoration.name, "decoration", decoration.parent);

  const siblingEdges = buildSiblingEdges(diagram, nodes);
  const rel = new Map<string, GridPoint>();
  const sizes = new Map<string, GridSize>();
  const pinned = new Set<string>();
  const sized = new Set<string>();

  const sizeOf = (name: string): GridSize =>
    sizes.get(name) ?? { w: COMPONENT_UNITS.w, h: COMPONENT_UNITS.h };

  /** Sizes and places the children of `parent` (positions in grid units, relative to it). */
  const placeChildren = (parent: string | null): void => {
    const kids = children.get(parent) ?? [];
    for (const kid of kids) {
      const node = nodes.get(kid);
      if (node?.kind === "container") {
        placeChildren(kid);
        sizes.set(kid, containerSize(kid));
      } else if (node?.kind === "decoration") {
        const decoration = diagram.decorations.get(kid);
        if (decoration !== undefined) sizes.set(kid, decorationSize(decoration));
      } else {
        sizes.set(kid, { w: COMPONENT_UNITS.w, h: COMPONENT_UNITS.h });
      }
    }

    const origin: GridPoint =
      parent === null
        ? { x: 0, y: 0 }
        : { x: CONTAINER_UNITS.padding, y: CONTAINER_UNITS.header + CONTAINER_UNITS.padding };
    const unpinned: string[] = [];
    let pinnedBottom = -Infinity;
    for (const kid of kids) {
      const decoration = diagram.decorations.get(kid);
      const at =
        overrides.positions?.get(kid) ?? decoration?.at ?? diagram.layout.get(kid)?.at ?? null;
      if (at !== null) {
        rel.set(kid, at);
        pinned.add(kid);
        pinnedBottom = Math.max(pinnedBottom, at.y + sizeOf(kid).h);
      } else {
        unpinned.push(kid);
      }
    }
    if (unpinned.length === 0) return;

    const start: GridPoint = {
      x: origin.x,
      y: Number.isFinite(pinnedBottom)
        ? Math.max(origin.y, pinnedBottom + PLACEMENT_UNITS.gapY)
        : origin.y,
    };
    const layers = assignLayers(unpinned, siblingEdges.get(parent) ?? new Map());
    let x = start.x;
    for (const layer of layers) {
      let y = start.y;
      let widest = 0;
      for (const name of layer) {
        const size = sizeOf(name);
        rel.set(name, { x, y });
        y += size.h + PLACEMENT_UNITS.gapY;
        widest = Math.max(widest, size.w);
      }
      x += widest + PLACEMENT_UNITS.gapX;
    }
  };

  const containerSize = (name: string): GridSize => {
    const container = diagram.containers.get(name);
    let w: number = CONTAINER_UNITS.minW;
    let h: number = CONTAINER_UNITS.minH;
    if (container !== undefined) {
      w = Math.max(w, Math.ceil((estimateTextWidth(container.label, 13) + 64) / 8));
    }
    for (const kid of children.get(name) ?? []) {
      const at = rel.get(kid);
      if (at === undefined) continue;
      const size = sizeOf(kid);
      w = Math.max(w, at.x + size.w + CONTAINER_UNITS.padding);
      h = Math.max(h, at.y + size.h + CONTAINER_UNITS.padding);
    }
    const manual = overrides.sizes?.get(name) ?? diagram.layout.get(name)?.size ?? null;
    if (manual !== null) {
      sized.add(name);
      return { w: Math.max(w, manual.w), h: Math.max(h, manual.h) };
    }
    return { w, h };
  };

  placeChildren(null);

  // Absolute pixel boxes, top-down.
  const elements = new Map<string, PlacedElement>();
  const tiles = new Map<string, Box>();
  const visit = (parent: string | null, originX: number, originY: number, depth: number): void => {
    for (const name of children.get(parent) ?? []) {
      const node = nodes.get(name);
      const at = rel.get(name);
      if (node === undefined || at === undefined) continue;
      const size = sizeOf(name);
      const box: Box = {
        x: originX + toPx(at.x),
        y: originY + toPx(at.y),
        w: toPx(size.w),
        h: toPx(size.h),
      };
      const z =
        node.kind === "decoration"
          ? (diagram.decorations.get(name)?.z ?? 0)
          : (diagram.layout.get(name)?.z ?? 0);
      elements.set(name, {
        name,
        kind: node.kind,
        parent,
        box,
        rel: at,
        size,
        pinned: pinned.has(name),
        sized: sized.has(name),
        depth,
        z,
        order: node.order,
      });
      if (node.kind === "component") tiles.set(name, tileOf(box));
      if (node.kind === "container") visit(name, box.x, box.y, depth + 1);
    }
  };
  visit(null, 0, 0, 0);

  if (overrides.translate !== undefined)
    applyTranslation(elements, tiles, children, overrides.translate);

  const groups = new Map<string, Box>();
  for (const group of diagram.groups.values()) {
    const box = union(
      group.members
        .map((member) => elements.get(member)?.box)
        .filter((b): b is Box => b !== undefined),
    );
    if (box !== null) groups.set(group.name, inflate(box, GROUP_PADDING));
  }

  const bounds = union([...[...elements.values()].map((e) => e.box), ...groups.values()]) ?? {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  return { elements, tiles, groups, children, bounds };
}

function applyTranslation(
  elements: Map<string, PlacedElement>,
  tiles: Map<string, Box>,
  children: ReadonlyMap<string | null, readonly string[]>,
  move: NonNullable<LayoutOverrides["translate"]>,
): void {
  const moved = new Set<string>();
  const collect = (name: string): void => {
    if (moved.has(name)) return;
    moved.add(name);
    for (const kid of children.get(name) ?? []) collect(kid);
  };
  for (const name of move.names) collect(name);
  for (const name of moved) {
    const element = elements.get(name);
    if (element === undefined) continue;
    elements.set(name, { ...element, box: translate(element.box, move.dx, move.dy) });
    const tile = tiles.get(name);
    if (tile !== undefined) tiles.set(name, translate(tile, move.dx, move.dy));
  }
}

/**
 * For each parent, edges between its direct children derived from connections between anything
 * inside them. Used to order auto-placement left to right along the traffic.
 */
function buildSiblingEdges(
  diagram: Diagram,
  nodes: ReadonlyMap<string, Node>,
): Map<string | null, Map<string, Set<string>>> {
  const chain = (name: string): string[] => {
    const out: string[] = [];
    let current: string | null = name;
    const guard = new Set<string>();
    while (current !== null && !guard.has(current)) {
      guard.add(current);
      out.push(current);
      current = nodes.get(current)?.parent ?? null;
    }
    return out;
  };
  const edges = new Map<string | null, Map<string, Set<string>>>();
  for (const connection of diagram.connections.values()) {
    if (!nodes.has(connection.from.element) || !nodes.has(connection.to.element)) continue;
    const fromChain = chain(connection.from.element);
    const toChain = chain(connection.to.element);
    // Find the closest common parent, then the two siblings just below it.
    const toSet = new Set(toChain);
    let common: string | null = null;
    let fromSibling: string | undefined = fromChain[fromChain.length - 1];
    for (let i = 0; i < fromChain.length; i++) {
      const name = fromChain[i];
      if (name !== undefined && toSet.has(name)) {
        common = name;
        fromSibling = fromChain[i - 1];
        break;
      }
    }
    const toSibling =
      common === null ? toChain[toChain.length - 1] : toChain[toChain.indexOf(common) - 1];
    if (fromSibling === undefined || toSibling === undefined || fromSibling === toSibling) continue;
    const parentEdges = edges.get(common) ?? new Map<string, Set<string>>();
    const targets = parentEdges.get(fromSibling) ?? new Set<string>();
    targets.add(toSibling);
    parentEdges.set(fromSibling, targets);
    edges.set(common, parentEdges);
  }
  return edges;
}

/** Longest-path layering (cycles broken by visiting order); unconnected elements share layer 0. */
function assignLayers(
  names: readonly string[],
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  const members = new Set(names);
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (name: string): number => {
    const known = layer.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    let depth = 0;
    for (const [source, targets] of edges) {
      if (targets.has(name) && members.has(source)) depth = Math.max(depth, depthOf(source) + 1);
    }
    visiting.delete(name);
    layer.set(name, depth);
    return depth;
  };
  const layers: string[][] = [];
  for (const name of names) {
    const depth = depthOf(name);
    (layers[depth] ??= []).push(name);
  }
  return layers.filter((group) => group.length > 0);
}

/** Render order within each layer: z first, then document order (ED-23). */
export function byZThenOrder(a: PlacedElement, b: PlacedElement): number {
  return a.z - b.z || a.order - b.order;
}

/** Containers back-to-front: parents before children, siblings by z. */
export function containerRenderOrder(layout: LayoutResult): PlacedElement[] {
  const out: PlacedElement[] = [];
  const walk = (parent: string | null): void => {
    const kids = (layout.children.get(parent) ?? [])
      .map((name) => layout.elements.get(name))
      .filter((e): e is PlacedElement => e?.kind === "container")
      .sort(byZThenOrder);
    for (const kid of kids) {
      out.push(kid);
      walk(kid.name);
    }
  };
  walk(null);
  return out;
}

export function ancestorsOf(layout: LayoutResult, name: string): string[] {
  const out: string[] = [];
  let current = layout.elements.get(name)?.parent ?? null;
  while (current !== null && !out.includes(current)) {
    out.push(current);
    current = layout.elements.get(current)?.parent ?? null;
  }
  return out;
}

export function descendantsOf(layout: LayoutResult, name: string): string[] {
  const out: string[] = [];
  const walk = (parent: string): void => {
    for (const kid of layout.children.get(parent) ?? []) {
      out.push(kid);
      walk(kid);
    }
  };
  walk(name);
  return out;
}
