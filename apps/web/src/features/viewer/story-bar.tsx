"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { beatsPlayed, captionAt, choicesAt, hasNext, storyTimeline } from "@mogram/core/picture";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useViewerController, useViewerShallow, useViewerStore } from "./viewer-context";

/**
 * The story (D-86): its words under the diagram as each beat plays, with back, play and next,
 * a dot for every beat, and the choices a beat offers. Arrow keys step it; Space plays it.
 */
export function StoryBar() {
  const controller = useViewerController();
  const store = useViewerStore();
  const { story, playing, levelPath } = useViewerShallow((s) => ({
    story: s.story,
    playing: s.storyPlaying,
    levelPath: s.levelPath,
  }));
  const diagram = controller.levels.top.diagram;
  const total = useMemo(
    () => (story === null ? 0 : (storyTimeline(diagram, story.story)?.beats ?? 0)),
    // The count depends on which story, not on how far into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diagram, story?.story],
  );

  // The diagram is framed above the bar, never under it.
  const bar = useRef<HTMLDivElement | null>(null);
  const shown = story !== null;
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
  }, [store, shown]);

  if (story === null) return null;
  const caption = captionAt(diagram, story);
  const choices = choicesAt(diagram, story);
  const played = beatsPlayed(story);
  const more = hasNext(diagram, story);
  // A story a choice played adds beats of its own: the dots follow the story begun.
  const dots = Math.max(total, played);
  const opening = played === 0;

  return (
    <Panel
      ref={bar}
      role="group"
      aria-label="Story"
      data-testid="story-bar"
      className="flex w-[min(640px,calc(100vw-1rem))] flex-col gap-2.5 px-4 pb-2.5 pt-3.5"
    >
      <p
        aria-live="polite"
        data-testid="story-caption"
        className={cn(
          "min-h-[2lh] text-pretty text-body leading-snug",
          caption === null ? "text-fg-muted" : "text-fg",
        )}
      >
        {caption ??
          (opening
            ? (diagram.settings.description ?? diagram.settings.name)
            : levelPath.length > 0
              ? ""
              : " ")}
      </p>
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
      <div className="-mx-1.5 flex items-center gap-0.5">
        <IconButton
          label="Back"
          shortcut="←"
          size="sm"
          shape="round"
          disabled={opening}
          onClick={() => controller.previousBeat()}
        >
          <ChevronLeft />
        </IconButton>
        <IconButton
          label={playing ? "Pause" : more ? "Play" : "Play again"}
          shortcut="Space"
          size="sm"
          shape="round"
          active={playing}
          onClick={() => controller.setStoryPlaying(!playing)}
        >
          {playing ? <Pause /> : more ? <Play /> : <RotateCcw />}
        </IconButton>
        <IconButton
          label={opening ? "Start" : "Next"}
          shortcut="→"
          size="sm"
          shape="round"
          disabled={!more}
          onClick={() => {
            store.getState().setStoryPlaying(false);
            controller.nextBeat();
          }}
        >
          <ChevronRight />
        </IconButton>
        <ol className="mx-2 flex min-w-0 flex-1 items-center gap-1" aria-label="Beats">
          {Array.from({ length: dots }, (_, index) => (
            <li key={index} className="min-w-0 flex-1">
              <button
                type="button"
                aria-label={`Beat ${index + 1} of ${dots}`}
                aria-current={index + 1 === played ? "step" : undefined}
                // Dots follow the story begun; inside a chosen story they only show progress.
                disabled={index >= total}
                onClick={() => {
                  store.getState().setStoryPlaying(false);
                  controller.openStory(story.story, index + 1);
                }}
                className="hit-area block h-1.5 w-full rounded-full transition-colors"
              >
                <span
                  className={cn(
                    "block h-1 w-full rounded-full transition-colors",
                    index < played ? "bg-fg-soft" : "bg-fill-active",
                  )}
                />
              </button>
            </li>
          ))}
        </ol>
        <span className="shrink-0 text-micro tabular-nums text-fg-muted">
          {played} / {dots}
        </span>
      </div>
    </Panel>
  );
}
