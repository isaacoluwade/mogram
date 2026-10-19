import type { Diagram, StoryStep } from "../model/types";
import { SCENE_TRANSITION } from "../timeline/transition";
import { nextBeat, startStory, stepAt, type StoryCursor } from "./moment";
import type { ControlValues } from "./values";

/**
 * A story's written times (D-86): what an export, a thumbnail and Play follow, so they agree.
 * A step is its change, then its hold. Stepping by hand ignores the holds: the viewer moves on
 * when they're ready.
 */
export const STEP_CHANGE = SCENE_TRANSITION;
/** `pace: slow`: the change takes twice as long, for the moment it all turns on. */
export const STEP_CHANGE_SLOW = SCENE_TRANSITION * 2;
/** A rewind cuts back this quickly, then the step's own changes play. */
export const REWIND_CUT = 0.45;
/** A wordless step between others of its beat stays this long before the next starts. */
export const STEP_GAP = 0.35;
/** The opening picture stays this long before the first step. */
export const OPENING_HOLD = 1.5;

/** Seconds a caption needs: a pause to find it, then about three words a second. */
export function readingTime(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "").length;
  return Math.min(9, Math.max(2.4, 1.2 + words / 3));
}

/** Seconds a script takes to say: a breath, then about 3.2 words a second. */
export function speakingTime(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "").length;
  return 0.4 + words / 3.2;
}

export function stepChange(step: StoryStep): number {
  return step.pace === "slow" ? STEP_CHANGE_SLOW : STEP_CHANGE;
}

/** How long a step stays once changed. `caption` is the words showing while it does. */
export function stepHold(
  step: StoryStep,
  endsBeat: boolean,
  caption: string | null,
  script: string | null = null,
): number {
  if (step.hold !== null) return step.hold;
  if (!endsBeat) return STEP_GAP;
  // A beat with a script lasts as long as it takes to say.
  if (script !== null) return speakingTime(script);
  return caption === null ? 1.2 : readingTime(caption);
}

/** One change of picture on a story's timeline. */
export interface StorySegment {
  /** The picture it changes from, and to. */
  readonly from: StoryCursor;
  readonly to: StoryCursor;
  /** When the change starts, and how long it takes. */
  readonly start: number;
  readonly change: number;
  /** When the next segment starts (or the story ends). */
  readonly end: number;
  /** Which beat it belongs to, counting from 0. */
  readonly beat: number;
  /** The last change of its beat. */
  readonly endsBeat: boolean;
}

export interface StoryTimeline {
  readonly opening: StoryCursor;
  readonly segments: readonly StorySegment[];
  readonly duration: number;
  /** How many beats it has. */
  readonly beats: number;
}

/** A story's timeline along the path that takes no choices. Null when there is no such story. */
export function storyTimeline(
  diagram: Diagram,
  story?: string,
  controls?: ControlValues,
): StoryTimeline | null {
  const opening = startStory(diagram, story);
  if (opening === null) return null;
  const segments: StorySegment[] = [];
  let at = OPENING_HOLD;
  let cursor = opening;
  for (let beat = 0; beat < 400; beat++) {
    const cursors = nextBeat(diagram, cursor, controls);
    if (cursors.length === 0) break;
    let caption: string | null = null;
    let script: string | null = null;
    cursors.forEach((to, index) => {
      const ref = to.played.at(-1);
      const step = ref === undefined ? null : stepAt(diagram, ref);
      if (step === null) return;
      caption = step.say ?? caption;
      script = step.script ?? script;
      const endsBeat = index === cursors.length - 1;
      const change = to.rewound ? REWIND_CUT : stepChange(step);
      const hold = to.rewound ? 0 : stepHold(step, endsBeat, caption, script);
      segments.push({
        from: cursor,
        to,
        start: at,
        change,
        end: at + change + hold,
        beat,
        endsBeat,
      });
      at += change + hold;
      cursor = to;
    });
  }
  return { opening, segments, duration: at, beats: (segments.at(-1)?.beat ?? -1) + 1 };
}

/** The segment under way at time `t` (the last one that has started), or null in the opening. */
export function segmentAt(timeline: StoryTimeline, t: number): StorySegment | null {
  let found: StorySegment | null = null;
  for (const segment of timeline.segments) {
    if (segment.start > t) break;
    found = segment;
  }
  return found;
}
