import type { ShapeId } from "@mogram/core/presets";
import type { RoutedPath } from "@mogram/core/routing";
import { GRID, type Box, type LayoutResult, type Point } from "@mogram/core/layout";
import type { Camera } from "@/features/canvas/camera";
import type { ConnectionDrag } from "./connection-drag";
import type { ResizeHandle } from "./overlays";

/** What the pointer is doing on the editor canvas, from press to release. */
export type Gesture =
  | { kind: "pan"; pointerId: number; start: Point; camera: Camera }
  | {
      kind: "press";
      pointerId: number;
      element: string;
      start: Point;
      startScreen: Point;
      additive: boolean;
      wasSelected: boolean;
      /** Pressed on a connection's label: the label's centre (ED-29). */
      label: Point | null;
      /** How far it has to move to become a drag: farther for a finger or pen. */
      threshold: number;
    }
  | {
      kind: "move";
      pointerId: number;
      names: string[];
      start: Point;
      layout: LayoutResult;
      /** Routes at the start, when one component moves: it can be dropped onto a connection. */
      routes: ReadonlyMap<string, RoutedPath> | null;
      /** The moving bounds and what they can line up with (smart guides). */
      bounds: Box | null;
      neighbours: readonly Box[];
      /** The offset the last preview used (grid plus guides), which the drop commits. */
      offset: { dx: number; dy: number };
    }
  | {
      kind: "marquee";
      pointerId: number;
      start: Point;
      base: readonly string[];
      /** Laid out once at the start: nothing moves while a selection box is drawn. */
      layout: LayoutResult;
    }
  | { kind: "draw"; pointerId: number; start: Point; tool: "container" | "zone" }
  | {
      kind: "resize";
      pointerId: number;
      name: string;
      handle: ResizeHandle;
      start: Point;
      at: { x: number; y: number };
      size: { w: number; h: number };
      minW: number;
      minH: number;
      isZone: boolean;
      /** Sizes of the siblings it can match, in grid units (size guides). */
      siblings: readonly { readonly name: string; readonly w: number; readonly h: number }[];
    }
  | {
      kind: "adjust";
      pointerId: number;
      name: string;
      shape: ShapeId;
      /** The shape's box in world px, as laid out when the handle was pressed. */
      box: Box;
      /** The typing session its edits merge under: one undo step, reverted by Escape. */
      session: string;
      last: number | null;
    }
  | {
      kind: "connect";
      pointerId: number;
      from: string;
      /** Which hover arrow was pressed: a click on it adds a connected copy that way. */
      direction: "up" | "right" | "down" | "left" | null;
      startScreen: Point;
    }
  | { kind: "path"; pointerId: number; drag: ConnectionDrag; startScreen: Point; moved: boolean }
  | { kind: "pinch"; startDistance: number; startCenter: Point; camera: Camera };

/** Pixels a press must travel before it becomes a drag. */
export const MOVE_THRESHOLD = 3;
/** A finger or pen wobbles more than a mouse: 12 px before a press becomes a drag (06 §20). */
export const TOUCH_THRESHOLD = 12;

export const thresholdFor = (pointerType: string): number =>
  pointerType === "mouse" ? MOVE_THRESHOLD : TOUCH_THRESHOLD;
export const snap = (value: number): number => Math.round(value / GRID) * GRID;

export function normalize(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/** Whether two boxes overlap at all. */
export function touches(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function intersectsFully(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function sameParents(
  layout: LayoutResult,
  names: readonly string[],
  target: string | null,
): boolean {
  return names.every((name) => (layout.elements.get(name)?.parent ?? null) === target);
}
