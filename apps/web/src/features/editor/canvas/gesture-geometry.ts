import { GRID, type Box, type LayoutResult, type Point } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import { viaOrigin } from "@mogram/core/routing";
import type { Camera } from "@/features/canvas/camera";
import type { EditorStore } from "../store/editor-store";
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
    }
  | { kind: "move"; pointerId: number; names: string[]; start: Point; layout: LayoutResult }
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
    }
  | { kind: "connect"; pointerId: number; from: string }
  | {
      kind: "bend";
      pointerId: number;
      connection: string;
      index: number;
      via: Point[];
      layout: LayoutResult;
    }
  | { kind: "pinch"; startDistance: number; startCenter: Point; camera: Camera };

/** Pixels a press must travel before it becomes a drag. */
export const MOVE_THRESHOLD = 3;
export const snap = (value: number): number => Math.round(value / GRID) * GRID;

export function normalize(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
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

/** A connection's stored waypoints in absolute pixels. */
export function currentVia(diagram: Diagram, layout: LayoutResult, name: string): Point[] {
  const connection = diagram.connections.get(name);
  const stored = diagram.layout.get(name)?.via ?? null;
  if (connection === undefined || stored === null) return [];
  const origin = viaOrigin(layout, connection);
  return stored.map((point) => ({ x: origin.x + point.x * GRID, y: origin.y + point.y * GRID }));
}

/** Where a new waypoint at `point` belongs among the existing ones, by distance along the path. */
export function insertionIndex(
  state: ReturnType<EditorStore["getState"]>,
  layout: LayoutResult,
  name: string,
  via: readonly Point[],
  point: Point,
): number {
  if (via.length === 0) return 0;
  const connection = state.diagram().connections.get(name);
  const from =
    connection === undefined
      ? undefined
      : (layout.tiles.get(connection.from.element) ??
        layout.elements.get(connection.from.element)?.box);
  const start = from === undefined ? point : { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const distance = (p: Point): number => Math.hypot(p.x - start.x, p.y - start.y);
  const d = distance(point);
  const index = via.findIndex((p) => distance(p) > d);
  return index === -1 ? via.length : index;
}
