import type { Box, Point } from "@mogram/core/layout";
import { easeInOutCubic } from "@mogram/core/timeline";

/** Screen = world * zoom + (x, y). */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export function toWorld(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.zoom, y: (screen.y - camera.y) / camera.zoom };
}

export function toScreen(camera: Camera, world: Point): Point {
  return { x: world.x * camera.zoom + camera.x, y: world.y * camera.zoom + camera.y };
}

/** Zooms keeping the world point under `anchor` (screen) fixed. */
export function zoomAt(camera: Camera, anchor: Point, zoom: number): Camera {
  const next = clampZoom(zoom);
  const world = toWorld(camera, anchor);
  return { zoom: next, x: anchor.x - world.x * next, y: anchor.y - world.y * next };
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Camera that fits `box` inside the viewport, leaving room for floating chrome via `insets`. */
export function fitBox(
  box: Box,
  viewport: Viewport,
  options: {
    padding?: number;
    maxZoom?: number;
    /** Never zoom out further than this, even if the box then overflows (it stays centred). */
    minZoom?: number;
    insets?: { top: number; right: number; bottom: number; left: number };
  } = {},
): Camera {
  const padding = options.padding ?? 64;
  const insets = options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const width = Math.max(1, viewport.width - insets.left - insets.right - padding * 2);
  const height = Math.max(1, viewport.height - insets.top - insets.bottom - padding * 2);
  const fit = Math.min(width / Math.max(1, box.w), height / Math.max(1, box.h));
  const zoom = clampZoom(Math.min(Math.max(fit, options.minZoom ?? 0), options.maxZoom ?? 1.25));
  const cx = insets.left + padding + width / 2;
  const cy = insets.top + padding + height / 2;
  return { zoom, x: cx - (box.x + box.w / 2) * zoom, y: cy - (box.y + box.h / 2) * zoom };
}

/** Camera centred on a world point at a given zoom, offset into the free area. */
export function centerOn(
  point: Point,
  zoom: number,
  viewport: Viewport,
  offset: Point = { x: 0, y: 0 },
): Camera {
  const z = clampZoom(zoom);
  return {
    zoom: z,
    x: viewport.width / 2 + offset.x - point.x * z,
    y: viewport.height / 2 + offset.y - point.y * z,
  };
}

/**
 * Smooth camera move. The world point at the viewport centre moves in a straight line and zoom
 * interpolates in log space, so the camera glides instead of swinging when zoom changes a lot.
 */
export function lerpCamera(a: Camera, b: Camera, p: number, viewport: Viewport): Camera {
  const t = easeInOutCubic(p);
  const middle = { x: viewport.width / 2, y: viewport.height / 2 };
  const from = toWorld(a, middle);
  const to = toWorld(b, middle);
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t);
  const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  return { zoom, x: middle.x - point.x * zoom, y: middle.y - point.y * zoom };
}

const LINE_PIXELS = 16;
const PAGE_PIXELS = 400;
/** The most one wheel event may zoom: a mouse-wheel notch is ~100px, a pinch step a few. */
const MAX_WHEEL_PIXELS = 24;
const WHEEL_ZOOM_RATE = 0.0085;

/**
 * Zoom factor for one ⌘/Ctrl-wheel event (or trackpad pinch, which browsers send as one).
 * Pinches stay smooth; a mouse-wheel notch zooms ~22% instead of jumping 2×.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaY * (deltaMode === 1 ? LINE_PIXELS : deltaMode === 2 ? PAGE_PIXELS : 1);
  const clamped = Math.max(-MAX_WHEEL_PIXELS, Math.min(MAX_WHEEL_PIXELS, pixels));
  return Math.exp(-clamped * WHEEL_ZOOM_RATE);
}

/**
 * Phones never fit a diagram smaller than this: below it labels are a few pixels tall. The
 * middle of the diagram shows at a readable size and the rest is a pan or pinch away.
 */
export const PHONE_MIN_ZOOM = 0.55;
export const PHONE_WIDTH = 768;

/** Zoom stops for buttons and keys (06 §20 P1-14): 100% is always one of them. */
export const ZOOM_STEPS = [
  0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 2.5, 3, 4,
] as const;

/** The next zoom stop above (`1`) or below (`-1`) `zoom`. */
export function nextZoomStep(zoom: number, direction: 1 | -1): number {
  const epsilon = 0.001;
  if (direction > 0) return ZOOM_STEPS.find((step) => step > zoom + epsilon) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - epsilon) ?? MIN_ZOOM;
}
