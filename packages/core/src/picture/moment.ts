import type { Diagram, Story, StoryChoice, StoryStep } from "../model/types";
import { stepPlays, type ControlValues } from "./values";

/**
 * Where someone is in a diagram (D-86): the scene picked, and how far into a story. Everything
 * that draws a diagram (the editor, the viewer, previews, exports, links) is given one of these,
 * and `pictureAt` turns it into what's there.
 */
export interface Moment {
  readonly scene: string | null;
  readonly story: StoryCursor | null;
  /** What the viewer has set the controls to (D-88); left out, each is where it starts. */
  readonly controls?: ControlValues;
}

export const NOW: Moment = { scene: null, story: null };

/** The moment of a scene on its own, with no story under way. */
export function sceneMoment(scene: string | null): Moment {
  return scene === null ? NOW : { scene, story: null };
}

/** A step of a story, by where it's written. */
export interface StepRef {
  readonly story: string;
  readonly index: number;
}

/** A story under way, and the step it plays next. */
export interface StoryFrame {
  readonly story: string;
  readonly next: number;
}

/**
 * How far into a story someone is. The picture is the diagram plus every step played, so the
 * cursor keeps them all, in order, through any stories a choice played on the way.
 */
export interface StoryCursor {
  /** The story begun. */
  readonly story: string;
  readonly played: readonly StepRef[];
  /** Stories under way, outermost first. Empty once the story has ended. */
  readonly stack: readonly StoryFrame[];
  /** The cursor as each beat played began, oldest first: how to go back. */
  readonly beats: readonly BeatStart[];
  /**
   * The last step rewinds, and so far only that has happened: the picture has cut back, and
   * the step's own changes come next.
   */
  readonly rewound: boolean;
}

export interface BeatStart {
  readonly played: number;
  readonly stack: readonly StoryFrame[];
}

export function storyNamed(diagram: Diagram, name: string): Story | null {
  return diagram.stories.find((story) => story.name === name) ?? null;
}

export function stepAt(diagram: Diagram, ref: StepRef): StoryStep | null {
  return storyNamed(diagram, ref.story)?.steps[ref.index] ?? null;
}

/** The opening of a story (the first, unless named): nothing played yet. */
export function startStory(diagram: Diagram, name?: string): StoryCursor | null {
  const story = name === undefined ? diagram.stories[0] : storyNamed(diagram, name);
  if (story === undefined || story === null) return null;
  return {
    story: story.name,
    played: [],
    stack: [{ story: story.name, next: 0 }],
    beats: [],
    rewound: false,
  };
}

/**
 * The step that plays next, and the stack once stories that have ended are left. Steps whose
 * `when` doesn't hold (for these controls) are passed over.
 */
function upcoming(
  diagram: Diagram,
  stack: readonly StoryFrame[],
  controls: ControlValues | undefined,
): {
  readonly step: StoryStep;
  readonly ref: StepRef;
  readonly stack: readonly StoryFrame[];
} | null {
  const plays = stepPlays(diagram, controls);
  let frames = stack;
  for (let guard = 0; guard < 5000; guard++) {
    const top = frames.at(-1);
    if (top === undefined) return null;
    const step = storyNamed(diagram, top.story)?.steps[top.next];
    if (step === undefined) {
      frames = frames.slice(0, -1);
      continue;
    }
    if (plays(step)) return { step, ref: { story: top.story, index: top.next }, stack: frames };
    frames = [...frames.slice(0, -1), { story: top.story, next: top.next + 1 }];
  }
  return null;
}

/** Whether anything is left to play. */
export function hasNext(diagram: Diagram, cursor: StoryCursor, controls?: ControlValues): boolean {
  return upcoming(diagram, cursor.stack, controls) !== null;
}

/**
 * Whether the step that plays next starts a beat: it has words, or nothing has played yet, or
 * the step before it offered choices (which ends a beat).
 */
function startsBeat(diagram: Diagram, cursor: StoryCursor, step: StoryStep): boolean {
  if (step.say !== null || step.script !== null) return true;
  const last = cursor.played.at(-1);
  if (last === undefined) return true;
  return (stepAt(diagram, last)?.choices.length ?? 0) > 0;
}

