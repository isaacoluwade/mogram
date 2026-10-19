import type { YAMLMap } from "yaml";
import { Scalar, isScalar, type Node } from "yaml";
import type {
  ConnectionLabelPlace,
  Diagram,
  GridPoint,
  ProjectFiles,
  RouteStyle,
} from "../model/types";
import {
  DEFAULT_ARROW_SIZE,
  DEFAULT_LINE_WIDTH,
  anchorName,
  defaultArrows,
  type Anchor,
  type ArrowEnds,
  type CornerStyle,
  type JumpStyle,
  type LinePattern,
} from "../presets/connectors";
import { computeLayout } from "../layout/compute";
import { GRID, type Point } from "../layout/geometry";
import { centreOf } from "../routing/anchors";
import { nearestSegment, toGridVia } from "../routing/edit-path";
import { endpointBox, routeConnections, viaOrigin } from "../routing/route";
import { edit, type EditContext, type EditResult } from "./context";
import { EditError, flowMap, flowSeq } from "./session";

/**
 * Connection commands (ED-29): how a connection looks (arrowheads, line, width, corners, jumps)
 * and its geometry (waypoints, fixed anchors, label place), reconnecting an end and reversing.
 * Looks are written on the connection; geometry in its layout entry. Defaults are never written.
 */

export interface ConnectionLook {
  readonly arrows?: Partial<ArrowEnds>;
  readonly arrowSize?: Partial<{ readonly start: number; readonly end: number }>;
  readonly line?: LinePattern;
  /** A custom dash pattern in px; `null` clears it back to `line`. */
  readonly dash?: readonly number[] | null;
  readonly width?: number;
  readonly corners?: CornerStyle;
  readonly jumps?: JumpStyle;
}

function requireConnection(ctx: EditContext, name: string) {
  const connection = ctx.diagram.connections.get(name);
  if (connection === undefined) throw new EditError(`"${name}" isn't a connection.`);
  return connection;
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Sets how connections look; several connections get the same values in one edit. */
export function setConnectionLook(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly look: ConnectionLook },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const { look } = args;
    for (const name of args.names) {
      const connection = requireConnection(ctx, name);
      const map = ctx.definition(name);

      if (look.arrows !== undefined) {
        const next = { ...connection.arrows, ...look.arrows };
        const implied = defaultArrows(connection.direction);
        if (next.start === implied.start && next.end === implied.end) map.delete("arrows");
        else if (next.start === implied.start) map.set("arrows", next.end);
        else
          map.set(
            "arrows",
            flowMap([
              ["start", next.start],
              ["end", next.end],
            ]),
          );
      }

      if (look.arrowSize !== undefined) {
        const next = { ...connection.arrowSize, ...look.arrowSize };
        const start = round(next.start, 1);
        const end = round(next.end, 1);
        if (start === DEFAULT_ARROW_SIZE && end === DEFAULT_ARROW_SIZE) map.delete("arrow_size");
        else if (start === end) map.set("arrow_size", start);
        else
          map.set(
            "arrow_size",
            flowMap([
              ["start", start],
              ["end", end],
            ]),
          );
      }

      if (look.dash !== undefined && look.dash !== null && look.dash.length >= 2) {
        map.set("line", flowSeq(look.dash.map((v) => round(v, 1))));
      } else if (look.line !== undefined) {
        if (look.line === "solid") map.delete("line");
        else map.set("line", look.line);
      } else if (look.dash === null) {
        map.delete("line");
      }

      if (look.width !== undefined) {
        const width = round(look.width, 1);
        if (width === DEFAULT_LINE_WIDTH) map.delete("width");
        else map.set("width", width);
      }
      if (look.corners !== undefined) {
        if (look.corners === "rounded") map.delete("corners");
        else map.set("corners", look.corners);
      }
      if (look.jumps !== undefined) {
        if (look.jumps === "none") map.delete("jumps");
        else map.set("jumps", look.jumps);
      }
    }
    return [...args.names];
  });
}

function anchorNode(anchor: Anchor): Node | string {
  return anchorName(anchor) ?? flowSeq([round(anchor.x, 3), round(anchor.y, 3)]);
}

function labelNode(place: ConnectionLabelPlace): Node | number {
  const at = round(place.at);
  const offset = round(place.offset, 1);
  if (offset === 0) return at;
  return flowMap([
    ["at", at],
    ["offset", offset],
  ]);
}

