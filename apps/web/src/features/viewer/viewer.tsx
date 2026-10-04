"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Hand, Play, Route, X } from "lucide-react";
import type { ProjectFiles } from "@mogram/core/model";
import { reachableSteps } from "@mogram/core/tours";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { deepLinkQuery, type DeepLink } from "@/features/share/deep-link";
import { CardPanel } from "./card-panel";
import { ViewerCanvas } from "./viewer-canvas";
import { LevelBack, SceneBar, ViewerActions, ViewerTitleBar, ViewerZoom } from "./viewer-chrome";
import {
  ViewerProvider,
  useViewer,
  useViewerController,
  useViewerShallow,
  useViewerStore,
} from "./viewer-context";

export interface ViewerProps {
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
}

/** The read-only, interactive diagram (SH-1, SH-2): share links, previews and present mode. */
export function Viewer(props: ViewerProps) {
  return (
    <ViewerProvider files={props.files} present={props.present}>
      <ViewerBody {...props} />
    </ViewerProvider>
  );
}

function ViewerBody({
  initialLink,
  allowViewerState,
  homeHref,
  editHref,
  preview = false,
}: ViewerProps) {
  const present = useViewer((s) => s.present);
  useDeepLinks(initialLink);
  useViewerKeys();
  usePresentFullscreen();

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-page" data-testid="viewer">
      <ViewerCanvas />
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
            <PresentStart />
            <PresentHint />
          </>
        ) : (
          <>
            <div className="pointer-events-auto absolute left-3 top-3 max-w-[calc(100%-11rem)]">
              <ViewerTitleBar homeHref={homeHref} preview={preview} />
            </div>
            <div className="pointer-events-auto absolute right-3 top-3">
              <ViewerActions editHref={editHref} preview={preview} />
            </div>
            <div className="pointer-events-auto absolute bottom-3 left-3 max-md:hidden">
              <ViewerZoom />
            </div>
            <div className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 max-sm:top-[60px]">
              <LevelBack />
            </div>
          </>
        )}
        <div className="pointer-events-auto absolute bottom-3 left-1/2 max-w-[calc(100%-1rem)] -translate-x-1/2 md:max-w-[calc(100%-22rem)]">
          <SceneBar />
        </div>
        <CardPanel allowViewerState={allowViewerState} />
      </div>
    </div>
  );
}

async function leavePresent(): Promise<void> {
  if (document.fullscreenElement !== null) await document.exitFullscreen().catch(() => undefined);
  else window.dispatchEvent(new Event("mogram:leave-present"));
}

/** Applies the deep link once the canvas knows its size, then keeps the URL in step (SH-4). */
function useDeepLinks(initial: DeepLink) {
  const store = useViewerStore();
  const controller = useViewerController();
  useEffect(() => {
    let applied = false;
    const unsubscribe = store.subscribe((state, previous) => {
      if (!applied && state.viewport !== previous.viewport) {
        applied = true;
        void controller.applyDeepLink(initial).finally(() => store.getState().setReady());
      }
      if (
        state.levelPath !== previous.levelPath ||
        state.scene !== previous.scene ||
        state.openCard !== previous.openCard ||
        state.tour !== previous.tour ||
        state.present !== previous.present
      ) {
        const params = new URLSearchParams(deepLinkQuery(controller.currentLink()).slice(1));
        if (state.present) params.set("present", "1");
        const query = params.toString().replace(/%2C/g, ",");
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${query.length > 0 ? `?${query}` : ""}`,
        );
      }
    });
    return unsubscribe;
  }, [store, controller, initial]);
}

/** Keyboard: arrows step tours (or scenes), digits pick choices, Escape backs out (TO-2, TO-8, NE-8). */
function useViewerKeys() {
  const store = useViewerStore();
  const controller = useViewerController();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      const state = store.getState();
      const forward =
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        (event.key === " " && state.present);
      const backward = event.key === "ArrowLeft" || event.key === "PageUp";
      if (forward || backward) {
        event.preventDefault();
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
        state.setPlaying(!state.playing);
        return;
      }
      if (event.key === "m" || event.key === "M") {
        state.setMotionPaused(!state.motionPaused);
        return;
      }
      if (event.key === "Escape") {
        if (state.inspected !== null) controller.inspect(null);
        else if (state.tour !== null) void controller.endTour();
        else if (state.openCard !== null) void controller.closeCard();
        else if (state.levelPath.length > 0) void controller.exitLevel();
        // Last of all, Escape leaves present mode (fullscreen handles its own Escape).
        else if (state.present) void leavePresent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, controller]);
}

/** Present mode follows the browser's fullscreen state, and re-frames when the size changes. */
function usePresentFullscreen() {
  const store = useViewerStore();
  const controller = useViewerController();
  useEffect(() => {
    const leave = () => {
      store.getState().setPresent(false);
    };
    const onChange = () => {
      if (document.fullscreenElement === null) leave();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("mogram:leave-present", leave);
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.present === previous.present && state.reservedBottom === previous.reservedBottom)
        return;
      // Chrome or an overlay appears or disappears: frame again for the space now available.
      requestAnimationFrame(() => {
        const s = store.getState();
        if (s.openCard !== null) void controller.openCard(s.openCard);
        else void controller.fit();
      });
    });
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("mogram:leave-present", leave);
      unsubscribe();
    };
  }, [store, controller]);
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
  const diagram = controller.levels.geometry("").diagram;
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
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 text-caption text-fg-muted max-md:hidden">
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
      <span>{tour !== null ? "steps" : "scenes"}</span>
      <span className="mx-1 text-fg-ghost">·</span>
      <Kbd>Esc</Kbd>
      <span>leave</span>
    </div>
  );
}
