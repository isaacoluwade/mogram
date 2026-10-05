import type { Connection, Diagram, GridPoint } from "../model/types";
import { ancestorsOf, type LayoutResult } from "../layout/compute";
import { GRID, type Box, type Point } from "../layout/geometry";
import {
  elbow,
  endSide,
  facingSides,
  routeOrthogonal,
  routeThrough,
  sidePoint,
  sideToward,
  type FixedPort,
  type RouteRequest,
  type Side,
} from "./orthogonal";
import type { Anchor } from "../presets/connectors";
import { anchorPoint, anchorPort, anchorSide, centreOf, clipToBox, outward } from "./anchors";
import { CORNER_RADIUS, curvePath, curveThrough, polylinePath, type RoutedPath } from "./path";
import { endsMoved, followVia, type Ends as EndBoxes } from "./follow";
import { shapeGeometry, shapePerimeter } from "../presets/shapes";

export interface RouteOptions {
  /** Connections to draw as quick elbows (e.g. while their ends are being dragged). */
  readonly quick?: ReadonlySet<string>;
  /** Anchor overrides (e.g. while an end is being reconnected). */
  readonly anchors?: ReadonlyMap<
    string,
    { readonly from?: Anchor | null; readonly to?: Anchor | null }
  >;
  /** Waypoint overrides in absolute pixels (e.g. while a bend is being dragged). */
  readonly via?: ReadonlyMap<string, readonly Point[]>;
  /**
   * The layout before elements started moving: stored bends follow their ends from there
   * (ED-29, `followVia`), so a drag previews what the drop will write.
   */
  readonly follow?: LayoutResult;
  /** Previously computed routes to reuse when nothing relevant changed. */
  readonly cache?: RouteCache;
}

/** Caches orthogonal routes by the geometry that produced them. */
export class RouteCache {
  private readonly entries = new Map<string, RoutedPath>();

  get(key: string): RoutedPath | undefined {
    return this.entries.get(key);
  }

  set(key: string, path: RoutedPath): void {
    if (this.entries.size > 2000) this.entries.clear();
    this.entries.set(key, path);
  }
}

/** The box a connection end attaches to: a component's icon tile, or a container's frame. */
export function endpointBox(layout: LayoutResult, element: string): Box | null {
  return layout.tiles.get(element) ?? layout.elements.get(element)?.box ?? null;
}

/** The innermost container holding both ends, whose origin `via` points are relative to (D-11). */
export function viaOrigin(layout: LayoutResult, connection: Connection): Point {
  const fromAncestors = ancestorsOf(layout, connection.from.element);
  const toAncestors = new Set(ancestorsOf(layout, connection.to.element));
  const common = fromAncestors.find((name) => toAncestors.has(name));
  const box = common === undefined ? null : layout.elements.get(common)?.box;
  return box === null || box === undefined ? { x: 0, y: 0 } : { x: box.x, y: box.y };
}

/**
 * Stored bends (grid units) carried along from where the ends were in `before` to `now`, snapped
 * to the grid as the drop will store them; null when neither end moved.
 */
export function followedVia(
  before: LayoutResult,
  connection: Connection,
  stored: readonly GridPoint[],
  now: EndBoxes,
  origin: Point,
): Point[] | null {
  const source = endpointBox(before, connection.from.element);
  const target = endpointBox(before, connection.to.element);
  if (source === null || target === null || !endsMoved({ source, target }, now)) return null;
  const from = viaOrigin(before, connection);
  const absolute = stored.map((p) => ({ x: from.x + p.x * GRID, y: from.y + p.y * GRID }));
  return followVia(connection.route, absolute, { source, target }, now).map((p) => ({
    x: origin.x + Math.round((p.x - origin.x) / GRID) * GRID,
    y: origin.y + Math.round((p.y - origin.y) / GRID) * GRID,
  }));
}