export interface ConnectionGeometry {
  /** Waypoints in grid units (relative to the connection's origin); `null` = automatic path. */
  readonly via?: readonly GridPoint[] | null;
  /** Fixed points; `null` = floating. */
  readonly fromAnchor?: Anchor | null;
  readonly toAnchor?: Anchor | null;
  /** `null` = placed automatically. */
  readonly label?: ConnectionLabelPlace | null;
}

function writeGeometry(ctx: EditContext, name: string, geometry: ConnectionGeometry): void {
  if (geometry.via !== undefined) {
    ctx.setVia(
      name,
      geometry.via === null
        ? null
        : geometry.via.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    );
  }
  const set = (
    field: "from_anchor" | "to_anchor" | "label",
    value: Node | string | number | undefined,
  ) => {
    ctx.setLayoutField(
      name,
      field,
      value === undefined ? undefined : typeof value === "object" ? value : new Scalar(value),
    );
  };
  if (geometry.fromAnchor !== undefined)
    set("from_anchor", geometry.fromAnchor === null ? undefined : anchorNode(geometry.fromAnchor));
  if (geometry.toAnchor !== undefined)
    set("to_anchor", geometry.toAnchor === null ? undefined : anchorNode(geometry.toAnchor));
  if (geometry.label !== undefined)
    set("label", geometry.label === null ? undefined : labelNode(geometry.label));
}

/** Sets a connection's waypoints, anchors and label place (only the fields given change). */
export function setConnectionGeometry(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string } & ConnectionGeometry,
): EditResult {
  return edit(files, diagram, (ctx) => {
    requireConnection(ctx, args.name);
    writeGeometry(ctx, args.name, args);
    return [args.name];
  });
}

/**
 * Attaches one end of a connection to another element (dragging an end handle). `copy` leaves
 * the original alone and adds a copy attached to the new element (Ctrl/Cmd while dropping).
 * Waypoints are kept.
 */
export function reconnectConnection(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    readonly name: string;
    readonly end: "from" | "to";
    /** The element, or a nested diagram's port (`aks.web`). */
    readonly endpoint: string;
    readonly anchor: Anchor | null;
    readonly copy?: boolean;
  },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const connection = requireConnection(ctx, args.name);
    const element = args.endpoint.split(".")[0] ?? "";
    const kind = ctx.kindOf(element);
    if (kind !== "component" && kind !== "container")
      throw new EditError(`Connections join components or containers, and "${element}" isn't one.`);
    const other = args.end === "from" ? connection.to.element : connection.from.element;
    if (element === other) throw new EditError("A connection needs two different ends.");

    let name = args.name;
    let map = ctx.definition(args.name);
    if (args.copy === true) {
      const fromElement = args.end === "from" ? element : connection.from.element;
      const toElement = args.end === "to" ? element : connection.to.element;
      name = ctx.claimName(`${fromElement}_to_${toElement}`);
      map = map.clone() as YAMLMap;
      ctx.session.section(ctx.fileOf(args.name), "connections").set(name, map);
      const layout = diagram.layout.get(args.name);
      if (layout?.via != null && layout.via.length > 0) ctx.setVia(name, layout.via);
      const kept = args.end === "from" ? layout?.toAnchor : layout?.fromAnchor;
      if (kept != null)
        writeGeometry(ctx, name, args.end === "from" ? { toAnchor: kept } : { fromAnchor: kept });
    }
    map.set(args.end, args.endpoint);
    writeGeometry(
      ctx,
      name,
      args.end === "from" ? { fromAnchor: args.anchor } : { toAnchor: args.anchor },
    );
    return [name];
  });
}

/**
 * Reverses a connection: its ends swap, and so do its waypoints, anchors and label place, so the
 * line keeps its shape while its flow — and the arrowheads that go with `start` and `end` —
 * now run the other way.
 */
export function reverseConnection(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[] },
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      const connection = requireConnection(ctx, name);
      const map = ctx.definition(name);
      const from = map.get("from", true) as Node | undefined;
      const to = map.get("to", true) as Node | undefined;
      const fromText = isScalar(from) ? String(from.value) : connection.from.element;
      const toText = isScalar(to) ? String(to.value) : connection.to.element;
      map.set("from", toText);
      map.set("to", fromText);
      const layout = diagram.layout.get(name);
      if (layout === undefined) continue;
      writeGeometry(ctx, name, {
        ...(layout.via !== null && layout.via.length > 0 ? { via: [...layout.via].reverse() } : {}),
        fromAnchor: layout.toAnchor,
        toAnchor: layout.fromAnchor,
        ...(layout.label !== null
          ? { label: { at: 1 - layout.label.at, offset: -layout.label.offset } }
          : {}),
      });
    }
    return [...args.names];
  });
}

