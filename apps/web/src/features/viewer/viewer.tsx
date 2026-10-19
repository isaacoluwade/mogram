"use client";

import { diagramFileSet } from "@mogram/core/format";
import { DeckBar } from "@/features/deck/deck-bar";
import type { ViewerDeck } from "@/features/deck/viewer-deck";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Hand, Play, Route, X } from "lucide-react";
import type { ProjectFiles } from "@mogram/core/model";
import { reachableSteps } from "@mogram/core/tours";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { deepLinkQuery, type DeepLink } from "@/features/share/deep-link";
import { CardPanel } from "./card-panel";
import { ViewerCanvas } from "./viewer-canvas";
import { LevelBack, SceneBar, ViewerActions, ViewerTitleBar, ViewerZoom } from "./viewer-chrome";
import { ControlsBar } from "./controls-bar";
import { StoryBar } from "./story-bar";
import type { PrompterLink, PrompterMessage } from "@/features/prompter/channel";
import {
  ViewerProvider,
  useViewer,
  useViewerController,
  useViewerShallow,
  useViewerStore,
} from "./viewer-context";

export interface ViewerProps {
  readonly assetBase?: string;
  readonly files: ProjectFiles;
  readonly initialLink: DeepLink;
  readonly present: boolean;
  /** Share setting (SH-3): may viewers try "what if" states? Owners always can. */
  readonly allowViewerState: boolean;
  /** Where the Mogram mark goes: the landing page on share links, the editor for owners. */
  readonly homeHref: string;
  readonly editHref: string | null;
  /** The owner previewing from the editor: says so, and offers the way back to editing. */
  readonly preview?: boolean;
  /**
   * This diagram's prompter (D-96), when it has one: the viewer offers to open it, and shows
   * the beat being read there.
   */
  readonly prompter?: PrompterLink;
  /** The deck this diagram is a slide of (D-99): it plays its stretch and hands over. */
  readonly deck?: ViewerDeck;
  /**
   * Starts in Record mode: the picture and nothing else, for capturing a deck as it plays. No
   * bars, no buttons, no pointer.
   */
  readonly record?: boolean;
  /**
   * A slide on its way out of a deck (D-99): its picture, fading, and nothing else. It takes no
   * keys and doesn't touch the address.
   */
  readonly passive?: boolean;
  /** Told when presenting or recording starts or stops, so a deck's next slide starts the same. */
  readonly onModeChange?: (mode: { readonly present: boolean; readonly record: boolean }) => void;
}

/** The read-only, interactive diagram (SH-1, SH-2): share links, previews and present mode. */
export function Viewer(props: ViewerProps) {
  const root = rootOf(props);
  return (
    <ViewerProvider
      files={props.files}
      present={props.present}
      record={props.record === true}
      root={root}
      deck={props.deck ?? null}
    >
      <ViewerBody
        {...props}
        // The owner's way back to the editor returns to the folder being previewed. (A deck says
        // which slide itself.)
        {...(props.preview === true && root !== "" && props.deck === undefined
          ? {
              homeHref: `${props.homeHref}?root=${root}`,
              editHref: props.editHref === null ? null : `${props.editHref}?root=${root}`,
            }
          : {})}
      />
    </ViewerProvider>
  );
}

/** The folder a link asks to see by itself, when the project has a diagram there (D-97). */
function rootOf({ files, initialLink }: ViewerProps): string {
  const root = initialLink.root ?? "";
  return root !== "" && diagramFileSet(files, root) !== null ? root : "";
}

