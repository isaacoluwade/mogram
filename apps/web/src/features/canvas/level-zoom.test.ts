import { describe, expect, it } from "vitest";
import {
  frameInside,
  innerCamera,
  levelOpacities,
  outerCamera,
  placeInside,
  zoomPath,
} from "./level-zoom";

const tile = { x: 400, y: 200, w: 64, h: 64 };
const inner = { x: -100, y: 0, w: 1200, h: 600 };

describe("nested zoom geometry (NE-6)", () => {
  it("fits the inner diagram inside the tile, centred", () => {
    const placement = placeInside(tile, inner);
    expect(placement.scale).toBeCloseTo(64 / 1200);
    // The inner box's centre lands on the tile's centre.
    const cx = (inner.x + inner.w / 2) * placement.scale + placement.dx;
    const cy = (inner.y + inner.h / 2) * placement.scale + placement.dy;
    expect(cx).toBeCloseTo(tile.x + tile.w / 2);
    expect(cy).toBeCloseTo(tile.y + tile.h / 2);
    // The frame is the tile, seen from inside: it contains the whole inner diagram.
    const frame = frameInside(tile, placement);
    expect(frame.x).toBeLessThanOrEqual(inner.x + 1e-6);
    expect(frame.y).toBeLessThanOrEqual(inner.y + 1e-6);
    expect(frame.x + frame.w).toBeGreaterThanOrEqual(inner.x + inner.w - 1e-6);
  });

  it("converts between the parent's camera and the inner one exactly", () => {
    const placement = placeInside(tile, inner);
    const parent = { zoom: 0.8, x: 120, y: -40 };
    const back = outerCamera(innerCamera(parent, placement), placement);
    expect(back.zoom).toBeCloseTo(parent.zoom);
    expect(back.x).toBeCloseTo(parent.x);
    expect(back.y).toBeCloseTo(parent.y);
    // A point of the inner diagram is drawn where the tile shows it.
    const point = { x: 500, y: 300 };
    const camera = innerCamera(parent, placement);
    const screen = { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
    const world = {
      x: point.x * placement.scale + placement.dx,
      y: point.y * placement.scale + placement.dy,
    };
    expect(screen.x).toBeCloseTo(world.x * parent.zoom + parent.x);
    expect(screen.y).toBeCloseTo(world.y * parent.zoom + parent.y);
  });

  it("zooms about a fixed point and lands exactly on both cameras", () => {
    const from = { zoom: 0.7, x: 100, y: 50 };
    const to = { zoom: 11.2, x: -4200, y: -2100 };
    const path = zoomPath(from, to);
    expect(path(0)).toEqual(from);
    const end = path(1);
    expect(end.zoom).toBeCloseTo(to.zoom);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    // Zoom grows evenly in log space: halfway is the geometric mean.
    expect(path(0.5).zoom).toBeCloseTo(Math.sqrt(from.zoom * to.zoom));
  });

  it("fades the inner level up before the outer one goes", () => {
    expect(levelOpacities(0)).toEqual({ inner: 0, outer: 1 });
    expect(levelOpacities(1)).toEqual({ inner: 1, outer: 0 });
    const mid = levelOpacities(0.5);
    expect(mid.inner).toBe(1);
    expect(mid.outer).toBeGreaterThan(0.8);
  });
});
