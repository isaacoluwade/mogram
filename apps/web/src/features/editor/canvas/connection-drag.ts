import {
  reconnectConnection,
  setConnectionGeometry,
  type ConnectionGeometry,
} from "@mogram/core/edit";
import { GRID, computeLayout, type Box, type LayoutResult, type Point } from "@mogram/core/layout";
import type { ConnectionLabelPlace, Diagram } from "@mogram/core/model";
import { BOX_ANCHORS, sameAnchor, type Anchor } from "@mogram/core/presets";
import {
  anchorPoint,
  bendingWaypoints,
  cornersOf,
  endpointBox,
  insertWaypoint,
  isHorizontalSegment,
  moveSegment,
  nearestAlong,
  nearestSegment,
  routeConnections,
  sameLine,
  snapToGrid,
  toGridVia,
  viaOrigin,
  type RoutedPath,
} from "@mogram/core/routing";
import type { EditorStore } from "../store/editor-store";
import { hitAt } from "./hit";

/**
 * Reshaping connections by hand (ED-18, ED-29), after draw.io's edge handlers
 * (docs/research/drawio/02-connectors.md §4–5): drag a waypoint or a faded "add" handle, slide
 * an orthogonal segment, drag an end to another element (onto one of its points to fix it
 * there), or drag the label along the line. Each drag previews through the store and commits
 * one edit on release.
 */
export type ConnectionDrag =
  | {
      readonly kind: "waypoint";
      readonly pointerId: number;
      readonly connection: string;
      readonly index: number;
      /** Waypoints in absolute px, as dragged so far. */
      via: Point[];
      readonly original: readonly Point[];
      readonly origin: Point;
      readonly handleStart: Point;
      readonly inserted: boolean;
    }
  | {
      readonly kind: "segment";
      readonly pointerId: number;
      readonly connection: string;
      readonly index: number;
      readonly points: readonly Point[];
      readonly start: Point;
      readonly origin: Point;
      /** The ends' boxes, so a moved end segment can step out of its side. */
      readonly ends: { readonly source: Box; readonly target: Box } | undefined;
      delta: number;
    }
  | {
      readonly kind: "end";
      readonly pointerId: number;
      readonly connection: string;
      readonly end: "from" | "to";
      target: string | null;
      anchor: Anchor | null;
    }
  | {
      readonly kind: "label";
      readonly pointerId: number;
      readonly connection: string;
      readonly route: RoutedPath;
      /** From the pointer to the label's centre, so the label doesn't jump to the pointer. */
      readonly grab: Point;
      place: ConnectionLabelPlace | null;
    };

/** Distance in screen px within which a press counts as on a connection's end. */
const END_REACH = 10;
/** Distance in screen px within which a dropped end snaps to a connection point. */
const ANCHOR_REACH = 12;

interface Context {
  readonly diagram: Diagram;
  readonly layout: LayoutResult;
  readonly route: RoutedPath;
}

function context(store: EditorStore, name: string, via?: readonly Point[]): Context | null {
  const diagram = store.getState().diagram();
  const layout = computeLayout(diagram);
  const route = routeConnections(
    diagram,
    layout,
    via === undefined ? {} : { via: new Map([[name, via]]) },
  ).get(name);
  return route === undefined ? null : { diagram, layout, route };
}

function endsOf(ctx: Context, name: string): { source: Box; target: Box } | undefined {
  const connection = ctx.diagram.connections.get(name);
  if (connection === undefined) return undefined;
  const source = endpointBox(ctx.layout, connection.from.element);
  const target = endpointBox(ctx.layout, connection.to.element);
  return source === null || target === null ? undefined : { source, target };
}

function originOf(ctx: Context, name: string): Point {
  const connection = ctx.diagram.connections.get(name);
  return connection === undefined ? { x: 0, y: 0 } : viaOrigin(ctx.layout, connection);
}

