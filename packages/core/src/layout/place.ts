import { contentSize } from "./media";
import type { Component, Container, Decoration, Diagram, GridSize } from "../model/types";
import { cursorAtStep, pictureAt, sceneMoment } from "../picture";
import { SHAPE_INFO } from "../presets/shapes";
import { decorationSize } from "./decorations";
import { COMPONENT_UNITS, tileOf, toPx, type Box, type Point } from "./geometry";

/**
 * Things a layout places (D-87): the children of a container with `layout:` (a row, a column, a
 * grid), and things that ride `on:` something else. They have no position of their own: where
 * they are follows from where they've been put, which a story can change.
 *
 * Everything else is placed once, for the diagram as written (`computeLayout`), so nothing
 * unrelated shifts as these come, go and move.
 */

/** A container that arranges its contents draws less of itself: a small title, a thin margin. */
export const TRAY_UNITS = { header: 3, padding: 2 } as const;
/** Space between a rider and what it rides on, in px. */
export const RIDER_GAP = 6;

/** Whether a container arranges what's in it. */
export function arranges(container: Container | undefined): boolean {
  return container?.layout != null;
}

/** Whether a layout places this component: it's in a container that arranges it, or rides. */
export function isPlacedComponent(diagram: Diagram, component: Component): boolean {
  if (component.on !== null) return true;
  return component.parent !== null && arranges(diagram.containers.get(component.parent));
}

/** Whether a layout places `name` (a component in a row, column or grid, or anything riding). */
export function isPlaced(diagram: Diagram, name: string): boolean {
  const component = diagram.components.get(name);
  if (component !== undefined) return isPlacedComponent(diagram, component);
  const decoration = diagram.decorations.get(name);
  return (
    decoration !== undefined &&
    (decoration.on !== null ||
      (decoration.parent !== null && arranges(diagram.containers.get(decoration.parent))))
  );
}

/** A placed component's size in grid units: a shape's own (or the one it copies), an icon's footprint. */
export function placedSize(diagram: Diagram, component: Component): GridSize {
  if (component.shape === null) return { w: COMPONENT_UNITS.w, h: COMPONENT_UNITS.h };
  const seen = new Set<string>();
  for (let at: Component | undefined = component; at !== undefined && !seen.has(at.name);) {
    seen.add(at.name);
    const size = diagram.layout.get(at.name)?.size ?? null;
    if (size !== null) return size;
    at = at.like === null ? undefined : diagram.components.get(at.like);
  }
  return contentSize(component) ?? { ...SHAPE_INFO[component.shape].size };
}

/** The room a container with a layout keeps: for the most it ever holds, in any story or scene. */
export interface Room {
  readonly columns: number;
  readonly rows: number;
  /** One cell: the largest thing it ever holds, in grid units. */
  readonly cell: GridSize;
}

const rooms = new WeakMap<Diagram, ReadonlyMap<string, Room>>();

/**
 * How much room each container with a layout keeps (D-87): enough for the most it holds at the
 * opening, after any step of any story, or in any scene. Like a scale set's room for its most
 * copies, it's there from the start, so the container never resizes.
 */
