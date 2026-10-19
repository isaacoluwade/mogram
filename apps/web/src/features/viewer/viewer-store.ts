import { createStore, type StoreApi } from "zustand/vanilla";
import type { ProjectFiles, SceneEntry } from "@mogram/core/model";
import type { Moment, StoryCursor } from "@mogram/core/picture";
import type { StatePreset } from "@mogram/core/presets";
import type { Value } from "@mogram/core/values";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import type { TourCursor } from "@mogram/core/tours";
import type { Camera, Viewport } from "@/features/canvas/camera";
import type { LevelZoomPlan } from "@/features/canvas/level-transition";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * State of one read-only viewer (share links, previews, present mode). The files never change
 * here; everything else is how the person is exploring them.
 */
export interface ViewerState {
  readonly files: ProjectFiles;
  /** The folder of the diagram being viewed ("" for the project's own). */
  readonly root: string;
  /** Which slide of its deck this is (D-99), so what depends on it draws again; -1 outside one. */
  readonly slide: number;
  /** Components opened from the top (NE-8). */
  readonly levelPath: readonly string[];
  /** Scenes always belong to the top diagram, which tells the story (NE-14). */
  readonly scene: string | null;
  /** How far into the top diagram's story the viewer is (D-86); null when it has none. */
  readonly story: StoryCursor | null;
  /** The moment being left while a change of scene or step animates. */
  readonly previous: Moment | null;
  readonly transitionStart: number | null;
  /** How long that change takes, in seconds. */
  readonly transitionSeconds: number;
  readonly playing: boolean;
  /** The story plays on by itself, beat after beat. */
  readonly storyPlaying: boolean;
  /** What the viewer has set the diagram's controls to (D-88); the rest are where they start. */
  readonly controls: ReadonlyMap<string, Value>;
  /** When the step showing began and how long it lasts: values run across it. */
  readonly ramp: { readonly start: number; readonly seconds: number } | null;
  readonly camera: Camera;
  readonly viewport: Viewport;
  /** Element whose card is open, at the current level. */
  readonly openCard: string | null;
  /** Element selected without a card (shows its quick info). */
  readonly inspected: string | null;
  readonly tour: TourCursor | null;
  /** Explore mode: the person moved away from the current tour step (TO-7). */
  readonly wandered: boolean;
  readonly present: boolean;
  /**
   * Record mode (D-99): presenting with nothing but the picture, for capturing a deck as it
   * plays. No bars, no buttons, no pointer, nothing to click.
   */
  readonly record: boolean;
  /** "What if" changes (SH-3), as paths from the top (`aks.checkout`). Never saved. */
  readonly viewerEntries: readonly SceneEntry[];
  /** Elements in focus (others fade) while a card, tour step or nested zoom is showing. */
  readonly focus: ReadonlySet<string> | null;
  /** Zooming through a component's tile into its nested diagram, or back out (NE-6). */
  readonly levelZoom: ViewerLevelZoom | null;
  /** True while the camera is being animated (ignore clicks that would fight it). */
  readonly animating: boolean;
  /** False until the first framing, so the diagram never flashes at the wrong place. */
  readonly ready: boolean;
  /** Pixels at the bottom covered by an overlay (present mode's start card): framing avoids them. */
  readonly reservedBottom: number;
  /** Traffic and other motion held still; starts true for reduced motion (PR-9). */
  readonly motionPaused: boolean;
}

export interface ViewerActions {
  setCamera(camera: Camera): void;
  setViewport(viewport: Viewport): void;
  setScene(scene: string | null, now: number): void;
  /** Moves to another place in the story; the picture changes over `seconds` (0 = at once). */
  setStory(story: StoryCursor | null, now: number, seconds?: number, hold?: number): void;
  setControl(name: string, value: Value): void;
  settleTransition(): void;
  setPlaying(playing: boolean): void;
  setStoryPlaying(playing: boolean): void;
  setSlide(slide: number): void;
  setLevel(path: readonly string[]): void;
  setOpenCard(name: string | null): void;
  setInspected(name: string | null): void;
  setTour(cursor: TourCursor | null): void;
  setWandered(wandered: boolean): void;
  setPresent(present: boolean): void;
  setRecord(record: boolean): void;
  setViewerState(target: string, state: StatePreset | null): void;
  resetViewerState(): void;
  setFocus(focus: ReadonlySet<string> | null): void;
  setLevelZoom(zoom: ViewerLevelZoom | null): void;
  setAnimating(animating: boolean): void;
  setReady(): void;
  setReservedBottom(pixels: number): void;
  setMotionPaused(paused: boolean): void;
}

