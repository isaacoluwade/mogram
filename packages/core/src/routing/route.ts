import type { Connection, Diagram } from "../model/types";
import { ancestorsOf, type LayoutResult } from "../layout/compute";
import { GRID, type Box, type Point } from "../layout/geometry";
import {
  elbow,
  endSide,
  facingSides,
  routeOrthogonal,
  routeThrough,
  sidePoint,
  type FixedPort,
  type RouteRequest,
  type Side,
} from "./orthogonal";
import { curvePath, polylinePath, type RoutedPath } from "./path";

export interface RouteOptions {
  /** Connections to draw as quick elbows (e.g. while their ends are being dragged). */
  readonly quick?: ReadonlySet<string>;
  /** Waypoint overrides in absolute pixels (e.g. while a bend is being dragged). */
  readonly via?: ReadonlyMap<string, readonly Point[]>;
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

    if (connection.route === "straight") {
      routes.set(connection.name, polylinePath(straight(source, target)));
      continue;
    }
    if (connection.route === "curved") {
      routes.set(connection.name, curved(source, target));
      continue;
    }

    const viaOverride = options.via?.get(connection.name);
    const stored = diagram.layout.get(connection.name)?.via;
    if (
      viaOverride !== undefined ||
      (stored !== null && stored !== undefined && stored.length > 0)
    ) {
      const origin = viaOrigin(layout, connection);
      const via =
        viaOverride ??
        (stored ?? []).map((p) => ({ x: origin.x + p.x * GRID, y: origin.y + p.y * GRID }));
      routes.set(connection.name, polylinePath(routeThrough(source, target, via)));
      continue;
    }

    if (options.quick?.has(connection.name) === true) {
      routes.set(connection.name, polylinePath(elbow(source, target)));
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
    const request: RouteRequest = { source, target, obstacles, sidePenalty };
    auto.push({ connection, request });
    routes.set(connection.name, routeCached(request, options.cache));
  }

  spreadSharedSides(auto, routes, options.cache);
  return routes;
}

interface AutoRoute {
  readonly connection: Connection;
  readonly request: RouteRequest;
}

function routeCached(request: RouteRequest, cache: RouteCache | undefined): RoutedPath {
  const key = cacheKey(request);
  const cached = cache?.get(key);
  if (cached !== undefined) return cached;
  const path = polylinePath(routeOrthogonal(request));
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
      fixed.sourcePort ?? (current?.from != null ? { side: current.from, offset: 0 } : undefined);
    const targetPort =
      fixed.targetPort ?? (current?.to != null ? { side: current.to, offset: 0 } : undefined);
    routes.set(
      route.connection.name,
      routeCached(
        {
          ...route.request,
          ...(sourcePort !== undefined ? { sourcePort } : {}),
          ...(targetPort !== undefined ? { targetPort } : {}),
        },
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

/** Centre-to-centre line clipped to both boxes. */
function straight(source: Box, target: Box): Point[] {
  const a = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
  const b = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  return [clipToBox(source, a, b), clipToBox(target, b, a)];
}

function clipToBox(box: Box, inside: Point, toward: Point): Point {
  const dx = toward.x - inside.x;
  const dy = toward.y - inside.y;
  if (dx === 0 && dy === 0) return inside;
  const tx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: inside.x + dx * t, y: inside.y + dy * t };
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
