import type { Intensity, Speed } from "../model/types";
import { clampPeriod } from "../presets/flow";
import { MOTION_INFO } from "../presets/motion";
import type { MotionPreset } from "../presets/names";

/**
 * Every animation in Mogram is a pure function of one shared clock `t` in seconds (PR-9).
 * The live canvas samples these with the current time; export samples them frame by frame, so
 * a GIF is exactly what the canvas showed and loops without a jump (all periods divide 4s).
 */

export interface MotionFrame {
  /** Translation in px. */
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
  /** Degrees. */
  readonly rotate: number;
  /** Halo strength 0..1. */
  readonly glow: number;
}

export const STILL: MotionFrame = { dx: 0, dy: 0, scale: 1, rotate: 0, glow: 0 };

const INTENSITY: Readonly<Record<Intensity, number>> = { low: 0.5, normal: 1, high: 1.6 };

/** Period after the speed option, kept inside the seamless set. */
export function motionPeriod(preset: MotionPreset, speed: Speed): number {
  const base = MOTION_INFO[preset].period;
  return clampPeriod(speed === "fast" ? base / 2 : speed === "slow" ? base * 2 : base);
}

/** Phase 0..1 of `t` within `period`. */
export function phase(t: number, period: number): number {
  const p = (t % period) / period;
  return p < 0 ? p + 1 : p;
}

export function motionAt(
  preset: MotionPreset,
  t: number,
  options: { readonly intensity: Intensity; readonly speed: Speed },
): MotionFrame {
  if (preset === "none") return STILL;
  const amount = INTENSITY[options.intensity];
  const p = phase(t, motionPeriod(preset, options.speed));
  switch (preset) {
    case "pulse":
      return { ...STILL, scale: 1 + 0.07 * amount * (0.5 - 0.5 * Math.cos(2 * Math.PI * p)) };
    case "bounce":
      return { ...STILL, dy: -7 * amount * Math.abs(Math.sin(Math.PI * p)) };
    case "rotate":
      return { ...STILL, rotate: 360 * p };
    case "shake": {
      // Short burst in the first half of each period, then rest — reads as "something's wrong".
      if (p >= 0.5) return STILL;
      const envelope = Math.sin(Math.PI * (p / 0.5));
      return { ...STILL, dx: 3.2 * amount * envelope * Math.sin(2 * Math.PI * 8 * p) };
    }
    case "glow":
      return { ...STILL, glow: Math.min(1, amount * (0.5 - 0.5 * Math.cos(2 * Math.PI * p))) };
  }
}

/** The breathing halo of an overloaded component, 1s period. */
export function overloadGlow(t: number): number {
  return 0.45 + 0.55 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase(t, 1)));
}
