import { stepAt } from "../picture/moment";
import type { DeckSlide, DeckSource, DeckTimeline } from "./deck";

/**
 * A deck's words (D-105): each beat's caption and script, where it falls in the deck and when.
 * The Script window reads them, and the script, subtitles and chapters are made from them.
 */

export interface DeckBeat {
  /** Which slide (its place in the deck as it plays) and which of its beats, from 0. */
  readonly slide: number;
  readonly beat: number;
  readonly caption: string | null;
  readonly script: string | null;
  /** When it starts and ends at the deck's own times. */
  readonly start: number;
  readonly end: number;
}

/** Every beat of a deck, in order, with its words and times. Still slides have none. */
export function deckBeats(
  source: DeckSource,
  slides: readonly DeckSlide[],
  timeline: DeckTimeline,
): readonly DeckBeat[] {
  const beats: DeckBeat[] = [];
  for (const timed of timeline.slides) {
    const entry = slides[timed.slide];
    if (entry === undefined) continue;
    const diagram = source.load(entry.folder).diagram;
    let current: {
      beat: number;
      caption: string | null;
      script: string | null;
      start: number;
      end: number;
    } | null = null;
    for (const segment of timed.segments) {
      if (current === null || current.beat !== segment.beat) {
        if (current !== null) beats.push({ slide: timed.slide, ...current });
        current = {
          beat: segment.beat,
          caption: null,
          script: null,
          start: segment.start,
          end: segment.end,
        };
      }
      const ref = segment.to.played.at(-1);
      const step = ref === undefined ? null : stepAt(diagram, ref);
      current.caption = step?.say ?? current.caption;
      current.script = step?.script ?? current.script;
      current.end = segment.end;
    }
    if (current !== null) beats.push({ slide: timed.slide, ...current });
  }
  return beats;
}

/** What a beat says aloud: its script, or its caption without one. */
export const spokenWords = (beat: DeckBeat): string | null => beat.script ?? beat.caption;

// -------------------------------------------------------------------------------------------------
// The script

/**
 * The script as a document (`script.md`): the deck's name, its sections, each slide by number
 * and title, and under it each beat's caption and script. `recorded` marks beats with no
 * recording, when it's given.
 */
export function deckScript(
  name: string,
  slides: readonly DeckSlide[],
  beats: readonly DeckBeat[],
  recorded?: (script: string) => boolean,
): string {
  const lines: string[] = [`# ${name}`, ""];
  let section: string | null = null;
  slides.forEach((slide, index) => {
    if (slide.section !== null && slide.section !== section) lines.push(`## ${slide.section}`, "");
    section = slide.section;
    lines.push(`### ${slide.number}. ${slide.title}`, "");
    const own = beats.filter((beat) => beat.slide === index);
    if (own.length === 0) lines.push("_A still slide: nothing is said._", "");
    for (const beat of own) {
      if (beat.caption !== null) lines.push(`**${beat.caption.trim()}**`, "");
      if (beat.script !== null) {
        lines.push(beat.script.trim(), "");
        if (recorded !== undefined && !recorded(beat.script)) lines.push("_Not recorded yet._", "");
      } else if (beat.caption === null) lines.push("_No words._", "");
    }
  });
  return `${lines.join("\n").trimEnd()}\n`;
}

// -------------------------------------------------------------------------------------------------
// Subtitles and chapters

/** The longest a subtitle runs, in characters: two short lines. */
const CUE_LENGTH = 84;

/** A time as WebVTT writes it: `00:01:02.345`. */
function cueTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Words cut into pieces no longer than a cue, at word boundaries. */
function pieces(text: string): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (line !== "" && line.length + 1 + word.length > CUE_LENGTH) {
      out.push(line);
      line = word;
    } else line = line === "" ? word : `${line} ${word}`;
  }
  if (line !== "") out.push(line);
  return out;
}

/**
 * Subtitles (`.vtt`) at the deck's times: what each beat says, in cues of two short lines at
 * most, each lasting its share of the beat by its words.
 */
export function deckSubtitles(beats: readonly DeckBeat[]): string {
  const cues: string[] = [];
  for (const beat of beats) {
    const words = spokenWords(beat);
    if (words === null || words.trim() === "") continue;
    const parts = pieces(words);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    let at = beat.start;
    for (const part of parts) {
      const length = ((beat.end - beat.start) * part.length) / total;
      cues.push(`${cues.length + 1}\n${cueTime(at)} --> ${cueTime(at + length)}\n${part}`);
      at += length;
    }
  }
  return `WEBVTT\n\n${cues.join("\n\n")}${cues.length > 0 ? "\n" : ""}`;
}

/** A time as a chapter list writes it: `0:00`, `12:05`, `1:02:03`. */
function chapterTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Chapters: a `0:00 Title` line where each section starts, or each slide for a deck without
 * sections. The first is always at 0:00, as video sites want.
 */
export function deckChapters(slides: readonly DeckSlide[], timeline: DeckTimeline): string {
  const marks =
    timeline.sections.length > 0
      ? timeline.sections
      : timeline.slides.map((timed) => ({
          title: slides[timed.slide]?.title ?? `Slide ${timed.slide + 1}`,
          start: timed.start,
        }));
  return `${marks.map((mark, index) => `${chapterTime(index === 0 ? 0 : mark.start)} ${mark.title}`).join("\n")}\n`;
}