/** Starts dragging a handle of the selected connection. */
export function beginHandleDrag(
  store: EditorStore,
  pointerId: number,
  name: string,
  handle: Element,
  world: Point,
): ConnectionDrag | null {
  const kind = handle.getAttribute("data-handle");
  const index = Number(handle.getAttribute("data-index") ?? "0");
  if (kind === "end") {
    const end = handle.getAttribute("data-end") === "from" ? "from" : "to";
    return beginEnd(store, pointerId, name, end, world);
  }
  const ctx = context(store, name);
  if (ctx === null) return null;
  if (kind === "segment") return beginSegment(ctx, pointerId, name, index, world);
  if (kind === "waypoint" || kind === "add-waypoint") {
    const via = ctx.route.through.slice(1, -1);
    const origin = originOf(ctx, name);
    if (kind === "waypoint") {
      const point = via[index] ?? world;
      return {
        kind: "waypoint",
        pointerId,
        connection: name,
        index,
        via: [...via],
        original: via,
        origin,
        handleStart: point,
        inserted: false,
      };
    }
    const at = {
      x: Number(handle.getAttribute("data-x")),
      y: Number(handle.getAttribute("data-y")),
    };
    const point = snapToGrid(at, origin);
    return {
      kind: "waypoint",
      pointerId,
      connection: name,
      index,
      via: insertWaypoint(via, index, point),
      original: via,
      origin,
      handleStart: point,
      inserted: true,
    };
  }
  return null;
}

/**
 * Pressing a connection anywhere and dragging (draw.io's immediate editing): near an end it
 * reconnects that end, on the label it moves the label, on an orthogonal line it slides the
 * nearest segment, and on a straight or curved line it bends the line at that point.
 */
export function beginLineDrag(
  store: EditorStore,
  pointerId: number,
  name: string,
  press: Point,
  /** The label's centre when the press was on the label. */
  label: Point | null,
): ConnectionDrag | null {
  const ctx = context(store, name);
  if (ctx === null) return null;
  const zoom = store.getState().camera.zoom;
  if (label !== null) return beginLabel(ctx, pointerId, name, press, label);
  const through = ctx.route.through;
  const first = through[0];
  const last = through[through.length - 1];
  const near = (p: Point | undefined) =>
    p !== undefined && Math.hypot(p.x - press.x, p.y - press.y) <= END_REACH / zoom;
  if (near(first)) return beginEnd(store, pointerId, name, "from", press);
  if (near(last)) return beginEnd(store, pointerId, name, "to", press);
  const style = ctx.diagram.connections.get(name)?.route ?? "orthogonal";
  if (style === "orthogonal") {
    return beginSegment(ctx, pointerId, name, nearestSegment(ctx.route.points, press).index, press);
  }
  const via = through.slice(1, -1);
  const origin = originOf(ctx, name);
  const index = nearestSegment(through, press).index;
  const point = snapToGrid(press, origin);
  return {
    kind: "waypoint",
    pointerId,
    connection: name,
    index,
    via: insertWaypoint(via, index, point),
    original: via,
    origin,
    handleStart: point,
    inserted: true,
  };
}

function beginSegment(
  ctx: Context,
  pointerId: number,
  name: string,
  index: number,
  start: Point,
): ConnectionDrag {
  return {
    kind: "segment",
    pointerId,
    connection: name,
    index,
    points: ctx.route.points,
    start,
    origin: originOf(ctx, name),
    ends: endsOf(ctx, name),
    delta: 0,
  };
}

function beginEnd(
  store: EditorStore,
  pointerId: number,
  name: string,
  end: "from" | "to",
  world: Point,
): ConnectionDrag {
  store.getState().setPathEdit({
    connection: name,
    loose: { end, pointer: world, target: null, anchor: null },
  });
  return { kind: "end", pointerId, connection: name, end, target: null, anchor: null };
}

function beginLabel(
  ctx: Context,
  pointerId: number,
  name: string,
  press: Point,
  centre: Point,
): ConnectionDrag {
  return {
    kind: "label",
    pointerId,
    connection: name,
    route: ctx.route,
    grab: { x: centre.x - press.x, y: centre.y - press.y },
    place: null,
  };
}

