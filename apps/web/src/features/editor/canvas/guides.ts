import { GRID, type Box } from "@mogram/core/layout";

/**
 * Smart guides while moving (06-canvas-interactions §8, §20 P1-7): the moving bounds line up
 * with a neighbour's left, centre or right (top, middle or bottom), or sit at an equal gap
 * between two neighbours. Positions are whole grid cells, so a guide only pulls the move by a
 * whole cell, and only within one cell of lining up; otherwise the grid position stands.
 */

/** A line where edges or centres line up: at `at` on `axis`, drawn from `from` to `to`. */
export interface AlignGuide {
  readonly kind: "align";
  readonly axis: "x" | "y";
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/** Equal gaps either side of the moving bounds: each gap from `from` to `to` at `cross`. */
export interface SpacingGuide {
  readonly kind: "spacing";
  readonly axis: "x" | "y";
  readonly gaps: readonly { readonly from: number; readonly to: number; readonly cross: number }[];
}

export type Guide = AlignGuide | SpacingGuide;

export interface GuideSnap {
  readonly dx: number;
  readonly dy: number;
  readonly guides: readonly Guide[];
}

/** How far a guide may pull the move, in px: one grid cell. */
const PULL = GRID;

const lines = (box: Box, axis: "x" | "y"): readonly number[] =>
  axis === "x"
    ? [box.x, box.x + box.w / 2, box.x + box.w]
    : [box.y, box.y + box.h / 2, box.y + box.h];

const shift = (box: Box, dx: number, dy: number): Box => ({ ...box, x: box.x + dx, y: box.y + dy });

/** The nearest whole-cell pull (|pull| ≤ PULL) that lines `box` up with one of `others`. */
function bestAlignment(box: Box, others: readonly Box[], axis: "x" | "y"): number | null {
  let best: { pull: number; distance: number } | null = null;
  const mine = lines(box, axis);
  for (const other of others) {
    const theirs = lines(other, axis);
    // How far apart they sit across the other axis: the closest neighbour wins a tie.
    const distance =
      axis === "x"
        ? Math.max(0, other.y - (box.y + box.h), box.y - (other.y + other.h))
        : Math.max(0, other.x - (box.x + box.w), box.x - (other.x + other.w));
    for (const a of mine) {
      for (const b of theirs) {
        const pull = b - a;
        if (Math.abs(pull) > PULL || pull % GRID !== 0) continue;
        if (
          best === null ||
          Math.abs(pull) < Math.abs(best.pull) ||
          (Math.abs(pull) === Math.abs(best.pull) && distance < best.distance)
        )
          best = { pull, distance };
      }
    }
  }
  return best?.pull ?? null;
}

/** Guides for every line `box` shares with `others`, each spanning just the shapes on it. */
function alignGuides(box: Box, others: readonly Box[], axis: "x" | "y"): AlignGuide[] {
  const guides: AlignGuide[] = [];
  for (const at of lines(box, axis)) {
    const on = others.filter((other) =>
      lines(other, axis).some((line) => Math.abs(line - at) < 0.5),
    );
    if (on.length === 0) continue;
    const spans = [box, ...on].map((b) => (axis === "x" ? [b.y, b.y + b.h] : [b.x, b.x + b.w]));
    guides.push({
      kind: "align",
      axis,
      at,
      from: Math.min(...spans.map((s) => s[0] ?? 0)),
      to: Math.max(...spans.map((s) => s[1] ?? 0)),
    });
  }
  return guides;
}

/**
 * Equal spacing between the nearest neighbours on each side that overlap the box across the
 * axis: the pull that makes both gaps equal (whole cells, within one cell), or null.
 */
function equalSpacing(
  box: Box,
  others: readonly Box[],
  axis: "x" | "y",
): { pull: number; guide: SpacingGuide } | null {
  const overlaps = (other: Box) =>
    axis === "x"
      ? other.y < box.y + box.h && other.y + other.h > box.y
      : other.x < box.x + box.w && other.x + other.w > box.x;
  const start = (b: Box) => (axis === "x" ? b.x : b.y);
  const end = (b: Box) => (axis === "x" ? b.x + b.w : b.y + b.h);
  const before = others
    .filter((o) => overlaps(o) && end(o) <= start(box) + PULL)
    .sort((a, b) => end(b) - end(a))[0];
  const after = others
    .filter((o) => overlaps(o) && start(o) >= end(box) - PULL)
    .sort((a, b) => start(a) - start(b))[0];
  if (before === undefined || after === undefined) return null;
  const left = start(box) - end(before);
  const right = start(after) - end(box);
  const pull = (right - left) / 2;
  if (Math.abs(pull) > PULL || pull % GRID !== 0 || left + pull <= 0) return null;
  const moved = axis === "x" ? shift(box, pull, 0) : shift(box, 0, pull);
  const cross = (b: Box) =>
    axis === "x"
      ? (Math.max(b.y, moved.y) + Math.min(b.y + b.h, moved.y + moved.h)) / 2
      : (Math.max(b.x, moved.x) + Math.min(b.x + b.w, moved.x + moved.w)) / 2;
  return {
    pull,
    guide: {
      kind: "spacing",
      axis,
      gaps: [
        { from: end(before), to: start(moved), cross: cross(before) },
        { from: end(moved), to: start(after), cross: cross(after) },
      ],
    },
  };
}

/**
 * Where the moving `box` (already moved by the grid-snapped dx, dy) should land, and the guides
 * to draw. Equal spacing wins over alignment on an axis, as in draw.io.
 */
export function snapToGuides(box: Box, others: readonly Box[], dx: number, dy: number): GuideSnap {
  let moved = shift(box, dx, dy);
  let pullX: number | null = null;
  let pullY: number | null = null;
  const spacingX = equalSpacing(moved, others, "x");
  const spacingY = equalSpacing(moved, others, "y");
  pullX = spacingX?.pull ?? bestAlignment(moved, others, "x");
  pullY = spacingY?.pull ?? bestAlignment(moved, others, "y");
  moved = shift(moved, pullX ?? 0, pullY ?? 0);
  const guides: Guide[] = [
    ...(spacingX === null ? alignGuides(moved, others, "x") : [spacingX.guide]),
    ...(spacingY === null ? alignGuides(moved, others, "y") : [spacingY.guide]),
  ];
  return { dx: dx + (pullX ?? 0), dy: dy + (pullY ?? 0), guides };
}