export type ViewerStore = StoreApi<ViewerState & ViewerActions>;

/** A nested zoom under way, and what to do on its last frame (switch level and camera). */
export type ViewerLevelZoom = LevelZoomPlan & { readonly finish: () => void };

export function createViewerStore(
  files: ProjectFiles,
  present: boolean,
  root = "",
  record = false,
): ViewerStore {
  return createStore<ViewerState & ViewerActions>()((set, get) => ({
    files,
    root,
    slide: -1,
    levelPath: [],
    scene: null,
    story: null,
    previous: null,
    transitionStart: null,
    transitionSeconds: SCENE_TRANSITION,
    playing: false,
    storyPlaying: false,
    controls: new Map(),
    ramp: null,
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1200, height: 800 },
    openCard: null,
    inspected: null,
    tour: null,
    wandered: false,
    present: present || record,
    record,
    viewerEntries: [],
    focus: null,
    levelZoom: null,
    animating: false,
    ready: false,
    reservedBottom: 0,
    motionPaused: prefersReducedMotion(),

    setCamera: (camera) => set({ camera }),
    setViewport: (viewport) => set({ viewport }),
    setScene: (scene, now) => {
      const state = get();
      if (scene === state.scene) return;
      set({
        previous: { scene: state.scene, story: state.story, controls: state.controls },
        scene,
        transitionStart: now,
        transitionSeconds: SCENE_TRANSITION,
      });
    },
    setStory: (story, now, seconds = SCENE_TRANSITION, hold = 0) => {
      const state = get();
      if (story === state.story) return;
      if (seconds <= 0) set({ story, previous: null, transitionStart: null, ramp: null });
      else
        set({
          previous: { scene: state.scene, story: state.story, controls: state.controls },
          story,
          transitionStart: now,
          transitionSeconds: seconds,
          ramp: { start: now, seconds: seconds + hold },
        });
    },
    setControl: (name, value) => {
      const controls = new Map(get().controls);
      controls.set(name, value);
      set({ controls });
    },
    settleTransition: () => set({ previous: null, transitionStart: null }),
    setPlaying: (playing) => set({ playing }),
    setSlide: (slide) => set({ slide }),
    setStoryPlaying: (storyPlaying) => {
      if (get().storyPlaying !== storyPlaying) set({ storyPlaying });
    },
    setLevel: (levelPath) => set({ levelPath, openCard: null, inspected: null }),
    setOpenCard: (openCard) => set({ openCard, inspected: null }),
    setInspected: (inspected) => set({ inspected, openCard: null }),
    setTour: (tour) => set({ tour, wandered: false }),
    setWandered: (wandered) => {
      if (get().wandered !== wandered) set({ wandered });
    },
    // Recording is a way of presenting: leaving present mode leaves it too.
    setPresent: (present) => set(present ? { present } : { present, record: false }),
    setRecord: (record) => set(record ? { record, present: true } : { record }),
    setMotionPaused: (motionPaused) => set({ motionPaused }),
    setReservedBottom: (pixels) => {
      if (get().reservedBottom !== pixels) set({ reservedBottom: pixels });
    },
    setViewerState: (target, state) => {
      const others = get().viewerEntries.filter((entry) => entry.target !== target);
      set({ viewerEntries: state === null ? others : [...others, viewerEntry(target, state)] });
    },
    resetViewerState: () => set({ viewerEntries: [] }),
    setFocus: (focus) => set({ focus }),
    setLevelZoom: (levelZoom) => set({ levelZoom }),
    setAnimating: (animating) => {
      if (get().animating !== animating) set({ animating });
    },
    setReady: () => set({ ready: true }),
  }));
}

function viewerEntry(target: string, state: StatePreset): SceneEntry {
  return { target, state, flow: null, motion: null, source: { file: "", line: 0 } };
}
