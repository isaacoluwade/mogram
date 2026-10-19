"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Gauge,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import {
  addStep,
  addStory,
  deleteStory,
  canJoinSlides,
  canSplitSlide,
  joinSlides,
  moveSteps,
  removeSteps,
  setSceneEntry,
  splitSlide,
  updateStep,
} from "@mogram/core/edit";
import type { Diagram, ProjectFiles, Story } from "@mogram/core/model";
import {
  beatsOf,
  captionAt,
  describeChange,
  stepChange,
  stepHold,
  type Beat,
  type StepRef,
} from "@mogram/core/picture";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { BeatVoice } from "./beat-voice";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useScrollFade } from "@/lib/use-scroll-fade";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { CommitInput } from "../inspector/fields";
import {
  currentSlide,
  parseCached,
  shownFiles,
  storyCursor,
  topDiagram,
} from "../store/editor-store";
import { DockSwitch, SceneThumb, type SceneStripProps } from "./scene-strip";

/** The words a new beat starts with: typed over straight away. */
const NEW_CAPTION = "Say what happens here.";

/** The beat a step belongs to, and where the step is in it. -1: the opening. */
function beatOf(beats: readonly Beat[], index: number): number {
  return beats.findIndex((beat) => index >= beat.first && index < beat.first + beat.steps.length);
}

/**
 * Play runs through the story's steps from the one shown, each for as long as it's written to
 * take, and stops at the end.
 */
