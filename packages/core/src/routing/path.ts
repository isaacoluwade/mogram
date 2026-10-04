import { intersects, type Box, type Point } from "../layout/geometry";

/**
 * A routed connection. Polylines are drawn with rounded corners; curves are cubic Béziers.
 * `samples` is a dense polyline along the exact drawn shape, used for traffic dots, labels and
 * the tour camera (TO-2), so every consumer follows the same path the user sees.
 */
export interface RoutedPath {
  readonly kind: "polyline" | "curve";
  /** Vertices (polyline) or the four Bézier control points (curve). */
  readonly points: readonly Point[];
  readonly d: string;
  readonly samples: readonly Point[];
  readonly length: number;
}

const CORNER_RADIUS = 10;

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

export function polylinePath(points: readonly Point[]): RoutedPath {
  const vertices = simplify(points);
  const samples = samplePolyline(vertices);
  return {
    kind: "polyline",
    points: vertices,
    d: roundedPolyline(vertices),
    samples,
    length: polylineLength(samples),
  };
}

export function curvePath(p0: Point, p1: Point, p2: Point, p3: Point): RoutedPath {
  const samples: Point[] = [];
  for (let i = 0; i <= 48; i++) samples.push(cubicPoint(p0, p1, p2, p3, i / 48));
  return {
    kind: "curve",
    points: [p0, p1, p2, p3],
    d: `M${round(p0.x)} ${round(p0.y)} C${round(p1.x)} ${round(p1.y)} ${round(p2.x)} ${round(p2.y)} ${round(p3.x)} ${round(p3.y)}`,
    samples,
    length: polylineLength(samples),
  };
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
    ? curvePath(
        points[0] ?? { x: 0, y: 0 },
        points[1] ?? { x: 0, y: 0 },
        points[2] ?? { x: 0, y: 0 },
        points[3] ?? { x: 0, y: 0 },
      )
    : { kind: "polyline", points, d: roundedPolyline(points), samples, length: path.length };
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
