import { didYouMean } from "../format/suggest";
import { findDiagramFolders } from "../format/project";
import type { ParseResult } from "../format/parse";
import type {
  DataValue,
  Deck,
  DeckEntry,
  Diagnostic,
  Diagram,
  ProjectFiles,
  Story,
} from "../model/types";
import {
  hasNext,
  nextBeat,
  previousBeat,
  startStory,
  stepAt,
  storyNamed,
  type Moment,
  type StepRef,
  type StoryCursor,
} from "../picture/moment";
import { REWIND_CUT, stepChange, stepHold, type StorySegment } from "../picture/timeline";
import type { ControlValues } from "../picture/values";
import { VOICE_TAIL } from "../assets/voice";

/**
 * Decks (D-99). A deck is an ordered list of slides; a slide is a diagram in a folder, playing
 * its story or a stretch of it. Everything here is worked out from the files: where someone is
 * in a deck, what comes next, and when, so the player, thumbnails and exports can't disagree.
 */

/** Something that can say whether a folder holds a diagram, and read it. */
export interface DeckSource {
  has(folder: string): boolean;
  load(folder: string): ParseResult;
}

/** A slide as it plays: skipped ones gone, numbered, its stretch found. */
export interface DeckSlide {
  /** Where its entry is in the deck's list as written (`DeckEntry.item`). */
  readonly item: number;
  /** Counted from 1 among the slides shown. */
  readonly number: number;
  readonly folder: string;
  /** The story it plays; null for a still slide. */
  readonly story: string | null;
  /** The step whose beat it begins after, and the one whose beat it stops after. */
  readonly from: StepRef | null;
  readonly to: StepRef | null;
  readonly scene: string | null;
  readonly title: string;
  /** The section it's in; null before the first. */
  readonly section: string | null;
  readonly frame: boolean;
  /** It goes straight on from the slide before: the same diagram, from where that one stopped. */
  readonly carriesOn: boolean;
}

/** Where someone is in a deck. */
export interface DeckPosition {
  readonly slide: number;
  readonly moment: Moment;
}

/** A slide's opening holds this long before its first beat; a slide with no story, this long. */
export const SLIDE_OPENING = 0.6;
export const STILL_SLIDE = 4;
/** One cut between slides, the one a rewind uses. */
export const SLIDE_CUT = REWIND_CUT;

const DECK_LINE = /^deck\s*:/m;

/**
 * Whether a project (or a folder of one) is a deck, and the little a list of decks needs to
 * show. Cheap for everything that isn't: a diagram's files are only parsed once one of them has
 * a `deck:` line.
 */
export function deckInfo(
  files: ProjectFiles,
  source: DeckSource,
  folder = "",
): { readonly name: string; readonly slides: number; readonly first: string | null } | null {
  const prefix = folder === "" ? "" : `${folder}/`;
  const likely = Object.entries(files).some(
    ([path, text]) =>
      path.startsWith(prefix) && !path.slice(prefix.length).includes("/") && DECK_LINE.test(text),
  );
  if (!likely || !source.has(folder)) return null;
  const { diagram } = source.load(folder);
  if (diagram.settings.deck === null) return null;
  const slides = deckSlides(source, folder);
  return { name: diagram.settings.name, slides: slides.length, first: slides[0]?.folder ?? null };
}

function namedStep(story: Story, name: string): StepRef | null {
  const index = story.steps.findIndex((step) => step.name === name);
  return index === -1 ? null : { story: story.name, index };
}

interface Resolved {
  readonly slides: DeckSlide[];
  readonly diagnostics: Diagnostic[];
}

