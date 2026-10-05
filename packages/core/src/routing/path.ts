import { intersects, type Box, type Point } from "../layout/geometry";

/**
 * A routed connection. Polylines are drawn with rounded corners; curves are cubic Béziers.
 * `samples` is a dense polyline along the exact drawn shape, used for traffic dots, labels and
 * the tour camera (TO-2), so every consumer follows the same path the user sees.
 */
export interface RoutedPath {
  readonly kind: "polyline" | "curve";
  /** Vertices (polyline) or Bézier control points, 3n + 1 for n cubic pieces (curve). */
  readonly points: readonly Point[];
  /**
   * The points the drawn line passes through: a polyline's vertices, or a curve's ends and
   * waypoints. Editing handles sit on these (ED-29).
   */
  readonly through: readonly Point[];
  readonly d: string;
  readonly samples: readonly Point[];
  readonly length: number;
  /** Corner radius a polyline was drawn with (0 = sharp corners). */
  readonly radius: number;
}

export const CORNER_RADIUS = 10;

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Removes duplicate and collinear points. */
export function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (
      last !== undefined &&
      Math.abs(last.x - point.x) < 0.01 &&
      Math.abs(last.y - point.y) < 0.01
    )
      continue;
    out.push(point);
    while (out.length >= 3) {
      const a = out[out.length - 3];
      const b = out[out.length - 2];
      const c = out[out.length - 1];
      if (a === undefined || b === undefined || c === undefined) break;
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) > 0.01) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** SVG path for a polyline with rounded corners. */
export function roundedPolyline(points: readonly Point[], radius = CORNER_RADIUS): string {
  const first = points[0];
  if (first === undefined) return "";
  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    if (prev === undefined || corner === undefined || next === undefined) continue;
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 0.5) {
      d += ` L${round(corner.x)} ${round(corner.y)}`;
      continue;
    }
    const start = {
      x: corner.x - ((corner.x - prev.x) / inLength) * r,
      y: corner.y - ((corner.y - prev.y) / inLength) * r,
    };
    const end = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    };
    d += ` L${round(start.x)} ${round(start.y)} Q${round(corner.x)} ${round(corner.y)} ${round(end.x)} ${round(end.y)}`;
  }
  const last = points[points.length - 1];
  if (last !== undefined && points.length > 1) d += ` L${round(last.x)} ${round(last.y)}`;
  return d;
}

/** Dense samples along a rounded polyline (corners included) for exact path following. */
export function samplePolyline(points: readonly Point[], radius = CORNER_RADIUS): Point[] {
  const out: Point[] = [];
  const first = points[0];
  if (first === undefined) return out;
  out.push(first);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    if (prev === undefined || corner === undefined) continue;
    if (next === undefined) {
      out.push(corner);
      continue;
    }
    const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 0.5) {
      out.push(corner);
      continue;
    }
    const start = {
      x: corner.x - ((corner.x - prev.x) / inLength) * r,
      y: corner.y - ((corner.y - prev.y) / inLength) * r,
    };
    const end = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    };
    out.push(start);
    for (let step = 1; step <= 4; step++) {
      const t = step / 4;
      const u = 1 - t;
      out.push({
        x: u * u * start.x + 2 * u * t * corner.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * corner.y + t * t * end.y,
      });
    }
  }
  return out;
}

export function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export function polylinePath(points: readonly Point[], radius = CORNER_RADIUS): RoutedPath {
  const vertices = simplify(points);
  const samples = samplePolyline(vertices, radius);
  return {
    kind: "polyline",
    points: vertices,
    through: vertices,
    d: roundedPolyline(vertices, radius),
    samples,
    length: polylineLength(samples),
    radius,
  };
}

/** A chain of cubic Béziers: `controls` holds 3n + 1 points for n pieces. */
export function bezierPath(controls: readonly Point[]): RoutedPath {
  const first = controls[0] ?? { x: 0, y: 0 };
  const samples: Point[] = [first];
  const through: Point[] = [first];
  let d = `M${round(first.x)} ${round(first.y)}`;
  const pieces = Math.floor((controls.length - 1) / 3);
  const steps = Math.max(12, Math.round(48 / Math.max(1, pieces)));
  for (let piece = 0; piece < pieces; piece++) {
    const [p0, p1, p2, p3] = controls.slice(piece * 3, piece * 3 + 4);
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) break;
    d += ` C${round(p1.x)} ${round(p1.y)} ${round(p2.x)} ${round(p2.y)} ${round(p3.x)} ${round(p3.y)}`;
    for (let i = 1; i <= steps; i++) samples.push(cubicPoint(p0, p1, p2, p3, i / steps));
    through.push(p3);
  }
  return {
    kind: "curve",
    points: controls,
    through,
    d,
    samples,
    length: polylineLength(samples),
    radius: 0,
  };
}

