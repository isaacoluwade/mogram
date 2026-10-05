import { GRID, type Box, type Point } from "../layout/geometry";
import type { GridPoint } from "../model/types";
import { STUB, type Side } from "./orthogonal";
import { simplify } from "./path";

/**
 * Pure geometry for editing a connection's path by hand (ED-18, ED-29), modelled on draw.io's
 * edge handlers (docs/research/drawio/02-connectors.md §4–5). Points are absolute px; the
 * editor turns the result into `via` grid points relative to the connection's origin.
 */

/** Distance (px) within which a waypoint is treated as lying on the line through its neighbours. */
export const COLLINEAR_TOLERANCE = 4;

/** Distance from `p` to the segment a–b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/**
 * Waypoints that still bend the line: a point within `tolerance` of the straight line between
 * its neighbours is dropped (draw.io removes a bend dragged back into line). `path` is the full
 * line, start and end included; the result is the waypoints only.
 */
export function bendingWaypoints(path: readonly Point[], tolerance = COLLINEAR_TOLERANCE): Point[] {
  const points = [...path];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1] as Point;
      const point = points[i] as Point;
      const next = points[i + 1] as Point;
      const dropped =
        distanceToSegment(point, prev, next) <= tolerance ||
        Math.hypot(point.x - prev.x, point.y - prev.y) <= tolerance ||
        Math.hypot(point.x - next.x, point.y - next.y) <= tolerance;
      if (dropped) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return points.slice(1, -1);
}

/** The waypoints with `point` inserted before index `index` (0 = right after the start). */
export function insertWaypoint(via: readonly Point[], index: number, point: Point): Point[] {
  const out = [...via];
  out.splice(Math.max(0, Math.min(out.length, index)), 0, point);
  return out;
}

export function removeWaypoint(via: readonly Point[], index: number): Point[] {
  return via.filter((_, i) => i !== index);
}

/** Whether segment `index` of an orthogonal route (points `index` → `index + 1`) is horizontal. */
export function isHorizontalSegment(points: readonly Point[], index: number): boolean {
  const a = points[index];
  const b = points[index + 1];
  if (a === undefined || b === undefined) return true;
  return Math.abs(b.y - a.y) <= Math.abs(b.x - a.x);
}

/** Which side of `box` a point on its outline lies on, or null when it isn't on the outline. */
function sideOf(box: Box, p: Point): Side | null {
  if (Math.abs(p.x - box.x) < 1) return "left";
  if (Math.abs(p.x - (box.x + box.w)) < 1) return "right";
  if (Math.abs(p.y - box.y) < 1) return "top";
  if (Math.abs(p.y - (box.y + box.h)) < 1) return "bottom";
  return null;
}

/** Whether an end moved to `p` can still leave `side` of `box` from there. */
function withinSide(box: Box, side: Side, p: Point): boolean {
  const inset = 4;
  return side === "left" || side === "right"
    ? p.y >= box.y + inset && p.y <= box.y + box.h - inset
    : p.x >= box.x + inset && p.x <= box.x + box.w - inset;
}

/**
 * The waypoints after sliding segment `index` of an orthogonal route sideways by `delta` px
 * (draw.io's segment handles). The route's interior corners become the waypoints, and the ends
 * line themselves up with them (see `routeThrough`), so moving the first or last segment slides
 * that end along its side. When the end can't go that far — the moved line misses the side —
 * the line steps out of the side and across to where it was moved. A single straight segment
 * gets one waypoint in its middle.
 */
export function moveSegment(
  points: readonly Point[],
  index: number,
  delta: number,
  ends?: { readonly source: Box; readonly target: Box },
): Point[] {
  const horizontal = isHorizontalSegment(points, index);
  const shift = (p: Point): Point =>
    horizontal ? { x: p.x, y: p.y + delta } : { x: p.x + delta, y: p.y };
  const moved = points.map((p, i) => (i === index || i === index + 1 ? shift(p) : p));
  const last = moved.length - 1;
  let via: Point[] =
    moved.length === 2
      ? [
          {
            x: ((moved[0] as Point).x + (moved[1] as Point).x) / 2,
            y: ((moved[0] as Point).y + (moved[1] as Point).y) / 2,
          },
        ]
      : moved.slice(1, -1);
  if (ends === undefined) return via;

  /** The step out of an end's side and across to the moved line, or null if none is needed. */
  const jog = (
    box: Box,
    original: Point | undefined,
    shifted: Point | undefined,
  ): Point[] | null => {
    if (original === undefined || shifted === undefined) return null;
    const side = sideOf(box, original);
    if (side === null || withinSide(box, side, shifted)) return null;
    const out = OUTWARD_STEP[side];
    const stub = { x: original.x + out.x * STUB, y: original.y + out.y * STUB };
    const across = horizontal ? { x: stub.x, y: shifted.y } : { x: shifted.x, y: stub.y };
    return [stub, across];
  };
  const startJog = index === 0 ? jog(ends.source, points[0], moved[0]) : null;
  const endJog = index + 1 === last ? jog(ends.target, points[last], moved[last]) : null;
  if (moved.length === 2 && (startJog !== null || endJog !== null)) via = [];
  if (startJog !== null) via = [...startJog, ...via];
  if (endJog !== null) via = [...via, ...[...endJog].reverse()];
  return via;
}

const OUTWARD_STEP: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** The route's corners as waypoints (start and end left out), merged where they run straight. */
export function cornersOf(route: readonly Point[]): Point[] {
  return simplify(route).slice(1, -1);
}

/** Whether two routes draw the same line, to within `tolerance` px at every corner. */
export function sameLine(a: readonly Point[], b: readonly Point[], tolerance = 0.5): boolean {
  const x = simplify(a);
  const y = simplify(b);
  return (
    x.length === y.length &&
    x.every((p, i) => {
      const q = y[i];
      return (
        q !== undefined && Math.abs(p.x - q.x) <= tolerance && Math.abs(p.y - q.y) <= tolerance
      );
    })
  );
}

/** Absolute waypoints → grid points relative to `origin`, as `via` stores them. */
export function toGridVia(points: readonly Point[], origin: Point): GridPoint[] {
  return points.map((p) => ({
    x: Math.round((p.x - origin.x) / GRID),
    y: Math.round((p.y - origin.y) / GRID),
  }));
}

export function fromGridVia(via: readonly GridPoint[], origin: Point): Point[] {
  return via.map((p) => ({ x: origin.x + p.x * GRID, y: origin.y + p.y * GRID }));
}

/** A point snapped to the grid, relative to `origin` (waypoints are stored in grid units). */
export function snapToGrid(point: Point, origin: Point): Point {
  return {
    x: origin.x + Math.round((point.x - origin.x) / GRID) * GRID,
    y: origin.y + Math.round((point.y - origin.y) / GRID) * GRID,
  };
}

/** Index of the polyline segment nearest `point`, and the distance to it. */
export function nearestSegment(
  points: readonly Point[],
  point: Point,
): { readonly index: number; readonly distance: number } {
  let best = { index: 0, distance: Infinity };
  for (let i = 0; i < points.length - 1; i++) {
    const distance = distanceToSegment(point, points[i] as Point, points[i + 1] as Point);
    if (distance < best.distance) best = { index: i, distance };
  }
  return best;
}
