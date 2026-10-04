import { computeLayout, type Box, type LayoutResult } from "@mogram/core/layout";
import type { Connection, Diagram, ProjectFiles, SceneEntry } from "@mogram/core/model";
import {
  resolveLevels,
  stubsFor,
  type DiagramLoader,
  type Level,
  type Stub,
} from "@mogram/core/nested";
import { routeConnections, type RoutedPath } from "@mogram/core/routing";
import type { ResolvedState } from "@mogram/core/state";
import { resolveTheme, type CanvasTheme } from "@/features/canvas/theme";
import { loaderFor, resolveAlong } from "@/features/canvas/use-diagram";

export interface LevelGeometry {
  readonly folder: string;
  readonly diagram: Diagram;
  readonly layout: LayoutResult;
  readonly routes: ReadonlyMap<string, RoutedPath>;
  readonly theme: CanvasTheme;
}

/**
 * Parsed, laid-out and routed diagrams for every level of a project, computed once per level.
 * The viewer's files never change, so nothing here is ever invalidated (NE-10: levels load on
 * first visit, not up front).
 */
export class ProjectLevels {
  private readonly cache = new Map<string, LevelGeometry>();
  readonly loader: DiagramLoader;

  constructor(readonly files: ProjectFiles) {
    this.loader = loaderFor(files);
  }

  geometry(folder: string): LevelGeometry {
    let value = this.cache.get(folder);
    if (value === undefined) {
      const { diagram } = this.loader.load(folder);
      const layout = computeLayout(diagram);
      value = {
        folder,
        diagram,
        layout,
        routes: routeConnections(diagram, layout),
        theme: resolveTheme(diagram.settings),
      };
      this.cache.set(folder, value);
    }
    return value;
  }

  /** Levels for a component path, or null when the path doesn't lead anywhere. */
  levels(path: readonly string[]): Level[] | null {
    return resolveLevels(this.loader, path);
  }

  folderOf(path: readonly string[]): string | null {
    return this.levels(path)?.at(-1)?.folder ?? null;
  }

  /**
   * Effective state at a level: the top diagram's scene and the viewer's changes flow down
   * through each nested instance (NE-11 … NE-14).
   */
  resolve(
    path: readonly string[],
    scene: string | null,
    viewer: readonly SceneEntry[],
  ): ResolvedState | null {
    const levels = this.levels(path);
    if (levels === null) return null;
    return resolveAlong(
      this.files,
      levels,
      scene,
      viewer,
      (folder) => this.geometry(folder).diagram,
    );
  }

  /** Parent neighbours of a nested level, drawn as faded stubs at its edge (NE-5). */
  stubs(path: readonly string[]): Stub[] {
    const owner = path.at(-1);
    if (owner === undefined) return [];
    const parentFolder = this.folderOf(path.slice(0, -1));
    const folder = this.folderOf(path);
    if (parentFolder === null || folder === null) return [];
    return stubsFor(this.geometry(parentFolder).diagram, owner, this.geometry(folder).diagram);
  }
}

/** The box a camera frames for an element: a component's tile, a container's frame, or a connection's route. */
export function elementBox(geometry: LevelGeometry, name: string): Box | null {
  const box = geometry.layout.tiles.get(name) ?? geometry.layout.elements.get(name)?.box;
  if (box !== undefined) return box;
  const route = geometry.routes.get(name);
  if (route === undefined || route.samples.length === 0) return null;
  const xs = route.samples.map((p) => p.x);
  const ys = route.samples.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** An element and the connections touching it: what stays at full strength while it's in focus. */
export function focusSet(diagram: Diagram, name: string): Set<string> {
  const names = new Set([name]);
  for (const connection of diagram.connections.values()) {
    if (connection.from.element === name || connection.to.element === name)
      names.add(connection.name);
  }
  return names;
}

/** A connection between two elements at one level, in either direction. */
export function connectionBetween(diagram: Diagram, a: string, b: string): Connection | null {
  for (const connection of diagram.connections.values()) {
    const from = connection.from.element;
    const to = connection.to.element;
    if ((from === a && to === b) || (from === b && to === a)) return connection;
  }
  return null;
}

/** "aks.checkout" → level path ["aks"], element "checkout" (tour steps and deep links). */
export function splitTarget(target: string): { path: string[]; element: string } {
  const parts = target.split(".");
  const element = parts.pop() ?? target;
  return { path: parts, element };
}