/** Reads a deck's entries against the folders they name. */
function resolveDeck(source: DeckSource, deckFolder: string, folders: readonly string[]): Resolved {
  const diagnostics: Diagnostic[] = [];
  const slides: DeckSlide[] = [];
  const deck = source.has(deckFolder) ? source.load(deckFolder).diagram.settings.deck : null;
  if (deck === null) return { slides, diagnostics };
  const say = (entry: { readonly source: { file: string; line: number } }, message: string) =>
    diagnostics.push({
      severity: "error",
      file: entry.source.file,
      line: entry.source.line,
      column: 1,
      message,
    });
  // What a folder is called in a message: as someone would write it from the deck's folder.
  const written = (folder: string) =>
    deckFolder !== "" && folder.startsWith(`${deckFolder}/`)
      ? folder.slice(deckFolder.length + 1)
      : folder;
  const known = folders.map(written);

  if (deck.frame !== null && !source.has(deck.frame))
    say(
      deck,
      `"frame" is "${written(deck.frame)}", but no folder with that name holds a diagram.${didYouMean(written(deck.frame), known)}`,
    );

  let section: string | null = null;
  let position = 0;
  for (const entry of deck.entries) {
    if (entry.kind === "section") {
      section = entry.title;
      continue;
    }
    position++;
    const name = written(entry.folder);
    if (!source.has(entry.folder)) {
      say(
        entry,
        `Slide ${position} is "${name}", but no folder with that name holds a diagram.${didYouMean(name, known)}`,
      );
      continue;
    }
    const diagram = source.load(entry.folder).diagram;
    if (diagram.settings.deck !== null) {
      say(entry, `Slide ${position} is "${name}", which is a deck. A deck's slides are diagrams.`);
      continue;
    }
    if (entry.skip) continue;

    let story: Story | null = diagram.stories[0] ?? null;
    if (entry.story !== null) {
      const named = storyNamed(diagram, entry.story);
      if (named === null)
        say(
          entry,
          `Slide ${position} names the story "${entry.story}", but "${name}" has no story with that name.${didYouMean(
            entry.story,
            diagram.stories.map((each) => each.name),
          )}`,
        );
      else story = named;
    }
    const names = story === null ? [] : story.steps.flatMap((step) => step.name ?? []);
    const stepOf = (word: string | null, which: "from" | "to"): StepRef | null => {
      if (word === null) return null;
      const ref = story === null ? null : namedStep(story, word);
      if (ref === null)
        say(
          entry,
          story === null
            ? `Slide ${position} ${which === "from" ? "plays" : "stops"} "${name}" ${which === "from" ? "from" : "at"} "${word}", but "${name}" has no story.`
            : which === "from"
              ? `Slide ${position} plays "${name}" from "${word}", but its story "${story.name}" has no step with that name.${didYouMean(word, names)}`
              : `Slide ${position} stops "${name}" at "${word}", but its story "${story.name}" has no step with that name.${didYouMean(word, names)}`,
        );
      return ref;
    };
    const from = stepOf(entry.from, "from");
    let to = stepOf(entry.to, "to");
    if (from !== null && to !== null && to.index <= from.index) {
      say(
        entry,
        `Slide ${position} stops at "${entry.to ?? ""}", which comes before "${entry.from ?? ""}", where it starts.`,
      );
      to = null;
    }
    if (entry.scene !== null && !diagram.scenes.some((scene) => scene.name === entry.scene))
      say(
        entry,
        `Slide ${position} lays the scene "${entry.scene}" over "${name}", which has no scene with that name.${didYouMean(
          entry.scene,
          diagram.scenes.map((scene) => scene.name),
        )}`,
      );
    const scene =
      entry.scene !== null && diagram.scenes.some((each) => each.name === entry.scene)
        ? entry.scene
        : null;
    const before = slides.at(-1);
    slides.push({
      item: entry.item,
      number: slides.length + 1,
      folder: entry.folder,
      story: story?.name ?? null,
      from,
      to,
      scene,
      title: entry.title ?? diagram.settings.name,
      section,
      frame: entry.frame && deck.frame !== null && source.has(deck.frame),
      carriesOn:
        before !== undefined &&
        before.folder === entry.folder &&
        before.story === (story?.name ?? null) &&
        before.scene === scene &&
        before.to !== null &&
        from !== null &&
        before.to.index === from.index,
    });
  }
  return { slides, diagnostics };
}

/** A deck's slides as they play. Empty when the folder isn't a deck. */
export function deckSlides(source: DeckSource, deckFolder = ""): readonly DeckSlide[] {
  return resolveDeck(source, deckFolder, []).slides;
}

/** What's wrong with a deck that only shows once its slides' folders are read. */
export function checkDeck(files: ProjectFiles, source: DeckSource, deckFolder = ""): Diagnostic[] {
  return resolveDeck(source, deckFolder, findDiagramFolders(files)).diagnostics;
}

