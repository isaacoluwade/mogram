"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deckSlides, slideClosing, type DeckSlide } from "@mogram/core/deck";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EditorUnavailable } from "@/components/screens";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { loaderFor } from "@/features/canvas/use-diagram";
import type { DeepLink } from "@/features/share/deep-link";
import { Viewer, type ViewerProps } from "@/features/viewer/viewer";
import type { ViewerDeck } from "./viewer-deck";

/** Which slide is showing, how it was arrived at, and whether the deck is playing itself. */
interface Showing {
  readonly index: number;
  readonly start: ViewerDeck["start"];
  readonly playing: boolean;
  /** Goes up at every cut: a slide that carries on keeps the viewer it has. */
  readonly cut: number;
}

/**
 * Where the deck is, as of the last handover. A viewer's way on checks it, so a slide that has
 * been cut away from (or a timer it left behind) can't move the deck again.
 */
class Handovers {
  constructor(private at: Showing) {}

  get showing(): Showing {
    return this.at;
  }

  /** Whether `showing` is still the slide the deck is on. */
  holds(showing: Showing): boolean {
    return this.at.index === showing.index && this.at.cut === showing.cut;
  }

  /** Moves the deck on: a cut, or carrying straight on in the same viewer. */
  move(to: Omit<Showing, "cut">, cut: boolean): Showing {
    this.at = { ...to, cut: this.at.cut + (cut ? 1 : 0) };
    return this.at;
  }
}

type Mode = { readonly present: boolean; readonly record: boolean };

/**
 * A deck, played (D-99): one slide at a time, each its own diagram playing its stretch, with
 * one cut between slides that show different pictures and none between slides that carry on.
 * → and Space step a beat and roll into the next slide; with Shift, a slide at a time.
 */
