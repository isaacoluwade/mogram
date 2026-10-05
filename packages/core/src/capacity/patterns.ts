import type { Diagram, SceneCapacity, TrafficPattern } from "../model/types";
import type { CapacityPlan } from "./plan";

/**
 * Capacity when traffic follows patterns (D-84): the plan at any moment, when it next changes,
 * how long until it all repeats, and the plans when everything is quiet and when it's busy (for
 * saying what happens in words).
 */
export interface CapacityOverTime {
  planAt(time: number): CapacityPlan;
  nextChange(after: number): number;
  readonly cycle: number;
  readonly quiet: CapacityPlan;
  readonly busy: CapacityPlan;
}

/**
 * Traffic patterns (D-84): how much a connection carries at each moment, in steps (quiet, then
 * busy), so the plan changes at a few known times and the timeline turns each change into
 * motion. Time is the clock's, in seconds; every cycle starts quiet.
 */

export const PATTERN_DEFAULTS: Readonly<Record<TrafficPattern["kind"], TrafficPattern>> = {
  waves: { kind: "waves", high: 5, low: 1, every: 10 },
  bursts: { kind: "bursts", high: 5, low: 0.5, every: 12 },
};

/** The shortest cycle: anything shorter can't show copies starting and leaving. */
export const SHORTEST_CYCLE = 4;
export const LONGEST_CYCLE = 120;

/** When, within a cycle (0–1), it turns busy; it turns quiet again at the cycle's end. */
const BUSY_FROM: Readonly<Record<TrafficPattern["kind"], number>> = { waves: 0.5, bursts: 0.75 };

/**
 * Whether the pattern is busy at time `t`. A hair after the moment it changes counts as after,
 * so the plan at a change (computed from rounded times) is always the new one.
 */
export function isBusy(pattern: TrafficPattern, t: number): boolean {
  const cycles = (t + 1e-6) / pattern.every;
  return cycles - Math.floor(cycles) >= BUSY_FROM[pattern.kind];
}

/** The level the pattern carries at time `t`. */
export function patternLevel(pattern: TrafficPattern, t: number): number {
  return isBusy(pattern, t) ? pattern.high : pattern.low;
}

/** The first time strictly after `after` at which the pattern changes level. */
export function nextPatternChange(pattern: TrafficPattern, after: number): number {
  const cycle = pattern.every;
  const first = Math.floor(after / cycle);
  for (let k = first; k <= first + 1; k++)
    for (const at of [(k + BUSY_FROM[pattern.kind]) * cycle, (k + 1) * cycle])
      if (at > after) return at;
  return (first + 2) * cycle;
}

/** The patterns in effect: a scene's own traffic level on a connection holds it steady. */
export function activePatterns(
  diagram: Diagram,
  overrides?: ReadonlyMap<string, SceneCapacity>,
): readonly TrafficPattern[] {
  const out: TrafficPattern[] = [];
  for (const connection of diagram.connections.values())
    if (connection.pattern !== null && overrides?.get(connection.name)?.traffic === undefined)
      out.push(connection.pattern);
  return out;
}

/** How long until everything repeats: the cycles' least common multiple (in half seconds). */
export function patternCycle(patterns: readonly TrafficPattern[]): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let lcm = 0;
  for (const pattern of patterns) {
    const halves = Math.max(1, Math.round(pattern.every * 2));
    lcm = lcm === 0 ? halves : (lcm * halves) / gcd(lcm, halves);
    if (lcm > LONGEST_CYCLE * 2) return LONGEST_CYCLE;
  }
  return lcm / 2;
}

/** "rises and falls between 1× and 5× every 10 s" */
export function describePattern(pattern: TrafficPattern): string {
  const x = (n: number) => `${Math.round(n * 100) / 100}×`;
  return pattern.kind === "waves"
    ? `rises and falls between ${x(pattern.low)} and ${x(pattern.high)} every ${pattern.every} s`
    : `runs at ${x(pattern.low)} with a burst of ${x(pattern.high)} every ${pattern.every} s`;
}