/** Updates the preview for a drag. */
export function moveConnectionDrag(
  store: EditorStore,
  drag: ConnectionDrag,
  world: Point,
  event: { clientX: number; clientY: number; shiftKey: boolean },
): void {
  const state = store.getState();
  switch (drag.kind) {
    case "waypoint": {
      let point = snapToGrid(world, drag.origin);
      if (event.shiftKey) {
        // Shift keeps the point level with, or under, where it started.
        point =
          Math.abs(point.x - drag.handleStart.x) >= Math.abs(point.y - drag.handleStart.y)
            ? { x: point.x, y: drag.handleStart.y }
            : { x: drag.handleStart.x, y: point.y };
      }
      drag.via = drag.via.map((p, i) => (i === drag.index ? point : p));
      state.setPathEdit({ connection: drag.connection, via: drag.via });
      return;
    }
    case "segment": {
      const horizontal = isHorizontalSegment(drag.points, drag.index);
      const segment = drag.points[drag.index] ?? drag.start;
      const raw = horizontal
        ? segment.y + world.y - drag.start.y
        : segment.x + world.x - drag.start.x;
      const base = horizontal ? drag.origin.y : drag.origin.x;
      const snapped = base + Math.round((raw - base) / GRID) * GRID;
      drag.delta = snapped - (horizontal ? segment.y : segment.x);
      state.setPathEdit({
        connection: drag.connection,
        via: moveSegment(drag.points, drag.index, drag.delta, drag.ends),
      });
      return;
    }
    case "end": {
      const diagram = state.diagram();
      const connection = diagram.connections.get(drag.connection);
      const other = drag.end === "from" ? connection?.to.element : connection?.from.element;
      // The canvas holds the pointer capture, so ask what is under the pointer instead.
      const hit = hitAt(
        document.elementFromPoint(event.clientX, event.clientY),
        event.clientX,
        event.clientY,
      );
      const target =
        hit !== null && hit.name !== other && (hit.kind === "component" || hit.kind === "container")
          ? hit.name
          : null;
      let anchor: Anchor | null = null;
      if (target !== null) {
        const box = endpointBox(computeLayout(diagram), target);
        if (box !== null) {
          const reach = ANCHOR_REACH / state.camera.zoom;
          let best = reach;
          for (const candidate of BOX_ANCHORS) {
            const p = anchorPoint(box, candidate);
            const distance = Math.hypot(p.x - world.x, p.y - world.y);
            if (distance <= best) {
              best = distance;
              anchor = candidate;
            }
          }
        }
      }
      drag.target = target;
      drag.anchor = anchor;
      state.setPathEdit({
        connection: drag.connection,
        loose: { end: drag.end, pointer: world, target, anchor },
      });
      return;
    }
    case "label": {
      const point = { x: world.x + drag.grab.x, y: world.y + drag.grab.y };
      const found = nearestAlong(drag.route, point);
      const place = {
        at: Math.round(found.at * 100) / 100,
        // Half grid units sideways: close to the line or clearly beside it.
        offset: Math.round((found.offset / GRID) * 2) / 2,
      };
      drag.place = place;
      state.setPathEdit({ connection: drag.connection, label: place });
      return;
    }
  }
}

