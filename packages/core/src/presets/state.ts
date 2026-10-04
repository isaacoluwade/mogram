import type { Tone } from "../model/types";
import type { StatePreset } from "./names";

export type StateBadge = "none" | "dot" | "plus" | "warn" | "bolt" | "cross";

/**
 * Every state preset has a complete built-in look (PR-6). Looks are numeric so scene
 * changes can tween between them (SC-7): ring/desaturate/dim/glow/ghost are 0..1.
 */
export interface StateLook {
  readonly tone: Tone;
  readonly ring: number;
  readonly desaturate: number;
  readonly dim: number;
  readonly glow: number;
  readonly ghost: number;
  readonly badge: StateBadge;
}

export interface StatePresetInfo {
  readonly label: string;
  readonly description: string;
  /** Ordering used by roll-up: higher is worse (D-12). */
  readonly severity: number;
  readonly look: StateLook;
}

export const STATE_INFO: Readonly<Record<StatePreset, StatePresetInfo>> = {
  healthy: {
    label: "Healthy",
    description: "Working normally.",
    severity: 0,
    look: { tone: "neutral", ring: 0, desaturate: 0, dim: 0, glow: 0, ghost: 0, badge: "none" },
  },
  active: {
    label: "Active",
    description: "Serving traffic right now, for example the side that took over in a failover.",
    severity: 1,
    look: { tone: "green", ring: 1, desaturate: 0, dim: 0, glow: 0.35, ghost: 0, badge: "dot" },
  },
  scaling: {
    label: "Scaling",
    description: "Adding or removing capacity.",
    severity: 2,
    look: { tone: "violet", ring: 1, desaturate: 0, dim: 0, glow: 0, ghost: 1, badge: "plus" },
  },
  degraded: {
    label: "Degraded",
    description: "Still working, but slower or with errors.",
    severity: 3,
    look: { tone: "amber", ring: 1, desaturate: 0, dim: 0, glow: 0, ghost: 0, badge: "warn" },
  },
  overloaded: {
    label: "Overloaded",
    description: "Receiving more load than it can handle.",
    severity: 4,
    look: { tone: "orange", ring: 1, desaturate: 0, dim: 0, glow: 1, ghost: 0, badge: "bolt" },
  },
  down: {
    label: "Down",
    description: "Not working. Traffic into it is blocked.",
    severity: 5,
    look: { tone: "rose", ring: 1, desaturate: 1, dim: 0.45, glow: 0, ghost: 0, badge: "cross" },
  },
};

export function severityOf(state: StatePreset): number {
  return STATE_INFO[state].severity;
}
