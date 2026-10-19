/**
 * Following a reader through a known script (the prompter, D-96). A speech recogniser hears
 * words, some of them wrong; the script is known. So this doesn't transcribe: it works out where
 * in the script the reader is, from the last few words heard, and only moves when it's sure.
 *
 * Pure and small: words in, a position out. The recogniser is someone else's (Chrome's, on the
 * device), and any other can feed it.
 */

/** A word of the script, as shown and as matched. */
export interface ScriptWord {
  /** As written, with its punctuation. */
  readonly text: string;
  /** Lower-cased, punctuation dropped, digits spelt: what's compared with what's heard. */
  readonly key: string;
  /** Which beat it belongs to, counting from 0. */
  readonly beat: number;
}

const DIGITS: Readonly<Record<string, string>> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
};

/** A word as it's compared: case, punctuation and the difference between "9" and "nine" gone. */
export function wordKey(word: string): string {
  const plain = word
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return DIGITS[plain] ?? plain;
}

/** The words of some text, without the ones that are only punctuation. */
export function wordsOf(text: string): string[] {
  return text
    .split(/[\s—–/]+/)
    .flatMap((word) => word.split(/(?<=[a-z])[-_.](?=[a-z])/i))
    .filter((word) => wordKey(word) !== "");
}

/** A script as words, beat by beat. */
export function scriptWords(beats: readonly string[]): ScriptWord[] {
  return beats.flatMap((text, beat) =>
    text
      .split(/\s+/)
      .filter((word) => wordKey(word) !== "")
      .map((word) => ({ text: word, key: wordKey(word), beat })),
  );
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row.push(
        Math.min(
          (previous[j] ?? 0) + 1,
          (row[j - 1] ?? 0) + 1,
          (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
        ),
      );
    previous = row;
  }
  return previous[b.length] ?? limit + 1;
}

/**
 * Whether a heard word is the script's word: the same, or close enough for a recogniser's slip
 * ("resource" for "resources", "terraforms" for "terraform's"). Short words must match exactly:
 * "a", "the" and "to" are everywhere.
 */
export function sameWord(heard: string, written: string): boolean {
  if (heard === written) return true;
  const shorter = Math.min(heard.length, written.length);
  if (shorter < 4) return false;
  if (heard.startsWith(written) || written.startsWith(heard)) return shorter >= 5;
  return editDistance(heard, written, shorter >= 8 ? 2 : 1) <= (shorter >= 8 ? 2 : 1);
}

export interface FollowOptions {
  /** How many of the last words heard are compared. */
  readonly tail: number;
  /** How far ahead of the reader a match is looked for first, in words. */
  readonly ahead: number;
  /** How far back (a sentence read again). */
  readonly back: number;
  /** Matching words needed to carry straight on from where the reader is. */
  readonly carryOn: number;
  /** Matching words needed to jump ahead (a sentence skipped) or back, nearby. */
  readonly jump: number;
  /** Matching words needed to jump anywhere else in the script (a page skipped, a retake). */
  readonly far: number;
  /** How far the reader can be moved by what's heard. Everywhere, unless said. */
  readonly reach?: FollowReach;
}

/**
 * How far following may move the reader:
 * - `order`: only on, word by word. Saying something that's written elsewhere moves nothing;
 *   skipping or going back is done by key.
 * - `nearby`: also a few sentences ahead or back (a sentence skipped, or read again).
 * - `anywhere`: also anywhere else in the script, when five words line up there and nowhere
 *   else nearly as well. A script that says similar things twice can be told apart less surely.
 */
export type FollowReach = "order" | "nearby" | "anywhere";
export const FOLLOW_REACHES: readonly FollowReach[] = ["order", "nearby", "anywhere"];

export const FOLLOW: FollowOptions = {
  tail: 8,
  ahead: 45,
  back: 14,
  carryOn: 2,
  jump: 4,
  far: 5,
};

export interface Followed {
  /** How many words of the script have been said: the index of the next one. */
  readonly position: number;
  /** What happened on this hearing. */
  readonly moved: "on" | "ahead" | "back" | "held";
}