export function layoutRooms(diagram: Diagram): ReadonlyMap<string, Room> {
  const known = rooms.get(diagram);
  if (known !== undefined) return known;
  const most = new Map<
    string,
    { count: number; column: number; row: number; w: number; h: number }
  >();
  const look = (shown: Diagram): void => {
    const here = new Map<string, { count: number; column: number; row: number }>();
    for (const component of [...shown.components.values(), ...shown.decorations.values()]) {
      if (component.on !== null || component.parent === null) continue;
      const container = shown.containers.get(component.parent);
      if (container?.layout == null) continue;
      const tally = here.get(container.name) ?? { count: 0, column: 0, row: 0 };
      tally.count++;
      if (component.kind === "component" && component.cell !== null) {
        tally.column = Math.max(tally.column, component.cell.x + 1);
        tally.row = Math.max(tally.row, component.cell.y + 1);
      }
      here.set(container.name, tally);
      const size =
        component.kind === "component" ? placedSize(diagram, component) : decorationSize(component);
      const all = most.get(container.name) ?? { count: 0, column: 0, row: 0, w: 0, h: 0 };
      all.w = Math.max(all.w, size.w);
      all.h = Math.max(all.h, size.h);
      most.set(container.name, all);
    }
    for (const [name, tally] of here) {
      const all = most.get(name);
      if (all === undefined) continue;
      all.count = Math.max(all.count, tally.count);
      all.column = Math.max(all.column, tally.column);
      all.row = Math.max(all.row, tally.row);
    }
  };
  look(pictureAt(diagram, null).diagram);
  for (const scene of diagram.scenes) look(pictureAt(diagram, sceneMoment(scene.name)).diagram);
  for (const story of diagram.stories)
    story.steps.forEach((_, index) => {
      const cursor = cursorAtStep(diagram, { story: story.name, index });
      look(pictureAt(diagram, { scene: null, story: cursor }).diagram);
    });

  const out = new Map<string, Room>();
  for (const container of diagram.containers.values()) {
    if (container.layout === null) continue;
    const all = most.get(container.name);
    const count = Math.max(1, all?.count ?? 0);
    const cell = { w: all?.w ?? COMPONENT_UNITS.w, h: all?.h ?? Math.round(COMPONENT_UNITS.h / 2) };
    let columns = 1;
    let rows = 1;
    if (container.layout.kind === "row") columns = count;
    else if (container.layout.kind === "column") rows = count;
    else {
      // A grid: its written cells, or as many columns as asked, or a block as square as it can be.
      const cells = all?.column ?? 0;
      columns = Math.max(
        cells,
        container.layout.columns ?? (cells > 0 ? cells : Math.ceil(Math.sqrt(count))),
      );
      rows = Math.max(all?.row ?? 0, Math.ceil(count / columns));
    }
    out.set(container.name, { columns, rows, cell });
  }
  rooms.set(diagram, out);
  return out;
}

/** The size a container with a layout takes, in grid units: its room, a title and a thin margin. */
export function traySize(container: Container, room: Room): GridSize {
  const gap = container.layout?.gap ?? 0;
  return {
    w: Math.ceil(TRAY_UNITS.padding * 2 + room.columns * room.cell.w + (room.columns - 1) * gap),
    h: Math.ceil(
      TRAY_UNITS.header + TRAY_UNITS.padding * 2 + room.rows * room.cell.h + (room.rows - 1) * gap,
    ),
  };
}

/** Where something placed by a layout is, in px. */
export interface Placement {
  readonly name: string;
  readonly kind: "component" | "decoration";
  readonly box: Box;
  /** The container it's in, if any (what it rides on isn't its parent). */
  readonly parent: string | null;
}

export interface PlaceInput {
  /** The diagram as written: sizes, room and order come from it. */
  readonly written: Diagram;
  /** The diagram as it stands (a picture's): who is where now. Left out: as written. */
  readonly shown?: Diagram;
  /** Things that aren't there now: they take no slot (an editor still draws them, after the rest). */
  readonly absent?: ReadonlySet<string>;
  /** Boxes of everything placed freely, and of containers. */
  readonly boxOf: (name: string) => Box | null;
  /** Where a connection runs, for things that ride on one; left out, they're left unplaced. */
  readonly pointOn?: (connection: string, along: number) => Point | null;
  /** A decoration's size in grid units. */
  readonly decorationSize: (decoration: Decoration) => GridSize;
}

/**
 * Places everything a layout places: the contents of rows, columns and grids, in file order,
 * closing up when something isn't there; then riders, beside what they ride on.
 */
