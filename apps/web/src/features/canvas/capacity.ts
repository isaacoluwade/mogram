"use client";

import { useMemo, useState } from "react";
import { CapacityTimeline } from "@mogram/core/capacity";
import type { Diagram } from "@mogram/core/model";
import type { ResolvedState } from "@mogram/core/state";

/**
 * A canvas's capacity over time (D-82): one timeline that heads for each new plan from the moment
 * it arrives (a scene change, an edit, or a traffic pattern turning busy or quiet), so copies boot and drain, machines
 * grow and shrink, and queues fill instead of jumping.
 */
export interface CapacityRuntime {
  readonly timeline: CapacityTimeline;
  /** Bumped on every change of plan, so drawing that's settled starts moving again. */
  readonly version: number;
}

class Follower {
  private timeline: CapacityTimeline | null = null;
  private version = 0;
  private last: ResolvedState | null = null;

  follow(
    diagram: Diagram,
    resolved: ResolvedState | null,
    at: number,
    instant: boolean,
  ): CapacityRuntime | null {
    if (resolved === null || !resolved.capacity.active) {
      this.timeline = null;
      this.last = null;
      return null;
    }
    if (this.timeline === null) {
      this.timeline = new CapacityTimeline(
        resolved.capacity,
        diagram,
        at,
        resolved.capacityOverTime,
      );
    } else if (resolved !== this.last) {
      this.timeline.update(resolved.capacity, diagram, at, instant, resolved.capacityOverTime);
      this.version++;
    }
    this.last = resolved;
    return { timeline: this.timeline, version: this.version };
  }
}

/**
 * Follows the resolved state of a live canvas. `instant` (reduced motion, motion paused) jumps to
 * each new picture instead of animating to it.
 */
export function useCapacity(
  diagram: Diagram,
  resolved: ResolvedState | null,
  now: () => number,
  instant: boolean,
): CapacityRuntime | null {
  const [follower] = useState(() => new Follower());
  // Following is idempotent for the same state, so a repeated render changes nothing.
  return useMemo(
    () => follower.follow(diagram, resolved, now(), instant),
    // `now` is read when the state changes, not a reason to follow again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [follower, diagram, resolved, instant],
  );
}

/** A still picture (thumbnails, single-frame exports): the plan as it settles. */
export function settledCapacity(diagram: Diagram, resolved: ResolvedState): CapacityRuntime | null {
  return resolved.capacity.active
    ? {
        timeline: new CapacityTimeline(resolved.capacity, diagram, 0, resolved.capacityOverTime),
        version: 0,
      }
    : null;
}
