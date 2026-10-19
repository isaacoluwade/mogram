"use client";

import { useLayoutEffect, useRef } from "react";
import {
  Captions,
  CaptionsOff,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pause,
  Play,
} from "lucide-react";
import { slideEnded } from "@mogram/core/deck";
import { captionAt, choicesAt } from "@mogram/core/picture";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import {
  useViewerController,
  useViewerShallow,
  useViewerStore,
} from "@/features/viewer/viewer-context";
import type { ViewerDeck } from "./viewer-deck";

/**
 * A deck's bar (D-99), where a story's bar would be: the words of the beat showing (when the
 * deck shows them), which slide this is, and the way on and back, a beat and then a slide at a
 * time.
 */
export function DeckBar({ deck }: { deck: ViewerDeck }) {
  const controller = useViewerController();
  const store = useViewerStore();
  const { story, playing, controls } = useViewerShallow((s) => ({
    story: s.story,
    playing: s.storyPlaying,
    controls: s.controls,
    // Carrying on changes the slide and nothing else: the bar still has to say so.
    slide: s.slide,
  }));
  const diagram = controller.levels.top.diagram;
  const slide = deck.slides[deck.index];
  const caption = deck.captions ? captionAt(diagram, story) : null;
  const choices = choicesAt(diagram, story);

  // The slide is framed above the bar, never under it (a page presented fills the screen).
  const bar = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const node = bar.current;
    if (node === null) return;
    const reserve = () => {
      const top = node.getBoundingClientRect().top;
      store.getState().setReservedBottom(Math.max(0, Math.round(window.innerHeight - top + 12)));
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(node);
    return () => {
      observer.disconnect();
      store.getState().setReservedBottom(0);
    };
  }, [store]);

  if (slide === undefined) return null;
  const first = deck.index === 0 && controller.storyBeat === 0;
  const last = deck.index === deck.slides.length - 1 && slideEnded(diagram, slide, story, controls);
  return (
    <div
      ref={bar}
      className="flex w-[min(720px,calc(100vw-1rem))] flex-col items-center gap-2"
      data-testid="deck-bar"
    >
      {caption !== null || choices.length > 0 ? (
        <Panel className="flex w-full flex-col gap-2.5 px-4 py-3">
          {caption !== null ? (
            <p
              aria-live="polite"
              data-testid="story-caption"
              className="text-pretty text-body leading-snug text-fg"
            >
              {caption}
            </p>
          ) : null}
          {choices.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="What happens next">
              {choices.map((choice) => (
                <Button
                  key={`${choice.play}:${choice.label}`}
                  variant="outline"
                  size="sm"
                  onClick={() => controller.chooseStory(choice.play)}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Panel>
      ) : null}
      <Panel shape="pill" role="group" aria-label="Deck" className="flex items-center gap-0.5 p-1">
        <IconButton
          label="Back"
          shortcut="←"
          size="sm"
          shape="round"
          disabled={first}
          onClick={() => controller.stepDeck(-1)}
        >
          <ChevronLeft />
        </IconButton>
        <IconButton
          label={playing ? "Pause" : "Play"}
          shortcut="Space"
          size="sm"
          shape="round"
          active={playing}
          onClick={() => controller.setStoryPlaying(!playing)}
        >
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <IconButton
          label="Next"
          shortcut="→"
          size="sm"
          shape="round"
          disabled={last}
          onClick={() => controller.stepDeck(1)}
        >
          <ChevronRight />
        </IconButton>
        <span
          className="min-w-14 px-1.5 text-center text-caption tabular-nums text-fg-muted"
          data-testid="deck-slide"
        >
          {slide.number} / {deck.slides.length}
        </span>
        <span
          className="max-w-64 truncate pr-2 text-caption text-fg-soft max-sm:hidden"
          data-testid="deck-title"
        >
          {slide.section === null ? slide.title : `${slide.section} · ${slide.title}`}
        </span>
        <ToolbarDivider />
        <IconButton
          label={deck.captions ? "Hide captions" : "Show captions"}
          shortcut="C"
          size="sm"
          shape="round"
          active={deck.captions}
          onClick={deck.toggleCaptions}
        >
          {deck.captions ? <Captions /> : <CaptionsOff />}
        </IconButton>
        <IconButton label="All slides" shortcut="G" size="sm" shape="round" onClick={deck.overview}>
          <LayoutGrid />
        </IconButton>
      </Panel>
    </div>
  );
}
