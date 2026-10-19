"use client";

import { useEffect, useMemo } from "react";
import type { LayoutOverrides } from "@mogram/core/layout";
import type { Diagram, ProjectFiles, SceneEntry } from "@mogram/core/model";
import type { ResolvedState } from "@mogram/core/state";
import { computeLayout, descendantsOf } from "@mogram/core/layout";
import { buildScene, type SceneModel } from "@/features/canvas/scene";
import { resolveTheme } from "@/features/canvas/theme";
import { resolveAlong, resolveFor, useLayout, useRoutes } from "@/features/canvas/use-diagram";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "./editor-context";
import { useCapacity } from "@/features/canvas/capacity";
import { useFontsVersion } from "@/features/canvas/text";
import type { Moment } from "@mogram/core/picture";
import {
  currentSlide,
  levelsAlong,
  momentOf,
  parseCached,
  parseEditor,
  shownFiles,
  slideShown,
  storyCursor,
  topDiagram,
} from "./store/editor-store";

/** How long after a change of picture ends its "from" side is kept, in ms. */
const SETTLE_MARGIN = 100;

/**
 * Everything the editor canvas draws: parse → layout (with gesture previews) → routes →
 * resolved state for the active scene (and the one it is animating from) → scene model.
 */
export function useEditorScene() {
  const state = useEditorShallow((s) => ({
    files: shownFiles(s),
    folder: s.folder,
    deckRoot: s.deckRoot,
    slide: s.slide,
    drag: s.drag,
    resize: s.resize,
    pathEdit: s.pathEdit,
    scene: s.scene,
    story: s.story,
    previous: s.previous,
    transitionStart: s.transitionStart,
    transitionSeconds: s.transitionSeconds,
    viewerEntries: s.viewerEntries,
    levelPath: s.levelPath,
    root: s.root,
  }));
  const store = useEditorStore();
  const clock = useEditorClock();
  const parsed = parseEditor(state.files, state.folder, state.deckRoot);
  const diagram = parsed.diagram;
  // On a slide (D-100), the canvas fills in the deck's built-in values; edits never see them.
  const slide = useMemo(
    () =>
      state.levelPath.length > 0
        ? null
        : currentSlide({ files: state.files, deckRoot: state.deckRoot, slide: state.slide }),
    [state.files, state.deckRoot, state.slide, state.levelPath.length],
  );
  const shown = useMemo(
    () => slideShown(state.files, diagram, state.deckRoot, slide),
    [state.files, diagram, state.deckRoot, slide],
  );

  const overrides = useMemo<LayoutOverrides>(() => {
    if (state.drag !== null) {
      return {
        translate: { names: new Set(state.drag.names), dx: state.drag.dx, dy: state.drag.dy },
      };
    }
    if (state.resize !== null) {
      return {
        sizes: new Map([[state.resize.name, state.resize.size]]),
        positions: new Map([[state.resize.name, state.resize.at]]),
      };
    }
    return {};
  }, [state.drag, state.resize]);
  const layout = useLayout(diagram, overrides);
  // Where things were before the gesture: bends follow their ends from there (ED-29).
  const moving = state.drag !== null || state.resize !== null;
  const settled = useMemo(() => (moving ? computeLayout(diagram) : null), [diagram, moving]);

  // While dragging, connections touching the moving elements use quick elbows; the full
  // obstacle-avoiding route is computed once on drop.
  const quick = useMemo(() => {
    if (state.drag === null) return undefined;
    const moving = new Set<string>();
    for (const name of state.drag.names) {
      moving.add(name);
      for (const child of descendantsOf(layout, name)) moving.add(child);
    }
    const names = new Set<string>();
    for (const connection of diagram.connections.values()) {
      if (moving.has(connection.from.element) || moving.has(connection.to.element))
        names.add(connection.name);
    }
    return names;
  }, [state.drag, diagram, layout]);
  const via = useMemo(
    () =>
      state.pathEdit?.via === undefined
        ? undefined
        : new Map([[state.pathEdit.connection, state.pathEdit.via]]),
    [state.pathEdit],
  );
  const labelPlaces = useMemo(
    () =>
      state.pathEdit?.label === undefined
        ? undefined
        : new Map([[state.pathEdit.connection, state.pathEdit.label]]),
    [state.pathEdit],
  );
  const routes = useRoutes(diagram, layout, {
    ...(quick ? { quick } : {}),
    ...(via ? { via } : {}),
    ...(settled !== null ? { follow: settled } : {}),
  });

  // Inside a nested diagram, the top diagram's scene and story reach this level as they do in
  // the viewer.
  const moment = useEditorMoment();
  const current = useMemo(
    () =>
      resolveLevelShared(
        state.files,
        state.levelPath,
        state.folder,
        diagram,
        moment,
        state.viewerEntries,
        state.root,
      ),
    [state.files, state.levelPath, state.folder, state.root, diagram, moment, state.viewerEntries],
  );
  const previous = useMemo(
    () =>
      state.transitionStart === null || state.previous === null
        ? null
        : resolveLevel(
            state.files,
            state.levelPath,
            state.folder,
            diagram,
            state.previous,
            [],
            state.root,
          ),
    [
      state.files,
      state.levelPath,
      state.folder,
      state.root,
      diagram,
      state.previous,
      state.transitionStart,
    ],
  );
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  // The deck's frame (D-99), drawn under a slide that has it, dressed for this slide.
  const frameDiagram = useMemo(() => {
    if (slide === null || !slide.frame || state.deckRoot === null) return null;
    const frame = parseCached(state.files, state.deckRoot).diagram.settings.deck?.frame;
    if (frame == null) return null;
    return slideShown(state.files, parseCached(state.files, frame).diagram, state.deckRoot, slide);
  }, [state.files, state.deckRoot, slide]);
  const frameLayout = useLayout(frameDiagram ?? diagram);
  const frameRoutes = useRoutes(frameDiagram ?? diagram, frameLayout);
  // What a layout places follows the pointer while it's dragged (D-87).
  const dragged = useMemo(
    () =>
      state.drag === null
        ? undefined
        : { names: new Set(state.drag.names), dx: state.drag.dx, dy: state.drag.dy },
    [state.drag],
  );
  // Text measured before the fonts loaded is measured again once they have.
  const fonts = useFontsVersion();
  const scene: SceneModel = useMemo(
    () =>
      buildScene({
        diagram: shown,
        files: state.files,
        layout,
        routes,
        current,
        previous,
        transitionStart: state.transitionStart,
        transitionSeconds: state.transitionSeconds,
        // What's hidden is drawn faintly, so it can still be selected and edited.
        ghosts: true,
        ...(dragged !== undefined ? { dragged } : {}),
        theme,
        fontFamily: "Inter",
        fontsVersion: fonts,
        ...(labelPlaces !== undefined ? { labelPlaces } : {}),
      }),
    [
      shown,
      state.files,
      layout,
      routes,
      current,
      previous,
      state.transitionStart,
      state.transitionSeconds,
      theme,
      fonts,
      labelPlaces,
      dragged,
    ],
  );
  const frameScene = useMemo(() => {
    if (frameDiagram === null) return null;
    return buildScene({
      diagram: frameDiagram,
      files: state.files,
      layout: frameLayout,
      routes: frameRoutes,
      current: resolveFor(state.files, frameDiagram.folder, frameDiagram, null),
      theme: resolveTheme(frameDiagram.settings),
      fontFamily: "Inter",
      fontsVersion: fonts,
    });
  }, [frameDiagram, state.files, frameLayout, frameRoutes, fonts]);

  // Once a scene change has finished animating, drop the "from" state so nothing keeps ticking.
  useEffect(() => {
    if (state.transitionStart === null) return;
    const settle = state.transitionSeconds * 1000 + SETTLE_MARGIN;
    const remaining = Math.max(0, settle - (clock.time() - state.transitionStart) * 1000);
    const timer = window.setTimeout(() => store.getState().settleTransition(), remaining);
    return () => window.clearTimeout(timer);
  }, [state.transitionStart, state.transitionSeconds, clock, store]);

  // Capacity over time (D-82, D-84): copies boot and drain as the scene or a traffic pattern changes.
  const motionPaused = useEditor((s) => s.motionPaused);
  const capacity = useCapacity(diagram, current, () => clock.time(), motionPaused);
  // What a layout places is where this moment's picture has it (D-87): selection, handles and
  // hit-testing use that layout.
  return {
    parsed,
    diagram,
    layout: scene.layout,
    routes,
    scene,
    frameScene,
    theme,
    current,
    capacity,
  };
}

