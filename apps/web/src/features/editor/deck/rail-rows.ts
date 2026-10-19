import type { DeckSlide } from "@mogram/core/deck";
import type { Deck, DeckEntry } from "@mogram/core/model";

/** A row of the slide rail: a section's header, or a slide's tile. */
export type RailRow =
  | {
      readonly kind: "section";
      /** Its place in the deck's list as written. */
      readonly item: number;
      readonly title: string;
      /** How many slides are under it, up to the next section. */
      readonly count: number;
    }
  | {
      readonly kind: "slide";
      readonly item: number;
      readonly entry: Extract<DeckEntry, { kind: "slide" }>;
      /** As it plays; null for one that's skipped (it isn't counted). */
      readonly slide: DeckSlide | null;
      /** What it's called: as it plays, or for one that's skipped, as it would. */
      readonly title: string;
      /** The section it's in, by title; null before the first. */
      readonly section: string | null;
    };

/**
 * The rail's rows, in the order the deck lists them. `nameOf` names a skipped slide's diagram,
 * which isn't among the slides as they play.
 */
export function railRows(
  deck: Deck,
  slides: readonly DeckSlide[],
  nameOf: (folder: string) => string | null = () => null,
): RailRow[] {
  const byItem = new Map(slides.map((slide) => [slide.item, slide]));
  const rows: RailRow[] = [];
  let section: string | null = null;
  for (const entry of deck.entries) {
    if (entry.kind === "section") {
      section = entry.title;
      rows.push({ kind: "section", item: entry.item, title: entry.title, count: 0 });
      continue;
    }
    const slide = byItem.get(entry.item) ?? null;
    rows.push({
      kind: "slide",
      item: entry.item,
      entry,
      slide,
      title: slide?.title ?? entry.title ?? nameOf(entry.folder) ?? entry.folder,
      section,
    });
  }
  // Each section says how many slides are under it, for when it's folded.
  return rows.map((row, at) => {
    if (row.kind !== "section") return row;
    let count = 0;
    for (const next of rows.slice(at + 1)) {
      if (next.kind === "section") break;
      count++;
    }
    return { ...row, count };
  });
}

/**
 * Where a new slide goes: after the one showing, in its section, or the end when none is. A
 * section right after it with nothing in yet (one just made) is where it goes instead.
 */
export function insertAfter(deck: Deck, item: number | null): number {
  const at = new Map(deck.entries.map((entry) => [entry.item, entry]));
  if (item === null) return (deck.entries.at(-1)?.item ?? -1) + 1;
  let place = item + 1;
  while (at.get(place)?.kind === "section" && at.get(place + 1)?.kind !== "slide") place++;
  return place;
}

/** The MIME type a dragged rail entry carries: nothing else dropped on the rail moves entries. */
export const RAIL_DRAG = "application/x-mogram-deck-entry";
