import type { MotionPreset } from "./names";

/** Motion applies to the whole icon (PR-3); periods divide 4s evenly (PR-9). */
export interface MotionPresetInfo {
  readonly label: string;
  readonly description: string;
  readonly period: number;
}

export const MOTION_INFO: Readonly<Record<MotionPreset, MotionPresetInfo>> = {
  none: { label: "None", description: "No motion.", period: 1 },
  pulse: { label: "Pulse", description: "Gently grows and shrinks, like a heartbeat.", period: 2 },
  bounce: { label: "Bounce", description: "Hops up and down.", period: 1 },
  rotate: { label: "Rotate", description: "Turns slowly in a full circle.", period: 4 },
  shake: { label: "Shake", description: "Shakes in short bursts, to signal trouble.", period: 1 },
  glow: { label: "Glow", description: "A soft halo brightens and fades.", period: 2 },
};