/** Commits a drag as one edit (or none, when nothing changed). */
export function endConnectionDrag(
  store: EditorStore,
  drag: ConnectionDrag,
  event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean },
): void {
  const state = store.getState();
  state.setPathEdit(null);
  const name = drag.connection;
  const geometry = (label: string, change: ConnectionGeometry) =>
    state.edit(label, (files, diagram) =>
      setConnectionGeometry(files, diagram, { name, ...change }),
    );

  switch (drag.kind) {
    case "waypoint": {
      const ctx = context(store, name, drag.via);
      if (ctx === null) return;
      // A bend dragged back into line goes away (Alt keeps it).
      const via = event.altKey ? drag.via : bendingWaypoints(ctx.route.through);
      if (!drag.inserted && sameLine(via, drag.original)) return;
      if (drag.inserted && via.length === drag.original.length) return;
      geometry(drag.inserted ? "Add bend" : "Move bend", {
        via: via.length === 0 ? null : toGridVia(via, drag.origin),
      });
      return;
    }
    case "segment": {
      if (drag.delta === 0) return;
      const moved = context(
        store,
        name,
        moveSegment(drag.points, drag.index, drag.delta, drag.ends),
      );
      const automatic = context(store, name, []);
      if (moved === null || automatic === null) return;
      // Back where the router would put it (to within half a grid cell, since bends snap to
      // the grid and the router's own corners needn't): drop the waypoints, keep the file clean.
      const same = sameLine(moved.route.points, automatic.route.points, GRID / 2);
      geometry("Move segment", {
        via: same ? null : toGridVia(cornersOf(moved.route.points), drag.origin),
      });
      return;
    }
    case "end": {
      if (drag.target === null) return;
      const diagram = state.diagram();
      const connection = diagram.connections.get(name);
      if (connection === undefined) return;
      const current = drag.end === "from" ? connection.from.element : connection.to.element;
      const entry = diagram.layout.get(name);
      const currentAnchor = (drag.end === "from" ? entry?.fromAnchor : entry?.toAnchor) ?? null;
      const copy = event.ctrlKey || event.metaKey;
      if (drag.target === current && !copy) {
        if (sameAnchor(currentAnchor, drag.anchor)) return;
        geometry(
          drag.anchor === null ? "Free connection end" : "Fix connection end",
          drag.end === "from" ? { fromAnchor: drag.anchor } : { toAnchor: drag.anchor },
        );
        return;
      }
      const endpoint = drag.target;
      state.edit(copy ? "Copy connection" : "Reconnect", (files, d) =>
        reconnectConnection(files, d, { name, end: drag.end, endpoint, anchor: drag.anchor, copy }),
      );
      return;
    }
    case "label": {
      if (drag.place === null) return;
      geometry("Move label", { label: drag.place });
      return;
    }
  }
}

/** Removes the waypoint at `index` (double-click on it). */
export function removeWaypointAt(store: EditorStore, name: string, index: number): void {
  const ctx = context(store, name);
  if (ctx === null) return;
  const via = ctx.route.through.slice(1, -1).filter((_, i) => i !== index);
  const origin = originOf(ctx, name);
  store.getState().edit("Remove bend", (files, diagram) =>
    setConnectionGeometry(files, diagram, {
      name,
      via: via.length === 0 ? null : toGridVia(via, origin),
    }),
  );
}

/** The connection's route as drawn now, or null. */
export function connectionRoute(store: EditorStore, name: string): RoutedPath | null {
  return context(store, name)?.route ?? null;
}

/** The bend within `reach` px of `point`, as its index among the waypoints, or null. */
export function waypointNear(
  store: EditorStore,
  name: string,
  point: Point,
  reach: number,
): number | null {
  const route = connectionRoute(store, name);
  if (route === null) return null;
  const index = route.through
    .slice(1, -1)
    .findIndex((p) => Math.hypot(p.x - point.x, p.y - point.y) <= reach);
  return index < 0 ? null : index;
}

/** Adds a bend at `point` (snapped to the grid) in the segment nearest it. */
export function addWaypointAt(store: EditorStore, name: string, point: Point): void {
  const ctx = context(store, name);
  if (ctx === null) return;
  const origin = originOf(ctx, name);
  const through = ctx.route.through;
  const { index } = nearestSegment(through, point);
  const via = insertWaypoint(through.slice(1, -1), index, snapToGrid(point, origin));
  store
    .getState()
    .edit("Add bend", (files, diagram) =>
      setConnectionGeometry(files, diagram, { name, via: toGridVia(via, origin) }),
    );
}
