"use client";

import { memo, useEffect, useRef, useState } from "react";
import { slideClosing, type DeckSlide } from "@mogram/core/deck";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import type { Moment } from "@mogram/core/picture";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { loaderFor } from "@/features/canvas/use-diagram";

/**
 * A slide's thumbnail: its last picture, with its frame and its deck's values (D-100). Drawn
 * only once it scrolls into view, and drawn again only when what it shows has changed.
 */
interface ThumbnailProps {
  readonly files: ProjectFiles;
  readonly deck: Diagram;
  readonly slide: DeckSlide;
  readonly count: number;
  /** The frame's folder, when this slide is drawn over it. */
  readonly frame: string | null;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  files,
  deck,
  slide,
  count,
  frame,
}: ThumbnailProps) {
  const host = useRef<HTMLSpanElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (node === null || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  const moment: Moment = {
    scene: slide.scene,
    story: slideClosing(loaderFor(files).load(slide.folder).diagram, slide),
  };
  return (
    <span ref={host} className="block h-full w-full">
      {seen ? (
        <DiagramPreview
          files={files}
          folder={slide.folder}
          deck={{ diagram: deck, slide, count, frameFolder: frame }}
          animate={false}
          padding={0}
          moment={moment}
          className="pointer-events-none h-full w-full"
        />
      ) : null}
    </span>
  );
}, sameThumbnail);

/**
 * Whether a thumbnail shows the same thing: the same slide, of the same deck, from files whose
 * slide, deck and frame folders read the same. An edit to another slide doesn't redraw this one.
 */
function sameThumbnail(a: ThumbnailProps, b: ThumbnailProps): boolean {
  if (a.count !== b.count || a.frame !== b.frame) return false;
  // The deck's own file gives every slide its page, theme and values.
  const deckFile = a.deck.settingsFile;
  if (deckFile !== b.deck.settingsFile || a.files[deckFile] !== b.files[deckFile]) return false;
  const x = a.slide;
  const y = b.slide;
  if (
    x.folder !== y.folder ||
    x.number !== y.number ||
    x.section !== y.section ||
    x.story !== y.story ||
    x.scene !== y.scene ||
    x.from?.index !== y.from?.index ||
    x.to?.index !== y.to?.index
  )
    return false;
  if (a.files === b.files) return true;
  const folders = [x.folder, ...(a.frame === null ? [] : [a.frame])];
  const inside = (path: string) => folders.some((folder) => path.startsWith(`${folder}/`));
  const paths = new Set([...Object.keys(a.files), ...Object.keys(b.files)]);
  for (const path of paths) if (inside(path) && a.files[path] !== b.files[path]) return false;
  return true;
}