let shared: { readonly key: readonly unknown[]; readonly value: ResolvedState } | null = null;

/**
 * `resolveLevel`, remembered for the same inputs: the canvas and the inspector (which explains
 * what the scene does to the selection) share one resolution.
 */
function resolveLevelShared(...args: Parameters<typeof resolveLevel>): ResolvedState {
  const last = shared;
  if (last !== null && last.key.length === args.length && args.every((v, i) => v === last.key[i]))
    return last.value;
  const value = resolveLevel(...args);
  shared = { key: args, value };
  return value;
}

/** Where the editor is (its scene, and the step of the story shown), the same object until it changes. */
export function useEditorMoment(): Moment {
  const state = useEditorShallow((s) => ({
    files: shownFiles(s),
    root: s.root,
    scene: s.scene,
    story: s.story,
  }));
  return momentOf(state.scene, storyCursor(topDiagram(state.files, state.root), state.story));
}

/** The state of the level being edited at the current moment, as the canvas shows it. */
export function useResolvedLevel(): ResolvedState {
  const state = useEditorShallow((s) => ({
    files: shownFiles(s),
    root: s.root,
    folder: s.folder,
    deckRoot: s.deckRoot,
    slide: s.slide,
    viewerEntries: s.viewerEntries,
    levelPath: s.levelPath,
  }));
  const moment = useEditorMoment();
  const diagram = parseEditor(state.files, state.folder, state.deckRoot).diagram;
  return useMemo(
    () =>
      resolveLevelShared(
        state.files,
        state.levelPath,
        state.folder,
        diagram,
        moment,
        state.viewerEntries,
        state.root,
      ),
    [state, diagram, moment],
  );
}

/** State at the level being edited: the top diagram's scene and story flow down through each instance. */
export function resolveLevel(
  files: ProjectFiles,
  levelPath: readonly string[],
  folder: string,
  diagram: Diagram,
  at: Moment | string | null,
  viewer: readonly SceneEntry[],
  root: string,
): ResolvedState {
  if (levelPath.length === 0) return resolveFor(files, folder, diagram, at, viewer, null);
  const levels = levelsAlong(files, levelPath, root);
  return (
    resolveAlong(files, levels, at, viewer, (path) =>
      path === folder ? diagram : parseCached(files, path).diagram,
    ) ?? resolveFor(files, folder, diagram, null, [], null)
  );
}
