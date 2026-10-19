/**
 * Presence and marks (D-86): the two things a story changes about an element besides its state.
 *
 * Presence is whether it's there: `shown`, `faded` (still there, pale: a commit nothing points
 * at, a version being retired) or `hidden` (absent: nothing draws it and the model doesn't see
 * it). A mark is a small sign at its corner (a gate that passed, a request refused); it means
 * nothing to the model.
 */

export const PRESENCES = ["shown", "faded", "hidden"] as const;
export type Presence = (typeof PRESENCES)[number];

export function isPresence(value: unknown): value is Presence {
  return typeof value === "string" && (PRESENCES as readonly string[]).includes(value);
}

/** How strongly a faded element is drawn (1 = shown). */
export const FADED_OPACITY = 0.38;

export function presenceOpacity(presence: Presence): number {
  return presence === "shown" ? 1 : presence === "faded" ? FADED_OPACITY : 0;
}

export const MARKS = [
  "check",
  "cross",
  "warn",
  "lock",
  "key",
  "clock",
  "star",
  "question",
] as const;
export type Mark = (typeof MARKS)[number];

export function isMark(value: unknown): value is Mark {
  return typeof value === "string" && (MARKS as readonly string[]).includes(value);
}

export interface MarkInfo {
  readonly label: string;
  /** The colour scheme it's drawn in. */
  readonly tone: "green" | "rose" | "amber" | "blue" | "violet" | "neutral";
}

export const MARK_INFO: Readonly<Record<Mark, MarkInfo>> = {
  check: { label: "Check", tone: "green" },
  cross: { label: "Cross", tone: "rose" },
  warn: { label: "Warning", tone: "amber" },
  lock: { label: "Lock", tone: "blue" },
  key: { label: "Key", tone: "violet" },
  clock: { label: "Clock", tone: "amber" },
  star: { label: "Star", tone: "amber" },
  question: { label: "Question", tone: "neutral" },
};