function useStoryPlayback(top: Diagram, story: Story | null) {
  const store = useEditorStore();
  const clock = useEditorClock();
  const { playing, step } = useEditorShallow((s) => ({ playing: s.playing, step: s.story }));
  useEffect(() => {
    if (!playing || story === null) return;
    const index = step?.story === story.name ? step.index : -1;
    const next = story.steps[index + 1];
    const state = store.getState();
    if (next === undefined) {
      state.setPlaying(false);
      return;
    }
    const current = story.steps[index];
    // How long the step showing stays: its change, then long enough to read its beat's words.
    const ends = next.say !== null;
    const wait =
      current === undefined
        ? 0.4
        : stepChange(current) +
          stepHold(current, ends, captionAt(top, storyCursor(top, { story: story.name, index })));
    const timer = window.setTimeout(
      () => store.getState().setStory({ story: story.name, index: index + 1 }, clock.time()),
      wait * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, story, step, top, store, clock]);
}

/**
 * A story as a strip of beats (D-86): the opening, then a tile per beat. Under the strip, the
 * beat that's picked: its words, its steps, and what the step shown changes. The canvas shows
 * the picture at that step, and what's changed about an element there belongs to the step.
 */
export function StoryStrip({ layout, routes, theme }: SceneStripProps) {
  const store = useEditorStore();
  const clock = useEditorClock();
  const { files, root, folder, step, playing, levelPath, deckRoot, slide } = useEditorShallow(
    (s) => ({
      files: shownFiles(s),
      root: s.root,
      folder: s.folder,
      step: s.story,
      playing: s.playing,
      levelPath: s.levelPath,
      deckRoot: s.deckRoot,
      slide: s.slide,
    }),
  );
  const diagram = useEditor((s) => s.parsed().diagram);
  // Stories belong to the top diagram, like scenes (NE-14).
  const nested = levelPath.length > 0;
  const top = nested ? topDiagram(files, root) : diagram;
  const topOf = (f: ProjectFiles, d: Diagram): Diagram => (nested ? topDiagram(f, root) : d);
  // On a slide (D-100), the story the slide plays, and which of its beats the slide covers.
  const onSlide = nested ? null : currentSlide({ files, deckRoot, slide });
  const story =
    top.stories.find((item) => item.name === step?.story) ??
    top.stories.find((item) => item.name === onSlide?.story) ??
    top.stories[0] ??
    null;
  const beats = useMemo(() => (story === null ? [] : beatsOf(story)), [story]);
  const strip = useScrollFade<HTMLDivElement>();
  useStoryPlayback(top, story);

  if (deckRoot !== null && slide === null && root === deckRoot) return null;

  const shown = step?.story === story?.name ? (step?.index ?? -1) : -1;
  const beatIndex = beatOf(beats, shown);
  const beat = beats[beatIndex];
  const show = (ref: StepRef) => store.getState().setStory(ref, clock.time());
  const thumbProps = { files, folder, diagram, layout, routes, theme, levelPath };

  if (story === null) {
    return (
      <Panel
        className="flex min-w-0 max-w-full items-center gap-3 p-1.5 pr-3"
        role="region"
        aria-label="Story"
      >
        <DockSwitch />
        <p className="min-w-0 pl-2 text-caption text-fg-muted">
          {onSlide !== null
            ? "This slide is still. A story plays it step by step, with words for each beat."
            : "A story plays your diagram step by step, with words for each beat."}
        </p>
        <button
          type="button"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-fill-button px-3 text-caption font-medium text-fg-soft transition-colors hover:bg-fill-active hover:text-fg"
          onClick={() => {
            const ok = store
              .getState()
              .edit("Add story", (f, d) => addStory(f, topOf(f, d), { say: NEW_CAPTION }));
            if (ok) show({ story: "main", index: 0 });
          }}
        >
          <Plus className="size-3.5" /> Start a story
        </button>
      </Panel>
    );
  }

  const name = story.name;
  const lastOf = (b: Beat): number => b.first + b.steps.length - 1;
  const addBeat = (after: Beat | undefined) => {
    const index = after === undefined ? 0 : lastOf(after) + 1;
    const ok = store
      .getState()
      .edit("Add beat", (f, d) =>
        addStep(f, topOf(f, d), { story: name, index, say: NEW_CAPTION }),
      );
    if (ok) show({ story: name, index });
  };

  return (
    <Panel
      className="flex min-w-0 max-w-full flex-col gap-1.5 p-1.5 lg:max-w-[920px]"
      role="region"
      aria-label="Story"
    >
      <div className="flex min-w-0 items-center gap-1">
        <DockSwitch />
        <IconButton
          label={playing ? "Pause story" : "Play story"}
          shortcut="P"
          shape="round"
          active={playing}
          onClick={() => {
            const state = store.getState();
            // From the end, play starts over.
            if (!playing && shown >= story.steps.length - 1) show({ story: name, index: -1 });
            state.setPlaying(!playing);
          }}
        >
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <StoryMenu top={top} story={story} topOf={topOf} onShow={show} />
        <ToolbarDivider />
        <div
          ref={strip}
          className="scroll-fade scrollbar-none flex min-w-0 items-start gap-1.5 overflow-x-auto px-0.5 py-0.5"
        >
          <BeatTile
            label="Opening"
            caption="Before anything happens"
            selected={shown === -1}
            onSelect={() => show({ story: name, index: -1 })}
          >
            <SceneThumb
              {...thumbProps}
              scene={{ scene: null, story: storyCursor(top, { story: name, index: -1 }) }}
            />
          </BeatTile>
          {beats.map((item, index) => (
            <BeatTile
              key={`${item.first}:${item.say ?? ""}`}
              label={`Beat ${index + 1}`}
              caption={item.say ?? item.script ?? "No words"}
              selected={index === beatIndex}
              outside={
                onSlide !== null &&
                onSlide.story === name &&
                ((onSlide.from !== null && lastOf(item) <= onSlide.from.index) ||
                  (onSlide.to !== null && item.first > onSlide.to.index))
              }
              onSelect={() => show({ story: name, index: lastOf(item) })}
            >
              <SceneThumb
                {...thumbProps}
                scene={{
                  scene: null,
                  story: storyCursor(top, { story: name, index: lastOf(item) }),
                }}
              />
            </BeatTile>
          ))}
          <button
            type="button"
            onClick={() => addBeat(beat ?? beats.at(-1))}
            aria-label="Add beat"
            title={beat === undefined ? "Add a beat" : "Add a beat after this one"}
            className="flex h-16 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-fg-ghost transition-colors hover:border-border-emphasis hover:text-fg-soft"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      {beat === undefined ? (
        <p className="px-2 pb-1 text-caption text-fg-muted">
          The opening is the diagram before anything happens. Changes made here are to the diagram
          itself.
        </p>
      ) : (
        <BeatDetail
          key={`${name}:${beat.first}`}
          top={top}
          topOf={topOf}
          story={story}
          beat={beat}
          beatIndex={beatIndex}
          beats={beats}
          shown={shown}
          onShow={show}
          deckRoot={deckRoot}
          slideIndex={slide}
        />
      )}
    </Panel>
  );
}

function BeatTile({
  label,
  caption,
  selected,
  onSelect,
  outside = false,
  children,
}: {
  label: string;
  caption: string;
  selected: boolean;
  onSelect: () => void;
  /** On a slide, a beat of its story the slide doesn't play: shown faint (D-100). */
  outside?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex w-28 shrink-0 flex-col items-center gap-1", outside && "opacity-40")}
      data-outside={outside ? "true" : undefined}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${label}: ${caption}`}
        title={caption}
        onClick={onSelect}
        className={cn(
          "h-16 w-28 overflow-hidden rounded-md border transition-colors",
          selected
            ? "border-border-emphasis ring-1 ring-border-emphasis"
            : "border-border hover:border-border-strong",
        )}
      >
        {children}
      </button>
      <span
        className={cn(
          "h-[18px] max-w-28 truncate text-micro",
          selected ? "font-medium text-fg" : "text-fg-muted",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** The beat picked: its words, its steps, and what the step shown changes. */
function BeatDetail({
  top,
  topOf,
  story,
  beat,
  beatIndex,
  beats,
  shown,
  onShow,
  deckRoot,
  slideIndex,
}: {
  top: Diagram;
  topOf: (files: ProjectFiles, diagram: Diagram) => Diagram;
  story: Story;
  beat: Beat;
  beatIndex: number;
  beats: readonly Beat[];
  shown: number;
  onShow: (ref: StepRef) => void;
  deckRoot: string | null;
  slideIndex: number | null;
}) {
  const store = useEditorStore();
  const name = story.name;
  const step = story.steps[shown];
  const edit = store.getState().edit;
  const count = beat.steps.length;
  const [confirm, setConfirm] = useState(false);
  const files = useEditor((state) => shownFiles(state));
  const onSlide = useEditor((state) => currentSlide(state));
  const readOnly = useEditor(
    (state) => state.busy !== null || state.viewing !== null || state.assistant !== null,
  );
  // "Start a new slide here" (D-100): this beat begins the next slide; the step before it ends
  // this one.
  const splitAfter = beat.first - 1;
  const deckDiagram = deckRoot === null ? null : parseCached(files, deckRoot).diagram;
  const canSplit =
    deckDiagram !== null &&
    slideIndex !== null &&
    canSplitSlide(files, deckDiagram, slideIndex, splitAfter);
  const canJoin =
    deckDiagram !== null &&
    slideIndex !== null &&
    // Joining is offered on the beat that starts the slide: the one the split began it at.
    beat.first === (onSlide?.from?.index ?? -1) + 1 &&
    canJoinSlides(deckDiagram, slideIndex);

  const moveBeat = (by: -1 | 1) => {
    const other = beats[beatIndex + by];
    if (other === undefined) return;
    const to = by === -1 ? other.first : other.first + other.steps.length;
    const ok = edit("Move beat", (f, d) =>
      moveSteps(f, topOf(f, d), { story: name, from: beat.first, count, to }),
    );
    if (ok) {
      const first = by === -1 ? other.first : beat.first + other.steps.length;
      onShow({ story: name, index: first + (shown - beat.first) });
    }
  };

  return (
    <div className="flex min-w-0 items-start gap-2 px-1 pb-0.5" data-testid="beat-detail">
      <div className="w-64 shrink-0">
        <CommitInput
          label="Caption"
          multiline
          value={beat.say ?? ""}
          placeholder="What this beat says"
          onCommit={(say) =>
            edit("Edit caption", (f, d) =>
              updateStep(f, topOf(f, d), { story: name, index: beat.first, patch: { say } }),
            )
          }
        />
      </div>
      <div className="w-72 shrink-0">
        {/* What's said aloud over the beat: the prompter shows it, the diagram never does. */}
        <CommitInput
          label="Script"
          multiline
          value={beat.script ?? ""}
          placeholder="What you say aloud, for the prompter"
          onCommit={(script) =>
            edit("Edit script", (f, d) =>
              updateStep(f, topOf(f, d), { story: name, index: beat.first, patch: { script } }),
            )
          }
        />
        <BeatVoice script={beat.script} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <div className="flex items-center gap-1" role="group" aria-label="Steps of this beat">
          <span className="mr-0.5 text-micro text-fg-muted">Steps</span>
          {beat.steps.map((_, offset) => {
            const index = beat.first + offset;
            return (
              <button
                key={index}
                type="button"
                aria-pressed={index === shown}
                aria-label={`Step ${offset + 1} of ${count}`}
                onClick={() => onShow({ story: name, index })}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-micro font-medium tabular-nums transition-colors",
                  index === shown
                    ? "bg-fill-active text-fg-strong"
                    : "text-fg-faint hover:bg-fill-hover hover:text-fg-soft",
                )}
              >
                {offset + 1}
              </button>
            );
          })}
          <IconButton
            label="Add a step to this beat"
            size="sm"
            shape="round"
            onClick={() => {
              const index = beat.first + count;
              const ok = edit("Add step", (f, d) =>
                addStep(f, topOf(f, d), { story: name, index }),
              );
              if (ok) onShow({ story: name, index });
            }}
          >
            <Plus />
          </IconButton>
          <div className="flex-1" />
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Beat options" size="sm" shape="round">
                <MoreHorizontal />
              </IconButton>
            </MenuTrigger>
            <MenuContent side="top" align="end" className="w-56">
              <MenuItem
                icon={<Gauge />}
                checked={step?.pace === "slow"}
                onSelect={() =>
                  edit("Set pace", (f, d) =>
                    updateStep(f, topOf(f, d), {
                      story: name,
                      index: shown,
                      patch: { pace: step?.pace === "slow" ? "normal" : "slow" },
                    }),
                  )
                }
              >
                Play this step slowly
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<ArrowLeft />}
                disabled={beatIndex === 0}
                onSelect={() => moveBeat(-1)}
              >
                Move beat earlier
              </MenuItem>
              <MenuItem
                icon={<ArrowRight />}
                disabled={beatIndex === beats.length - 1}
                onSelect={() => moveBeat(1)}
              >
                Move beat later
              </MenuItem>
              <MenuSeparator />
              {deckRoot !== null && slideIndex !== null ? (
                <>
                  <MenuSeparator />
                  <MenuItem
                    icon={<Scissors />}
                    disabled={!canSplit || readOnly}
                    onSelect={() => {
                      if (!canSplit || deckRoot === null || slideIndex === null) return;
                      const ok = edit("Split slide", (files) =>
                        splitSlide(files, parseCached(files, deckRoot).diagram, {
                          item: slideIndex,
                          step: splitAfter,
                        }),
                      );
                      if (ok) store.getState().showSlide(slideIndex + 1);
                    }}
                  >
                    Start a new slide here
                  </MenuItem>
                  <MenuItem
                    icon={<ArrowLeft />}
                    disabled={!canJoin || readOnly}
                    onSelect={() => {
                      if (!canJoin || deckRoot === null || slideIndex === null) return;
                      const ok = edit("Join slides", (files) =>
                        joinSlides(files, parseCached(files, deckRoot).diagram, {
                          item: slideIndex,
                        }),
                      );
                      if (ok) store.getState().showSlide(slideIndex - 1);
                    }}
                  >
                    Join with the slide before
                  </MenuItem>
                </>
              ) : null}
              <MenuSeparator />
              {count > 1 && shown !== beat.first ? (
                <MenuItem
                  icon={<Trash2 />}
                  tone="danger"
                  onSelect={() => {
                    const ok = edit("Delete step", (f, d) =>
                      removeSteps(f, topOf(f, d), { story: name, from: shown }),
                    );
                    if (ok) onShow({ story: name, index: shown - 1 });
                  }}
                >
                  Delete this step
                </MenuItem>
              ) : null}
              <MenuItem
                icon={<Trash2 />}
                tone="danger"
                onSelect={() => {
                  // A story is its steps: without any there's nothing to keep.
                  if (beats.length === 1 && !confirm) {
                    setConfirm(true);
                    store
                      .getState()
                      .notify("That's the story's last beat. Delete it again to remove the story.");
                    return;
                  }
                  const ok = edit("Delete beat", (f, d) =>
                    removeSteps(f, topOf(f, d), { story: name, from: beat.first, count }),
                  );
                  if (ok) onShow({ story: name, index: beat.first - 1 });
                }}
              >
                Delete beat
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <ChangeList top={top} topOf={topOf} step={{ story: name, index: shown }} />
      </div>
    </div>
  );
}

/** What the step shown changes, a chip per element, each with a way to take it back. */
function ChangeList({
  top,
  topOf,
  step,
}: {
  top: Diagram;
  topOf: (files: ProjectFiles, diagram: Diagram) => Diagram;
  step: StepRef;
}) {
  const store = useEditorStore();
  const entries = top.stories.find((s) => s.name === step.story)?.steps[step.index]?.entries ?? [];
  if (entries.length === 0)
    return (
      <p className="text-micro leading-snug text-fg-muted">
        Nothing changes at this step yet. Select something on the canvas and change it: its state,
        whether it&apos;s shown, what it says.
      </p>
    );
  return (
    <ul className="flex flex-wrap gap-1" aria-label="What this step changes">
      {entries.map((entry) => {
        const said = describeChange(top, entry).join(", ");
        return (
          <li
            key={entry.target}
            className="flex h-6 max-w-full items-center gap-0.5 rounded-full bg-fill-button pl-2.5 pr-0.5 text-micro text-fg-soft"
          >
            <button
              type="button"
              className="min-w-0 truncate transition-colors hover:text-fg"
              title="Select it on the canvas"
              onClick={() => store.getState().select([entry.target])}
            >
              {said}
            </button>
            <button
              type="button"
              aria-label={`Undo: ${said}`}
              title="Take this change away"
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-fill-hover hover:text-fg"
              onClick={() =>
                store.getState().edit("Remove change", (f, d) =>
                  setSceneEntry(f, topOf(f, d), {
                    scene: step,
                    target: entry.target,
                    value: null,
                  }),
                )
              }
            >
              <X className="size-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Which story the strip shows, with a way to add and remove stories (a choice plays another). */
function StoryMenu({
  top,
  story,
  topOf,
  onShow,
}: {
  top: Diagram;
  story: Story;
  topOf: (files: ProjectFiles, diagram: Diagram) => Diagram;
  onShow: (ref: StepRef) => void;
}) {
  const store = useEditorStore();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Story: ${story.label}`}
          className="flex h-8 max-w-32 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-medium text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg"
        >
          <span className="truncate">{story.label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-fg-faint" />
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-56">
        {top.stories.map((item, index) => (
          <MenuItem
            key={item.name}
            checked={item.name === story.name}
            description={index === 0 ? "Plays when the diagram opens" : "Played by a choice"}
            onSelect={() => onShow({ story: item.name, index: -1 })}
          >
            {item.label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          icon={<Plus />}
          onSelect={() => {
            let created: string | undefined;
            const ok = store.getState().edit("Add story", (f, d) => {
              const result = addStory(f, topOf(f, d), { say: NEW_CAPTION });
              created = result.named;
              return result;
            });
            if (ok && created !== undefined) onShow({ story: created, index: 0 });
          }}
        >
          New story
        </MenuItem>
        <MenuItem
          icon={<Trash2 />}
          tone="danger"
          onSelect={() => {
            const ok = store
              .getState()
              .edit("Delete story", (f, d) => deleteStory(f, topOf(f, d), story.name));
            const first = top.stories.find((item) => item.name !== story.name);
            if (ok && first !== undefined) onShow({ story: first.name, index: -1 });
          }}
        >
          Delete this story
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