/** Routes every connection whose ends are placed. */
export function routeConnections(
  diagram: Diagram,
  layout: LayoutResult,
  options: RouteOptions = {},
): Map<string, RoutedPath> {
  const routes = new Map<string, RoutedPath>();
  const auto: AutoRoute[] = [];
  const components = [...layout.elements.values()].filter((e) => e.kind === "component");
  const containers = [...layout.elements.values()].filter((e) => e.kind === "container");

  for (const connection of diagram.connections.values()) {
    const source = endpointBox(layout, connection.from.element);
    const target = endpointBox(layout, connection.to.element);
    if (source === null || target === null) continue;
    const entry = diagram.layout.get(connection.name);
    const fromAnchor = options.anchors?.get(connection.name)?.from ?? entry?.fromAnchor ?? null;
    const toAnchor = options.anchors?.get(connection.name)?.to ?? entry?.toAnchor ?? null;
    const radius = connection.corners === "sharp" ? 0 : CORNER_RADIUS;

    const viaOverride = options.via?.get(connection.name);
    const stored = entry?.via;
    let via: readonly Point[] = [];
    if (viaOverride !== undefined) via = viaOverride;
    else if (stored !== null && stored !== undefined && stored.length > 0) {
      const origin = viaOrigin(layout, connection);
      via = stored.map((p) => ({ x: origin.x + p.x * GRID, y: origin.y + p.y * GRID }));
      const followed =
        options.follow === undefined
          ? null
          : followedVia(options.follow, connection, stored, { source, target }, origin);
      if (followed !== null) via = followed;
    }
    const ends = { source, target, fromAnchor, toAnchor, via };

    if (connection.route === "straight") {
      routes.set(connection.name, polylinePath(straightThrough(ends), radius));
      continue;
    }
    if (connection.route === "curved") {
      routes.set(connection.name, curvedThrough(ends));
      continue;
    }

    const towardTarget =
      via[0] ?? (toAnchor !== null ? anchorPoint(target, toAnchor) : centreOf(target));
    const towardSource =
      via[via.length - 1] ??
      (fromAnchor !== null ? anchorPoint(source, fromAnchor) : centreOf(source));
    const sourcePort =
      fromAnchor === null ? undefined : anchorPort(source, fromAnchor, towardTarget);
    const targetPort = toAnchor === null ? undefined : anchorPort(target, toAnchor, towardSource);

    if (via.length > 0) {
      routes.set(
        connection.name,
        polylinePath(
          routeThrough(source, target, via, {
            ...(sourcePort !== undefined ? { sourcePort } : {}),
            ...(targetPort !== undefined ? { targetPort } : {}),
          }),
          radius,
        ),
      );
      continue;
    }

    if (options.quick?.has(connection.name) === true) {
      routes.set(connection.name, polylinePath(elbow(source, target), radius));
      continue;
    }

    const excluded = new Set<string>([
      connection.from.element,
      connection.to.element,
      ...ancestorsOf(layout, connection.from.element),
      ...ancestorsOf(layout, connection.to.element),
    ]);
    const obstacles: Box[] = [];
    for (const element of components) if (!excluded.has(element.name)) obstacles.push(element.box);
    for (const element of containers) if (!excluded.has(element.name)) obstacles.push(element.box);

    const sidePenalty =
      layout.tiles.has(connection.from.element) || layout.tiles.has(connection.to.element)
        ? { bottom: 24 }
        : {};
    const request: RouteRequest = {
      source,
      target,
      obstacles,
      sidePenalty,
      ...(sourcePort !== undefined ? { sourcePort } : {}),
      ...(targetPort !== undefined ? { targetPort } : {}),
    };
    auto.push({
      connection,
      request,
      radius,
      fixedFrom: sourcePort !== undefined,
      fixedTo: targetPort !== undefined,
    });
    routes.set(connection.name, routeCached(request, radius, options.cache));
  }

  spreadSharedSides(auto, routes, options.cache);
  fitEndsToShapes(diagram, layout, routes);
  return routes;
}