/** A way of lining the words heard up against part of the script. */
interface LineUp {
  readonly score: number;
  /** The script index after its last matched word: where the reader would be. */
  readonly end: number;
  /** How many heard words it matches to script words. */
  readonly matches: number;
  /** How many of those are script words the reader hadn't said yet. */
  readonly fresh: number;
  /** How many are words long enough to mean something ("the" and "it" are everywhere). */
  readonly solid: number;
}

interface Cell {
  readonly score: number;
  readonly matches: number;
  readonly fresh: number;
  readonly solid: number;
}

const NOTHING: Cell = { score: 0, matches: 0, fresh: 0, solid: 0 };

/**
 * The best line-up of the words heard against the script from `from` up to `to`, and the best
 * that ends somewhere else altogether (to tell a sure place from one of two that look alike).
 *
 * Local alignment (Smith-Waterman): a match scores 2 (1 for a short word, which proves less); a
 * slip, or a word dropped or added, costs 1. Only a line-up that ends on a match at the end of
 * what was heard says where the reader is now. Ties go to the place nearest where they were.
 */
function lineUp(
  script: readonly ScriptWord[],
  tail: readonly string[],
  from: number,
  to: number,
  position: number,
): { readonly best: LineUp | null; readonly other: number } {
  const width = to - from;
  if (width <= 0) return { best: null, other: 0 };
  let best: LineUp | null = null;
  // The best score of a line-up ending at each script word, to find the runner-up afterwards.
  const ends = new Array<number>(width + 1).fill(0);
  let previous = new Array<Cell>(width + 1).fill(NOTHING);
  for (let i = 1; i <= tail.length; i++) {
    const row: Cell[] = [NOTHING];
    const word = tail[i - 1] ?? "";
    for (let j = 1; j <= width; j++) {
      const at = from + j - 1;
      const written = script[at]?.key ?? "";
      const same = sameWord(word, written);
      const diagonal = previous[j - 1] ?? NOTHING;
      const up = previous[j] ?? NOTHING;
      const left = row[j - 1] ?? NOTHING;
      let cell = NOTHING;
      const matched = diagonal.score + (same ? (written.length <= 3 ? 1 : 2) : -1);
      if (matched > cell.score)
        cell = same
          ? {
              score: matched,
              matches: diagonal.matches + 1,
              fresh: diagonal.fresh + (at >= position ? 1 : 0),
              solid: diagonal.solid + (written.length >= 4 ? 1 : 0),
            }
          : { ...diagonal, score: matched };
      if (up.score - 1 > cell.score) cell = { ...up, score: up.score - 1 };
      if (left.score - 1 > cell.score) cell = { ...left, score: left.score - 1 };
      row.push(cell);
      if (!same || i < tail.length - 1 || cell.score <= 0) continue;
      const end = at + 1;
      ends[j] = Math.max(ends[j] ?? 0, cell.score);
      const nearer =
        best !== null && Math.abs(end - position - 1) < Math.abs(best.end - position - 1);
      if (best === null || cell.score > best.score || (cell.score === best.score && nearer))
        best = { ...cell, end };
    }
    previous = row;
  }
  let other = 0;
  if (best !== null)
    for (let j = 1; j <= width; j++)
      if (Math.abs(from + j - best.end) > tail.length) other = Math.max(other, ends[j] ?? 0);
  return { best, other };
}

/**
 * Where the reader is, given where they were and the words heard lately (the recogniser's
 * current guess, oldest first; only its last few are used).
 *
 * The tail of what was heard is lined up against the script around the reader, allowing for
 * words the recogniser dropped, added or got wrong. Only words the reader hadn't said yet are
 * proof of moving on: two of them to carry on from here, four to jump ahead nearby. Failing
 * that, the whole script is searched, and the reader is moved anywhere in it only when five
 * words line up there and nowhere else nearly as well. Otherwise the position holds, which is
 * what should happen when the reader says something that isn't in the script.
 */