export function DeckPlayer({
  folder = "",
  ...props
}: Omit<ViewerProps, "deck" | "passive" | "onModeChange"> & {
  /** The deck's folder: the project's own, unless said. */
  readonly folder?: string;
}) {
  const { files, initialLink, editHref } = props;
  const loader = useMemo(() => loaderFor(files), [files]);
  const slides = useMemo(() => deckSlides(loader, folder), [loader, folder]);
  const deckDiagram = loader.load(folder).diagram;
  const deck = deckDiagram.settings.deck;
  const [showing, setShowing] = useState<Showing>(() => ({
    index: Math.min(Math.max(0, (initialLink.slide ?? 1) - 1), Math.max(0, slides.length - 1)),
    start: { kind: "beats", beats: initialLink.beat ?? 0 },
    // Record mode waits for the presenter: → steps by hand, P plays the deck by itself.
    playing: false,
    cut: 0,
  }));
  const [handovers] = useState(() => new Handovers(showing));
  // The slide cut away from, fading off the one that's come (none, for reduced motion).
  const [leaving, setLeaving] = useState<Showing | null>(null);
  const [captions, setCaptions] = useState(deck?.captions ?? true);
  const [overview, setOverview] = useState(false);
  // Presenting and recording outlast a cut: the next slide's viewer starts the same.
  const [mode, setMode] = useState<Mode>(() => ({
    present: props.present || props.record === true,
    record: props.record === true,
  }));
  const onModeChange = useCallback(
    (next: Mode) =>
      setMode((was) => (was.present === next.present && was.record === next.record ? was : next)),
    [],
  );

  const go = useCallback(
    (to: Omit<Showing, "cut">, cut: boolean) => {
      const was = handovers.showing;
      setShowing(handovers.move(to, cut));
      if (cut) setLeaving(prefersReducedMotion() ? null : was);
    },
    [handovers],
  );

  const jump = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      go({ index, start: { kind: "opening" }, playing: false }, true);
      setOverview(false);
    },
    [go, slides.length],
  );

  // What the viewer is told. A slide that carries on is handed straight back, so the viewer
  // that's playing can play on without waiting to be drawn again.
  const make = useCallback(
    (first: Showing): ViewerDeck => {
      const build = (at: Showing): ViewerDeck => ({
        folder,
        frame: deck?.frame ?? null,
        slides,
        index: at.index,
        start: at.start,
        playing: at.playing,
        captions,
        next: (playing) => {
          const next = slides[at.index + 1];
          if (next === undefined || !handovers.holds(at)) return false;
          const to = { index: at.index + 1, start: { kind: "opening" } as const, playing };
          go(to, !next.carriesOn);
          return next.carriesOn ? build(handovers.showing) : true;
        },
        previous: () => {
          if (at.index === 0 || !handovers.holds(at)) return false;
          const carried = slides[at.index]?.carriesOn === true;
          const to = { index: at.index - 1, start: { kind: "closing" } as const, playing: false };
          go(to, !carried);
          return carried ? build(handovers.showing) : true;
        },
        toggleCaptions: () => setCaptions((shown) => !shown),
        overview: () => setOverview(true),
        goTo: (slide, beats) => {
          if (!handovers.holds(at) || slide < 0 || slide >= slides.length) return;
          const start =
            beats > 0
              ? ({ kind: "beats", beats: beats - 1, play: true } as const)
              : ({ kind: "opening" } as const);
          go({ index: slide, start, playing: false }, true);
        },
      });
      return build(first);
    },
    [folder, deck?.frame, slides, captions, go, handovers],
  );
  const viewerDeck = useMemo(() => make(showing), [make, showing]);
  const leavingDeck = useMemo(() => (leaving === null ? null : make(leaving)), [make, leaving]);

  // The deck's own keys: a slide at a time, the ends, the overview, the captions.
  const { record } = mode;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
          event.target.closest('[role="dialog"]') !== null)
      )
        return;
      const index = handovers.showing.index;
      if (event.shiftKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        if (!event.repeat) jump(index + (event.key === "ArrowRight" ? 1 : -1));
      } else if (event.key === "Home") jump(0);
      else if (event.key === "End") jump(slides.length - 1);
      // Record mode shows the picture and nothing else: no overview over it.
      else if (!record && (event.key === "g" || event.key === "G")) setOverview(true);
      else if (event.key === "c" || event.key === "C") setCaptions((shown) => !shown);
    };
    // Before the viewer's own keys, which step a beat and leave Shift+arrows to the deck.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [jump, slides.length, record, handovers]);

  const slide = slides[showing.index];
  // Each slide's viewer opens its slide's folder. The rest of the link was for the first.
  const link = useMemo(
    () => ({ ...initialLink, root: slide?.folder ?? null }),
    [initialLink, slide?.folder],
  );
  const leavingFolder = leaving === null ? null : (slides[leaving.index]?.folder ?? null);
  const leavingLink = useMemo(
    () => ({ ...initialLink, root: leavingFolder }),
    [initialLink, leavingFolder],
  );

  if (deck === null || slide === undefined)
    return (
      <EditorUnavailable
        title="This deck has no slides yet"
        description="A deck plays its slides in order. Add one in the editor, then open it again."
      />
    );

  // The owner's way back to the editor opens the slide showing.
  const slideEditHref = editHref === null ? null : `${editHref}?${editQuery(folder, slide)}`;
  // A preview's way home is the editor too: the same slide.
  const slideHomeHref =
    props.preview === true ? `${props.homeHref}?${editQuery(folder, slide)}` : props.homeHref;
  const layers: { cut: number; deck: ViewerDeck; link: DeepLink; going: boolean }[] = [
    { cut: showing.cut, deck: viewerDeck, link, going: false },
  ];
  if (leaving !== null && leavingDeck !== null && leaving.cut !== showing.cut)
    layers.push({ cut: leaving.cut, deck: leavingDeck, link: leavingLink, going: true });
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-page" data-testid="deck-player">
      {layers.map(({ cut, deck: layerDeck, link: layerLink, going }) => {
        return (
          <div
            key={cut}
            className={cn("absolute inset-0", going && "pointer-events-none z-20 animate-fade-out")}
            // The slide showing says which it is; the one fading out says it's going.
            {...{
              [going ? "data-leaving" : "data-slide"]: layerDeck.slides[layerDeck.index]?.number,
            }}
            onAnimationEnd={(event) => {
              // Its own fade, not one inside the picture.
              if (going && event.target === event.currentTarget)
                setLeaving((was) => (was?.cut === cut ? null : was));
            }}
          >
            <Viewer
              {...props}
              editHref={slideEditHref}
              homeHref={slideHomeHref}
              present={mode.present}
              record={mode.record}
              initialLink={layerLink}
              deck={layerDeck}
              passive={going}
              {...(going ? {} : { onModeChange })}
            />
          </div>
        );
      })}
      <Overview
        open={overview}
        files={files}
        deckDiagram={deckDiagram}
        frameFolder={deck.frame}
        slides={slides}
        current={showing.index}
        onPick={jump}
        onOpenChange={setOverview}
      />
    </div>
  );
}

