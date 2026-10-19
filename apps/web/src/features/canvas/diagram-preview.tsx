"use client";

import { useCapacity } from "./capacity";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import {
  OPENING_HOLD,
  captionAt,
  storyTimeline,
  type Moment,
  type StoryCursor,
} from "@mogram/core/picture";
import { computeLayout } from "@mogram/core/layout";
import { routeConnections } from "@mogram/core/routing";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import { cn } from "@/lib/cn";
import { fitBox, type Camera } from "./camera";
import { Clock } from "./clock";
import { buildScene } from "./scene";
import { useFontsVersion } from "./text";
import { DiagramSvg } from "./svg/diagram-svg";
import { resolveTheme } from "./theme";
import { resolveFor, useLayout, useParsedDiagram, useRoutes } from "./use-diagram";
import { loaderFor } from "./use-diagram";
import { slideDiagram, type DeckSlide } from "@mogram/core/deck";

export interface DiagramPreviewDeck {
  readonly diagram: Diagram;
  readonly slide: Pick<DeckSlide, "number" | "section">;
  readonly count: number;
  readonly frameFolder: string | null;
}

/**
 * A read-only, animated diagram that fits its box. Used on the landing page, in previews and
 * for scene thumbnails.
 */
export function DiagramPreview({
  files,
  folder = "",
  scene = null,
  className,
  padding = 32,
  minZoom,
  insets,
  animate = true,
  captions = false,
  moment: fixed,
  deck,
}: {
  files: ProjectFiles;
  folder?: string;
  scene?: string | null;
  className?: string;
  padding?: number;
  /** Small boxes (phones) show the middle of the diagram at a readable size instead of all of it. */
  minZoom?: number;
  /** Room kept clear of the diagram, e.g. under a scene control laid over the preview. */
  insets?: { top: number; right: number; bottom: number; left: number };
  animate?: boolean;
  /** Show the story's words over the bottom of the preview as it plays. */
  captions?: boolean;
  /** One picture to show and hold, in place of playing the story: a slide's thumbnail. */
  moment?: Moment;
  /** The deck and slide context for an overview thumbnail, including its frame when shown. */
  deck?: DiagramPreviewDeck;
}) {
  const { diagram: parsedDiagram } = useParsedDiagram(files, folder);
  const diagram = useMemo(
    () =>
      deck === undefined
        ? parsedDiagram
        : slideDiagram(deck.diagram, parsedDiagram, deck.slide, deck.count),
    [deck, parsedDiagram],
  );
  const layout = useLayout(diagram);
  const routes = useRoutes(diagram, layout);
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  const [clock] = useState(() => new Clock());
  // A diagram with a story plays it, over and over, while the preview animates (D-86).
  const playing = useStoryLoop(diagram, animate && fixed === undefined);
  const moment = useMemo<Moment>(
    () => fixed ?? { scene, story: playing.cursor },
    [fixed, scene, playing.cursor],
  );
  const resolved = useMemo(
    () => resolveFor(files, folder, diagram, moment),
    [files, folder, diagram, moment],
  );

  // Changes of scene or step animate like the editor's (SC-7): remember where we came from
  // until the change is done.
  const [transition, setTransition] = useState<{
    from: Moment;
    start: number;
    seconds: number;
  } | null>(null);
  const shownMoment = useRef(moment);
  useLayoutEffect(() => {
    const from = shownMoment.current;
    if (from === moment) return;
    shownMoment.current = moment;
    // A story starting over cuts back to its opening.
    if (playing.seconds > 0 || from.scene !== moment.scene)
      setTransition({
        from,
        start: clock.time(),
        seconds: from.scene !== moment.scene ? SCENE_TRANSITION : playing.seconds,
      });
    else setTransition(null);
  }, [moment, clock, playing.seconds]);
  useEffect(() => {
    if (transition === null) return;
    // A step's values run on after its change is done: keep its start until the step ends.
    const lasts = Math.max(transition.seconds, playing.lasts);
    const timer = window.setTimeout(() => setTransition(null), lasts * 1000 + 100);
    return () => window.clearTimeout(timer);
  }, [transition, playing.lasts]);
  const previous = useMemo(
    () => (transition === null ? null : resolveFor(files, folder, diagram, transition.from)),
    [files, folder, diagram, transition],
  );

  // Text measured before the fonts loaded is measured again once they have.
  const fonts = useFontsVersion();
  const model = useMemo(
    () =>
      buildScene({
        diagram,
        files,
        layout,
        routes,
        current: resolved,
        previous,
        transitionStart: transition?.start ?? null,
        ...(transition === null ? {} : { transitionSeconds: transition.seconds }),
        ...(transition === null || playing.lasts === 0
          ? {}
          : { ramp: { start: transition.start, seconds: playing.lasts } }),
        theme,
        fontFamily: "Inter",
        fontsVersion: fonts,
      }),
    [diagram, files, layout, routes, resolved, previous, transition, playing.lasts, theme, fonts],
  );
  const frameModel = useMemo(() => {
    if (deck === undefined || deck.frameFolder === null) return null;
    const raw = loaderFor(files).load(deck.frameFolder).diagram;
    const frameDiagram = slideDiagram(deck.diagram, raw, deck.slide, deck.count);
    const frameLayout = computeLayout(frameDiagram);
    const frameRoutes = routeConnections(frameDiagram, frameLayout);
    return buildScene({
      diagram: frameDiagram,
      files,
      layout: frameLayout,
      routes: frameRoutes,
      current: resolveFor(files, deck.frameFolder, frameDiagram, null),
      theme: resolveTheme(frameDiagram.settings),
      fontFamily: "Inter",
      fontsVersion: fonts,
    });
  }, [deck, files, fonts]);

  // Capacity over time (D-82): a preview that changes scene shows copies booting and draining.
  const capacity = useCapacity(diagram, resolved, () => clock.time(), !animate);

  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined)
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clock.dispose(), [clock]);
  // Previews can start and stop animating (e.g. on hover); reduced motion keeps them still.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) clock.pause();
    else clock.resume();
    clock.tick();
  }, [clock, animate]);

  const camera: Camera | null =
    size === null
      ? null
      : fitBox(model.bounds, size, {
          padding,
          maxZoom: 1,
          ...(minZoom !== undefined ? { minZoom } : {}),
          ...(insets !== undefined ? { insets } : {}),
        });

  const caption = captions ? captionAt(diagram, playing.cursor) : null;
  return (
    <div ref={host} className={cn("relative", className)} style={{ background: theme.css }}>
      {camera !== null && size !== null ? (
        <>
          {frameModel !== null ? (
            <div className="pointer-events-none absolute inset-0">
              <DiagramSvg
                scene={frameModel}
                time={{ kind: "live", clock }}
                mode="view"
                fontFamily="var(--font-sans)"
                camera={camera}
                size={size}
              />
            </div>
          ) : null}
          <DiagramSvg
            scene={model}
            capacity={capacity}
            time={{ kind: "live", clock }}
            mode="view"
            fontFamily="var(--font-sans)"
            camera={camera}
            size={size}
          />
        </>
      ) : null}
      {caption !== null ? (
        <p
          key={caption}
          data-testid="preview-caption"
          className="pointer-events-none absolute inset-x-3 bottom-3 animate-fade-in rounded-md border border-white/10 bg-sidebar/90 px-3 py-2 text-pretty text-caption leading-snug text-fg shadow-panel backdrop-blur-xl"
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** How long the last picture of a story stays before it starts over. */
const END_HOLD = 2.5;

/**
 * Plays a diagram's first story on its written times, starting over at the end. While `on` is
 * false (or there's no story) it rests at the opening. `seconds` is how long the change into
 * the cursor takes (0: a cut).
 */
function useStoryLoop(
  diagram: Diagram,
  on: boolean,
): {
  readonly cursor: StoryCursor | null;
  readonly seconds: number;
  /** How long the step lasts, change and hold: values run across it. */
  readonly lasts: number;
} {
  const timeline = useMemo(() => storyTimeline(diagram), [diagram]);
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    if (timeline === null || !on || timeline.segments.length === 0) return;
    let timer = 0;
    const play = (next: number): void => {
      const segment = timeline.segments[next];
      if (segment === undefined) {
        timer = window.setTimeout(() => {
          setIndex(-1);
          timer = window.setTimeout(() => play(0), OPENING_HOLD * 1000);
        }, END_HOLD * 1000);
        return;
      }
      setIndex(next);
      timer = window.setTimeout(() => play(next + 1), (segment.end - segment.start) * 1000);
    };
    timer = window.setTimeout(() => play(0), OPENING_HOLD * 1000);
    return () => {
      window.clearTimeout(timer);
      setIndex(-1);
    };
  }, [timeline, on]);
  if (timeline === null) return { cursor: null, seconds: 0, lasts: 0 };
  const segment = timeline.segments[index];
  return segment === undefined
    ? { cursor: timeline.opening, seconds: 0, lasts: 0 }
    : { cursor: segment.to, seconds: segment.change, lasts: segment.end - segment.start };
}