export function follow(
  script: readonly ScriptWord[],
  position: number,
  heard: readonly string[],
  options: FollowOptions = FOLLOW,
): Followed {
  const tail = heard
    .map(wordKey)
    .filter((word) => word !== "")
    .slice(-options.tail);
  const held: Followed = { position, moved: "held" };
  if (tail.length === 0 || script.length === 0) return held;
  const reach = options.reach ?? "anywhere";

  const near = lineUp(
    script,
    tail,
    Math.max(0, position - options.back),
    Math.min(script.length, position + options.ahead),
    position,
  ).best;
  if (near !== null && near.end !== position) {
    const step = near.end - position;
    if (step > 0 && step <= options.carryOn + 3) {
      // Carrying on: the next few words, perhaps with one or two dropped. One new word is
      // enough to move one word on, if the word before it was heard too; more need more.
      const fresh = step <= 1 ? 1 : options.carryOn;
      const matches = position === 0 ? 1 : 2;
      // One small word misheard ("an expression" for "in expression") shouldn't stop the
      // reader at the last word of a paragraph: a long word right after it, on the heels of
      // words that did match, is proof enough.
      const overOne =
        step === 2 &&
        near.fresh === 1 &&
        near.matches >= 3 &&
        (script[near.end - 1]?.key.length ?? 0) >= 6 &&
        (script[near.end - 2]?.key.length ?? 9) <= 3;
      if ((near.fresh >= fresh && near.matches >= matches) || overOne)
        return { position: near.end, moved: "on" };
    } else if (reach === "order") {
      // Kept in order: nothing heard moves the reader but the words that come next.
    } else if (step > 0) {
      if (near.fresh >= options.jump) return { position: near.end, moved: "ahead" };
    } else if (step < -3 && near.matches >= options.jump && near.solid >= 2) {
      // Further back than a recogniser changing its mind about the last word or two.
      return { position: near.end, moved: "back" };
    }
  }

  // Somewhere else altogether: a page skipped, or a take started again from further back.
  if (reach !== "anywhere") return held;
  if (tail.length < options.far) return held;
  const far = lineUp(script, tail, 0, script.length, position);
  if (far.best === null || far.best.end === position) return held;
  const step = far.best.end - position;
  if (step >= -3 && step <= options.carryOn + 3) return held;
  if (far.best.matches < options.far || far.best.solid < 3) return held;
  if (step > 0 && far.best.fresh < options.far) return held;
  if (far.best.score < far.other + 2) return held;
  return { position: far.best.end, moved: step > 0 ? "ahead" : "back" };
}

/**
 * `follow`, but going back has to be heard twice. A recogniser now and then hands over an
 * older stretch of what it heard for one guess before righting itself, and the words on screen
 * shouldn't leap back and forth when it does. A reader who really has gone back is still there
 * a moment later. Keeps what it's waiting to hear again; make one for each reading.
 */
export function steadyFollow(): typeof follow {
  let waiting: number | null = null;
  return (script, position, heard, options) => {
    const next = follow(script, position, heard, options);
    if (next.moved !== "back") {
      waiting = null;
      return next;
    }
    const again = waiting !== null && Math.abs(waiting - next.position) <= 3;
    waiting = again ? null : next.position;
    return again ? next : { position, moved: "held" };
  };
}

/** The beat the reader is in, and how far through its words they are (0 to 1). */
export function beatAt(
  script: readonly ScriptWord[],
  position: number,
): { readonly beat: number; readonly progress: number; readonly done: boolean } {
  const word = script[Math.min(position, script.length - 1)];
  if (word === undefined) return { beat: 0, progress: 0, done: true };
  const beat = position >= script.length ? word.beat : word.beat;
  let first = position;
  while (first > 0 && script[first - 1]?.beat === beat) first--;
  let end = Math.min(position, script.length - 1);
  while (end < script.length && script[end]?.beat === beat) end++;
  const length = Math.max(1, end - first);
  return {
    beat,
    progress: Math.min(1, (position - first) / length),
    done: position >= script.length,
  };
}