/**
 * Plays one step. A step that rewinds gives two cursors: the cut back, then its changes.
 * Empty at the end of the story.
 */
export function advance(
  diagram: Diagram,
  cursor: StoryCursor,
  controls?: ControlValues,
): StoryCursor[] {
  const next = upcoming(diagram, cursor.stack, controls);
  if (next === null) return [];
  const beats = startsBeat(diagram, cursor, next.step)
    ? [...cursor.beats, { played: cursor.played.length, stack: cursor.stack }]
    : cursor.beats;
  const after = {
    story: cursor.story,
    played: [...cursor.played, next.ref],
    stack: [...next.stack.slice(0, -1), { story: next.ref.story, next: next.ref.index + 1 }],
    beats,
  };
  return next.step.rewind === null
    ? [{ ...after, rewound: false }]
    : [
        { ...after, rewound: true },
        { ...after, rewound: false },
      ];
}

/**
 * The cursors the rest of the beat passes through, one per step (two for a step that rewinds).
 * A beat is a step with words and the wordless steps after it; a step that offers choices ends
 * its beat. From the end of a beat this is the whole next one; empty at the end of the story.
 */
export function nextBeat(
  diagram: Diagram,
  cursor: StoryCursor,
  controls?: ControlValues,
): StoryCursor[] {
  const out: StoryCursor[] = [];
  let at: StoryCursor = cursor.rewound ? { ...cursor, rewound: false } : cursor;
  if (cursor.rewound) out.push(at);
  for (let guard = 0; guard < 500; guard++) {
    const next = upcoming(diagram, at.stack, controls);
    if (next === null) break;
    if (out.length > 0 && startsBeat(diagram, at, next.step)) break;
    const played = advance(diagram, at, controls);
    const last = played.at(-1);
    if (last === undefined) break;
    out.push(...played);
    at = last;
  }
  return out;
}

/** The cursor as it was before the beat showing began; null at the opening. */
export function previousBeat(cursor: StoryCursor): StoryCursor | null {
  const start = cursor.beats.at(-1);
  if (start === undefined) return null;
  return {
    story: cursor.story,
    played: cursor.played.slice(0, start.played),
    stack: start.stack,
    beats: cursor.beats.slice(0, -1),
    rewound: false,
  };
}

/** The beat just played: its first step, where the caption is. */
function beatFirst(cursor: StoryCursor): number {
  return cursor.beats.at(-1)?.played ?? 0;
}

/** The words showing: the caption of the beat being played. */
export function captionAt(diagram: Diagram, cursor: StoryCursor | null): string | null {
  if (cursor === null) return null;
  for (let i = cursor.played.length - 1; i >= beatFirst(cursor); i--) {
    const ref = cursor.played[i];
    const say = ref === undefined ? null : (stepAt(diagram, ref)?.say ?? null);
    if (say !== null) return say;
  }
  return null;
}

/** Stories the viewer can play from here: the last step's choices, until one is taken. */
export function choicesAt(diagram: Diagram, cursor: StoryCursor | null): readonly StoryChoice[] {
  const last = cursor?.played.at(-1);
  if (cursor === null || last === undefined || cursor.rewound) return [];
  return stepAt(diagram, last)?.choices ?? [];
}

/** Takes a choice: the story it names plays from here, and its first beat comes back. */
export function chooseStory(
  diagram: Diagram,
  cursor: StoryCursor,
  play: string,
  controls?: ControlValues,
): StoryCursor[] {
  if (storyNamed(diagram, play) === null) return [];
  return nextBeat(
    diagram,
    { ...cursor, rewound: false, stack: [...cursor.stack, { story: play, next: 0 }] },
    controls,
  );
}

/** A beat of a story as it's listed: its words and the steps in it. */
export interface Beat {
  /** Index of its first step in the story. */
  readonly first: number;
  readonly steps: readonly StoryStep[];
  readonly say: string | null;
  /** What's spoken over it; null when it has only a caption. */
  readonly script: string | null;
}

