import {
  SLIDE_OPENING,
  STILL_SLIDE,
  slideClosing,
  slideDiagram,
  slideEnded,
  slideOpening,
  type DeckSlide,
} from "@mogram/core/deck";
import type { ViewerDeck } from "@/features/deck/viewer-deck";
import { loaderFor } from "@/features/canvas/use-diagram";
import type { ElementLink } from "@mogram/core/model";
import type { Box } from "@mogram/core/layout";
import type { Tour } from "@mogram/core/model";
import type { FlowPreset, StatePreset } from "@mogram/core/presets";
import { advance, back, cursorTo, startCursor, type TourCursor } from "@mogram/core/tours";
import { stepScene as nextScene } from "@mogram/core/timeline";
import {
  REWIND_CUT,
  STEP_GAP,
  beatsPlayed,
  captionAt,
  chooseStory,
  cursorAtBeat,
  hasNext,
  nextBeat,
  pictureAt,
  previousBeat,
  stepAt,
  stepChange,
  stepHold,
  type Moment,
  type StoryCursor,
} from "@mogram/core/picture";
import type { Value } from "@mogram/core/values";
import { createElement } from "react";
import {
  fitBox,
  MAX_ZOOM,
  PHONE_MIN_ZOOM,
  PHONE_WIDTH,
  type Camera,
} from "@/features/canvas/camera";
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
import type { Sound } from "@/features/assets/voice-player";
import { voiceFor, VOICE_TAIL, type Voice } from "@mogram/core/assets";

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
  /** Steps of the beat being played that haven't happened yet, and the next beat when playing. */
  private storyTimer: number | null = null;
  private storyRun = 0;
  /** Plays each beat's recording while the story plays by itself (D-105); none on a server. */
  sound: Sound | null = null;
  /** How long each step of the beat being played lasts, by its recording; null without one. */
  private beatShare: number | null = null;
  /** What the camera is framing for the story: an element, or null for the whole diagram. */
  private storyZoom: string | null = null;

  constructor(
    readonly store: ViewerStore,
    readonly clock: Clock,
    /** The deck this diagram is a slide of (D-99), when it is one. */
    private deck: ViewerDeck | null = null,
  ) {
    const { files, root } = store.getState();
    // A slide and its frame take the deck's settings, and its built-in values for this slide.
    const deckDiagram = deck === null ? null : loaderFor(files).load(deck.folder).diagram;
    this.levels = new ProjectLevels(files, root, (folder, diagram) => {
      const now = this.deck;
      if (now === null || deckDiagram === null) return diagram;
      if (folder !== root && folder !== now.frame) return diagram;
      return slideDiagram(deckDiagram, diagram, now.slides[now.index] ?? null, now.slides.length);
    });
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

  /** Where the viewer is: the scene picked and how far into the story (D-86). */
  get moment(): Moment {
    return { scene: this.state.scene, story: this.state.story, controls: this.state.controls };
  }

  /** A level drawn on its own at `camera`, for the zoom between levels. */
  private picture(path: readonly string[], camera: Camera): LevelSide | null {
    const geometry = this.geometry(path);
    const { viewerEntries } = this.state;
    const current = this.levels.resolve(path, this.moment, viewerEntries);
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
    const parent = this.levels.resolve(path.slice(0, -1), this.moment, this.state.viewerEntries);
    for (const [name, status] of parent?.connections ?? []) flows.set(name, status.flow);
    return flows;
  }

  geometry(path: readonly string[] = this.state.levelPath): LevelGeometry {
    return this.levels.geometry(this.levels.folderOf(path) ?? this.levels.root);
  }

  get topTours(): readonly Tour[] {
    return this.levels.top.diagram.tours;
  }

  /** What framing a level shows: its diagram, and room for the parent's stubs either side. */
  private fitArea(geometry: LevelGeometry, path: readonly string[]): Box {
    // A page (D-98) is the whole picture: nothing beside it to keep in view.
    if (geometry.layout.page !== null) return geometry.layout.page;
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
    const insets = withReserved(chromeInsets(viewport, present), reservedBottom);
    // A page fills the room there is, at whatever zoom that takes: edge to edge when presenting.
    // Presenting, nothing is kept clear: the words sit over the foot of the page, as subtitles do.
    if (geometry.layout.page !== null)
      return fitBox(bounds, viewport, {
        padding: present ? 0 : 16,
        maxZoom: MAX_ZOOM,
        insets: present ? { top: 0, right: 0, bottom: 0, left: 0 } : insets,
      });
    return fitBox(bounds, viewport, {
      padding: 40,
      maxZoom: 1.1,
      ...(viewport.width < PHONE_WIDTH ? { minZoom: PHONE_MIN_ZOOM } : {}),
      insets,
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

  async reframe(): Promise<void> {
    if (this.state.openCard !== null) {
      await this.openCard(this.state.openCard, { instant: true });
    } else if (this.state.levelPath.length === 0) {
      this.frameStory(this.state.story, false, true);
    } else {
      await this.fit(false);
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

  /**
   * An element's own `link:` (07 §18 P0-3): a web page opens in a new tab; a scene is shown; a
   * tour starts; another element's card opens (or it's highlighted when it has none).
   */
  async followElementLink(link: ElementLink): Promise<void> {
    switch (link.kind) {
      case "url":
        window.open(link.url, "_blank", "noopener,noreferrer");
        return;
      case "scene":
        this.setScene(link.scene);
        return;
      case "tour":
        await this.startTour(link.tour);
        return;
      case "element": {
        const diagram = this.geometry().diagram;
        const card =
          diagram.components.get(link.element)?.card ??
          diagram.containers.get(link.element)?.card ??
          diagram.connections.get(link.element)?.card ??
          null;
        if (card !== null) await this.openCard(link.element, { travelFrom: this.state.openCard });
        else this.inspect(link.element);
        return;
      }
    }
  }

  /** `[text](#name)` in a card (CA-4): relative to the card's level; dots go into nested levels. */
  async followLink(target: string): Promise<void> {
    const { path, element } = splitTarget(target, this.levels, this.state.levelPath);
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
    const scenes = this.levels.top.diagram.scenes.map((s) => s.name);
    this.setScene(nextScene(scenes, this.state.scene, direction));
  }

  // -----------------------------------------------------------------------------------------------
  // Stories (D-86)

  private get top() {
    return this.levels.top.diagram;
  }

  private stopStoryTimer(): void {
    if (this.storyTimer !== null) window.clearTimeout(this.storyTimer);
    this.storyTimer = null;
    this.storyRun++;
    // A recording plays with its beat, and stops when the picture moves on without it.
    this.sound?.stop();
  }

  /** The recording of what a beat says, kept in the deck's folder (or the diagram's). */
  private voiceOf(cursors: readonly StoryCursor[]): Voice | null {
    let script: string | null = null;
    for (const cursor of cursors) {
      const ref = cursor.played.at(-1);
      script = (ref === undefined ? null : stepAt(this.top, ref))?.script ?? script;
    }
    if (script === null) return null;
    return voiceFor(this.state.files, this.deck?.folder ?? this.levels.root, script);
  }

  /** Frames what the story's step says to (an element), or the whole diagram again. */
  private frameStory(cursor: StoryCursor | null, animated: boolean, force = false): void {
    if (this.state.levelPath.length > 0 || this.state.openCard !== null) return;
    const zoom =
      cursor === null
        ? null
        : pictureAt(this.top, {
            scene: this.state.scene,
            story: cursor,
            controls: this.state.controls,
          }).zoom;
    if (zoom === this.storyZoom && !force) return;
    this.storyZoom = zoom;
    const box = zoom === null ? null : elementBox(this.geometry([]), zoom);
    if (box === null) {
      void this.fit(animated);
      return;
    }
    const { viewport, present, reservedBottom } = this.state;
    const target = focusCamera(
      box,
      viewport,
      withReserved(chromeInsets(viewport, present), reservedBottom),
    );
    if (animated) void this.animator.to(target, 650);
    else {
      this.animator.cancel();
      this.state.setCamera(target);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // A slide of a deck (D-99)

  /** Whether this slide has been handed over: it's on its way out, and plays no further. */
  private left = false;

  /**
   * The deck has cut to another slide and this one is fading out: it stays as it is, and
   * nothing it had under way moves the deck again.
   */
  leave(): void {
    this.left = true;
    this.stopStoryTimer();
    this.state.setStoryPlaying(false);
  }

  /**
   * Stops everything under way: a camera move, the story's next beat. The viewer is going (or,
   * in development, React is trying its effects twice, so nothing is marked for good).
   */
  dispose(): void {
    this.stopStoryTimer();
    this.animator.cancel();
  }

  /** The slide this viewer is showing, when it's in a deck. */
  private get slide(): DeckSlide | null {
    return this.deck?.slides[this.deck.index] ?? null;
  }

  /** The frame's folder, when this slide is drawn over the deck's frame. */
  get frameFolder(): string | null {
    return this.slide?.frame === true ? (this.deck?.frame ?? null) : null;
  }

  /** Whether the deck shows each beat's words; true outside a deck. */
  get captions(): boolean {
    return this.deck?.captions ?? true;
  }

  /**
   * The deck has moved on to a slide that carries straight on from this one: the same diagram,
   * the same picture, a new stretch. Nothing on screen changes but the slide's number.
   */
  carryOn(deck: ViewerDeck): void {
    this.deck = deck;
    this.levels.reset();
    this.state.setSlide(deck.index);
  }

  /** Puts the slide where its deck says it begins: its opening, its last picture, or part-way. */
  private openSlide(): void {
    const deck = this.deck;
    const slide = this.slide;
    if (deck === null || slide === null) return;
    this.stopStoryTimer();
    if (slide.scene !== null) this.state.setScene(slide.scene, this.clock.time() - 10);
    const cursor =
      deck.start.kind === "closing"
        ? slideClosing(this.top, slide, this.state.controls)
        : this.slideAfter(slide, deck.start.kind === "beats" ? deck.start.beats : 0);
    this.state.setStory(cursor, this.clock.time(), 0);
    this.frameStory(cursor, false);
    // Opened by the Script window as a beat begins: that beat plays once the cut is over.
    if (deck.start.kind === "beats" && deck.start.play === true) {
      const run = this.storyRun;
      this.storyTimer = window.setTimeout(() => {
        if (run === this.storyRun) this.nextBeat();
      }, SLIDE_OPENING * 1000);
      return;
    }
    if (!deck.playing) return;
    // The deck is playing itself: a slide with nothing to play holds a moment, then moves on.
    this.state.setStoryPlaying(true);
    const run = this.storyRun;
    this.storyTimer = window.setTimeout(
      () => {
        if (run !== this.storyRun) return;
        if (cursor === null || slideEnded(this.top, slide, cursor, this.state.controls))
          this.leaveSlide();
        else this.nextBeat();
      },
      (cursor === null ? STILL_SLIDE : SLIDE_OPENING) * 1000,
    );
  }

  /** A slide once `beats` of its stretch have played. */
  private slideAfter(slide: DeckSlide, beats: number): StoryCursor | null {
    let cursor = slideOpening(this.top, slide, this.state.controls);
    for (let beat = 0; cursor !== null && beat < beats; beat++) {
      if (slideEnded(this.top, slide, cursor, this.state.controls)) break;
      cursor = nextBeat(this.top, cursor, this.state.controls).at(-1) ?? cursor;
    }
    return cursor;
  }

  /**
   * The Script window has begun the `beats`th beat of a slide (D-105): the next beat plays as
   * it would by hand, a slide that carries on plays on in place, and anything else is a jump.
   */
  followScript(slide: number, beats: number): void {
    const deck = this.deck;
    const current = this.slide;
    if (deck === null || current === null || this.left) return;
    this.state.setStoryPlaying(false);
    if (slide === deck.index) {
      const played = this.storyBeat;
      if (beats === played) return;
      if (beats === played + 1) {
        this.nextBeat();
        return;
      }
      this.stopStoryTimer();
      const cursor = this.slideAfter(current, beats);
      this.state.setStory(cursor, this.clock.time(), this.state.motionPaused ? 0 : undefined);
      this.frameStory(cursor, true);
      return;
    }
    const ended = slideEnded(this.top, current, this.state.story, this.state.controls);
    if (slide === deck.index + 1 && beats === 1 && deck.slides[slide]?.carriesOn && ended) {
      this.stepDeck(1);
      return;
    }
    deck.goTo(slide, beats);
  }

  /** The slide has played while the deck plays itself: on to the next, or stop at the end. */
  private leaveSlide(): void {
    if (this.left) return;
    const next = this.deck?.next(true) ?? false;
    if (next === false) this.state.setStoryPlaying(false);
    else if (next !== true) {
      // It carries straight on: the same story, its next beat.
      this.carryOn(next);
      this.nextBeat();
    }
  }

  /**
   * Forward in a deck: the slide's next beat, or the next slide once it has played. Back: the
   * beat before, or the slide before's last picture.
   */
  stepDeck(direction: 1 | -1): void {
    const deck = this.deck;
    if (deck === null || this.left) return;
    this.state.setStoryPlaying(false);
    if (direction === 1) {
      if (this.nextBeat()) return;
      const next = deck.next(false);
      if (typeof next === "object") {
        this.carryOn(next);
        this.nextBeat();
      }
      return;
    }
    if (this.previousBeat()) return;
    const before = deck.previous();
    if (typeof before === "object") {
      this.carryOn(before);
      this.previousBeat();
    }
  }

  /** Opens a story (the first, unless named) with `beats` of it already played. */
  openStory(name?: string, beats = 0, options: { instant?: boolean } = {}): boolean {
    const story = name ?? this.top.stories[0]?.name;
    const cursor =
      story === undefined ? null : cursorAtBeat(this.top, story, beats, this.state.controls);
    if (cursor === null) return false;
    this.stopStoryTimer();
    const instant = options.instant === true || this.state.motionPaused;
    this.state.setStory(cursor, this.clock.time(), instant ? 0 : undefined);
    this.frameStory(cursor, !instant);
    return true;
  }

  /** Plays cursors one after another, each for as long as its step takes. */
  private playCursors(cursors: readonly StoryCursor[]): void {
    this.stopStoryTimer();
    const last = cursors.at(-1);
    if (last === undefined) {
      this.state.setStoryPlaying(false);
      return;
    }
    // A beat with a recording lasts as long as it, a little more, its steps spaced through it.
    const voice = this.voiceOf(cursors);
    const share = voice === null ? null : (voice.seconds + VOICE_TAIL) / cursors.length;
    this.beatShare = share;
    if (voice !== null && this.state.storyPlaying) this.sound?.play(voice);
    // With motion held still there's nothing to watch between steps: land on the beat's end.
    if (this.state.motionPaused) {
      this.state.setStory(last, this.clock.time(), 0);
      this.frameStory(last, false);
      this.afterBeat(last);
      return;
    }
    const run = this.storyRun;
    const play = (index: number): void => {
      const cursor = cursors[index];
      if (cursor === undefined || run !== this.storyRun) return;
      const ref = cursor.played.at(-1);
      const step = ref === undefined ? null : stepAt(this.top, ref);
      const change = cursor.rewound ? REWIND_CUT : step === null ? 0 : stepChange(step);
      const ends = index === cursors.length - 1;
      // Values that run across the step (a timer) take its change and its hold.
      const hold =
        step === null || cursor.rewound
          ? 0
          : share !== null
            ? Math.max(0, share - change)
            : stepHold(step, ends, ends ? captionAt(this.top, cursor) : null);
      this.state.setStory(cursor, this.clock.time(), change, hold);
      this.frameStory(cursor, true);
      if (ends) {
        this.afterBeat(cursor);
        return;
      }
      const gap = cursor.rewound
        ? 0
        : share !== null
          ? Math.max(0, share - change)
          : (step?.hold ?? STEP_GAP);
      this.storyTimer = window.setTimeout(() => play(index + 1), (change + gap) * 1000);
    };
    play(0);
  }

  /** At the end of a beat: when the story is playing, the next one follows once it's been read. */
  private afterBeat(cursor: StoryCursor): void {
    if (!this.state.storyPlaying) return;
    const ref = cursor.played.at(-1);
    const step = ref === undefined ? null : stepAt(this.top, ref);
    // A choice waits for the viewer; so does the end.
    if (step === null || step.choices.length > 0) {
      this.state.setStoryPlaying(false);
      return;
    }
    const slide = this.slide;
    const over =
      slide !== null
        ? slideEnded(this.top, slide, cursor, this.state.controls)
        : !hasNext(this.top, cursor, this.state.controls);
    if (over && slide === null) {
      this.state.setStoryPlaying(false);
      return;
    }
    const wait =
      this.beatShare ??
      stepChange(step) + stepHold(step, true, captionAt(this.top, cursor), step.script);
    const run = this.storyRun;
    this.storyTimer = window.setTimeout(() => {
      if (run !== this.storyRun) return;
      // In a deck, the end of a slide's stretch is where the next slide begins.
      if (over) this.leaveSlide();
      else this.nextBeat();
    }, wait * 1000);
  }

  /** Plays the next beat. False at the end of the story, or of a slide's stretch of it. */
  nextBeat(): boolean {
    const cursor = this.state.story;
    if (cursor === null) return false;
    const slide = this.slide;
    if (slide !== null && slideEnded(this.top, slide, cursor, this.state.controls)) return false;
    const cursors = nextBeat(this.top, cursor, this.state.controls);
    this.playCursors(cursors);
    return cursors.length > 0;
  }

  /** Back a beat. False at the opening of the story, or of a slide's stretch of it. */
  previousBeat(): boolean {
    const cursor = this.state.story;
    const slide = this.slide;
    const opening = slide === null ? null : slideOpening(this.top, slide, this.state.controls);
    if (cursor !== null && opening !== null && cursor.played.length <= opening.played.length)
      return false;
    const before = cursor === null ? null : previousBeat(cursor);
    if (before === null) return false;
    this.stopStoryTimer();
    this.state.setStoryPlaying(false);
    this.state.setStory(before, this.clock.time(), this.state.motionPaused ? 0 : undefined);
    this.frameStory(before, true);
    return true;
  }

  /** Takes one of the choices a step offers: its story plays from here. */
  chooseStory(play: string): void {
    const cursor = this.state.story;
    if (cursor === null) return;
    this.playCursors(chooseStory(this.top, cursor, play, this.state.controls));
  }

  /** Plays the story on by itself, or stops it where it is. From the end, it starts again. */
  setStoryPlaying(playing: boolean): void {
    const cursor = this.state.story;
    if (!playing) {
      this.stopStoryTimer();
      this.state.setStoryPlaying(false);
      return;
    }
    const slide = this.slide;
    if (cursor === null) {
      if (slide === null) return;
      this.state.setPlaying(false);
      this.stopStoryTimer();
      this.state.setStoryPlaying(true);
      const run = this.storyRun;
      this.storyTimer = window.setTimeout(() => {
        if (run !== this.storyRun) return;
        this.leaveSlide();
      }, STILL_SLIDE * 1000);
      return;
    }
    this.state.setPlaying(false);
    if (slide !== null && slideEnded(this.top, slide, cursor, this.state.controls)) {
      // In a deck, playing from the end of a slide goes on to the next one.
      this.state.setStoryPlaying(true);
      this.leaveSlide();
      return;
    }
    if (!hasNext(this.top, cursor, this.state.controls)) this.openStory(cursor.story, 0);
    this.state.setStoryPlaying(true);
    this.nextBeat();
  }

  /**
   * Sets one of the diagram's controls (D-88). The story is where it was, played again with the
   * new setting, since a control can change which steps play.
   */
  setControl(name: string, value: Value): void {
    const story = this.state.story;
    this.state.setControl(name, value);
    if (story === null) return;
    this.stopStoryTimer();
    this.state.setStoryPlaying(false);
    const cursor = cursorAtBeat(this.top, story.story, beatsPlayed(story), this.state.controls);
    if (cursor !== null) this.state.setStory(cursor, this.clock.time(), 0);
  }

  /** How many beats of the story have played, for links and the progress dots. */
  get storyBeat(): number {
    const slide = this.slide;
    // In a deck, beats are counted within the slide's stretch.
    if (slide !== null) {
      const opening = slideOpening(this.top, slide, this.state.controls);
      return Math.max(0, beatsPlayed(this.state.story) - beatsPlayed(opening));
    }
    return beatsPlayed(this.state.story);
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
    const { path, element } = splitTarget(cursor.step, this.levels);
    const before = previous === null ? null : splitTarget(previous.step, this.levels);
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
      this.levels.resolve(this.state.levelPath, this.moment, others)?.elements.get(element)
        ?.state ?? "healthy"
    );
  }

  /** Picking the state the element already has from the scene clears the "what if". */
  chooseViewerState(element: string, state: StatePreset): void {
    this.setViewerState(element, state === this.baseStateOf(element) ? null : state);
  }

  /** Opens straight to a level, scene, tour step or card, without animation. */
  async applyDeepLink(link: DeepLink): Promise<void> {
    const top = this.levels.top.diagram;
    if (this.deck !== null) {
      this.openSlide();
      await this.fit(false);
      return;
    }
    if (link.scene !== null && top.scenes.some((s) => s.name === link.scene))
      this.state.setScene(link.scene, this.clock.time() - 10);
    // A diagram with a story opens at its beginning, or as far in as the link says.
    if (top.stories.length > 0)
      this.openStory(
        top.stories.some((story) => story.name === link.story)
          ? (link.story ?? undefined)
          : undefined,
        link.beat ?? 0,
        { instant: true },
      );
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
    const { levelPath, scene, openCard, tour, story } = this.state;
    const root = this.levels.root === "" ? null : this.levels.root;
    // In a deck, where someone is is a slide and how far into it.
    if (this.deck !== null)
      return {
        root: this.deck.folder === "" ? null : this.deck.folder,
        slide: this.deck.index + 1,
        level: [],
        scene: null,
        card: null,
        tour: null,
        step: null,
        story: null,
        beat: this.storyBeat,
      };
    if (tour !== null)
      return {
        root,
        slide: null,
        level: [],
        scene: null,
        card: null,
        tour: tour.tour,
        step: tour.step,
        story: null,
        beat: null,
      };
    // The first story from its opening is where every visit starts, so it isn't spelled out.
    const beat = beatsPlayed(story);
    const named = story !== null && (beat > 0 || story.story !== this.top.stories[0]?.name);
    return {
      root,
      slide: null,
      level: levelPath,
      scene,
      card: openCard,
      tour: null,
      step: null,
      story: named ? story.story : null,
      beat: named ? beat : null,
    };
  }
}

/** Keeps framing clear of an overlay along the bottom (it never shrinks the chrome's own room). */
function withReserved(insets: Insets, bottom: number): Insets {
  return bottom > insets.bottom ? { ...insets, bottom } : insets;
}
