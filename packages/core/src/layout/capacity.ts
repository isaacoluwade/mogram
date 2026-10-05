import type { Component, GridSize } from "../model/types";
import { GRID, type Box, type Point } from "./geometry";

/**
 * Room for capacity (D-82). A component that scales out keeps room for its most copies (a grid
 * in a frame that grows and shrinks inside it); one that scales up keeps room for its largest
 * size. Reserving the room means nothing else moves while it scales, and the faint outline of
 * that room shows how far it can go. Pixels unless named otherwise.
 */
export const FLEET = {
  tile: 56,
  gapX: 14,
  gapY: 22,
  padX: 14,
  padTop: 14,
  /** Under the last row: the copies' load bars. */
  padBottom: 18,
  /** The name and count, under the frame. */
  label: 30,
} as const;

export const MACHINE = {
  smallest: { w: 128, h: 108 },
  largest: { w: 216, h: 148 },
  label: 30,
} as const;

/** Columns for a scale set of up to `max` copies. */
export function fleetColumns(max: number): number {
  if (max <= 4) return max;
  if (max <= 8) return 4;
  return 6;
}

/** The frame around `count` copies (fractional while one appears or leaves), in px. */
export function fleetFrame(count: number, max: number): { w: number; h: number } {
  const columns = fleetColumns(max);
  const shown = Math.max(1, count);
  const cols = Math.min(columns, shown);
  const rows = Math.ceil(shown / columns - 1e-9);
  return {
    w: FLEET.padX * 2 + cols * FLEET.tile + (cols - 1) * FLEET.gapX,
    h: FLEET.padTop + rows * FLEET.tile + (rows - 1) * FLEET.gapY + FLEET.padBottom,
  };
}

/** Where a copy's tile sits, from the frame's top-left (slots fill rows left to right). */
export function fleetSlot(slot: number, max: number): Point {
  const columns = fleetColumns(max);
  const col = slot % columns;
  const row = Math.floor(slot / columns);
  return {
    x: FLEET.padX + col * (FLEET.tile + FLEET.gapX),
    y: FLEET.padTop + row * (FLEET.tile + FLEET.gapY),
  };
}

/** A size's panel, growing evenly from the smallest to the largest. */
export function machinePanel(size: number, count: number): { w: number; h: number } {
  const t = count <= 1 ? 1 : Math.min(1, Math.max(0, size / (count - 1)));
  return {
    w: MACHINE.smallest.w + (MACHINE.largest.w - MACHINE.smallest.w) * t,
    h: MACHINE.smallest.h + (MACHINE.largest.h - MACHINE.smallest.h) * t,
  };
}

const units = (px: number) => Math.ceil(px / GRID);

/** The room a component keeps for its capacity, in grid units; null when it doesn't scale. */
export function capacityFootprint(component: Component): GridSize | null {
  const scale = component.scale;
  if (scale === null || component.shape !== null) return null;
  if (scale.kind === "out") {
    const frame = fleetFrame(scale.max, scale.max);
    return { w: units(frame.w), h: units(frame.h + FLEET.label) };
  }
  return { w: units(MACHINE.largest.w), h: units(MACHINE.largest.h + MACHINE.label) };
}

/** Within a footprint, the room the frame or panel can fill (connections attach to it). */
export function capacityRoom(box: Box, component: Component): Box | null {
  const scale = component.scale;
  if (scale === null || component.shape !== null) return null;
  if (scale.kind === "out") {
    const frame = fleetFrame(scale.max, scale.max);
    return { x: box.x, y: box.y, w: frame.w, h: frame.h };
  }
  return {
    x: box.x + (box.w - MACHINE.largest.w) / 2,
    y: box.y,
    w: MACHINE.largest.w,
    h: MACHINE.largest.h,
  };
}
