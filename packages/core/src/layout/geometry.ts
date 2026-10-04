/**
 * Diagram geometry (D-11). Stored coordinates are grid units; rendering uses pixels.
 */

/** Pixels per grid unit (ED-9). */
export const GRID = 8;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Component footprint, in grid units: icon tile on top, label underneath. */
export const COMPONENT_UNITS = { w: 12, h: 12 } as const;
/** Icon tile inside the footprint, in pixels. Connections attach to the tile. */
export const TILE = { size: 56, offsetX: 20, offsetY: 4 } as const;
/** Label baseline area inside the footprint, in pixels. */
export const LABEL = { top: 68, lineHeight: 15, maxWidth: 120 } as const;

/** Container chrome, in grid units. */
export const CONTAINER_UNITS = { header: 4, padding: 3, minW: 20, minH: 12 } as const;

/** Spacing used when Mogram places unpinned elements, in grid units. */
export const PLACEMENT_UNITS = { gapX: 6, gapY: 4 } as const;

/** Group outline distance from its members, in pixels. */
export const GROUP_PADDING = 12;

export function toPx(units: number): number {
  return units * GRID;
}

/** Nearest whole grid unit — positions are always whole numbers (ED-9). */
export function toUnits(px: number): number {
  return Math.round(px / GRID);
}

export function snapPx(px: number): number {
  return toUnits(px) * GRID;
}

export function union(boxes: Iterable<Box>): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

export function inflate(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 };
}

export function translate(box: Box, dx: number, dy: number): Box {
  return { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
}

export function contains(box: Box, point: Point): boolean {
  return (
    point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h
  );
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function center(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** The icon tile of a component whose footprint is `box`. */
export function tileOf(box: Box): Box {
  return { x: box.x + TILE.offsetX, y: box.y + TILE.offsetY, w: TILE.size, h: TILE.size };
}

/** Rough text width for layout decisions; rendering measures properly. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.56);
}