/** The deck entries that are slides, for anything that edits or lists them. */
export function slideEntries(deck: Deck): Extract<DeckEntry, { kind: "slide" }>[] {
  return deck.entries.filter((entry) => entry.kind === "slide");
}

/**
 * A slide's diagram as it's shown in its deck: the deck's page, theme, background and grid
 * unless it sets its own, the deck's styles and values under its own, and the deck's built-in
 * values (`%deck%`, `%section%`, `%slide%`, `%slides%`) for any label. The frame's diagram is
 * given the same.
 */
export function slideDiagram(
  deck: Diagram,
  diagram: Diagram,
  slide: Pick<DeckSlide, "number" | "section"> | null,
  count: number,
): Diagram {
  const own = diagram.settings;
  const data = new Map<string, DataValue>([
    ["deck", deck.settings.name],
    ["section", slide?.section ?? ""],
    ["slide", slide?.number ?? ""],
    ["slides", count],
    ...deck.settings.data,
    ...diagram.settings.data,
  ]);
  return {
    ...diagram,
    styles: new Map([...deck.styles, ...diagram.styles]),
    settings: {
      ...diagram.settings,
      page: own.page ?? deck.settings.page,
      theme: own.themeSet ? own.theme : deck.settings.theme,
      themeSet: own.themeSet || deck.settings.themeSet,
      background: own.background ?? deck.settings.background,
      grid: own.grid ?? deck.settings.grid,
      data,
    },
  };
}

// -------------------------------------------------------------------------------------------------
// Where someone is, and what comes next

const played = (cursor: StoryCursor, ref: StepRef): boolean =>
  cursor.played.some((step) => step.story === ref.story && step.index === ref.index);

/** The cursor once the beat holding `ref` has played, taking no choices. */
function afterBeatOf(
  diagram: Diagram,
  story: string,
  ref: StepRef,
  controls?: ControlValues,
): StoryCursor | null {
  let cursor = startStory(diagram, story);
  for (let guard = 0; cursor !== null && guard < 2000; guard++) {
    if (played(cursor, ref)) return cursor;
    const next = nextBeat(diagram, cursor, controls).at(-1);
    if (next === undefined) return cursor;
    cursor = next;
  }
  return cursor;
}

/** The picture a slide begins with: its story's start, or as things stood after `from`. */
export function slideOpening(
  diagram: Diagram,
  slide: DeckSlide,
  controls?: ControlValues,
): StoryCursor | null {
  if (slide.story === null) return null;
  return slide.from === null
    ? startStory(diagram, slide.story)
    : afterBeatOf(diagram, slide.story, slide.from, controls);
}

/** Whether a slide has played all it plays: its story's end, or the beat of `to`. */
export function slideEnded(
  diagram: Diagram,
  slide: DeckSlide,
  cursor: StoryCursor | null,
  controls?: ControlValues,
): boolean {
  if (cursor === null) return true;
  if (slide.to !== null && played(cursor, slide.to)) return true;
  return !hasNext(diagram, cursor, controls);
}

/** The picture a slide ends with. */
export function slideClosing(
  diagram: Diagram,
  slide: DeckSlide,
  controls?: ControlValues,
): StoryCursor | null {
  let cursor = slideOpening(diagram, slide, controls);
  for (let guard = 0; cursor !== null && guard < 2000; guard++) {
    if (slideEnded(diagram, slide, cursor, controls)) break;
    const next = nextBeat(diagram, cursor, controls).at(-1);
    if (next === undefined) break;
    cursor = next;
  }
  return cursor;
}

const at = (slide: number, entry: DeckSlide, story: StoryCursor | null): DeckPosition => ({
  slide,
  moment: { scene: entry.scene, story },
});

/** The opening of a slide (the first, unless said). Null for a deck with no slides. */
export function startDeck(
  source: DeckSource,
  slides: readonly DeckSlide[],
  slide = 0,
): DeckPosition | null {
  const index = Math.min(Math.max(0, slide), slides.length - 1);
  const entry = slides[index];
  if (entry === undefined) return null;
  return at(index, entry, slideOpening(source.load(entry.folder).diagram, entry));
}

