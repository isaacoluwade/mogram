"use client";

import type { ReactNode } from "react";
import { computeLayout, type LayoutResult } from "@mogram/core/layout";
import type { Diagram, ProjectFiles, SceneEntry } from "@mogram/core/model";
import { stubsFor, type Stub } from "@mogram/core/nested";
import type { FlowPreset } from "@mogram/core/presets";
import { routeConnections } from "@mogram/core/routing";
import type { Camera } from "@/features/canvas/camera";
import { buildScene, type SceneModel } from "@/features/canvas/scene";
import { StubsOverlay } from "@/features/canvas/svg/stubs";
import { resolveTheme, type CanvasTheme } from "@/features/canvas/theme";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import { fitArea, fitCamera, layoutOf, zoomToFit } from "./actions";
import { levelsAlong, parseCached, type EditorStore } from "./store/editor-store";
import { resolveLevel } from "./use-editor-scene";

/**
 * Going into nested diagrams and back out in the editor (NE-6, NE-8): the same continuous zoom
 * as the viewer, through the component's tile, so it's always clear where you went and how to
 * get back.
 */

/** A level drawn on its own, as the canvas would draw it. */
interface LevelPicture {
  readonly diagram: Diagram;
  readonly layout: LayoutResult;
  readonly scene: SceneModel;
  readonly theme: CanvasTheme;
  readonly underlay: ReactNode;
}

function levelPicture(
  files: ProjectFiles,
  levelPath: readonly string[],
  scene: string | null,
  viewer: readonly SceneEntry[],
): LevelPicture {
  const folder = levelsAlong(files, levelPath).at(-1)?.folder ?? "";
  const diagram = parseCached(files, folder).diagram;
  const layout = computeLayout(diagram);
  const routes = routeConnections(diagram, layout);
  const theme = resolveTheme(diagram.settings);
  const current = resolveLevel(files, levelPath, folder, diagram, scene, viewer);
  const stubs = nestedStubs(files, levelPath, diagram);
  return {
    diagram,
    layout,
    theme,
    scene: buildScene({ diagram, files, layout, routes, current, theme, fontFamily: "Inter" }),
    underlay:
      stubs === null || stubs.stubs.length === 0 ? undefined : (
        <StubsOverlay stubs={stubs.stubs} flows={stubs.flows} layout={layout} theme={theme} />
      ),
  };
}

/** At a nested level, the parent's neighbours as stubs, with the parent's traffic (NE-5, NE-7). */
export function nestedStubs(
  files: ProjectFiles,
  levelPath: readonly string[],
  diagram: Diagram,
): { readonly stubs: readonly Stub[]; readonly flows: ReadonlyMap<string, FlowPreset> } | null {
  const owner = levelPath.at(-1);
  if (owner === undefined) return null;
  const parentPath = levelPath.slice(0, -1);
  const folder = levelsAlong(files, parentPath).at(-1)?.folder ?? "";
  const parent = parseCached(files, folder).diagram;
  const flows = new Map<string, FlowPreset>();
  for (const [name, status] of resolveLevel(files, parentPath, folder, parent, null, [])
    .connections)
    flows.set(name, status.flow);
  return { stubs: stubsFor(parent, owner, diagram), flows };
}

/** Where the camera was on each level before going inside, so coming back out returns there. */
const returnCameras = new WeakMap<EditorStore, Map<string, Camera>>();

function camerasOf(store: EditorStore): Map<string, Camera> {
  let cameras = returnCameras.get(store);
  if (cameras === undefined) {
    cameras = new Map();
    returnCameras.set(store, cameras);
  }
  return cameras;
}

const animate = (store: EditorStore): boolean =>
  store.getState().viewport.width > 0 && !prefersReducedMotion();

/** Opens the nested diagram a component points at, zooming in through its tile (NE-6). */
export function openNested(store: EditorStore, name: string): boolean {
  const state = store.getState();
  if (state.levelZoom !== null) return true;
  const component = state.diagram().components.get(name);
  if (component?.opens == null) return false;
  const opens = component.opens;
  if (parseCached(state.files, opens).diagram.files.length === 0) {
    state.notify(
      `"${component.label}" opens ${component.opens}, but that folder has no diagram yet.`,
      "error",
    );
    return false;
  }
  const outerPath = state.levelPath;
  const innerPath = [...outerPath, name];
  camerasOf(store).set(outerPath.join("/"), state.camera);

  const inner = levelPicture(state.files, innerPath, state.scene, state.viewerEntries);
  const area = fitArea(inner.layout, true);
  const enter = () => {
    const s = store.getState();
    s.openLevel(name, opens);
    // Framed for the room the panels leave once inside (the inner level has its own size).
    s.setCamera(fitCamera(store, area));
    s.setLevelZoom(null);
  };
  const outerLayout = layoutOf(store);
  const tile = outerLayout.tiles.get(name) ?? outerLayout.elements.get(name)?.box;
  if (tile === undefined || !animate(store)) {
    enter();
    return true;
  }
  const outer = levelPicture(state.files, outerPath, state.scene, state.viewerEntries);
  state.select([]);
  state.setEditingLabel(null);
  state.setLevelZoom({
    direction: "in",
    outer: { ...outer, camera: state.camera },
    inner: { ...inner, camera: fitCamera(store, area) },
    tile,
    area,
    component: name,
    finish: enter,
  });
  return true;
}

/**
 * Back out to the level at `depth` (0 is the top diagram; by default, one level up). One level
 * zooms back out through the tile; a jump of several goes straight there.
 */
export function exitNested(store: EditorStore, depth?: number): boolean {
  const state = store.getState();
  if (state.levelZoom !== null) return true;
  const path = state.levelPath;
  const target = depth ?? path.length - 1;
  if (target < 0 || target >= path.length) return false;
  const outerPath = path.slice(0, target);
  const back = camerasOf(store).get(outerPath.join("/"));
  const leave = (camera: Camera | null) => {
    const s = store.getState();
    s.closeLevel(target);
    if (camera !== null) s.setCamera(camera);
    else requestAnimationFrame(() => zoomToFit(store));
    s.setLevelZoom(null);
  };
  const component = path[target];
  if (target !== path.length - 1 || component === undefined || !animate(store)) {
    leave(back ?? null);
    return true;
  }
  const outer = levelPicture(state.files, outerPath, state.scene, state.viewerEntries);
  const inner = levelPicture(state.files, path, state.scene, state.viewerEntries);
  const tile = outer.layout.tiles.get(component) ?? outer.layout.elements.get(component)?.box;
  const outerCamera = back ?? fitCamera(store, fitArea(outer.layout, outerPath.length > 0));
  if (tile === undefined) {
    leave(outerCamera);
    return true;
  }
  state.select([]);
  state.setEditingLabel(null);
  state.setLevelZoom({
    direction: "out",
    outer: { ...outer, camera: outerCamera },
    inner: { ...inner, camera: state.camera },
    tile,
    area: fitArea(inner.layout, true),
    component,
    finish: () => leave(outerCamera),
  });
  return true;
}
