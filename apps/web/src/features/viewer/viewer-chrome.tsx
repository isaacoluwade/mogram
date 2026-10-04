"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import type { Route as AppRoute } from "next";
import {
  ArrowLeft,
  ChevronRight,
  Maximize,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Route,
} from "lucide-react";
import { STORY_HOLD } from "@mogram/core/timeline";
import { reachableSteps } from "@mogram/core/tours";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { LogoMark } from "@/components/ui/logo";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useScrollFade } from "@/lib/use-scroll-fade";
import { zoomAt } from "@/features/canvas/camera";
import { MotionButton } from "@/features/canvas/motion-button";
import { useViewer, useViewerController, useViewerShallow, useViewerStore } from "./viewer-context";

/** Top left: the Mogram mark, the diagram's name and where you are in nested levels (NE-8). */
export function ViewerTitleBar({
  homeHref,
  preview = false,
}: {
  homeHref: string;
  preview?: boolean;
}) {
  const controller = useViewerController();
  const levelPath = useViewer((s) => s.levelPath);
  const levels = controller.levels.levels(levelPath) ?? [];
  return (
    <Panel className="flex h-11 max-w-full items-center gap-1 pl-1.5 pr-3">
      <Link
        href={homeHref as AppRoute}
        aria-label={preview ? "Back to editor" : "Mogram"}
        title={preview ? "Back to editor" : undefined}
        className="hit-area shrink-0 rounded-md p-0.5 transition-opacity hover:opacity-80"
      >
        <LogoMark size="sm" />
      </Link>
      <nav
        aria-label="Diagram levels"
        className="ml-1 flex min-w-0 items-center gap-0.5 text-label"
      >
        {levels.map((level, index) => (
          <Fragment key={level.path.join(".") || "top"}>
            {index > 0 ? (
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-ghost" />
            ) : null}
            {index === levels.length - 1 ? (
              <span aria-current="page" className="truncate px-1 font-medium text-fg">
                {level.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void controller.goToLevel(level.path)}
                className="truncate rounded-sm px-1 text-fg-faint transition-colors hover:bg-fill-hover hover:text-fg max-sm:hidden"
              >
                {level.label}
              </button>
            )}
          </Fragment>
        ))}
      </nav>
      {preview ? (
        <Badge
          tone="neutral"
          size="sm"
          className="ml-1 shrink-0"
          title="What people you share this with will see"
        >
          Preview
        </Badge>
      ) : null}
    </Panel>
  );
}

/**
 * Inside a nested diagram: the way back to the level it opened from (NE-8), always in view,
 * including in present mode where there are no breadcrumbs. Escape does the same.
 */
