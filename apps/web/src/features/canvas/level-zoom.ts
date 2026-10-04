import type { Box } from "@mogram/core/layout";
import type { Camera } from "./camera";

/**
 * The geometry of going into a nested diagram (NE-6): the inner diagram is drawn inside its
 * component's tile, so one camera move zooms through the tile and lands on the inner diagram
 * exactly where its own camera frames it. Going back out is the same move in reverse.
 */

/** How the inner diagram sits in the parent's world: scaled to fit the tile and centred in it. */
export interface Placement {
  readonly scale: number;
  readonly dx: number;
  readonly dy: number;
}

export function placeInside(tile: Box, inner: Box): Placement {
  const scale = Math.min(tile.w / Math.max(1, inner.w), tile.h / Math.max(1, inner.h));
  return {
    scale,
    dx: tile.x + tile.w / 2 - (inner.x + inner.w / 2) * scale,
    dy: tile.y + tile.h / 2 - (inner.y + inner.h / 2) * scale,
  };
}

/** The inner diagram's camera while the parent's camera is `outer`. */
export function innerCamera(outer: Camera, placement: Placement): Camera {
  return {
    zoom: outer.zoom * placement.scale,
    x: outer.x + placement.dx * outer.zoom,
    y: outer.y + placement.dy * outer.zoom,
  };
}

/** The parent's camera that shows the inner diagram through `inner`. */
export function outerCamera(inner: Camera, placement: Placement): Camera {
  const zoom = inner.zoom / placement.scale;
  return { zoom, x: inner.x - placement.dx * zoom, y: inner.y - placement.dy * zoom };
}

/** The tile's area in the inner diagram's world: the frame the inner diagram is seen through. */
export function frameInside(tile: Box, placement: Placement): Box {
  return {
    x: (tile.x - placement.dx) / placement.scale,
    y: (tile.y - placement.dy) / placement.scale,
    w: tile.w / placement.scale,
    h: tile.h / placement.scale,
  };
}

/**
 * A camera move that zooms about the one screen point both cameras agree on, with zoom changing
 * in log space: it reads as a straight push in (or pull back), never a swing. `t` runs 0 → 1.
 */
export function zoomPath(from: Camera, to: Camera): (t: number) => Camera {
  const ratio = to.zoom / from.zoom;
  if (Math.abs(Math.log(ratio)) < 1e-4) {
    return (t) => ({
      zoom: from.zoom + (to.zoom - from.zoom) * t,
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
  }
  // The world point both cameras put at the same place on screen.
  const wx = (from.x - to.x) / (to.zoom - from.zoom);
  const wy = (from.y - to.y) / (to.zoom - from.zoom);
  const sx = wx * from.zoom + from.x;
  const sy = wy * from.zoom + from.y;
  return (t) => {
    const zoom = from.zoom * ratio ** t;
    return { zoom, x: sx - wx * zoom, y: sy - wy * zoom };
  };
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * What each level shows at progress `p` (0 = outside, 1 = inside): the inner diagram fades up
 * through the opening tile, then the parent around it fades away.
 */
export function levelOpacities(p: number): { readonly outer: number; readonly inner: number } {
  return { inner: smoothstep(0.08, 0.5, p), outer: 1 - smoothstep(0.45, 0.92, p) };
}

/** Longer for bigger zooms, within limits that keep it brisk. */
export function zoomDuration(from: Camera, to: Camera, direction: "in" | "out"): number {
  const stops = Math.abs(Math.log2(to.zoom / from.zoom));
  const base = direction === "in" ? 620 : 520;
  return Math.round(Math.min(1100, Math.max(base, base + stops * 70)));
}
