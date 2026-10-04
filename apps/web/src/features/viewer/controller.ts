import type { Box } from "@mogram/core/layout";
import type { Tour } from "@mogram/core/model";
import type { FlowPreset, StatePreset } from "@mogram/core/presets";
import { advance, back, cursorTo, startCursor, type TourCursor } from "@mogram/core/tours";
import { stepScene as nextScene } from "@mogram/core/timeline";
import { createElement } from "react";
import { fitBox, PHONE_MIN_ZOOM, PHONE_WIDTH, type Camera } from "@/features/canvas/camera";
import type { LevelSide, LevelZoomPlan } from "@/features/canvas/level-transition";
import { buildScene } from "@/features/canvas/scene";
import { STUB_ROOM, StubsOverlay } from "@/features/canvas/svg/stubs";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import type { Clock } from "@/features/canvas/clock";
import type { DeepLink } from "@/features/share/deep-link";
import {
  CameraAnimator,
  cardInsets,
  chromeInsets,
  focalPoint,
  focusCamera,
  type Insets,
} from "./camera-motion";
import {
  ProjectLevels,
  connectionBetween,
  elementBox,
  focusSet,
  splitTarget,
  type LevelGeometry,
} from "./levels";
import type { ViewerStore } from "./viewer-store";

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Everything the viewer does that moves the camera: cards (CA-1, CA-4), tours (TO-1 … TO-11),
 * nested zoom (NE-6, NE-8) and deep links (SH-4). Each operation supersedes the previous one, so
 * clicking quickly never leaves the camera or the panels half-way.
 */
export class ViewerController {
  readonly levels: ProjectLevels;
  readonly animator: CameraAnimator;
  /**
   * Where the camera was on each level before going inside one of its components, by level path.
   * Keyed rather than stacked: an interrupted zoom-in can't leave a stale entry behind.
   */
  private readonly parentCameras = new Map<string, Camera>();
  private version = 0;

  constructor(
    readonly store: ViewerStore,
    readonly clock: Clock,
  ) {
    this.levels = new ProjectLevels(store.getState().files);
    this.animator = new CameraAnimator(
      () => store.getState().camera,
      (camera) => store.getState().setCamera(camera),
      () => store.getState().viewport,
      (active) => store.getState().setAnimating(active),
    );
  }

  private get state() {
    return this.store.getState();
  }

  /** Starts an operation; returns a check that is false once a newer one has started. */
  private begin(): () => boolean {
    const token = ++this.version;
    this.dropZoom();
    return () => token === this.version;
  }

  /** The nested zoom in progress: resolves `true` when it lands, `false` if interrupted. */
  private pendingZoom: ((landed: boolean) => void) | null = null;

  private dropZoom(): void {
    const pending = this.pendingZoom;
    this.pendingZoom = null;
    if (this.state.levelZoom !== null) {
      this.state.setLevelZoom(null);
      this.state.setAnimating(false);
    }
    pending?.(false);
  }

