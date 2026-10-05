import type { Point } from "../layout/geometry";

/**
 * Line jumps (ED-29): where a connection crosses one drawn before it, it hops over with a small
 * arc or leaves a gap, so crossings read as crossings rather than junctions (draw.io's
 * `jumpStyle`, 02-connectors §14). Only straight runs jump; corners and curves don't.
 */

export const JUMP_SIZE = 6;

const round = (value: number): number => Math.round(value * 10) / 10;

/** Where segment a–b crosses segment c–d, as the distance along a–b, or null. */
function crossing(a: Point, b: Point, c: Point, d: Point): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denominator;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return t * Math.hypot(r.x, r.y);
}

/**
 * For each segment of `points`, the distances along it where it crosses any of `others` (each a
 * polyline), kept only where there is room for a jump clear of the segment's ends.
 */
export function crossingsOn(
  points: readonly Point[],
  others: readonly (readonly Point[])[],
  clearance: number,
): number[][] {
  return points.slice(1).map((b, i) => {
    const a = points[i] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const found: number[] = [];
    for (const other of others) {
      for (let j = 1; j < other.length; j++) {
        const at = crossing(a, b, other[j - 1] as Point, other[j] as Point);
        if (at !== null && at > clearance && at < length - clearance) found.push(at);
      }
    }
    found.sort((x, y) => x - y);
    // Crossings closer together than one jump merge into one.
    return found.filter((at, k) => k === 0 || at - (found[k - 1] as number) > JUMP_SIZE * 2.5);
  });
}

/**
 * SVG path for a polyline with rounded corners and jumps at `crossings` (per segment, distances
 * along it). `arc` hops over with a half circle on the left of travel; `gap` breaks the line.
 */
export function jumpedPolyline(
  points: readonly Point[],
  radius: number,
  crossings: readonly (readonly number[])[],
  style: "arc" | "gap",
  size = JUMP_SIZE,
): string {
  const first = points[0];
  if (first === undefined) return "";
  const last = points.length - 1;
  const length = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
  // How far each corner's rounding reaches into the segments either side of it.
  const radii = points.map((corner, i) => {
    if (i === 0 || i === last) return 0;
    const r = Math.min(
      radius,
      length(points[i - 1] as Point, corner) / 2,
      length(corner, points[i + 1] as Point) / 2,
    );
    return r < 0.5 ? 0 : r;
  });
  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let k = 0; k < last; k++) {
    const a = points[k] as Point;
    const b = points[k + 1] as Point;
    const total = length(a, b);
    if (total === 0) continue;
    const ux = (b.x - a.x) / total;
    const uy = (b.y - a.y) / total;
    const startOff = radii[k] ?? 0;
    const endOff = radii[k + 1] ?? 0;
    for (const at of crossings[k] ?? []) {
      if (at - size <= startOff || at + size >= total - endOff) continue;
      const before = { x: a.x + ux * (at - size), y: a.y + uy * (at - size) };
      const after = { x: a.x + ux * (at + size), y: a.y + uy * (at + size) };
      d += ` L${round(before.x)} ${round(before.y)}`;
      d +=
        style === "arc"
          ? ` A${size} ${size} 0 0 1 ${round(after.x)} ${round(after.y)}`
          : ` M${round(after.x)} ${round(after.y)}`;
    }
    d += ` L${round(b.x - ux * endOff)} ${round(b.y - uy * endOff)}`;
    if (endOff > 0) {
      const c = points[k + 2] as Point;
      const out = length(b, c);
      d += ` Q${round(b.x)} ${round(b.y)} ${round(b.x + ((c.x - b.x) / out) * endOff)} ${round(b.y + ((c.y - b.y) / out) * endOff)}`;
    }
  }
  return d;
}
