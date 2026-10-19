"use client";

import { useMemo, useState } from "react";
import { parseDiagram, type ParseResult } from "@mogram/core/format";
import { computeLayout, type LayoutOverrides, type LayoutResult } from "@mogram/core/layout";
import type { Diagram, ProjectFiles, SceneEntry } from "@mogram/core/model";
import { DiagramLoader, resolveInstance, type Level } from "@mogram/core/nested";
import {
  RouteCache,
  routeConnections,
  type RouteOptions,
  type RoutedPath,
} from "@mogram/core/routing";
import { sceneMoment, type Moment } from "@mogram/core/picture";
import type { ResolvedState } from "@mogram/core/state";

/** Parsed diagram for a folder of the project, recomputed only when the files change. */
export function useParsedDiagram(files: ProjectFiles, folder: string): ParseResult {
  return useMemo(() => parseDiagram(files, folder), [files, folder]);
}

export function useLayout(diagram: Diagram, overrides?: LayoutOverrides): LayoutResult {
  return useMemo(() => computeLayout(diagram, overrides), [diagram, overrides]);
}

/** Routes with a cache that survives renders, so unchanged connections aren't re-routed. */
export function useRoutes(
  diagram: Diagram,
  layout: LayoutResult,
  options?: Omit<RouteOptions, "cache">,
): ReadonlyMap<string, RoutedPath> {
  const [cache] = useState(() => new RouteCache());
  const quick = options?.quick;
  const via = options?.via;
  const follow = options?.follow;
  return useMemo(
    () =>
      routeConnections(diagram, layout, {
        cache,
        ...(quick ? { quick } : {}),
        ...(via ? { via } : {}),
        ...(follow ? { follow } : {}),
      }),
    [diagram, layout, quick, via, follow, cache],
  );
}

const loaders = new WeakMap<ProjectFiles, DiagramLoader>();

/**
 * One loader per set of files, so nested diagrams are parsed once however many scenes, thumbnails
 * and levels resolve state from them. Files are immutable (every edit makes a new object), so a
 * cached loader is never stale.
 */
export function loaderFor(files: ProjectFiles): DiagramLoader {
  let loader = loaders.get(files);
  if (loader === undefined) {
    loader = new DiagramLoader(files);
    loaders.set(files, loader);
  }
  return loader;
}

/**
 * Effective state at a moment (a scene, and how far into a story), with any viewer changes,
 * including roll-up from nested instances (NE-12). `inherited` carries lines handed down from a
 * parent diagram. A scene name stands for the moment of that scene on its own.
 */
export function resolveFor(
  files: ProjectFiles,
  folder: string,
  diagram: Diagram,
  at: Moment | string | null,
  viewer: readonly SceneEntry[] = [],
  inherited: {
    scene: readonly SceneEntry[];
    viewer: readonly SceneEntry[];
    ownerDown: boolean;
  } | null = null,
): ResolvedState {
  return resolveInstance(loaderFor(files), {
    folder,
    diagram,
    moment: typeof at === "string" || at === null ? sceneMoment(at) : at,
    scene: inherited?.scene ?? [],
    viewer: [...(inherited?.viewer ?? []), ...viewer],
    ownerDown: inherited?.ownerDown ?? false,
  });
}

/**
 * Effective state at a nested level: the top diagram's story, scene and "what if" changes flow
 * down through each instance on the way in (NE-11 … NE-14), so a level looks the same in the
 * editor as in the viewer. `levels` runs from the top diagram to the level shown.
 */
export function resolveAlong(
  files: ProjectFiles,
  levels: readonly Level[],
  at: Moment | string | null,
  viewer: readonly SceneEntry[],
  diagramOf: (folder: string) => Diagram,
): ResolvedState | null {
  const top = levels[0];
  if (top === undefined) return null;
  let resolved = resolveFor(files, top.folder, diagramOf(top.folder), at, viewer, null);
  for (let i = 1; i < levels.length; i++) {
    const level = levels[i];
    const owner = level?.path.at(-1);
    if (level === undefined || owner === undefined) return null;
    const entries = resolved.nested.get(owner) ?? { scene: [], viewer: [] };
    resolved = resolveFor(files, level.folder, diagramOf(level.folder), null, [], {
      scene: entries.scene,
      viewer: entries.viewer,
      ownerDown: resolved.elements.get(owner)?.state === "down",
    });
  }
  return resolved;
}