/**
 * Lines ending at a shape stop at its drawn outline (an ellipse, a diamond) rather than its
 * bounding box (03-shapes-styles-library P1-3): each end slides along its last segment until it
 * meets the outline, so orthogonal ends stay square.
 */
function fitEndsToShapes(
  diagram: Diagram,
  layout: LayoutResult,
  routes: Map<string, RoutedPath>,
): void {
  const outlines = new Map<string, { box: Box; polygon: readonly Point[] } | null>();
  const outlineOf = (name: string) => {
    if (outlines.has(name)) return outlines.get(name) ?? null;
    const component = diagram.components.get(name);
    const box = layout.elements.get(name)?.box;
    const shape = component?.shape ?? null;
    const value =
      shape === null || box === undefined || shape === "rectangle" || shape === "person"
        ? null
        : {
            box,
            polygon: shapeGeometry(shape, box.w, box.h, component?.look ?? {}).polygon,
          };
    outlines.set(name, value);
    return value;
  };
  for (const connection of diagram.connections.values()) {
    const path = routes.get(connection.name);
    if (path === undefined || path.kind !== "polyline" || path.points.length < 2) continue;
    const from = outlineOf(connection.from.element);
    const to = outlineOf(connection.to.element);
    if (from === null && to === null) continue;
    const points = [...path.points];
    const onto = (end: number, next: number, outline: { box: Box; polygon: readonly Point[] }) => {
      const p = points[end] as Point;
      const q = points[next] as Point;
      const length = Math.hypot(p.x - q.x, p.y - q.y);
      if (length === 0) return;
      // Far enough past the end to cross the whole shape.
      const reach = outline.box.w + outline.box.h;
      const inside = {
        x: p.x + ((p.x - q.x) / length) * reach,
        y: p.y + ((p.y - q.y) / length) * reach,
      };
      points[end] = shapePerimeter(outline.polygon, outline.box, inside, q);
    };
    if (from !== null) onto(0, 1, from);
    if (to !== null) onto(points.length - 1, points.length - 2, to);
    routes.set(connection.name, polylinePath(points, path.radius));
  }
}

interface Ends {
  readonly source: Box;
  readonly target: Box;
  readonly fromAnchor: Anchor | null;
  readonly toAnchor: Anchor | null;
  /** Waypoints in absolute px. */
  readonly via: readonly Point[];
}

/** A straight line, through waypoints when there are any; floating ends aim at the next point. */
function straightThrough({ source, target, fromAnchor, toAnchor, via }: Ends): Point[] {
  const startFixed = fromAnchor === null ? null : anchorPoint(source, fromAnchor);
  const endFixed = toAnchor === null ? null : anchorPoint(target, toAnchor);
  const towardFromStart = via[0] ?? endFixed ?? centreOf(target);
  const towardFromEnd = via[via.length - 1] ?? startFixed ?? centreOf(source);
  const start = startFixed ?? clipToBox(source, centreOf(source), towardFromStart);
  const end = endFixed ?? clipToBox(target, centreOf(target), towardFromEnd);
  return [start, ...via, end];
}

/** A smooth curve leaving and arriving square to the sides, through any waypoints. */
function curvedThrough(ends: Ends): RoutedPath {
  const { source, target, fromAnchor, toAnchor, via } = ends;
  if (via.length === 0 && fromAnchor === null && toAnchor === null) return curved(source, target);
  const startFixed = fromAnchor === null ? null : anchorPoint(source, fromAnchor);
  const endFixed = toAnchor === null ? null : anchorPoint(target, toAnchor);
  const towardFromStart = via[0] ?? endFixed ?? centreOf(target);
  const towardFromEnd = via[via.length - 1] ?? startFixed ?? centreOf(source);
  const startSide =
    fromAnchor !== null
      ? anchorSide(source, fromAnchor, towardFromStart)
      : sideToward(source, towardFromStart);
  const endSide =
    toAnchor !== null
      ? anchorSide(target, toAnchor, towardFromEnd)
      : sideToward(target, towardFromEnd);
  const start = startFixed ?? sidePoint(source, startSide);
  const end = endFixed ?? sidePoint(target, endSide);
  return curveThrough([start, ...via, end], outward(startSide), outward(endSide));
}