export function curvePath(p0: Point, p1: Point, p2: Point, p3: Point): RoutedPath {
  return bezierPath([p0, p1, p2, p3]);
}

/**
 * A smooth curve passing through every point (Catmull-Rom as Béziers), leaving the first point
 * along `startTangent` and arriving at the last along `endTangent` when given (unit vectors).
 * The line goes through each waypoint, so its handle sits on the curve the user sees.
 */
export function curveThrough(
  points: readonly Point[],
  startTangent?: Point,
  endTangent?: Point,
): RoutedPath {
  const n = points.length;
  if (n < 2) return bezierPath(points.length === 1 ? [points[0] as Point] : []);
  const tangents: Point[] = points.map((point, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    if (prev !== undefined && next !== undefined) {
      return { x: (next.x - prev.x) / 2, y: (next.y - prev.y) / 2 };
    }
    const chord = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
    if (prev === undefined && next !== undefined) {
      const reach = Math.max(40, chord(point, next));
      return startTangent !== undefined
        ? { x: startTangent.x * reach, y: startTangent.y * reach }
        : { x: next.x - point.x, y: next.y - point.y };
    }
    if (prev !== undefined) {
      const reach = Math.max(40, chord(prev, point));
      return endTangent !== undefined
        ? { x: -endTangent.x * reach, y: -endTangent.y * reach }
        : { x: point.x - prev.x, y: point.y - prev.y };
    }
    return { x: 0, y: 0 };
  });
  const controls: Point[] = [points[0] as Point];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const ta = tangents[i] as Point;
    const tb = tangents[i + 1] as Point;
    controls.push(
      { x: a.x + ta.x / 3, y: a.y + ta.y / 3 },
      { x: b.x - tb.x / 3, y: b.y - tb.y / 3 },
      b,
    );
  }
  return bezierPath(controls);
}

export interface PathPosition {
  readonly point: Point;
  /** Direction of travel in radians. */
  readonly angle: number;
}

/** Point and heading at `distance` along the samples (clamped to the ends). */
export function pointAtLength(samples: readonly Point[], distance: number): PathPosition {
  const first = samples[0] ?? { x: 0, y: 0 };
  if (samples.length < 2) return { point: first, angle: 0 };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a === undefined || b === undefined) continue;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segment || i === samples.length - 1) {
      const t = segment === 0 ? 0 : Math.min(1, remaining / segment);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= segment;
  }
  return { point: samples[samples.length - 1] ?? first, angle: 0 };
}

export function midpointOf(path: RoutedPath): PathPosition {
  return pointAtLength(path.samples, path.length / 2);
}

/** Reversed copy, for travelling a connection against its direction (tour camera). */
export function reversePath(path: RoutedPath): RoutedPath {
  const samples = [...path.samples].reverse();
  const points = [...path.points].reverse();
  return path.kind === "curve"
    ? bezierPath(points)
    : {
        kind: "polyline",
        points,
        through: points,
        d: roundedPolyline(points, path.radius),
        samples,
        length: path.length,
        radius: path.radius,
      };
}

/** Where a fraction `at` (0…1) along the path is, moved `offset` px to the left of travel. */
export function pointAlong(path: RoutedPath, at: number, offset = 0): PathPosition {
  const position = pointAtLength(path.samples, path.length * Math.min(1, Math.max(0, at)));
  if (offset === 0) return position;
  const { point, angle } = position;
  // Left of travel, in screen coordinates (y grows downwards).
  return {
    point: { x: point.x + Math.sin(angle) * offset, y: point.y - Math.cos(angle) * offset },
    angle,
  };
}

/**
 * The inverse of `pointAlong`: the fraction along the path nearest `target`, and how far it is
 * to the left of travel (negative = right). Used when a label is dragged.
 */