function ViewerBody({
  initialLink,
  allowViewerState,
  homeHref,
  editHref,
  preview = false,
  prompter,
  deck,
  passive = false,
  onModeChange,
}: ViewerProps) {
  const { present, record } = useViewerShallow((s) => ({ present: s.present, record: s.record }));
  const controller = useViewerController();
  usePrompter(passive ? undefined : prompter?.channel, deck !== undefined);
  useDeepLinks(initialLink, passive);
  useViewerKeys(deck ?? null, passive);
  usePresentFullscreen(passive);
  // The deck moved on to a slide that carries straight on: same viewer, new stretch.
  useEffect(() => {
    if (deck !== undefined && !passive) controller.carryOn(deck);
  }, [controller, deck, passive]);
  useEffect(() => {
    onModeChange?.({ present, record });
  }, [onModeChange, present, record]);
  // Cut away from: it stays as it is while it fades, and moves the deck no further.
  useEffect(() => {
    if (passive) controller.leave();
  }, [controller, passive]);

  // The picture and nothing else: a slide on its way out, or Record mode. Nothing in it can be
  // clicked, tabbed to or pointed at. (The canvas stays where it is, so it isn't drawn again.)
  const bare = passive || record;
  return (
    <div
      className={cn("relative h-dvh w-full overflow-hidden bg-page", bare && "cursor-none")}
      data-testid={passive ? "viewer-leaving" : "viewer"}
      data-record={record ? "true" : undefined}
      inert={bare}
    >
      <ViewerCanvas />
      {bare ? null : (
        <div className="pointer-events-none absolute inset-0 z-10">
          {present ? (
            <>
              <div className="pointer-events-auto absolute right-4 top-4">
                <Panel shape="pill" className="p-1">
                  <IconButton
                    label="Leave present mode"
                    shape="round"
                    tooltipSide="left"
                    onClick={() => void leavePresent()}
                  >
                    <X />
                  </IconButton>
                </Panel>
              </div>
              <div className="pointer-events-auto absolute left-4 top-4">
                <LevelBack />
              </div>
              {/* A deck starts by itself: no "what would you like to see" card. */}
              {deck === undefined ? <PresentStart /> : null}
              <PresentHint />
            </>
          ) : (
            <>
              <div className="pointer-events-auto absolute left-3 top-3 max-w-[calc(100%-11rem)]">
                <ViewerTitleBar homeHref={homeHref} preview={preview} />
              </div>
              <div className="pointer-events-auto absolute right-3 top-3">
                <ViewerActions
                  editHref={editHref}
                  preview={preview}
                  deck={deck !== undefined}
                  {...(prompter === undefined ? {} : { prompterHref: prompter.href })}
                />
              </div>
              <div className="pointer-events-auto absolute bottom-3 left-3 max-md:hidden">
                <ViewerZoom />
              </div>
              <div className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 max-sm:top-[60px]">
                <LevelBack />
              </div>
            </>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-2 md:max-w-[calc(100%-22rem)] [&>*]:pointer-events-auto">
            {deck === undefined ? <SceneBar /> : null}
            <ControlsBar />
            {deck === undefined ? <StoryBar /> : <DeckBar deck={deck} />}
          </div>
          <CardPanel allowViewerState={allowViewerState} />
        </div>
      )}
    </div>
  );
}

/** Shows the beat being read in this diagram's Script window, as it's read (D-96, D-105). */
function usePrompter(name: string | undefined, inDeck: boolean) {
  const controller = useViewerController();
  useEffect(() => {
    if (name === undefined || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(name);
    channel.onmessage = (event: MessageEvent<PrompterMessage>) => {
      const message = event.data;
      if (message.kind === "deck") {
        if (inDeck) controller.followScript(message.slide, message.beats);
        return;
      }
      if (message.kind !== "beat" || inDeck) return;
      const beats = message.beats;
      const played = controller.storyBeat;
      if (beats === played) return;
      // The next beat plays as it would by hand, step by step; anything else is a jump.
      if (beats === played + 1) controller.nextBeat();
      else controller.openStory(undefined, beats);
    };
    return () => channel.close();
  }, [name, controller, inDeck]);
}

async function leavePresent(): Promise<void> {
  if (document.fullscreenElement !== null) await document.exitFullscreen().catch(() => undefined);
  else window.dispatchEvent(new Event("mogram:leave-present"));
}

/** Out of Record mode, back to the viewer with its bars (and out of fullscreen). */
function leaveRecord(store: ReturnType<typeof useViewerStore>): void {
  store.getState().setPresent(false);
  if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => undefined);
}

/** Applies the deep link once the canvas knows its size, then keeps the URL in step (SH-4). */
function useDeepLinks(initial: DeepLink, passive: boolean) {
  const store = useViewerStore();
  const controller = useViewerController();
  useEffect(() => {
    // A slide on its way out has had its link applied, and the address is the next one's now.
    if (passive) return;
    let applied = false;
    const unsubscribe = store.subscribe((state, previous) => {
      if (!applied && state.viewport !== previous.viewport) {
        applied = true;
        void controller.applyDeepLink(initial).finally(() => store.getState().setReady());
      }
      if (
        state.slide !== previous.slide ||
        state.levelPath !== previous.levelPath ||
        state.scene !== previous.scene ||
        state.story !== previous.story ||
        state.openCard !== previous.openCard ||
        state.tour !== previous.tour ||
        state.present !== previous.present ||
        state.record !== previous.record
      ) {
        const params = new URLSearchParams(deepLinkQuery(controller.currentLink()).slice(1));
        // Recording presents too, and says so in its own way.
        if (state.record) params.set("record", "1");
        else if (state.present) params.set("present", "1");
        const query = params.toString().replace(/%2C/g, ",").replace(/%2F/g, "/");
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${query.length > 0 ? `?${query}` : ""}`,
        );
      }
    });
    return unsubscribe;
  }, [store, controller, initial, passive]);
}

/** Keyboard: arrows step tours (or scenes), digits pick choices, Escape backs out (TO-2, TO-8, NE-8). */
function useViewerKeys(deck: ViewerDeck | null, passive: boolean) {
  const store = useViewerStore();
  const controller = useViewerController();
  // The deck's object is new each time the slide changes; the keys read the one that's current.
  const current = useRef(deck);
  useEffect(() => {
    current.current = deck;
  }, [deck]);
  useEffect(() => {
    if (passive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
          // A dialog over the viewer (the deck's overview) keeps its keys to itself.
          event.target.closest('[role="dialog"]') !== null)
      )
        return;
      const state = store.getState();
      const forward =
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        (event.key === " " && state.present);
      const backward = event.key === "ArrowLeft" || event.key === "PageUp";
      // Space plays or pauses the story (outside present mode, where it steps).
      if (event.key === " " && state.story !== null && state.tour === null && !state.present) {
        if (event.target instanceof HTMLElement && event.target.closest("button, a") !== null)
          return;
        event.preventDefault();
        controller.setStoryPlaying(!state.storyPlaying);
        return;
      }
      if (forward || backward) {
        event.preventDefault();
        const slides = current.current;
        // In a deck, a slide's beats play and then the slide changes, a still slide at once.
        if (slides !== null && state.tour === null) {
          // A held key steps once: a presenter's slip shouldn't race through the deck.
          // With Shift held the deck moves a whole slide (its own keys, in the player).
          if (!event.shiftKey && !event.repeat) controller.stepDeck(forward ? 1 : -1);
          return;
        }
        if (state.tour === null && state.story !== null) {
          state.setStoryPlaying(false);
          if (forward) controller.nextBeat();
          else controller.previousBeat();
          return;
        }
        if (state.tour !== null) {
          const choices = controller.tour()?.steps.get(state.tour.step)?.choices ?? [];
          if (backward) void controller.previousStep();
          else if (choices.length === 0) void controller.nextStep(0);
        } else controller.stepScene(forward ? 1 : -1);
        return;
      }
      if (/^[1-9]$/.test(event.key) && state.tour !== null) {
        const index = Number(event.key) - 1;
        const choices = controller.tour()?.steps.get(state.tour.step)?.choices ?? [];
        if (index < choices.length) {
          event.preventDefault();
          void controller.nextStep(index);
        }
        return;
      }
      if (event.key === "p" || event.key === "P") {
        // In a deck, P plays the deck by itself (or stops it).
        if (current.current !== null) controller.setStoryPlaying(!state.storyPlaying);
        else state.setPlaying(!state.playing);
        return;
      }
      if (event.key === "m" || event.key === "M") {
        state.setMotionPaused(!state.motionPaused);
        return;
      }
      if (event.key === "Escape") {
        // Record mode has nothing to click: Esc is the way out.
        if (state.record) leaveRecord(store);
        else if (state.inspected !== null) controller.inspect(null);
        else if (state.tour !== null) void controller.endTour();
        else if (state.openCard !== null) void controller.closeCard();
        else if (state.levelPath.length > 0) void controller.exitLevel();
        // Last of all, Escape leaves present mode (fullscreen handles its own Escape).
        else if (state.present) void leavePresent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, controller, passive]);
}

/** Present mode follows the browser's fullscreen state, and re-frames when the size changes. */
function usePresentFullscreen(passive: boolean) {
  const store = useViewerStore();
  const controller = useViewerController();
  useEffect(() => {
    if (passive) return;
    const leave = () => {
      store.getState().setPresent(false);
    };
    const onChange = () => {
      // Recording carries on in the window: a capture can be of the window, not the screen.
      if (document.fullscreenElement === null && !store.getState().record) leave();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("mogram:leave-present", leave);
    const unsubscribe = store.subscribe((state, previous) => {
      const resized = state.viewport !== previous.viewport && previous.viewport.width > 0;
      if (
        state.present === previous.present &&
        state.record === previous.record &&
        state.reservedBottom === previous.reservedBottom &&
        !resized
      )
        return;
      // Chrome or an overlay appears or disappears: frame again for the space now available.
      requestAnimationFrame(() => {
        void controller.reframe();
      });
    });
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("mogram:leave-present", leave);
      unsubscribe();
    };
  }, [store, controller, passive]);
}

/** Present mode with nothing running yet: pick a tour, play the scenes, or just explore (TO-8). */
function PresentStart() {
  const controller = useViewerController();
  const store = useViewerStore();
  const { tour, playing, openCard } = useViewerShallow((s) => ({
    tour: s.tour,
    playing: s.playing,
    openCard: s.openCard,
  }));
  const [dismissed, setDismissed] = useState(false);
  const diagram = controller.levels.top.diagram;
  const tours = controller.topTours;
  if (tour !== null || playing || openCard !== null || dismissed) return null;
  if (tours.length === 0 && diagram.scenes.length === 0) return null;
  return (
    <PresentStartCard>
      <Panel className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-caption text-fg-muted">Presenting</p>
          <h2 className="font-display text-heading font-medium tracking-snug text-fg">
            {diagram.settings.name}
          </h2>
        </div>
        <div className="flex flex-col gap-1.5">
          {tours.map((item) => (
            <Button
              key={item.name}
              variant="secondary"
              className="justify-start"
              onClick={() => void controller.startTour(item.name)}
            >
              <Route />
              <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
              <span className="text-micro text-fg-muted">{reachableSteps(item).length} steps</span>
            </Button>
          ))}
          {diagram.scenes.length > 0 ? (
            <Button
              variant="secondary"
              className="justify-start"
              onClick={() => store.getState().setPlaying(true)}
            >
              <Play />
              Play the scenes
            </Button>
          ) : null}
          <Button variant="ghost" className="justify-start" onClick={() => setDismissed(true)}>
            <Hand />
            Just explore
          </Button>
        </div>
      </Panel>
    </PresentStartCard>
  );
}

/** The start card's frame. While it shows, the diagram is framed above it, not under it. */
function PresentStartCard({ children }: { children: ReactNode }) {
  const store = useViewerStore();
  const card = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const node = card.current;
    if (node === null) return;
    const reserve = () => {
      const top = node.getBoundingClientRect().top;
      store.getState().setReservedBottom(Math.max(0, Math.round(window.innerHeight - top + 16)));
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(node);
    return () => {
      observer.disconnect();
      store.getState().setReservedBottom(0);
    };
  }, [store]);
  return (
    <div
      ref={card}
      className="pointer-events-auto absolute bottom-24 left-1/2 w-[min(440px,calc(100%-2rem))] -translate-x-1/2 animate-pop-in"
    >
      {children}
    </div>
  );
}

function PresentHint() {
  const tour = useViewer((s) => s.tour);
  const story = useViewer((s) => s.story !== null);
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 text-caption text-fg-muted max-md:hidden">
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
      <span>{tour !== null ? "steps" : story ? "story" : "scenes"}</span>
      <span className="mx-1 text-fg-ghost">·</span>
      <Kbd>Esc</Kbd>
      <span>leave</span>
    </div>
  );
}
