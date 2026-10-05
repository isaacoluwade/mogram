import type { Box, Point } from "../layout/geometry";
import type { Anchor } from "../presets/connectors";
import type { FixedPort, Side } from "./orthogonal";

/**
 * Fixed connection points (ED-29): an end attached to an anchor leaves from that exact point;
 * a floating end (no anchor) leaves from wherever the router finds best.
 */

export function anchorPoint(box: Box, anchor: Anchor): Point {
  return { x: box.x + box.w * anchor.x, y: box.y + box.h * anchor.y };
}

const OUTWARD: Readonly<Record<Side, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * The side an anchor leaves from. On a corner, the one of its two sides that faces `toward`
 * better; inside the box, the nearest side.
 */
export function anchorSide(box: Box, anchor: Anchor, toward: Point): Side {
  const candidates: Side[] = [];
  if (anchor.x <= 0) candidates.push("left");
  if (anchor.x >= 1) candidates.push("right");
  if (anchor.y <= 0) candidates.push("top");
  if (anchor.y >= 1) candidates.push("bottom");
  if (candidates.length === 0) {
    const distances: [Side, number][] = [
      ["left", anchor.x],
      ["right", 1 - anchor.x],
      ["top", anchor.y],
      ["bottom", 1 - anchor.y],
    ];
    distances.sort((a, b) => a[1] - b[1]);
    return distances[0]?.[0] ?? "right";
  }
  if (candidates.length === 1) return candidates[0] as Side;
  const at = anchorPoint(box, anchor);
  const dx = toward.x - at.x;
  const dy = toward.y - at.y;
  const score = (side: Side) => OUTWARD[side].x * dx + OUTWARD[side].y * dy;
  return candidates.reduce((best, side) => (score(side) > score(best) ? side : best));
}

/** The orthogonal router's fixed port for an anchor. */
export function anchorPort(box: Box, anchor: Anchor, toward: Point): FixedPort {
  const side = anchorSide(box, anchor, toward);
  const point = anchorPoint(box, anchor);
  const offset =
    side === "top" || side === "bottom"
      ? point.x - (box.x + box.w / 2)
      : point.y - (box.y + box.h / 2);
  return { side, offset };
}

/** Unit vector pointing out of `side`. */
export function outward(side: Side): Point {
  return OUTWARD[side];
}

/** Where a line from inside `box` towards `toward` crosses the box's outline. */
export function clipToBox(box: Box, inside: Point, toward: Point): Point {
  const dx = toward.x - inside.x;
  const dy = toward.y - inside.y;
  if (dx === 0 && dy === 0) return inside;
  const tx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: inside.x + dx * t, y: inside.y + dy * t };
}

export function centreOf(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}