export function LevelBack() {
  const controller = useViewerController();
  const levelPath = useViewer((s) => s.levelPath);
  if (levelPath.length === 0) return null;
  const parent = controller.levels.levels(levelPath.slice(0, -1))?.at(-1);
  if (parent === undefined) return null;
  return (
    <Panel shape="pill" className="p-1 animate-pop-in">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Back to ${parent.label}`}
        title="Back out one level (Esc)"
        onClick={() => void controller.exitLevel()}
      >
        <ArrowLeft />
        <span className="max-w-48 truncate">Back to {parent.label}</span>
        <Kbd className="ml-0.5 max-md:hidden">Esc</Kbd>
      </Button>
    </Panel>
  );
}

/** Top right: tours (TO-10), present (TO-8) and, for the owner, back to editing. */
export function ViewerActions({
  editHref,
  preview = false,
}: {
  editHref: string | null;
  preview?: boolean;
}) {
  const controller = useViewerController();
  const tours = controller.topTours;
  const tour = useViewer((s) => s.tour);
  return (
    <Panel className="flex h-11 items-center gap-1 px-1.5">
      {tours.length > 0 ? (
        <Menu>
          <MenuTrigger asChild>
            <Button variant={tour === null ? "ghost" : "secondary"} size="sm" aria-label="Tours">
              <Route />
              <span className="max-sm:hidden">Tours</span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end" className="w-72">
            <MenuLabel>Take a tour</MenuLabel>
            {tours.map((item) => (
              <MenuItem
                key={item.name}
                icon={<Route />}
                description={`${reachableSteps(item).length} steps`}
                onSelect={() => void controller.startTour(item.name)}
              >
                {item.title}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
      <IconButton
        label="Present"
        tooltipSide="bottom"
        onClick={() => void enterPresent(controller.store)}
      >
        <Maximize />
      </IconButton>
      {editHref !== null ? (
        <>
          <ToolbarDivider />
          <Button variant="primary" size="sm" asChild>
            <Link href={editHref as AppRoute} aria-label={preview ? "Back to editor" : "Edit"}>
              <Pencil />
              <span className="max-sm:hidden">{preview ? "Back to editor" : "Edit"}</span>
            </Link>
          </Button>
        </>
      ) : null}
    </Panel>
  );
}

export async function enterPresent(store: ReturnType<typeof useViewerStore>): Promise<void> {
  store.getState().setPresent(true);
  try {
    if (document.fullscreenElement === null)
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Fullscreen can be refused (iframes, iOS Safari); present mode still hides the chrome.
  }
}

/** Scenes as chips with play/pause (SC-6 … SC-9), plus resetting "what if" changes (SH-3). */
export function SceneBar() {
  const controller = useViewerController();
  const store = useViewerStore();
  const { scene, playing, changed } = useViewerShallow((s) => ({
    scene: s.scene,
    playing: s.playing,
    changed: s.viewerEntries.length > 0,
  }));
  const scenes = controller.levels.geometry("").diagram.scenes;
  const strip = useScrollFade<HTMLDivElement>();

  // Playing steps through Normal and every scene, holding each for STORY_HOLD seconds.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => controller.stepScene(1), STORY_HOLD * 1000);
    return () => window.clearInterval(timer);
  }, [playing, controller]);

  if (scenes.length === 0 && !changed) return null;
  return (
    <Panel
      shape="pill"
      className="flex max-w-full items-center gap-1 p-1"
      role="group"
      aria-label="Scenes"
    >
      {scenes.length > 0 ? (
        <>
          <IconButton
            label={playing ? "Pause scenes" : "Play scenes"}
            shortcut="P"
            shape="round"
            active={playing}
            onClick={() => {
              if (!playing && store.getState().tour !== null) void controller.endTour();
              store.getState().setPlaying(!playing);
            }}
          >
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <div
            ref={strip}
            className="scroll-fade scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {[
              { name: null, label: "Normal" },
              ...scenes.map((s) => ({ name: s.name, label: s.label })),
            ].map((item) => (
              <button
                key={item.name ?? "normal"}
                type="button"
                aria-pressed={scene === item.name}
                onClick={() => {
                  store.getState().setPlaying(false);
                  controller.setScene(item.name);
                }}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-caption font-medium transition-colors",
                  scene === item.name
                    ? "bg-fill-active text-fg-strong"
                    : "text-fg-faint hover:bg-fill-hover hover:text-fg-soft",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {changed ? (
        <>
          {scenes.length > 0 ? <ToolbarDivider /> : null}
          <Button variant="ghost" size="sm" onClick={() => store.getState().resetViewerState()}>
            <RotateCcw />
            Reset
          </Button>
        </>
      ) : null}
    </Panel>
  );
}

export function ViewerZoom() {
  const store = useViewerStore();
  const controller = useViewerController();
  const zoom = useViewer((s) => s.camera.zoom);
  const motionPaused = useViewer((s) => s.motionPaused);
  const by = (factor: number) => {
    const { camera, viewport } = store.getState();
    controller.animator.cancel();
    store
      .getState()
      .setCamera(
        zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, camera.zoom * factor),
      );
  };
  return (
    <Panel shape="pill" className="flex items-center gap-0.5 p-1" role="group" aria-label="Zoom">
      <IconButton label="Zoom out" size="sm" shape="round" onClick={() => by(1 / 1.25)}>
        <Minus />
      </IconButton>
      <button
        type="button"
        onClick={() => void controller.fit()}
        className="h-7 min-w-12 rounded-full px-1.5 text-caption font-medium tabular-nums text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg"
        aria-label="Fit diagram"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton label="Zoom in" size="sm" shape="round" onClick={() => by(1.25)}>
        <Plus />
      </IconButton>
      <MotionButton
        paused={motionPaused}
        onToggle={() => store.getState().setMotionPaused(!motionPaused)}
      />
    </Panel>
  );
}