interface AutoRoute {
  readonly connection: Connection;
  readonly request: RouteRequest;
  readonly radius: number;
  /** Ends on a fixed anchor keep it; only floating ends share their side (ED-29). */
  readonly fixedFrom: boolean;
  readonly fixedTo: boolean;
}

function routeCached(
  request: RouteRequest,
  radius: number,
  cache: RouteCache | undefined,
): RoutedPath {
  const key = `${cacheKey(request)}|r${radius}`;
  const cached = cache?.get(key);
  if (cached !== undefined) return cached;
  const path = polylinePath(routeOrthogonal(request), radius);
  cache?.set(key, path);
  return path;
}

const PORT_SPACING = 12;
/** How strongly an end leans toward the other end along its side (0 = always centred). */
const PORT_LEAN = 0.25;

/**
 * Positions for several ends on one side: as close as possible (least squares) to where each line
 * naturally arrives, at least `spacing` apart, in the same order, and inside ±`limit`. A line that
 * is already straight stays straight when it can. `natural` must be sorted ascending.
 *
 * Subtracting `i * spacing` turns "at least spacing apart" into "non-decreasing", which is solved
 * exactly by pool-adjacent-violators (isotonic regression).
 */
export function spreadOffsets(
  natural: readonly number[],
  limit: number,
  spacing = PORT_SPACING,
): number[] {
  const n = natural.length;
  if (n === 0) return [];
  if (spacing * (n - 1) > limit * 2) {
    const step = (limit * 2) / Math.max(1, n - 1);
    return natural.map((_, i) => (i - (n - 1) / 2) * step);
  }
  const blocks: { sum: number; count: number }[] = [];
  natural.forEach((value, i) => {
    blocks.push({ sum: Math.max(-limit, Math.min(limit, value)) - i * spacing, count: 1 });
    for (;;) {
      const last = blocks[blocks.length - 1];
      const before = blocks[blocks.length - 2];
      if (
        last === undefined ||
        before === undefined ||
        before.sum / before.count <= last.sum / last.count
      )
        break;
      blocks.splice(blocks.length - 2, 2, {
        sum: before.sum + last.sum,
        count: before.count + last.count,
      });
    }
  });
  const pos: number[] = [];
  for (const block of blocks)
    for (let k = 0; k < block.count; k++) pos.push(block.sum / block.count + pos.length * spacing);
  // Pull ends that fell off the side back on, pushing neighbours only as far as needed.
  pos[0] = Math.max(pos[0] ?? 0, -limit);
  for (let i = 1; i < n; i++) pos[i] = Math.max(pos[i] ?? 0, (pos[i - 1] ?? 0) + spacing);
  pos[n - 1] = Math.min(pos[n - 1] ?? 0, limit);
  for (let i = n - 2; i >= 0; i--) pos[i] = Math.min(pos[i] ?? 0, (pos[i + 1] ?? 0) - spacing);
  return pos;
}

