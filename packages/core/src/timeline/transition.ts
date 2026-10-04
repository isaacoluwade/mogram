import { formatColor, parseColor } from "../presets/color";
import type { StateLook } from "../presets/state";

// Kept on the timeline entry point, where they were first published.
export { formatColor, parseColor };

/** How long a scene change takes to animate (SC-7), in seconds. */
export const SCENE_TRANSITION = 0.6;

export function easeInOutCubic(x: number): number {
  const v = Math.min(1, Math.max(0, x));
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

/** Eased progress 0..1 of a transition that started at `start`. */
export function transitionProgress(t: number, start: number, duration = SCENE_TRANSITION): number {
  if (duration <= 0) return 1;
  return easeInOutCubic((t - start) / duration);
}

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

export interface MixedLook {
  readonly from: StateLook;
  readonly to: StateLook;
  readonly ring: number;
  readonly desaturate: number;
  readonly dim: number;
  readonly glow: number;
  readonly ghost: number;
  /** Badge crossfade: 0 shows `from.badge`, 1 shows `to.badge`. */
  readonly progress: number;
}

/** Numeric blend of two state looks; tones are blended by the renderer with `mixColor`. */
export function mixLook(from: StateLook, to: StateLook, p: number): MixedLook {
  return {
    from,
    to,
    ring: lerp(from.ring, to.ring, p),
    desaturate: lerp(from.desaturate, to.desaturate, p),
    dim: lerp(from.dim, to.dim, p),
    glow: lerp(from.glow, to.glow, p),
    ghost: lerp(from.ghost, to.ghost, p),
    progress: p,
  };
}

export function mixColor(from: string, to: string, p: number): string {
  if (p <= 0) return from;
  if (p >= 1) return to;
  const a = parseColor(from);
  const b = parseColor(to);
  return formatColor({
    r: lerp(a.r, b.r, p),
    g: lerp(a.g, b.g, p),
    b: lerp(a.b, b.b, p),
    a: lerp(a.a, b.a, p),
  });
}

export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return formatColor({ ...c, a: c.a * alpha });
}
