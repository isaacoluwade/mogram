import { farthestCorner } from "@mogram/core/presets";

/**
 * Where SVG gradients run for a box, matching what CSS draws for the same paint (`paintCss` in
 * `@mogram/core/presets`), so exports look like the live canvas.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The line a CSS linear gradient runs along for `box`: through the centre at `angle` (0 up,
 * 90 right), long enough that the corners get the first and last colours.
 */
export function linearLine(angle: number, box: Box) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/**
 * A CSS radial gradient's ellipse for `box`. Without a radius it reaches the farthest corner,
 * which in the box's own proportions is a circle of that many box units.
 */
export function radialEllipse(
  center: { x: number; y: number },
  radius: { x: number; y: number } | null,
  box: Box,
) {
  const corner = farthestCorner(center);
  const rx = (radius?.x ?? corner) * box.w;
  const ry = (radius?.y ?? corner) * box.h;
  return { cx: box.x + center.x * box.w, cy: box.y + center.y * box.h, rx, ry };
}