/** A slide once `beats` of its stretch have played: where a link or a thumbnail points. */
export function deckPositionAtBeat(
  source: DeckSource,
  slides: readonly DeckSlide[],
  slide: number,
  beats: number,
): DeckPosition | null {
  let position = startDeck(source, slides, slide);
  const entry = position === null ? undefined : slides[position.slide];
  if (position === null || entry === undefined) return null;
  const diagram = source.load(entry.folder).diagram;
  for (let beat = 0; beat < beats; beat++) {
    const cursor: StoryCursor | null = position.moment.story;
    if (cursor === null || slideEnded(diagram, entry, cursor)) break;
    const next = nextBeat(diagram, cursor).at(-1);
    if (next === undefined) break;
    position = at(position.slide, entry, next);
  }
  return position;
}

/** How many beats of its slide's stretch a position has played. */
export function beatsIntoSlide(
  source: DeckSource,
  slides: readonly DeckSlide[],
  position: DeckPosition,
): number {
  const entry = slides[position.slide];
  const cursor = position.moment.story;
  if (entry === undefined || cursor === null) return 0;
  const opening = slideOpening(source.load(entry.folder).diagram, entry);
  return Math.max(0, cursor.beats.length - (opening?.beats.length ?? 0));
}

/**
 * Forward: the positions the next beat passes through, one per step, or the next slide's
 * opening once this slide has played. A slide that carries on from this one plays straight on:
 * its first beat, with no stop at a boundary nobody can see. Empty at the end of the deck.
 */
export function nextInDeck(
  source: DeckSource,
  slides: readonly DeckSlide[],
  position: DeckPosition,
  controls?: ControlValues,
): DeckPosition[] {
  const entry = slides[position.slide];
  if (entry === undefined) return [];
  const diagram = source.load(entry.folder).diagram;
  const cursor = position.moment.story;
  if (cursor !== null && !slideEnded(diagram, entry, cursor, controls))
    return nextBeat(diagram, cursor, controls).map((to) => at(position.slide, entry, to));
  const next = slides[position.slide + 1];
  if (next === undefined) return [];
  if (next.carriesOn && cursor !== null)
    return nextInDeck(source, slides, at(position.slide + 1, next, cursor), controls);
  return [at(position.slide + 1, next, slideOpening(source.load(next.folder).diagram, next))];
}

/**
 * Back: the beat before, or the last picture of the slide before. Null at the very start.
 */
export function previousInDeck(
  source: DeckSource,
  slides: readonly DeckSlide[],
  position: DeckPosition,
  controls?: ControlValues,
): DeckPosition | null {
  const entry = slides[position.slide];
  if (entry === undefined) return null;
  const diagram = source.load(entry.folder).diagram;
  const cursor = position.moment.story;
  const opening = slideOpening(diagram, entry, controls);
  if (cursor !== null && cursor.played.length > (opening?.played.length ?? 0)) {
    const before = previousBeat(cursor);
    // Never back past where the slide begins.
    const story =
      before === null || before.played.length < (opening?.played.length ?? 0) ? opening : before;
    return at(position.slide, entry, story);
  }
  const previous = slides[position.slide - 1];
  if (previous === undefined) return null;
  if (entry.carriesOn && cursor !== null) {
    // The same story, one beat back, on the slide that played it.
    const before = previousBeat(cursor);
    if (before !== null) return at(position.slide - 1, previous, before);
  }
  return at(
    position.slide - 1,
    previous,
    slideClosing(source.load(previous.folder).diagram, previous, controls),
  );
}

// -------------------------------------------------------------------------------------------------
// When

export interface DeckTimelineSlide {
  readonly slide: number;
  /** When it's first on screen, and when the next one is. */
  readonly start: number;
  readonly end: number;
  /** Whether it arrives with a cut (a different picture) or carries straight on. */
  readonly cut: boolean;
  readonly opening: StoryCursor | null;
  /** Its changes of picture, at the deck's own times. */
  readonly segments: readonly StorySegment[];
}

export interface DeckTimeline {
  readonly slides: readonly DeckTimelineSlide[];
  /** Where each section starts, for a chapter list. */
  readonly sections: readonly { readonly title: string; readonly start: number }[];
  readonly duration: number;
}

/** How long a beat's recording plays, for a script that has one (D-105); null for none. */
export type VoiceLength = (script: string) => number | null;

/**
 * A deck's own times, along the path that takes no choices: each slide's opening holds a
 * moment, each beat lasts as its story's would, and a slide that doesn't carry on arrives with
 * one cut. A beat with a recording lasts as long as it, with a short tail, its steps spaced
 * evenly through it. What Play, a clock and an export follow; stepping by hand ignores it all.
 */