/** The editor's address for a deck's slide: its folder's deck, and which slide. */
function editQuery(folder: string, slide: DeckSlide): string {
  const params = new URLSearchParams();
  if (folder !== "") params.set("root", folder);
  params.set("slide", String(slide.number));
  return params.toString().replace(/%2F/g, "/");
}

/** Every slide as a thumbnail of its last picture, under its section. Click to go there. */
function Overview({
  open,
  files,
  deckDiagram,
  frameFolder,
  slides,
  current,
  onPick,
  onOpenChange,
}: {
  open: boolean;
  files: ProjectFiles;
  deckDiagram: Diagram;
  frameFolder: string | null;
  slides: readonly DeckSlide[];
  current: number;
  onPick: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const sections = useMemo(() => {
    const groups: { title: string | null; slides: { slide: DeckSlide; index: number }[] }[] = [];
    slides.forEach((slide, index) => {
      const last = groups.at(-1);
      if (last === undefined || last.title !== slide.section)
        groups.push({ title: slide.section, slides: [{ slide, index }] });
      else last.slides.push({ slide, index });
    });
    return groups;
  }, [slides]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="All slides" size="xl" data-testid="deck-overview">
        <div className="flex flex-col gap-6">
          {sections.map((section, at) => (
            <section key={`${at}:${section.title ?? ""}`} className="flex flex-col gap-3">
              {section.title !== null ? (
                <h3 className="text-label font-medium text-fg-muted">{section.title}</h3>
              ) : null}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {section.slides.map(({ slide, index }) => (
                  <li key={index}>
                    <OverviewTile
                      files={files}
                      deckDiagram={deckDiagram}
                      frameFolder={slide.frame ? frameFolder : null}
                      slide={slide}
                      count={slides.length}
                      current={index === current}
                      onPick={() => onPick(index)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverviewTile({
  files,
  deckDiagram,
  frameFolder,
  slide,
  count,
  current,
  onPick,
}: {
  files: ProjectFiles;
  deckDiagram: Diagram;
  frameFolder: string | null;
  slide: DeckSlide;
  count: number;
  current: boolean;
  onPick: () => void;
}) {
  const moment = useMemo(
    () => ({
      scene: slide.scene,
      story: slideClosing(loaderFor(files).load(slide.folder).diagram, slide),
    }),
    [files, slide],
  );
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={current ? "true" : undefined}
      aria-label={`Slide ${slide.number}: ${slide.title}`}
      className={cn(
        "group flex w-full flex-col gap-1.5 rounded-lg p-1.5 text-left transition-colors hover:bg-fill-hover",
        current && "bg-fill-active",
      )}
    >
      <span className="block aspect-video w-full overflow-hidden rounded-md ring-1 ring-border">
        <DiagramPreview
          files={files}
          folder={slide.folder}
          deck={{ diagram: deckDiagram, slide, count, frameFolder }}
          animate={false}
          padding={0}
          className="pointer-events-none h-full w-full"
          moment={moment}
        />
      </span>
      <span className="flex items-baseline gap-2 px-0.5">
        <span className="text-caption tabular-nums text-fg-muted">{slide.number}</span>
        <span className="truncate text-caption text-fg-soft">{slide.title}</span>
      </span>
    </button>
  );
}