function spreadSharedSides(
  auto: readonly AutoRoute[],
  routes: Map<string, RoutedPath>,
  cache: RouteCache | undefined,
): void {
  interface End {
    readonly route: AutoRoute;
    readonly end: "from" | "to";
    readonly side: Side;
    /** Where the line would naturally meet this side, relative to the side's midpoint. */
    readonly natural: number;
  }
  const groups = new Map<string, End[]>();
  const sides = new Map<string, { from: Side | null; to: Side | null }>();
  for (const route of auto) {
    const path = routes.get(route.connection.name);
    if (path === undefined) continue;
    const from = endSide(path.points, "start");
    const to = endSide(path.points, "end");
    sides.set(route.connection.name, { from, to });
    const add = (end: "from" | "to", side: Side | null) => {
      if (side === null) return;
      if (end === "from" ? route.fixedFrom : route.fixedTo) return;
      const element = end === "from" ? route.connection.from.element : route.connection.to.element;
      const own = end === "from" ? route.request.source : route.request.target;
      const other = end === "from" ? route.request.target : route.request.source;
      const vertical = side === "left" || side === "right";
      const delta = vertical
        ? other.y + other.h / 2 - (own.y + own.h / 2)
        : other.x + other.w / 2 - (own.x + own.w / 2);
      const key = `${element}|${side}`;
      const list = groups.get(key) ?? [];
      list.push({ route, end, side, natural: delta * PORT_LEAN });
      groups.set(key, list);
    };
    add("from", from);
    add("to", to);
  }

  const ports = new Map<string, { sourcePort?: FixedPort; targetPort?: FixedPort }>();
  for (const ends of groups.values()) {
    if (ends.length < 2) continue;
    const first = ends[0];
    if (first === undefined) continue;
    const box = first.end === "from" ? first.route.request.source : first.route.request.target;
    const length = first.side === "left" || first.side === "right" ? box.h : box.w;
    ends.sort(
      (a, b) =>
        a.natural - b.natural || a.route.connection.name.localeCompare(b.route.connection.name),
    );
    const offsets = spreadOffsets(
      ends.map((end) => end.natural),
      length / 2 - 6,
    );
    ends.forEach((end, index) => {
      const entry = ports.get(end.route.connection.name) ?? {};
      ports.set(end.route.connection.name, {
        ...entry,
        [end.end === "from" ? "sourcePort" : "targetPort"]: {
          side: end.side,
          offset: offsets[index] ?? 0,
        },
      });
    });
  }

  for (const route of auto) {
    const fixed = ports.get(route.connection.name);
    if (fixed === undefined) continue;
    // Keep the unshared end on the side it already uses, so the route keeps its shape.
    const current = sides.get(route.connection.name);
    const sourcePort =
      fixed.sourcePort ??
      route.request.sourcePort ??
      (current?.from != null ? { side: current.from, offset: 0 } : undefined);
    const targetPort =
      fixed.targetPort ??
      route.request.targetPort ??
      (current?.to != null ? { side: current.to, offset: 0 } : undefined);
    routes.set(
      route.connection.name,
      routeCached(
        {
          ...route.request,
          ...(sourcePort !== undefined ? { sourcePort } : {}),
          ...(targetPort !== undefined ? { targetPort } : {}),
        },
        route.radius,
        cache,
      ),
    );
  }
}

function cacheKey(request: RouteRequest): string {
  const box = (b: Box): string => `${b.x},${b.y},${b.w},${b.h}`;
  const port = (p: FixedPort | undefined): string =>
    p === undefined ? "" : `${p.side}${p.offset}`;
  const penalty = request.sidePenalty?.bottom ?? 0;
  return `${box(request.source)}|${box(request.target)}|${port(request.sourcePort)}|${port(request.targetPort)}|${penalty}|${request.obstacles.map(box).join(";")}`;
}

function curved(source: Box, target: Box): RoutedPath {
  const { from, to } = facingSides(source, target);
  const p0 = sidePoint(source, from);
  const p3 = sidePoint(target, to);
  const reach = Math.max(40, Math.hypot(p3.x - p0.x, p3.y - p0.y) / 2.5);
  const push = (side: typeof from, point: Point): Point => {
    switch (side) {
      case "left":
        return { x: point.x - reach, y: point.y };
      case "right":
        return { x: point.x + reach, y: point.y };
      case "top":
        return { x: point.x, y: point.y - reach };
      case "bottom":
        return { x: point.x, y: point.y + reach };
    }
  };
  return curvePath(p0, push(from, p0), push(to, p3), p3);
}
