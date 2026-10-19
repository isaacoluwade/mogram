import { slideOpening } from "@mogram/core/deck";
import { beatsPlayed, type StepRef } from "@mogram/core/picture";
import type { ProjectFiles } from "@mogram/core/model";
import { deepLinkQuery } from "@/features/share/deep-link";
import { currentSlide, slidesOf, storyCursor, topDiagram } from "./store/editor-store";

interface Where {
  readonly files: ProjectFiles;
  readonly root: string;
  readonly deckRoot: string | null;
  readonly slide: number | null;
  readonly levelPath: readonly string[];
  readonly scene: string | null;
  readonly story: StepRef | null;
}

/**
 * The viewer's address for what the editor shows (SH-4): the level, scene and beat, or in a
 * deck the slide and how far into it (D-99), so Preview and Present open where you are.
 */
export function viewerQuery(state: Where, options: { readonly present?: boolean } = {}): string {
  const query = deepLinkQuery(where(state));
  if (options.present !== true) return query;
  return `${query.length > 0 ? `${query}&` : "?"}present=1`;
}

function where(state: Where): Parameters<typeof deepLinkQuery>[0] {
  const top = topDiagram(state.files, state.root);
  const cursor = storyCursor(top, state.story);
  const slide = currentSlide(state);
  if (state.deckRoot !== null && slide !== null) {
    const number =
      1 + slidesOf(state.files, state.deckRoot).findIndex((each) => each.item === slide.item);
    // How many of the slide's own beats have played, when it's the slide's story that's showing.
    const opening = slideOpening(top, slide);
    const beat =
      cursor !== null && cursor.story === slide.story
        ? Math.max(0, beatsPlayed(cursor) - beatsPlayed(opening))
        : 0;
    return {
      root: state.deckRoot === "" ? null : state.deckRoot,
      slide: number,
      ...(beat > 0 ? { beat } : {}),
    };
  }
  return {
    root: state.root === "" ? null : state.root,
    level: state.levelPath,
    scene: state.scene,
    ...(cursor === null ? {} : { story: cursor.story, beat: beatsPlayed(cursor) }),
  };
}