/**
 * Changes how connections are routed. Waypoints belong to a route style (an orthogonal line's
 * corners make no sense on a curve), so they are cleared; the label keeps its place.
 */
export function setConnectionRoute(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly route: RouteStyle },
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      const connection = requireConnection(ctx, name);
      if (connection.route === args.route) continue;
      const map = ctx.definition(name);
      if (args.route === "orthogonal") map.delete("route");
      else map.set("route", args.route);
      if ((diagram.layout.get(name)?.via?.length ?? 0) > 0) ctx.setVia(name, null);
    }
    return [...args.names];
  });
}

/** Removes waypoints and fixed anchors: the connection is routed automatically again. */
export function resetConnectionPath(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly anchors?: boolean },
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      requireConnection(ctx, name);
      writeGeometry(ctx, name, {
        via: null,
        ...(args.anchors === true ? { fromAnchor: null, toAnchor: null } : {}),
      });
    }
    return [...args.names];
  });
}

/**
 * Splits a connection around an element dropped on it (ED-29, 02-connectors §12): the
 * connection now ends at `element`, and a copy of it (same look and flow, no label or card)
 * carries on from `element` to the original target. Bends before the drop point stay with the
 * first part, those after go to the second, and any under the element are dropped.
 */
export function splitConnection(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly element: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const connection = requireConnection(ctx, args.name);
    const kind = ctx.kindOf(args.element);
    if (kind !== "component" && kind !== "container")
      throw new EditError(
        `Connections join components or containers, and "${args.element}" isn't one.`,
      );
    if (connection.from.element === args.element || connection.to.element === args.element)
      throw new EditError("That connection already ends there.");

    const map = ctx.definition(args.name);
    const toNode = map.get("to", true) as Node | undefined;
    const toText = isScalar(toNode) ? String(toNode.value) : connection.to.element;
    const second = ctx.claimName(`${args.element}_to_${connection.to.element}`);
    const copy = map.clone() as YAMLMap;
    copy.delete("label");
    copy.delete("card");
    copy.set("from", args.element);
    copy.set("to", toText);
    ctx.session.section(ctx.fileOf(args.name), "connections").set(second, copy);
    map.set("to", args.element);

    const entry = diagram.layout.get(args.name);
    const parts = splitBends(diagram, args.name, args.element);
    writeGeometry(ctx, args.name, { via: parts.first, toAnchor: null });
    writeGeometry(ctx, second, {
      via: parts.second,
      ...(entry?.toAnchor != null ? { toAnchor: entry.toAnchor } : {}),
    });
    return [args.element];
  });
}

/** The connection's bends on either side of `element`, in grid units for each part. */
function splitBends(
  diagram: Diagram,
  name: string,
  element: string,
): { first: GridPoint[] | null; second: GridPoint[] | null } {
  const stored = diagram.layout.get(name)?.via;
  const connection = diagram.connections.get(name);
  if (stored == null || stored.length === 0 || connection === undefined)
    return { first: null, second: null };
  const layout = computeLayout(diagram);
  const box = endpointBox(layout, element);
  const route = routeConnections(diagram, layout).get(name);
  if (box === null || route === undefined) return { first: null, second: null };
  const through = route.through;
  const { index } = nearestSegment(through, centreOf(box));
  const outside = (p: Point): boolean =>
    p.x < box.x - GRID ||
    p.x > box.x + box.w + GRID ||
    p.y < box.y - GRID ||
    p.y > box.y + box.h + GRID;
  const part = (points: readonly Point[], from: string, to: string): GridPoint[] | null => {
    const kept = points.filter(outside);
    if (kept.length === 0) return null;
    const origin = viaOrigin(layout, {
      ...connection,
      from: { element: from, port: null, part: null },
      to: { element: to, port: null, part: null },
    });
    return toGridVia(kept, origin);
  };
  return {
    first: part(through.slice(1, index + 1), connection.from.element, element),
    second: part(through.slice(index + 1, -1), element, connection.to.element),
  };
}