export function deckTimeline(
  source: DeckSource,
  slides: readonly DeckSlide[],
  controls?: ControlValues,
  voice?: VoiceLength,
): DeckTimeline {
  const out: DeckTimelineSlide[] = [];
  const sections: { title: string; start: number }[] = [];
  let now = 0;
  let section: string | null = null;
  slides.forEach((entry, index) => {
    const diagram = source.load(entry.folder).diagram;
    const cut = index > 0 && !entry.carriesOn;
    const start = now;
    if (entry.section !== null && entry.section !== section)
      sections.push({ title: entry.section, start });
    section = entry.section;
    if (cut) now += SLIDE_CUT;
    const opening = slideOpening(diagram, entry, controls);
    const segments: StorySegment[] = [];
    if (opening === null) now += STILL_SLIDE;
    else {
      if (!entry.carriesOn) now += SLIDE_OPENING;
      let cursor = opening;
      for (let beat = 0; beat < 400 && !slideEnded(diagram, entry, cursor, controls); beat++) {
        const cursors = nextBeat(diagram, cursor, controls);
        if (cursors.length === 0) break;
        let caption: string | null = null;
        let script: string | null = null;
        // A recording of the beat's words sets its length: each step a share of it.
        const words = beatScript(diagram, cursors);
        const clip = words === null ? null : (voice?.(words) ?? null);
        const share = clip === null ? null : (clip + VOICE_TAIL) / cursors.length;
        cursors.forEach((to, step) => {
          const ref = to.played.at(-1);
          const played = ref === undefined ? null : stepAt(diagram, ref);
          if (played === null) return;
          caption = played.say ?? caption;
          script = played.script ?? script;
          const endsBeat = step === cursors.length - 1;
          const change = to.rewound ? REWIND_CUT : stepChange(played);
          const hold = to.rewound
            ? 0
            : share !== null
              ? Math.max(0, share - change)
              : stepHold(played, endsBeat, caption, script);
          segments.push({
            from: cursor,
            to,
            start: now,
            change,
            end: now + change + hold,
            beat,
            endsBeat,
          });
          now += change + hold;
          cursor = to;
        });
      }
    }
    out.push({ slide: index, start, end: now, cut, opening, segments });
  });
  return { slides: out, sections, duration: now };
}

/** The script a beat says: the last its steps give, as the timeline counts captions. */
function beatScript(diagram: Diagram, cursors: readonly StoryCursor[]): string | null {
  let script: string | null = null;
  for (const to of cursors) {
    const ref = to.played.at(-1);
    const played = ref === undefined ? null : stepAt(diagram, ref);
    script = played?.script ?? script;
  }
  return script;
}

/**
 * Where a deck is at a time: the position, and while a picture is changing, the one it's
 * changing from and when that began.
 */
export function deckPositionAt(
  slides: readonly DeckSlide[],
  timeline: DeckTimeline,
  t: number,
): {
  readonly position: DeckPosition;
  readonly previous: DeckPosition | null;
  readonly changeStart: number | null;
  readonly changeSeconds: number;
  readonly cut: boolean;
} | null {
  let found = timeline.slides[0];
  for (const each of timeline.slides) if (each.start <= t) found = each;
  const entry = found === undefined ? undefined : slides[found.slide];
  if (found === undefined || entry === undefined) return null;
  let segment: StorySegment | null = null;
  for (const each of found.segments) if (each.start <= t) segment = each;
  if (segment === null) {
    // The opening: a cut from the slide before, when there was one.
    const before = timeline.slides[found.slide - 1];
    const beforeEntry = slides[found.slide - 1];
    const last = before?.segments.at(-1)?.to ?? before?.opening ?? null;
    return {
      position: at(found.slide, entry, found.opening),
      previous:
        found.cut && beforeEntry !== undefined ? at(found.slide - 1, beforeEntry, last) : null,
      changeStart: found.cut ? found.start : null,
      changeSeconds: SLIDE_CUT,
      cut: found.cut,
    };
  }
  return {
    position: at(found.slide, entry, segment.to),
    previous: at(found.slide, entry, segment.from),
    changeStart: segment.start,
    changeSeconds: segment.change,
    cut: false,
  };
}