/** A story's steps, grouped into beats. */
export function beatsOf(story: Story): Beat[] {
  const beats: {
    first: number;
    steps: StoryStep[];
    say: string | null;
    script: string | null;
  }[] = [];
  story.steps.forEach((step, index) => {
    const current = beats.at(-1);
    const previous = story.steps[index - 1];
    const starts =
      current === undefined ||
      step.say !== null ||
      step.script !== null ||
      (previous?.choices.length ?? 0) > 0;
    if (starts) beats.push({ first: index, steps: [step], say: step.say, script: step.script });
    else current.steps.push(step);
  });
  return beats;
}

/**
 * Where a story begins: the first one at the diagram's opening; another, where a step's choice
 * plays it (so what it rewinds to and builds on is there), or failing that on its own.
 */
function beginning(diagram: Diagram, story: string, seen: ReadonlySet<string>): StoryCursor | null {
  if (storyNamed(diagram, story) === null) return null;
  if (diagram.stories[0]?.name === story || seen.has(story)) return startStory(diagram, story);
  for (const other of diagram.stories) {
    if (other.name === story) continue;
    const index = other.steps.findIndex((step) =>
      step.choices.some((choice) => choice.play === story),
    );
    if (index === -1) continue;
    const from = stepCursor(diagram, { story: other.name, index }, new Set([...seen, story]));
    if (from === null) continue;
    return { ...from, stack: [...from.stack, { story, next: 0 }] };
  }
  return startStory(diagram, story);
}

function stepCursor(diagram: Diagram, ref: StepRef, seen: ReadonlySet<string>): StoryCursor | null {
  let cursor = beginning(diagram, ref.story, seen);
  for (let guard = 0; cursor !== null && guard < 2000; guard++) {
    const top = cursor.stack.at(-1);
    if (top === undefined || top.story !== ref.story || top.next > ref.index) break;
    const next = advance(diagram, cursor).at(-1);
    if (next === undefined) break;
    cursor = next;
  }
  return cursor;
}

/**
 * The cursor just after a step has played, reached the way a viewer would reach it: where the
 * editor's story dock points. Null when there is no such story.
 */
export function cursorAtStep(diagram: Diagram, ref: StepRef): StoryCursor | null {
  return stepCursor(diagram, ref, new Set());
}

/**
 * The cursor once `count` beats of a story have played, taking no choices: where a link or a
 * thumbnail points. `count` past the end gives the end.
 */
export function cursorAtBeat(
  diagram: Diagram,
  story: string,
  count: number,
  controls?: ControlValues,
): StoryCursor | null {
  let cursor = startStory(diagram, story);
  if (cursor === null) return null;
  for (let beat = 0; beat < count; beat++) {
    const next = nextBeat(diagram, cursor, controls).at(-1);
    if (next === undefined) break;
    cursor = next;
  }
  return cursor;
}

/** How many beats have played. */
export function beatsPlayed(cursor: StoryCursor | null): number {
  return cursor?.beats.length ?? 0;
}

/** Whether two moments show the same thing. */
export function sameMoment(a: Moment, b: Moment): boolean {
  if (a.scene !== b.scene || a.controls !== b.controls) return false;
  const x = a.story;
  const y = b.story;
  if (x === null || y === null) return x === y;
  return (
    x.story === y.story &&
    x.rewound === y.rewound &&
    x.played.length === y.played.length &&
    x.played.every((ref, i) => ref.story === y.played[i]?.story && ref.index === y.played[i].index)
  );
}

/** What's spoken at the beat showing: its script, or its caption when it has none. */
export function spokenAt(diagram: Diagram, cursor: StoryCursor | null): string | null {
  if (cursor === null) return null;
  for (let i = cursor.played.length - 1; i >= (cursor.beats.at(-1)?.played ?? 0); i--) {
    const ref = cursor.played[i];
    const step = ref === undefined ? null : stepAt(diagram, ref);
    if (step !== null && (step.script !== null || step.say !== null))
      return step.script ?? step.say;
  }
  return null;
}
