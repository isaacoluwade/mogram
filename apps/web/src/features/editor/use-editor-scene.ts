"use client";

import { useEffect, useMemo } from "react";
import type { LayoutOverrides } from "@mogram/core/layout";
import type { Diagram, ProjectFiles, SceneEntry } from "@mogram/core/model";
import type { ResolvedState } from "@mogram/core/state";
import { descendantsOf } from "@mogram/core/layout";
import { buildScene, type SceneModel } from "@/features/canvas/scene";
import { resolveTheme } from "@/features/canvas/theme";
import { resolveAlong, resolveFor, useLayout, useRoutes } from "@/features/canvas/use-diagram";
import { useEditorClock, useEditorShallow, useEditorStore } from "./editor-context";
import { useFontsVersion } from "@/features/canvas/text";
import { levelsAlong, parseCached } from "./store/editor-store";

const SETTLE_MS = 700;

/**
 * Everything the editor canvas draws: parse → layout (with gesture previews) → routes →
 * resolved state for the active scene (and the one it is animating from) → scene model.
 */
export function useEditorScene() {
  const state = useEditorShallow((s) => ({
    files: s.files,
    folder: s.folder,
    drag: s.drag,
    resize: s.resize,
    bend: s.bend,
    scene: s.scene,
    previousScene: s.previousScene,
    transitionStart: s.transitionStart,
    viewerEntries: s.viewerEntries,
    levelPath: s.levelPath,
  }));
  const store = useEditorStore();
  const clock = useEditorClock();
  const parsed = parseCached(state.files, state.folder);
  const diagram = parsed.diagram;

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
    () => (state.bend === null ? undefined : new Map([[state.bend.connection, state.bend.via]])),
    [state.bend],
  );
  const routes = useRoutes(diagram, layout, {
    ...(quick ? { quick } : {}),
    ...(via ? { via } : {}),
  });

  // Inside a nested diagram, the top diagram's scene reaches this level as it does in the viewer.
  const current = useMemo(
    () =>
      resolveLevel(
        state.files,
        state.levelPath,
        state.folder,
        diagram,
        state.scene,
        state.viewerEntries,
      ),
    [state.files, state.levelPath, state.folder, diagram, state.scene, state.viewerEntries],
  );
  const previous = useMemo(
    () =>
      state.transitionStart === null
        ? null
        : resolveLevel(
            state.files,
            state.levelPath,
            state.folder,
            diagram,
            state.previousScene,
            [],
          ),
    [
      state.files,
      state.levelPath,
      state.folder,
      diagram,
      state.previousScene,
      state.transitionStart,
    ],
  );
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  // Text measured before the fonts loaded is measured again once they have.
  const fonts = useFontsVersion();
  const scene: SceneModel = useMemo(
    () =>
      buildScene({
        diagram,
        files: state.files,
        layout,
        routes,
        current,
        previous,
        transitionStart: state.transitionStart,
        theme,
        fontFamily: "Inter",
        fontsVersion: fonts,
      }),
    [diagram, state.files, layout, routes, current, previous, state.transitionStart, theme, fonts],
  );

  // Once a scene change has finished animating, drop the "from" state so nothing keeps ticking.
  useEffect(() => {
    if (state.transitionStart === null) return;
    const remaining = Math.max(0, SETTLE_MS - (clock.time() - state.transitionStart) * 1000);
    const timer = window.setTimeout(() => store.getState().settleTransition(), remaining);
    return () => window.clearTimeout(timer);
  }, [state.transitionStart, clock, store]);

  return { parsed, diagram, layout, routes, scene, theme, current };
}

/** State at the level being edited: the top diagram's scene flows down through each instance. */
export function resolveLevel(
  files: ProjectFiles,
  levelPath: readonly string[],
  folder: string,
  diagram: Diagram,
  scene: string | null,
  viewer: readonly SceneEntry[],
): ResolvedState {
  if (levelPath.length === 0) return resolveFor(files, folder, diagram, scene, viewer);
  const levels = levelsAlong(files, levelPath);
  return (
    resolveAlong(files, levels, scene, viewer, (path) =>
      path === folder ? diagram : parseCached(files, path).diagram,
    ) ?? resolveFor(files, folder, diagram, null)
  );
}
