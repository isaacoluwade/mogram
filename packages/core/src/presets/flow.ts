import type { Density, Speed, Tone } from "../model/types";
import type { FlowPreset } from "./names";

/**
 * Flow presets animate traffic along a connection's routed path (PR-7).
 * Dots move exactly one `spacing` per `period`, so the pattern repeats every period
 * whatever the path length; periods are in {0.25, 0.5, 1, 2, 4}s so every combination
 * loops seamlessly within 4s (PR-9, D-13).
 */
export interface FlowPresetInfo {
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  readonly animated: boolean;
  readonly dashedLine: boolean;
  /** Line opacity 0..1 (dots are drawn on top at full strength). */
  readonly lineOpacity: number;
  /** Base period in seconds for normal speed and density. */
  readonly period: number;
  readonly marker: "none" | "cross";
}

export const FLOW_INFO: Readonly<Record<FlowPreset, FlowPresetInfo>> = {
  traffic: {
    label: "Traffic",
    description: "Requests flowing normally.",
    tone: "green",
    animated: true,
    dashedLine: false,
    lineOpacity: 0.5,
    period: 0.5,
    marker: "none",
  },
  slow: {
    label: "Slow",
    description: "Traffic is getting through, but slowly.",
    tone: "amber",
    animated: true,
    dashedLine: false,
    lineOpacity: 0.5,
    period: 2,
    marker: "none",
  },
  blocked: {
    label: "Blocked",
    description: "Nothing gets through.",
    tone: "rose",
    animated: false,
    dashedLine: true,
    lineOpacity: 0.9,
    period: 1,
    marker: "cross",
  },
  rerouted: {
    label: "Rerouted",
    description: "Traffic is taking this path instead of its usual one.",
    tone: "violet",
    animated: true,
    dashedLine: true,
    lineOpacity: 0.55,
    period: 0.5,
    marker: "none",
  },
  idle: {
    label: "Idle",
    description: "Connected, but nothing is flowing right now.",
    tone: "neutral",
    animated: false,
    dashedLine: false,
    lineOpacity: 0.32,
    period: 1,
    marker: "none",
  },
};

/** Base spacing between dots in px at normal density. */
export const FLOW_DOT_SPACING = 24;

/**
 * Spacing and period for a flow. Density changes spacing and period together so the
 * apparent speed stays the same; speed halves or doubles the period. All results stay
 * inside the seamless set {0.25 … 4}s.
 */
export function flowTiming(
  preset: FlowPreset,
  speed: Speed,
  density: Density,
): { spacing: number; period: number } {
  const base = FLOW_INFO[preset].period;
  const densityFactor = density === "low" ? 2 : density === "high" ? 0.5 : 1;
  const speedFactor = speed === "fast" ? 0.5 : speed === "slow" ? 2 : 1;
  const period = clampPeriod(base * densityFactor * speedFactor);
  return { spacing: FLOW_DOT_SPACING * densityFactor, period };
}

const SEAMLESS_PERIODS = [0.25, 0.5, 1, 2, 4] as const;

export function clampPeriod(period: number): number {
  let best: number = SEAMLESS_PERIODS[0];
  for (const candidate of SEAMLESS_PERIODS) {
    if (Math.abs(candidate - period) < Math.abs(best - period)) best = candidate;
  }
  return best;
}
