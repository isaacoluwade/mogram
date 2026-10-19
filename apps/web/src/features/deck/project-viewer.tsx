"use client";

import { useEffect, useMemo } from "react";
import { addAssetSource } from "@/features/assets/remote";
import { deckInfo } from "@mogram/core/deck";
import { loaderFor } from "@/features/canvas/use-diagram";
import { Viewer, type ViewerProps } from "@/features/viewer/viewer";
import { DeckPlayer } from "./deck-player";

/** What a project is shown in: the deck player when it's a deck (D-99), else the viewer. */
export function ProjectViewer(props: Omit<ViewerProps, "deck">) {
  const { files } = props;
  const assetBase = props.assetBase;
  // Pictures come from where the page opened the diagram, when this browser hasn't them.
  useEffect(() => (assetBase === undefined ? undefined : addAssetSource(assetBase)), [assetBase]);
  // The deck at the folder asked for (`?root=talks/intro`), or the project's own. A link to a
  // slide's folder is that diagram by itself: the folder isn't a deck.
  const folder = props.initialLink.root ?? "";
  const isDeck = useMemo(() => deckInfo(files, loaderFor(files), folder) !== null, [files, folder]);
  return isDeck ? <DeckPlayer {...props} folder={folder} /> : <Viewer {...props} />;
}