  /** Plays the zoom through a tile; `land` switches level and camera on its last frame. */
  private zoomThrough(plan: LevelZoomPlan, land: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingZoom = resolve;
      this.animator.cancel();
      this.state.setAnimating(true);
      this.state.setLevelZoom({
        ...plan,
        finish: () => {
          if (this.pendingZoom !== resolve) return;
          this.pendingZoom = null;
          land();
          this.state.setLevelZoom(null);
          this.state.setAnimating(false);
          resolve(true);
        },
      });
    });
  }

  /** A level drawn on its own at `camera`, for the zoom between levels. */
  private picture(path: readonly string[], camera: Camera): LevelSide | null {
    const geometry = this.geometry(path);
    const { scene, viewerEntries } = this.state;
    const current = this.levels.resolve(path, scene, viewerEntries);
    if (current === null) return null;
    const model = buildScene({
      diagram: geometry.diagram,
      files: this.levels.files,
      layout: geometry.layout,
      routes: geometry.routes,
      current,
      theme: geometry.theme,
      fontFamily: "Inter",
    });
    const stubs = path.length > 0 ? this.levels.stubs(path) : [];
    return {
      scene: model,
      theme: geometry.theme,
      camera,
      underlay:
        stubs.length === 0
          ? undefined
          : createElement(StubsOverlay, {
              stubs,
              flows: this.parentFlows(path),
              layout: geometry.layout,
              theme: geometry.theme,
            }),
    };
  }

  /** Flow of each parent connection at a nested level, for its stubs (NE-7). */
  parentFlows(path: readonly string[]): Map<string, FlowPreset> {
    const flows = new Map<string, FlowPreset>();
    if (path.length === 0) return flows;
    const { scene, viewerEntries } = this.state;
    const parent = this.levels.resolve(path.slice(0, -1), scene, viewerEntries);
    for (const [name, status] of parent?.connections ?? []) flows.set(name, status.flow);
    return flows;
  }

  geometry(path: readonly string[] = this.state.levelPath): LevelGeometry {
    return this.levels.geometry(this.levels.folderOf(path) ?? "");
  }

  get topTours(): readonly Tour[] {
    return this.levels.geometry("").diagram.tours;
  }

  /** What framing a level shows: its diagram, and room for the parent's stubs either side. */
  private fitArea(geometry: LevelGeometry, path: readonly string[]): Box {
    const layoutBounds =
      geometry.layout.bounds.w === 0 ? { x: 0, y: 0, w: 400, h: 300 } : geometry.layout.bounds;
    // Nested levels show their parent's neighbours as stubs either side; keep those in view.
    const stubs = path.length > 0 ? this.levels.stubs(path) : [];
    const left = stubs.some((s) => s.direction === "in") ? STUB_ROOM : 0;
    const right = stubs.some((s) => s.direction === "out") ? STUB_ROOM : 0;
    return {
      x: layoutBounds.x - left,
      y: layoutBounds.y,
      w: layoutBounds.w + left + right,
      h: layoutBounds.h,
    };
  }

  private fitCamera(
    geometry: LevelGeometry,
    path: readonly string[] = this.state.levelPath,
  ): Camera {
    const { viewport, present, reservedBottom } = this.state;
    const bounds = this.fitArea(geometry, path);
    return fitBox(bounds, viewport, {
      padding: 40,
      maxZoom: 1.1,
      ...(viewport.width < PHONE_WIDTH ? { minZoom: PHONE_MIN_ZOOM } : {}),
      insets: withReserved(chromeInsets(viewport, present), reservedBottom),
    });
  }

  /** Frames the whole level. */
  async fit(animated = true): Promise<void> {
    const camera = this.fitCamera(this.geometry());
    if (animated) await this.animator.to(camera, 600);
    else {
      this.animator.cancel();
      this.state.setCamera(camera);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Cards

  /** Opens an element's card and frames it beside the card (CA-1). */
  async openCard(
    name: string,
    options: { travelFrom?: string | null; instant?: boolean } = {},
  ): Promise<boolean> {
    const current = this.begin();
    const geometry = this.geometry();
    const box = elementBox(geometry, name);
    if (box === null) return false;
    this.state.setOpenCard(name);
    this.state.setFocus(focusSet(geometry.diagram, name));
    const { viewport, present } = this.state;
    const insets = cardInsets(viewport, present);
    const target = focusCamera(box, viewport, insets);
    if (options.instant === true) {
      this.animator.cancel();
      this.state.setCamera(target);
      return true;
    }
    const from = options.travelFrom ?? null;
    const connection = from === null ? null : connectionBetween(geometry.diagram, from, name);
    const route = connection === null ? undefined : geometry.routes.get(connection.name);
    if (connection !== null && route !== undefined) {
      const points =
        connection.from.element === name ? [...route.samples].reverse() : route.samples;
      await this.animator.along(points, focalPoint(viewport, insets), target.zoom, target);
    } else {
      await this.animator.to(target, 650);
    }
    return current();
  }

  async closeCard(): Promise<void> {
    this.begin();
    this.state.setOpenCard(null);
    this.state.setFocus(null);
    if (this.state.tour !== null) return;
    await this.fit();
  }

  /** Elements without a card just show their quick info; the camera stays put. */
  inspect(name: string | null): void {
    this.state.setInspected(name);
    this.state.setFocus(name === null ? null : focusSet(this.geometry().diagram, name));
  }

  /** `[text](#name)` in a card (CA-4): relative to the card's level; dots go into nested levels. */
  async followLink(target: string): Promise<void> {
    const { path, element } = splitTarget(target);
    const from = this.state.openCard;
    if (path.length === 0) {
      if (elementBox(this.geometry(), element) === null) return;
      await this.openCard(element, { travelFrom: from });
      return;
    }
    const absolute = [...this.state.levelPath, ...path];
    if (this.levels.levels(absolute) === null) return;
    if (!(await this.goToLevel(absolute))) return;
    await this.openCard(element);
  }

  // -----------------------------------------------------------------------------------------------
  // Nested levels (NE-6, NE-8)

  canEnter(component: string): boolean {
    const opens = this.geometry().diagram.components.get(component)?.opens ?? null;
    return opens !== null && this.levels.levels([...this.state.levelPath, component]) !== null;
  }

  /** Goes inside: the camera pushes into the tile as the inner diagram grows out of it. */
  async enterLevel(component: string, options: { instant?: boolean } = {}): Promise<boolean> {
    const current = this.begin();
    if (!this.canEnter(component)) return false;
    const parent = this.geometry();
    const tile = elementBox(parent, component);
    if (tile === null) return false;
    const outerPath = this.state.levelPath;
    const path = [...outerPath, component];
    this.parentCameras.set(outerPath.join("/"), this.state.camera);
    this.state.setOpenCard(null);
    this.state.setInspected(null);
    this.state.setFocus(null);

    const inner = this.geometry(path);
    const innerCamera = this.fitCamera(inner, path);
    const land = () => {
      this.state.setLevel(path);
      this.state.setCamera(innerCamera);
    };
    const outer = this.picture(outerPath, this.state.camera);
    const within = this.picture(path, innerCamera);
    if (options.instant === true || prefersReducedMotion() || outer === null || within === null) {
      this.animator.cancel();
      land();
      return true;
    }
    const landed = await this.zoomThrough(
      { direction: "in", outer, inner: within, tile, area: this.fitArea(inner, path), component },
      land,
    );
    return landed && current();
  }

  /** Back out one level (Escape): the inner diagram shrinks back into its tile. */
  async exitLevel(options: { instant?: boolean } = {}): Promise<boolean> {
    const current = this.begin();
    const path = this.state.levelPath;
    const component = path.at(-1);
    if (component === undefined) return false;
    const parentPath = path.slice(0, -1);
    this.state.setOpenCard(null);
    this.state.setInspected(null);
    this.state.setFocus(null);
    const key = parentPath.join("/");
    const parent = this.geometry(parentPath);
    const back = this.parentCameras.get(key) ?? this.fitCamera(parent, parentPath);
    this.parentCameras.delete(key);
    const land = () => {
      this.state.setLevel(parentPath);
      this.state.setCamera(back);
    };
    const tile = elementBox(parent, component);
    const outer = this.picture(parentPath, back);
    const inner = this.picture(path, this.state.camera);
    if (
      options.instant === true ||
      prefersReducedMotion() ||
      tile === null ||
      outer === null ||
      inner === null
    ) {
      this.animator.cancel();
      land();
      return true;
    }
    const landed = await this.zoomThrough(
      {
        direction: "out",
        outer,
        inner,
        tile,
        area: this.fitArea(this.geometry(path), path),
        component,
      },
      land,
    );
    return landed && current();
  }

  /** Moves out and in until `path` is the current level (breadcrumbs, tours, deep links). */
  async goToLevel(path: readonly string[], options: { instant?: boolean } = {}): Promise<boolean> {
    if (this.levels.levels(path) === null) return false;
    while (!samePath(this.state.levelPath, path.slice(0, this.state.levelPath.length))) {
      if (!(await this.exitLevel(options))) return false;
    }
    while (this.state.levelPath.length > path.length) {
      if (!(await this.exitLevel(options))) return false;
    }
    while (this.state.levelPath.length < path.length) {
      const next = path[this.state.levelPath.length];
      if (next === undefined || !(await this.enterLevel(next, options))) return false;
    }
    return true;
  }

  // -----------------------------------------------------------------------------------------------
  // Scenes

  setScene(scene: string | null): void {
    this.state.setScene(scene, this.clock.time());
  }

  stepScene(direction: 1 | -1): void {
    const scenes = this.levels.geometry("").diagram.scenes.map((s) => s.name);
    this.setScene(nextScene(scenes, this.state.scene, direction));
  }

  // -----------------------------------------------------------------------------------------------
  // Tours (TO-1 … TO-11)

  tour(name: string | undefined = this.state.tour?.tour): Tour | null {
    return this.topTours.find((t) => t.name === name) ?? null;
  }

  async startTour(
    name: string,
    step?: string | null,
    options: { instant?: boolean } = {},
  ): Promise<void> {
    const tour = this.tour(name);
    if (tour === null) return;
    // A deep-linked step is reached as if walked to, so Back and step numbers are right (TO-11).
    const cursor =
      step != null
        ? (cursorTo(tour, step, this.state.scene) ?? startCursor(tour, this.state.scene))
        : startCursor(tour, this.state.scene);
    if (cursor === null) return;
    this.state.setPlaying(false);
    this.state.setTour(cursor);
    await this.showStep(null, cursor, options);
  }

  private async showStep(
    previous: TourCursor | null,
    cursor: TourCursor,
    options: { instant?: boolean } = {},
  ): Promise<void> {
    if (cursor.scene !== this.state.scene) this.setScene(cursor.scene);
    const { path, element } = splitTarget(cursor.step);
    const before = previous === null ? null : splitTarget(previous.step);
    if (before !== null && samePath(before.path, path) && samePath(this.state.levelPath, path)) {
      await this.openCard(element, { travelFrom: before.element });
      return;
    }
    if (!(await this.goToLevel(path, options))) return;
    await this.openCard(element, options);
  }

  async nextStep(choice = 0): Promise<void> {
    const cursor = this.state.tour;
    const tour = this.tour();
    if (cursor === null || tour === null) return;
    const next = advance(tour, cursor, choice);
    if (next === null) {
      await this.endTour();
      return;
    }
    this.state.setTour(next);
    await this.showStep(cursor, next);
  }

  async previousStep(): Promise<void> {
    const cursor = this.state.tour;
    if (cursor === null) return;
    const previous = back(cursor);
    if (previous === null) return;
    this.state.setTour(previous);
    await this.showStep(cursor, previous);
  }

  /** Back to the current step after wandering off in explore mode (TO-7). */
  async resumeTour(): Promise<void> {
    const cursor = this.state.tour;
    if (cursor === null) return;
    this.state.setWandered(false);
    await this.showStep(null, cursor);
  }

  /** Closing a tour zooms out to the full diagram (TO-4). */
  async endTour(): Promise<void> {
    this.begin();
    this.state.setTour(null);
    this.state.setOpenCard(null);
    this.state.setFocus(null);
    if (this.state.levelPath.length > 0) await this.goToLevel([]);
    await this.fit();
  }

  // -----------------------------------------------------------------------------------------------
  // What if (SH-3) and deep links (SH-4)

  setViewerState(element: string, state: StatePreset | null): void {
    this.state.setViewerState([...this.state.levelPath, element].join("."), state);
  }

  viewerStateOf(element: string): StatePreset | null {
    const target = [...this.state.levelPath, element].join(".");
    return this.state.viewerEntries.find((entry) => entry.target === target)?.state ?? null;
  }

  /** The state an element has from the diagram and scene alone, ignoring its own "what if". */
  baseStateOf(element: string): StatePreset {
    const target = [...this.state.levelPath, element].join(".");
    const others = this.state.viewerEntries.filter((entry) => entry.target !== target);
    return (
      this.levels.resolve(this.state.levelPath, this.state.scene, others)?.elements.get(element)
        ?.state ?? "healthy"
    );
  }

  /** Picking the state the element already has from the scene clears the "what if". */
  chooseViewerState(element: string, state: StatePreset): void {
    this.setViewerState(element, state === this.baseStateOf(element) ? null : state);
  }

  /** Opens straight to a level, scene, tour step or card, without animation. */
  async applyDeepLink(link: DeepLink): Promise<void> {
    const top = this.levels.geometry("").diagram;
    if (link.scene !== null && top.scenes.some((s) => s.name === link.scene))
      this.state.setScene(link.scene, this.clock.time() - 10);
    if (link.tour !== null && this.tour(link.tour) !== null) {
      await this.startTour(link.tour, link.step, { instant: true });
      return;
    }
    if (link.level.length > 0) await this.goToLevel(link.level, { instant: true });
    else await this.fit(false);
    if (link.card !== null && elementBox(this.geometry(), link.card) !== null)
      await this.openCard(link.card, { instant: true });
  }

  /** The deep link for what's on screen now. */
  currentLink(): DeepLink {
    const { levelPath, scene, openCard, tour } = this.state;
    if (tour !== null)
      return { level: [], scene: null, card: null, tour: tour.tour, step: tour.step };
    return { level: levelPath, scene, card: openCard, tour: null, step: null };
  }
}

/** Keeps framing clear of an overlay along the bottom (it never shrinks the chrome's own room). */
function withReserved(insets: Insets, bottom: number): Insets {
  return bottom > insets.bottom ? { ...insets, bottom } : insets;
}