export function nearestAlong(
  path: RoutedPath,
  target: Point,
): { readonly at: number; readonly offset: number; readonly distance: number } {
  const samples = path.samples;
  let best = { at: 0.5, offset: 0, distance: Infinity };
  let travelled = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const t = Math.max(
      0,
      Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / length ** 2),
    );
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const distance = Math.hypot(target.x - px, target.y - py);
    if (distance < best.distance) {
      // Cross product sign: positive when the target is left of travel (y down).
      const side = dx * (target.y - a.y) - dy * (target.x - a.x) < 0 ? 1 : -1;
      best = {
        at: path.length === 0 ? 0.5 : (travelled + length * t) / path.length,
        offset: side * distance,
        distance,
      };
    }
    travelled += length;
  }
  return best;
}

/** Fractions of the path tried for a label, middle first, then working outwards. */
const LABEL_STOPS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82] as const;

/**
 * Where a connection's label pill goes: the point nearest the middle of the path where a pill of
 * `size` covers none of the `obstacles` (component icons and names, labels already placed).
 * When every stop is covered, the middle.
 */
export function labelPosition(
  path: RoutedPath,
  size: { readonly w: number; readonly h: number },
  obstacles: readonly Box[],
): Point {
  for (const stop of LABEL_STOPS) {
    const { point } = pointAtLength(path.samples, path.length * stop);
    const pill = { x: point.x - size.w / 2, y: point.y - size.h / 2, w: size.w, h: size.h };
    if (!obstacles.some((box) => intersects(pill, box))) return point;
  }
  return midpointOf(path).point;
}

/** Splits a cubic at `t`: the two halves' control points. */
function splitCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): readonly [readonly Point[], readonly Point[]] {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const a = lerp(p0, p1);
  const b = lerp(p1, p2);
  const c = lerp(p2, p3);
  const d = lerp(a, b);
  const e = lerp(b, c);
  const f = lerp(d, e);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}

/** The cubic parameter `distance` px from the start (or, `fromEnd`, from the end) of a piece. */
function cubicParamAt(p: readonly Point[], distance: number, fromEnd: boolean): number {
  const [p0, p1, p2, p3] = p as [Point, Point, Point, Point];
  let travelled = 0;
  let previous = cubicPoint(p0, p1, p2, p3, fromEnd ? 1 : 0);
  const steps = 64;
  for (let i = 1; i <= steps; i++) {
    const t = fromEnd ? 1 - i / steps : i / steps;
    const point = cubicPoint(p0, p1, p2, p3, t);
    travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (travelled >= distance) return t;
    previous = point;
  }
  return fromEnd ? 0 : 1;
}

/** A polyline's vertices with its first and last segments shortened by `start` and `end`. */
export function trimPolyline(points: readonly Point[], start: number, end: number): Point[] {
  const trimmed = [...points];
  const move = (index: number, toward: number, by: number) => {
    const a = trimmed[index];
    const b = trimmed[toward];
    if (a === undefined || b === undefined || by <= 0) return;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const step = Math.min(by, Math.max(0, length - 1));
    if (length === 0) return;
    trimmed[index] = {
      x: a.x + ((b.x - a.x) / length) * step,
      y: a.y + ((b.y - a.y) / length) * step,
    };
  };
  move(0, 1, start);
  move(trimmed.length - 1, trimmed.length - 2, end);
  return trimmed;
}

/**
 * The path shortened by `start` px at its start and `end` px at its end, so a line stops at the
 * base of a filled arrowhead instead of poking through it (draw.io pulls the line back the
 * same way). Only the drawn shape changes; `samples` keep the full length.
 */
export function trimPath(path: RoutedPath, start: number, end: number): string {
  if (start <= 0 && end <= 0) return path.d;
  if (path.kind === "polyline")
    return roundedPolyline(trimPolyline(path.points, start, end), path.radius);
  const controls = [...path.points];
  const pieces = Math.floor((controls.length - 1) / 3);
  if (pieces === 0) return path.d;
  if (start > 0) {
    const first = controls.slice(0, 4);
    const [, rest] = splitCubic(
      first[0] as Point,
      first[1] as Point,
      first[2] as Point,
      first[3] as Point,
      cubicParamAt(first, start, false),
    );
    controls.splice(0, 4, ...rest);
  }
  if (end > 0) {
    const at = controls.length - 4;
    const last = controls.slice(at);
    const [kept] = splitCubic(
      last[0] as Point,
      last[1] as Point,
      last[2] as Point,
      last[3] as Point,
      cubicParamAt(last, end, true),
    );
    controls.splice(at, 4, ...kept);
  }
  return bezierPath(controls).d;
}
