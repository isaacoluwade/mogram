import { TEXT_LINE_HEIGHT } from "@mogram/core/layout";
import type { TextAlign } from "@mogram/core/presets";
import { measure } from "./text";

/**
 * Rich text for free text and sticky notes (ED-25): `**bold**` and `*italic*` inline, and lines
 * starting "- " or "1. " as lists. Laid out here, with the same measurements the SVG draws with,
 * so wrapping and alignment match on screen and in exports.
 */

export interface TextRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export interface RichParagraph {
  readonly list: "bullet" | "number" | null;
  /** The number a numbered line was written with. */
  readonly number: number;
  readonly runs: readonly TextRun[];
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+/;
const BOLD = /\*\*(.+?)\*\*/g;
const ITALIC = /\*(\S(?:.*?\S)?)\*/g;

export function parseRich(text: string): RichParagraph[] {
  return text.split("\n").map((line) => {
    const bullet = BULLET.exec(line);
    if (bullet !== null)
      return { list: "bullet", number: 0, runs: parseInline(line.slice(bullet[0].length)) };
    const numbered = NUMBERED.exec(line);
    if (numbered !== null) {
      return {
        list: "number",
        number: Number(numbered[1]),
        runs: parseInline(line.slice(numbered[0].length)),
      };
    }
    return { list: null, number: 0, runs: parseInline(line) };
  });
}

/** Text without its inline markers, for labels and search. */
export function plainText(text: string): string {
  return parseRich(text)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join("\n");
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const push = (value: string, bold: boolean, italic: boolean) => {
    if (value.length === 0) return;
    const last = runs.at(-1);
    if (last !== undefined && last.bold === bold && last.italic === italic) {
      runs[runs.length - 1] = { ...last, text: last.text + value };
    } else {
      runs.push({ text: value, bold, italic });
    }
  };
  const italics = (segment: string, bold: boolean) => {
    let last = 0;
    for (const match of segment.matchAll(ITALIC)) {
      push(segment.slice(last, match.index), bold, false);
      push(match[1] ?? "", bold, true);
      last = match.index + match[0].length;
    }
    push(segment.slice(last), bold, false);
  };
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    italics(text.slice(last, match.index), false);
    italics(match[1] ?? "", true);
    last = match.index + match[0].length;
  }
  italics(text.slice(last), false);
  return runs;
}

// -------------------------------------------------------------------------------------------------
// Layout

export interface LineSegment {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** From the line's start, after its list indent. */
  readonly x: number;
}

export interface RichLine {
  readonly marker: string | null;
  readonly indent: number;
  readonly segments: readonly LineSegment[];
  /** Indent plus words. */
  readonly width: number;
}

export interface RichLayout {
  readonly lines: readonly RichLine[];
  readonly fontSize: number;
  /** Weight of plain words, and the letter spacing they were measured with. */
  readonly weight: number;
  readonly tracking: number;
  readonly lineHeight: number;
  /** The widest line. */
  readonly width: number;
  readonly height: number;
  /** A word had to be split to fit the width. */
  readonly splitWords: boolean;
}

export interface RichOptions {
  readonly fontSize: number;
  readonly family: string;
  /** Weight of plain text (bold text is 700). */
  readonly weight: number;
  /** Everything bold or italic (the toolbar's B and I). */
  readonly bold: boolean;
  readonly italic: boolean;
  /** Letter spacing in px (titles are set slightly tight). */
  readonly tracking: number;
  /** Wrap width; `Infinity` keeps each line whole. */
  readonly maxWidth: number;
}

export const BOLD_WEIGHT = 700;

interface Word {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** A space comes before it on the same line. */
  readonly spaced: boolean;
}

function wordsOf(runs: readonly TextRun[], options: RichOptions): Word[] {
  const words: Word[] = [];
  let pendingSpace = false;
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/)) {
      if (part.length === 0) continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = true;
        continue;
      }
      words.push({
        text: part,
        bold: options.bold || run.bold,
        italic: options.italic || run.italic,
        spaced: pendingSpace && words.length > 0,
      });
      pendingSpace = false;
    }
  }
  return words;
}

