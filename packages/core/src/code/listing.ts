import type { CodeListing } from "../model/types";
import type { CodeLanguage } from "../presets/code";

/**
 * A code listing as it's shown (D-103): every line of the text or file, cleaned only of what a
 * screen can't show, and which of them the element shows. The type lives with the model.
 */
export type { CodeListing };

/** A slice of a listing, `[first, last]` in the file's own numbers, as `lines:` writes it. */
export type LineRange = readonly [number, number];

/** `12` or `12-31` as a range of line numbers; null for anything else. */
export function lineRange(value: unknown): LineRange | null {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value > 0 ? [value, value] : null;
  if (typeof value !== "string") return null;
  const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(value);
  if (match === null) return null;
  const first = Number(match[1]);
  const last = Number(match[2] ?? match[1]);
  return Number.isSafeInteger(first) && Number.isSafeInteger(last) && first > 0 && last >= first
    ? [first, last]
    : null;
}

/** Escape sequences a terminal uses for colour and titles: CSI (`ESC [ … m`) and OSC (`ESC ] … BEL`). */
const ESCAPES = new RegExp(
  [
    `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
    `${String.fromCharCode(27)}\\][^${String.fromCharCode(7)}${String.fromCharCode(27)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(27)}\\\\)`,
  ].join("|"),
  "g",
);

/** The lines of a text, as a listing shows them. */
export function listingLines(text: string, language: CodeLanguage): string[] {
  const clean = language === "console" ? text.replace(ESCAPES, "") : text;
  const lines = clean.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
  // A text that ends with a newline (as every `text: |` block does) has no line after it.
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * A listing from its text (null when the text or file isn't there), showing `slice` of it, or
 * all of it. A slice past the end shows what there is.
 */
export function listingOf(
  text: string | null,
  language: CodeLanguage,
  slice: LineRange | null,
): CodeListing {
  if (text === null) {
    const first = slice?.[0] ?? 1;
    return { lines: [], first, last: first - 1, missing: true };
  }
  const lines = listingLines(text, language);
  const first = Math.min(slice?.[0] ?? 1, Math.max(1, lines.length));
  const last = Math.min(slice?.[1] ?? lines.length, lines.length);
  return { lines, first, last, missing: false };
}

/** The lines a listing shows, in order. */
export function shownLines(listing: CodeListing): readonly string[] {
  return listing.lines.slice(listing.first - 1, listing.last);
}