export function placeAll(input: PlaceInput): Map<string, Placement> {
  const { written } = input;
  const shown = input.shown ?? written;
  const absent = input.absent ?? new Set<string>();
  const roomOf = layoutRooms(written);
  const out = new Map<string, Placement>();
  // File order is order: of the diagram as written, however the picture's maps were built.
  const order = new Map(
    [...written.components.keys(), ...written.decorations.keys()].map((name, index) => [
      name,
      index,
    ]),
  );
  const inOrder = <T extends { readonly name: string }>(items: T[]): T[] =>
    items.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));

  // 1. Rows, columns and grids.
  for (const container of shown.containers.values()) {
    const layout = container.layout;
    const room = roomOf.get(container.name);
    const frame = input.boxOf(container.name);
    if (layout === null || room === undefined || frame === null) continue;
    const members = inOrder(
      [...shown.components.values(), ...shown.decorations.values()].filter(
        (component) => component.parent === container.name && component.on === null,
      ),
    );
    // What's there takes the slots; what isn't is drawn (by an editor) after it.
    const here = [
      ...members.filter((member) => !absent.has(member.name)),
      ...members.filter((member) => absent.has(member.name)),
    ];
    const cellW = toPx(room.cell.w);
    const cellH = toPx(room.cell.h);
    const gap = toPx(layout.gap);
    const origin = {
      x: frame.x + toPx(TRAY_UNITS.padding),
      y: frame.y + toPx(TRAY_UNITS.header + TRAY_UNITS.padding),
    };
    const taken = new Set<string>();
    const cellOf = new Map<string, Point>();
    if (layout.kind === "grid")
      for (const member of here)
        if (member.kind === "component" && member.cell !== null) {
          cellOf.set(member.name, member.cell);
          taken.add(`${member.cell.x},${member.cell.y}`);
        }
    let next = 0;
    for (const member of here) {
      let cell = cellOf.get(member.name);
      if (cell === undefined) {
        if (layout.kind === "row") cell = { x: next++, y: 0 };
        else if (layout.kind === "column") cell = { x: 0, y: next++ };
        else {
          // The next free cell, a row at a time.
          for (;;) {
            const candidate = { x: next % room.columns, y: Math.floor(next / room.columns) };
            next++;
            if (!taken.has(`${candidate.x},${candidate.y}`)) {
              cell = candidate;
              break;
            }
          }
        }
      }
      const size =
        member.kind === "component" ? placedSize(written, member) : input.decorationSize(member);
      const w = toPx(size.w);
      const h = toPx(size.h);
      out.set(member.name, {
        name: member.name,
        kind: member.kind,
        parent: container.name,
        box: {
          x: origin.x + cell.x * (cellW + gap) + (cellW - w) / 2,
          y: origin.y + cell.y * (cellH + gap) + (cellH - h) / 2,
          w,
          h,
        },
      });
    }
  }

  // 2. Riders: above what they ride on, the first one closest; on an arrow, on its line.
  const boxOf = (name: string): Box | null => {
    const placed = out.get(name);
    if (placed !== undefined) {
      const component = shown.components.get(name);
      return component !== undefined && component.shape === null ? tileOf(placed.box) : placed.box;
    }
    return input.boxOf(name);
  };
  const riders: (Component | Decoration)[] = [
    ...inOrder([...shown.components.values()].filter((component) => component.on !== null)),
    ...[...shown.decorations.values()].filter((decoration) => decoration.on !== null),
  ];
  const stacked = new Map<string, number>();
  // A rider can ride on a rider: place those whose host is known, until none are left.
  for (let pass = 0, waiting = riders; waiting.length > 0 && pass < 16; pass++) {
    const later: (Component | Decoration)[] = [];
    for (const rider of waiting) {
      const host = rider.on;
      if (host === null) continue;
      const size =
        rider.kind === "component" ? placedSize(written, rider) : input.decorationSize(rider);
      const w = toPx(size.w);
      const h = toPx(size.h);
      const parent = rider.kind === "component" ? rider.parent : null;
      if (shown.connections.has(host)) {
        const at = input.pointOn?.(host, rider.along ?? 0.5) ?? null;
        if (at !== null)
          out.set(rider.name, {
            name: rider.name,
            kind: rider.kind,
            parent,
            box: { x: at.x - w / 2, y: at.y - h / 2, w, h },
          });
        continue;
      }
      // Its host rides too and hasn't been placed yet: wait for it.
      if (riders.some((other) => other.name === host) && !out.has(host)) {
        later.push(rider);
        continue;
      }
      const under = boxOf(host);
      if (under === null) continue;
      const lift = stacked.get(host) ?? 0;
      stacked.set(host, lift + h + RIDER_GAP);
      out.set(rider.name, {
        name: rider.name,
        kind: rider.kind,
        parent,
        box: { x: under.x + under.w / 2 - w / 2, y: under.y - RIDER_GAP - h - lift, w, h },
      });
    }
    waiting = later;
  }
  return out;
}