export function layoutRich(paragraphs: readonly RichParagraph[], options: RichOptions): RichLayout {
  const { fontSize, family } = options;
  const weightOf = (bold: boolean) => (bold ? BOLD_WEIGHT : options.weight);
  const width = (text: string, bold: boolean) =>
    measure(text, fontSize, weightOf(bold), family) + options.tracking * text.length;
  const lines: RichLine[] = [];
  let splitWords = false;

  for (const paragraph of paragraphs) {
    const marker =
      paragraph.list === "bullet"
        ? "•"
        : paragraph.list === "number"
          ? `${paragraph.number}.`
          : null;
    const indent =
      marker === null ? 0 : Math.max(fontSize * 1.1, width(marker, options.bold) + fontSize * 0.45);
    const available = Math.max(fontSize, options.maxWidth - indent);
    let segments: LineSegment[] = [];
    let cursor = 0;
    let first = true;
    const flush = () => {
      lines.push({ marker: first ? marker : null, indent, segments, width: indent + cursor });
      segments = [];
      cursor = 0;
      first = false;
    };
    const place = (word: Word, x: number, w: number) => {
      const last = segments.at(-1);
      if (
        last !== undefined &&
        last.bold === word.bold &&
        last.italic === word.italic &&
        word.spaced
      ) {
        segments[segments.length - 1] = { ...last, text: `${last.text} ${word.text}` };
      } else {
        segments.push({ text: word.text, bold: word.bold, italic: word.italic, x });
      }
      cursor = x + w;
    };

    for (const word of wordsOf(paragraph.runs, options)) {
      const w = width(word.text, word.bold);
      const space = segments.length > 0 && word.spaced ? width(" ", word.bold) : 0;
      if (segments.length > 0 && cursor + space + w > available) flush();
      if (segments.length === 0 && w > available) {
        // A word wider than the line (a URL): split it across lines.
        splitWords = true;
        let rest = word.text;
        while (rest.length > 0) {
          let end = rest.length;
          while (end > 1 && width(rest.slice(0, end), word.bold) > available) end--;
          const piece = rest.slice(0, end);
          place({ ...word, text: piece, spaced: false }, 0, width(piece, word.bold));
          rest = rest.slice(end);
          if (rest.length > 0) flush();
        }
        continue;
      }
      const x = segments.length === 0 ? 0 : cursor + space;
      place(segments.length === 0 ? { ...word, spaced: false } : word, x, w);
    }
    flush();
  }

  const lineHeight = fontSize * TEXT_LINE_HEIGHT;
  return {
    lines,
    fontSize,
    weight: options.weight,
    tracking: options.tracking,
    lineHeight,
    width: Math.max(0, ...lines.map((line) => line.width)),
    height: lines.length * lineHeight,
    splitWords,
  };
}

/** Sizes a note's automatic type tries, largest first. */
export const AUTO_FONT_SIZES = [32, 28, 24, 20, 18, 16, 14, 12, 10, 8] as const;

/** The largest automatic size whose lines fit `maxHeight` without splitting words. */
export function fitRich(
  paragraphs: readonly RichParagraph[],
  options: Omit<RichOptions, "fontSize">,
  maxHeight: number,
): RichLayout {
  let layout: RichLayout | null = null;
  for (const fontSize of AUTO_FONT_SIZES) {
    layout = layoutRich(paragraphs, { ...options, fontSize });
    if (layout.height <= maxHeight && !layout.splitWords) return layout;
  }
  return layout ?? layoutRich(paragraphs, { ...options, fontSize: 8 });
}

/** Where a line starts, for an alignment within `width`. */
export function lineOffset(line: RichLine, align: TextAlign, width: number): number {
  if (align === "center") return (width - line.width) / 2;
  if (align === "right") return width - line.width;
  return 0;
}
