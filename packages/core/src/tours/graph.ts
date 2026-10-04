import type { Tour, TourChoice, TourStep } from "../model/types";

/**
 * Tours are graphs of steps keyed by the element they visit (TO-6). A step without an entry
 * of its own (for example the target of a choice) is an implicit final step.
 */

export function tourStart(tour: Tour): string | null {
  return tour.start ?? tour.steps.keys().next().value ?? null;
}

export function stepFor(tour: Tour, target: string): TourStep {
  return (
    tour.steps.get(target) ?? { target, next: null, scene: null, choices: [], source: tour.source }
  );
}

/** Where each step can go next: the single `next`, or each choice. */
export function exitsOf(step: TourStep): readonly TourChoice[] {
  if (step.choices.length > 0) return step.choices;
  return step.next === null ? [] : [{ label: "Next", next: step.next, scene: null }];
}

/** Every step reachable from the start, breadth-first, each listed once. */
export function reachableSteps(tour: Tour): string[] {
  const start = tourStart(tour);
  if (start === null) return [];
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === undefined) continue;
    for (const exit of exitsOf(stepFor(tour, current))) {
      if (exit.next !== null && !seen.has(exit.next)) {
        seen.add(exit.next);
        queue.push(exit.next);
      }
    }
  }
  return queue;
}

/** The main path: follow `next`, or the first choice, until the end or a repeat. */
export function mainPath(tour: Tour): string[] {
  const start = tourStart(tour);
  if (start === null) return [];
  const path: string[] = [];
  const seen = new Set<string>();
  let current: string | null = start;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    current = exitsOf(stepFor(tour, current))[0]?.next ?? null;
  }
  return path;
}

/** A position in a tour, with history so Back retraces branches and scenes (TO-7). */
export interface TourCursor {
  readonly tour: string;
  readonly step: string;
  /** Scene in effect at this step (`null` = Normal). */
  readonly scene: string | null;
  readonly history: readonly { readonly step: string; readonly scene: string | null }[];
}

export function startCursor(tour: Tour, initialScene: string | null = null): TourCursor | null {
  const start = tourStart(tour);
  if (start === null) return null;
  const first = stepFor(tour, start);
  return { tour: tour.name, step: start, scene: first.scene ?? initialScene, history: [] };
}

/**
 * Moves along exit `index` of the current step. A choice's scene applies on the way; the next
 * step's own scene, if any, applies on arrival (TO-3).
 */
export function advance(tour: Tour, cursor: TourCursor, index = 0): TourCursor | null {
  const exit = exitsOf(stepFor(tour, cursor.step))[index];
  if (exit?.next == null) return null;
  const arriving = stepFor(tour, exit.next);
  return {
    tour: cursor.tour,
    step: exit.next,
    scene: arriving.scene ?? exit.scene ?? cursor.scene,
    history: [...cursor.history, { step: cursor.step, scene: cursor.scene }],
  };
}

export function back(cursor: TourCursor): TourCursor | null {
  const previous = cursor.history[cursor.history.length - 1];
  if (previous === undefined) return null;
  return {
    tour: cursor.tour,
    step: previous.step,
    scene: previous.scene,
    history: cursor.history.slice(0, -1),
  };
}

/**
 * A cursor at `target` as if the person had walked there from the start: the shortest route
 * through `next` and choices, replayed with `advance` so history and scenes are right (deep links
 * to a step, TO-11). Null when the step can't be reached.
 */
export function cursorTo(
  tour: Tour,
  target: string,
  initialScene: string | null = null,
): TourCursor | null {
  const start = startCursor(tour, initialScene);
  if (start === null) return null;
  if (start.step === target) return start;
  const routes = new Map<string, readonly number[]>([[start.step, []]]);
  const queue = [start.step];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === undefined) continue;
    const route = routes.get(current) ?? [];
    exitsOf(stepFor(tour, current)).forEach((exit, index) => {
      if (exit.next === null || routes.has(exit.next)) return;
      routes.set(exit.next, [...route, index]);
      queue.push(exit.next);
    });
  }
  const route = routes.get(target);
  if (route === undefined) return null;
  let cursor: TourCursor | null = start;
  for (const index of route) cursor = cursor === null ? null : advance(tour, cursor, index);
  return cursor;
}

/** 1-based position along the main path, or along the history when off it. */
export function stepNumber(
  tour: Tour,
  cursor: TourCursor,
): { readonly index: number; readonly total: number } {
  const path = mainPath(tour);
  const total = Math.max(path.length, cursor.history.length + 1);
  return { index: cursor.history.length + 1, total };
}
