import type { Box, Point } from "@mogram/core/layout";
import { easeInOutCubic } from "@mogram/core/timeline";
import {
  clampZoom,
  lerpCamera,
  PHONE_WIDTH as PHONE,
  type Camera,
  type Viewport,
} from "@/features/canvas/camera";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";

/** Free space around the chrome, so framing never hides things under a panel. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Space left for the diagram when a card is open: beside it on desktop, above it on phones. */
export function cardInsets(viewport: Viewport, present: boolean): Insets {
  if (viewport.width < PHONE)
    return {
      top: present ? 16 : 64,
      right: 16,
      bottom: Math.round(viewport.height * 0.5),
      left: 16,
    };
  return { top: present ? 24 : 72, right: 420, bottom: present ? 120 : 96, left: 32 };
}

export function chromeInsets(viewport: Viewport, present: boolean): Insets {
  if (viewport.width < PHONE)
    return { top: present ? 16 : 64, right: 16, bottom: present ? 72 : 96, left: 16 };
  return { top: present ? 24 : 72, right: 32, bottom: present ? 72 : 96, left: 32 };
}

/** Camera that puts `box` in the middle of the free area at a comfortable reading zoom. */
export function focusCamera(box: Box, viewport: Viewport, insets: Insets, zoom?: number): Camera {
  const width = Math.max(1, viewport.width - insets.left - insets.right);
  const height = Math.max(1, viewport.height - insets.top - insets.bottom);
  const z = clampZoom(
    zoom ?? Math.min(1.5, Math.max(0.75, Math.min(width / (box.w + 360), height / (box.h + 240)))),
  );
  const cx = insets.left + width / 2;
  const cy = insets.top + height / 2;
  return { zoom: z, x: cx - (box.x + box.w / 2) * z, y: cy - (box.y + box.h / 2) * z };
}

/** Screen-space centre of the free area (where the camera keeps its subject). */
export function focalPoint(viewport: Viewport, insets: Insets): Point {
  return {
    x: insets.left + (viewport.width - insets.left - insets.right) / 2,
    y: insets.top + (viewport.height - insets.top - insets.bottom) / 2,
  };
}

/**
 * Drives the viewer camera with requestAnimationFrame. One animation at a time: starting a new
 * one (or the person grabbing the canvas) cancels the current one, whose promise then resolves
 * with `false`.
 */
export class CameraAnimator {
  private frame: number | null = null;
  private finish: ((completed: boolean) => void) | null = null;

  constructor(
    private readonly read: () => Camera,
    private readonly write: (camera: Camera) => void,
    private readonly viewport: () => Viewport,
    private readonly onActive: (active: boolean) => void,
  ) {}

  cancel(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    const finish = this.finish;
    this.finish = null;
    if (finish !== null) {
      this.onActive(false);
      finish(false);
    }
  }

  /** Glides to `target` (zoom in log space, so big zoom changes don't swing). */
  to(target: Camera, duration = 700): Promise<boolean> {
    const start = this.read();
    return this.run(duration, (p) => lerpCamera(start, target, p, this.viewport()), target);
  }

  /**
   * Rides a routed connection (TO-2, CA-4): the camera's focal point travels along `points`
   * at `zoom`, so the person sees the path the traffic takes, then settles on `end`.
   */
  async along(points: readonly Point[], focal: Point, zoom: number, end: Camera): Promise<boolean> {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      lengths.push(
        (lengths[i - 1] ?? 0) +
          (a === undefined || b === undefined ? 0 : Math.hypot(b.x - a.x, b.y - a.y)),
      );
    }
    const total = lengths[lengths.length - 1] ?? 0;
    if (points.length < 2 || total < 1) return this.to(end);
    const first = points[0] ?? { x: 0, y: 0 };
    const startCamera = { zoom, x: focal.x - first.x * zoom, y: focal.y - first.y * zoom };
    // Get onto the path first (usually already there: the previous step was framed on it).
    if (!(await this.to(startCamera, 380))) return false;
    const duration = Math.min(2400, Math.max(700, (total / 520) * 1000));
    const at = (distance: number): Point => {
      let i = 1;
      while (i < lengths.length - 1 && (lengths[i] ?? 0) < distance) i++;
      const a = points[i - 1] ?? first;
      const b = points[i] ?? a;
      const span = (lengths[i] ?? 0) - (lengths[i - 1] ?? 0);
      const t = span <= 0 ? 0 : (distance - (lengths[i - 1] ?? 0)) / span;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    const rode = await this.run(
      duration,
      (p) => {
        const point = at(easeInOutCubic(p) * total);
        return { zoom, x: focal.x - point.x * zoom, y: focal.y - point.y * zoom };
      },
      null,
    );
    if (!rode) return false;
    return this.to(end, 420);
  }

  private run(
    duration: number,
    frame: (p: number) => Camera,
    final: Camera | null,
  ): Promise<boolean> {
    this.cancel();
    // Reduced motion: the camera cuts instead of gliding.
    if (prefersReducedMotion() || duration <= 0) {
      this.write(final ?? frame(1));
      return Promise.resolve(true);
    }
    this.onActive(true);
    return new Promise((resolve) => {
      this.finish = resolve;
      const started = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - started) / duration);
        this.write(p >= 1 && final !== null ? final : frame(p));
        if (p < 1) {
          this.frame = requestAnimationFrame(tick);
          return;
        }
        this.frame = null;
        this.finish = null;
        this.onActive(false);
        resolve(true);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }
}
