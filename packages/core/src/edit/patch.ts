import type { Document, ToStringOptions } from "yaml";
import { diffLines } from "./diff";

/**
 * Minimal-diff writing (FI-5, D-4).
 *
 * `yaml` can re-print a document with comments and order intact, but it normalises spacing
 * (inline comment gaps, brace padding, doubled blank lines). Re-printing the whole file would turn
 * a one-line change into a noisy diff. Instead we print the document twice with the same options —
 * before and after the edit — diff those two prints, and apply only the changed lines to the
 * original text. Lines the edit didn't touch keep their exact original bytes.
 */

export interface FileStyle {
  readonly indent: number;
}

export function detectStyle(text: string): FileStyle {
  let indent = 0;
  for (const line of text.split("\n")) {
    const match = /^( +)\S/.exec(line);
    if (match?.[1] !== undefined && !line.trimStart().startsWith("#")) {
      const width = match[1].length;
      if (indent === 0 || width < indent) indent = width;
    }
  }
  return { indent: indent === 2 || indent === 4 ? indent : 2 };
}

export function stringifyOptions(style: FileStyle): ToStringOptions {
  return {
    indent: style.indent,
    lineWidth: 0,
    flowCollectionPadding: true,
    defaultKeyType: "PLAIN",
    nullStr: "",
  };
}

/** Prints a document in Mogram's canonical style: `{ at: [2, 6] }`, `members: [a, b]`. */
export function printDocument(doc: Document, style: FileStyle): string {
  const text = doc.toString(stringifyOptions(style));
  // Simple lists read better without inner padding: [4, 6], [a, b], [[24, 10], [24, 18]].
  return text
    .replace(/\[ ([A-Za-z0-9_.\-/]+(?:, [A-Za-z0-9_.\-/]+)*) \]/g, "[$1]")
    .replace(/\[ (\[[^[\]\n]*\](?:, \[[^[\]\n]*\])*) \]/g, "[$1]");
}

/** Whitespace-insensitive key used to line up original and normalised lines. */
function lineKey(line: string): string {
  return line.replace(/\s+/g, "");
}

/**
 * Applies the change from `before` to `after` (both normalised prints) onto `original`. Texts too
 * far apart to diff cheaply (see `MAX_EDITS`) are written as the whole `after` print instead.
 */
export function patchOriginal(original: string, before: string, after: string): string {
  if (before === after) return original;
  const o = original.split("\n");
  const b = before.split("\n");
  const m = after.split("\n");

  // 1. Line up original ↔ normalised-before (whitespace-insensitive).
  const oKeys = o.map(lineKey);
  const bKeys = b.map(lineKey);
  const oForB = new Int32Array(b.length).fill(-1);
  const alignment = diffLines(oKeys, bKeys);
  if (alignment === null) return after;
  let pendingDeletes: number[] = [];
  let pendingInserts: number[] = [];
  const flushPairs = (): void => {
    // Lines normalisation changed beyond whitespace: pair them up in order.
    const count = Math.min(pendingDeletes.length, pendingInserts.length);
    for (let i = 0; i < count; i++) oForB[pendingInserts[i] ?? 0] = pendingDeletes[i] ?? -1;
    pendingDeletes = [];
    pendingInserts = [];
  };
  for (const op of alignment) {
    if (op.kind === "equal") {
      flushPairs();
      oForB[op.b] = op.a;
    } else if (op.kind === "delete") pendingDeletes.push(op.a);
    else pendingInserts.push(op.b);
  }
  flushPairs();

  // 2. Walk the before→after diff, emitting original lines wherever the edit left them alone.
  const out: string[] = [];
  let cursor = 0;
  const emitOriginalUpTo = (limit: number): void => {
    while (cursor < limit) {
      out.push(o[cursor] ?? "");
      cursor++;
    }
  };
  // In this diff, side "a" is the normalised-before print and side "b" the after print.
  const changes = diffLines(b, m);
  if (changes === null) return after;
  for (const op of changes) {
    if (op.kind === "insert") {
      out.push(m[op.b] ?? "");
      continue;
    }
    const mapped = oForB[op.a] ?? -1;
    if (mapped >= cursor) emitOriginalUpTo(mapped);
    if (op.kind === "equal") {
      if (mapped >= 0 && mapped >= cursor) {
        out.push(o[mapped] ?? "");
        cursor = mapped + 1;
      } else {
        out.push(m[op.b] ?? "");
      }
    } else if (mapped >= 0 && mapped >= cursor) {
      cursor = mapped + 1; // deleted: skip the original line
    }
  }
  emitOriginalUpTo(o.length);
  return out.join("\n");
}
