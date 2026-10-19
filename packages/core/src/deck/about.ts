import { voiceFor } from "../assets/voice";
import type { ProjectFiles } from "../model/types";
import { beatsOf } from "../picture/moment";
import { deckInfo, deckSlides, deckTimeline, type DeckSource } from "./deck";
import { deckBeats } from "./words";

/**
 * What a project is, in the few numbers a list of projects shows: a diagram or a deck, how much
 * there is of it, and how far its words have got (written, then recorded).
 */
export interface ProjectAbout {
  readonly kind: "diagram" | "deck";
  /** A deck's slides as it plays; 0 for a diagram. */
  readonly slides: number;
  /** A diagram's scenes; 0 for a deck (its slides have their own). */
  readonly scenes: number;
  /** Beats of the story (a diagram's first, or every slide's stretch). */
  readonly beats: number;
  /** Of those, the ones with a script to say, and the ones recorded. */
  readonly scripted: number;
  readonly recorded: number;
}

const NOTHING: ProjectAbout = {
  kind: "diagram",
  slides: 0,
  scenes: 0,
  beats: 0,
  scripted: 0,
  recorded: 0,
};

/** What the project at `folder` is. A project that can't be read is an empty diagram. */
export function projectAbout(files: ProjectFiles, source: DeckSource, folder = ""): ProjectAbout {
  const words = (scripts: readonly (string | null)[]) => {
    const said = scripts.filter((script): script is string => script !== null);
    return {
      beats: scripts.length,
      scripted: said.length,
      recorded: said.filter((script) => voiceFor(files, folder, script) !== null).length,
    };
  };
  if (deckInfo(files, source, folder) !== null) {
    const slides = deckSlides(source, folder);
    const beats = deckBeats(source, slides, deckTimeline(source, slides));
    return {
      kind: "deck",
      slides: slides.length,
      scenes: 0,
      ...words(beats.map((beat) => beat.script)),
    };
  }
  if (!source.has(folder)) return NOTHING;
  const diagram = source.load(folder).diagram;
  const story = diagram.stories[0];
  return {
    kind: "diagram",
    slides: 0,
    scenes: diagram.scenes.length,
    ...words(story === undefined ? [] : beatsOf(story).map((beat) => beat.script)),
  };
}
