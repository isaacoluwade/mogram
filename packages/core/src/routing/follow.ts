import type { RouteStyle } from "../model/types";
import type { Box, Point } from "../layout/geometry";
import { centreOf } from "./anchors";

/**
 * Waypoints follow the elements they join (ED-29, 02-connectors §16 and P1.5, after draw.io's
 * `followTerminals`): when an end moves or resizes, a connection's bends move with it instead of
 * staying behind and kinking the line.
 *
 * - Straight and curved routes keep each bend's place along the line between the two ends and
 *   its distance from that line, so the shape rotates and stretches with the ends
 *   (`getFollowedAxisPoints`).
 * - Orthogonal routes stay axis-parallel: each vertical segment shares one x shift and each
 *   horizontal segment one y shift, interpolated between the two ends' shifts by how far along
 *   the route the segment sits; the first and last segments move with their element
 *   (`getFollowedSegmentPoints`).
 */

export interface Ends {
  readonly source: Box;
  readonly target: Box;
}

const sameBox = (a: Box, b: Box): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Whether either end moved or changed size. */
export function endsMoved(before: Ends, after: Ends): boolean {
  return !sameBox(before.source, after.source) || !sameBox(before.target, after.target);
}

export function followVia(
  route: RouteStyle,
  via: readonly Point[],
  before: Ends,
  after: Ends,
): Point[] {
  if (via.length === 0 || !endsMoved(before, after)) return [...via];
  return route === "orthogonal"
    ? followSegments(via, before, after)
    : followAxis(via, before, after);
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

function shiftOf(before: Box, after: Box): Point {
  return sub(centreOf(after), centreOf(before));
}

function translate(via: readonly Point[], before: Ends, after: Ends): Point[] {
  const a = shiftOf(before.source, after.source);
  const b = shiftOf(before.target, after.target);
  const dx = (a.x + b.x) / 2;
  const dy = (a.y + b.y) / 2;
  return via.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

function followAxis(via: readonly Point[], before: Ends, after: Ends): Point[] {
  const a0 = centreOf(before.source);
  const b0 = centreOf(before.target);
  const a1 = centreOf(after.source);
  const b1 = centreOf(after.target);
  const v0 = sub(b0, a0);
  const v1 = sub(b1, a1);
  const len0 = Math.hypot(v0.x, v0.y);
  const len1 = Math.hypot(v1.x, v1.y);
  if (len0 < 1 || len1 < 1) return translate(via, before, after);
  const u0 = { x: v0.x / len0, y: v0.y / len0 };
  const u1 = { x: v1.x / len1, y: v1.y / len1 };
  return via.map((p) => {
    const rel = sub(p, a0);
    const along = (rel.x * u0.x + rel.y * u0.y) / len0;
    const aside = rel.x * -u0.y + rel.y * u0.x;
    return {
      x: a1.x + u1.x * along * len1 - u1.y * aside,
      y: a1.y + u1.y * along * len1 + u1.x * aside,
    };
  });
}

/** Whether `y` falls within the box's height (a horizontal segment can leave it sideways). */
const withinRows = (box: Box, y: number): boolean => y >= box.y && y <= box.y + box.h;

function followSegments(via: readonly Point[], before: Ends, after: Ends): Point[] {
  const source = centreOf(before.source);
  const target = centreOf(before.target);
  const points = [source, ...via, target];
  const segments = points.length - 1;

  // Which way each segment runs. Bends alternate, so the end segments run across their
  // neighbours; with a single bend, the box spans decide.
  const vertical: boolean[] = [];
  for (let k = 0; k < segments; k++) {
    const a = points[k] as Point;
    const b = points[k + 1] as Point;
    vertical.push(Math.abs(b.x - a.x) < Math.abs(b.y - a.y));
  }
  if (via.length >= 2) {
    vertical[0] = !(vertical[1] ?? false);
    vertical[segments - 1] = !(vertical[segments - 2] ?? false);
  } else {
    const bend = via[0] as Point;
    vertical[0] = !withinRows(before.source, bend.y);
    vertical[1] = !vertical[0];
  }

  // How far along the route each segment's middle sits.
  const lengths = points.slice(1).map((b, k) => {
    const a = points[k] as Point;
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  });
  const total = lengths.reduce((sum, l) => sum + l, 0) || 1;
  const s = shiftOf(before.source, after.source);
  const t = shiftOf(before.target, after.target);
  let travelled = 0;
  const shift = lengths.map((length, k) => {
    const middle = (travelled + length / 2) / total;
    travelled += length;
    const f = k === 0 ? 0 : k === segments - 1 ? 1 : middle;
    // A vertical segment moves sideways (x); a horizontal one up or down (y).
    return vertical[k] === true ? s.x + (t.x - s.x) * f : s.y + (t.y - s.y) * f;
  });

  return via.map((p, i) => {
    // Bend i sits between segment i (before it) and segment i + 1 (after it).
    const around = [i, i + 1];
    const xFrom = around.find((k) => vertical[k] === true);
    const yFrom = around.find((k) => vertical[k] === false);
    const f = (i + 1) / (via.length + 1);
    const dx = xFrom === undefined ? s.x + (t.x - s.x) * f : (shift[xFrom] ?? 0);
    const dy = yFrom === undefined ? s.y + (t.y - s.y) * f : (shift[yFrom] ?? 0);
    return { x: p.x + dx, y: p.y + dy };
  });
}
