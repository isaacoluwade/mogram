import type { DeckSlide } from "@mogram/core/deck";

/**
 * What a viewer is told when the diagram it shows is a slide of a deck (D-99): which slide,
 * where in it to begin, and how to hand over to the slide before or after.
 */
export interface ViewerDeck {
  /** The deck's folder, and the folder of its frame when this slide is drawn over one. */
  readonly folder: string;
  readonly frame: string | null;
  readonly slides: readonly DeckSlide[];
  /** Which of `slides` is showing. */
  readonly index: number;
  /** Where the slide begins when this viewer first shows it. */
  readonly start:
    | { readonly kind: "opening" }
    | { readonly kind: "closing" }
    | {
        readonly kind: "beats";
        readonly beats: number;
        /** Then the next beat plays: the Script window has just begun it. */
        readonly play?: boolean;
      };
  /** Whether each beat's caption is shown. */
  readonly captions: boolean;
  /** Whether the deck was playing by itself when this slide came up, and should carry on. */
  readonly playing: boolean;
  /**
   * To the slide after (keeping the deck playing, or not). False at the end of the deck. When
   * that slide carries straight on from this one, the deck as it is on that slide comes back
   * instead: the same viewer plays on, with nothing to wait for.
   */
  next(playing: boolean): boolean | ViewerDeck;
  /** To the last picture of the slide before; the same three answers. */
  previous(): boolean | ViewerDeck;
  /** Shows or hides each beat's words, for this viewing. */
  toggleCaptions(): void;
  /** Opens every slide as a thumbnail, to go to one. */
  overview(): void;
  /** To a slide with `beats` of it begun, the last of them playing (the Script window's). */
  goTo(slide: number, beats: number): void;
}
