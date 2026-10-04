import { createStore, type StoreApi } from "zustand/vanilla";
import { diagramFileSet, parseDiagram, type ParseResult } from "@mogram/core/format";
import type { Box, Point } from "@mogram/core/layout";
import type { Diagram, GridPoint, GridSize, ProjectFiles, SceneEntry } from "@mogram/core/model";
import { EditError, type EditResult } from "@mogram/core/edit";
import { followLevels, type Level } from "@mogram/core/nested";
import type { TourCursor } from "@mogram/core/tours";
import type { Camera } from "@/features/canvas/camera";
import type { LevelZoomPlan } from "@/features/canvas/level-transition";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Editor state (one store per editor instance — engineering standards §4.6).
 *
 * The YAML files are the document (D-4). Everything visual is derived from them. Gestures keep
 * their in-progress state here (drag offset, resize box, connection draft) and only write YAML
 * when the gesture ends, so one gesture is one undo step and one small diff.
 */

export type Tool = "select" | "hand" | "connect" | "container" | "zone" | "text" | "note" | "label";

export type PanelId = "library" | "inspector" | "code" | "tours";

export type DialogId = "export" | "share" | "shortcuts" | "history" | "open" | "settings";

export type SaveStatus =
  | { readonly kind: "saved"; readonly at: number }
  | { readonly kind: "saving" }
  | { readonly kind: "unsaved" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "conflict"; readonly currentVersion: number };

export interface DragPreview {
  readonly names: readonly string[];
  readonly dx: number;
  readonly dy: number;
  /** Container the drop would land in, highlighted while dragging. */
  readonly target: string | null;
}

export interface ResizePreview {
  readonly name: string;
  readonly at: GridPoint;
  readonly size: GridSize;
}

export interface ConnectDraft {
  readonly from: string;
  readonly pointer: Point;
  readonly target: string | null;
}

export interface BendPreview {
  readonly connection: string;
  /** Waypoints in absolute pixels. */
  readonly via: readonly Point[];
}

interface Snapshot {
  readonly files: ProjectFiles;
  readonly selection: readonly string[];
  readonly label: string;
  readonly at: number;
  /** The typing session that made this step, if any (see `startTyping`). */
  readonly typing?: string;
}

export interface EditorState {
  // Document
  readonly files: ProjectFiles;
  /** Folder of the diagram being edited (nested levels open sub-folders, NE-1). */
  readonly folder: string;
  /** Components opened from the top, for breadcrumbs (NE-8). */
  readonly levelPath: readonly string[];
  readonly past: readonly Snapshot[];
  readonly future: readonly Snapshot[];

  // Selection and tools
  readonly selection: readonly string[];
  readonly hovered: string | null;
  readonly tool: Tool;
  readonly camera: Camera;
  readonly viewport: { readonly width: number; readonly height: number };

  // Scenes and motion (SC-6 … SC-9, PR-9)
  readonly scene: string | null;
  readonly previousScene: string | null;
  readonly transitionStart: number | null;
  readonly playing: boolean;
  readonly motionPaused: boolean;
  readonly showGrid: boolean;

  // Panels
  readonly panels: Readonly<Record<PanelId, boolean>>;
  /** The inspector was open when code or tours took its place, so closing them brings it back. */
  readonly inspectorBehind: boolean;
  readonly codeFile: string | null;

  // Gestures in progress
  readonly drag: DragPreview | null;
  readonly resize: ResizePreview | null;
  readonly connect: ConnectDraft | null;
  readonly marquee: Box | null;
  readonly bend: BendPreview | null;
  readonly editingLabel: string | null;
  /** Zooming into a nested diagram or back out; the canvas waits until it has finished. */
  readonly levelZoom: EditorLevelZoom | null;

  // Explanation (preview inside the editor)
  readonly openCard: string | null;
  readonly tour: TourCursor | null;
  readonly tourAuthoring: string | null;

  // Viewer changes made while previewing (SH-3)
  readonly viewerEntries: readonly SceneEntry[];

  readonly dialog: DialogId | null;

  // Persistence
  readonly save: SaveStatus;
  /** Set while the document is being handed over (e.g. uploaded); edits wait until it clears. */
  readonly busy: string | null;
  /**
   * The text field being typed in, if any. A field saves as it is typed in; every save of one
   * visit to the field becomes one undo step.
   */
  readonly typing: string | null;
  readonly message: {
    readonly id: number;
    readonly text: string;
    readonly tone: "error" | "info";
  } | null;
}

export interface EditorActions {
  /** Parsed diagram at the current level (cached per files object). */
  parsed(): ParseResult;
  diagram(): Diagram;
  /** Runs a core edit command; failures become a message instead of an exception. */
  edit(
    label: string,
    run: (files: ProjectFiles, diagram: Diagram) => EditResult,
    options?: { coalesce?: boolean },
  ): boolean;
  /** Replaces files from the code editor or an import (one undo step). */
  /**
   * Replaces the files as one undo step. `typed` marks text typed over the current files (the
   * code panel): while it doesn't parse, the canvas keeps showing the last version that did.
   */
  replaceFiles(files: ProjectFiles, label: string, options?: { readonly typed?: boolean }): void;
  undo(): void;
  redo(): void;
  select(names: readonly string[], mode?: "replace" | "add" | "toggle"): void;
  setHovered(name: string | null): void;
  setTool(tool: Tool): void;
  setCamera(camera: Camera): void;
  setViewport(viewport: { width: number; height: number }): void;
  setScene(scene: string | null, now: number): void;
  settleTransition(): void;
  setPlaying(playing: boolean): void;
  setMotionPaused(paused: boolean): void;
  toggleGrid(): void;
  togglePanel(panel: PanelId, open?: boolean): void;
  setCodeFile(path: string | null): void;
  setDrag(drag: DragPreview | null): void;
  setResize(resize: ResizePreview | null): void;
  setConnect(connect: ConnectDraft | null): void;
  setMarquee(marquee: Box | null): void;
  setBend(bend: BendPreview | null): void;
  setEditingLabel(name: string | null): void;
  setLevelZoom(zoom: EditorLevelZoom | null): void;
  openLevel(component: string, folder: string): void;
  closeLevel(depth?: number): void;
  setOpenCard(name: string | null): void;
  setTour(cursor: TourCursor | null): void;
  setTourAuthoring(tour: string | null): void;
  setViewerEntries(entries: readonly SceneEntry[]): void;
  setSave(save: SaveStatus): void;
  setBusy(busy: string | null): void;
  /** A text field took focus: its saves from now on merge into one undo step. */
  startTyping(session: string): void;
  /** The field lost focus; later edits are separate steps again. */
  stopTyping(session: string): void;
  /** Undoes what this typing session saved (Escape in the field). False if it saved nothing. */
  revertTyping(session: string): boolean;
  setDialog(dialog: DialogId | null): void;
  notify(text: string, tone?: "error" | "info"): void;
}

export type EditorStore = StoreApi<EditorState & EditorActions>;

const HISTORY_LIMIT = 150;
/** Below this canvas width only one side panel is open at a time. */
export const NARROW_WIDTH = 1100;
const COALESCE_MS = 600;

const parseCache = new WeakMap<ProjectFiles, Map<string, ParseResult>>();
const shownCache = new WeakMap<ProjectFiles, Map<string, ParseResult>>();
/** Which files each set was typed from, so a half-typed edit can show the last one that parsed. */
const typedFrom = new WeakMap<ProjectFiles, ProjectFiles>();
const LINEAGE_LIMIT = 200;

function cached(
  cache: WeakMap<ProjectFiles, Map<string, ParseResult>>,
  files: ProjectFiles,
  folder: string,
  compute: () => ParseResult,
): ParseResult {
  let byFolder = cache.get(files);
  if (byFolder === undefined) {
    byFolder = new Map();
    cache.set(files, byFolder);
  }
  let result = byFolder.get(folder);
  if (result === undefined) {
    result = compute();
    byFolder.set(folder, result);
  }
  return result;
}

/** Exactly what the files say (an unreadable file contributes nothing). */
export function parseExact(files: ProjectFiles, folder: string): ParseResult {
  return cached(parseCache, files, folder, () => parseDiagram(files, folder));
}

/**
 * The diagram to show. While YAML typed in the code panel doesn't parse yet, this keeps the
 * last version that did (with the current problems), so the canvas doesn't blank out mid-word.
 * `brokenFiles` stays set, and the store refuses canvas edits until the YAML is fixed.
 */
export function parseCached(files: ProjectFiles, folder: string): ParseResult {
  return cached(shownCache, files, folder, () => {
    const exact = parseExact(files, folder);
    if (exact.brokenFiles.length === 0) return exact;
    let earlier = typedFrom.get(files);
    for (let step = 0; earlier !== undefined && step < LINEAGE_LIMIT; step++) {
      const candidate = parseExact(earlier, folder);
      if (candidate.brokenFiles.length === 0) return { ...exact, diagram: candidate.diagram };
      earlier = typedFrom.get(earlier);
    }
    return exact;
  });
}

/** The nested levels along `path` (NE-8), read through the parse cache above. */
/** The diagram whose scenes tell the story at every level: the top one (NE-14, D-23). */
export function storyDiagram(files: ProjectFiles): Diagram {
  return parseCached(files, "").diagram;
}

/** How a scene names an element at a level: `aks.checkout` for `checkout` inside `aks` (SC-10). */
export function sceneTarget(levelPath: readonly string[], name: string): string {
  return [...levelPath, name].join(".");
}

export function levelsAlong(files: ProjectFiles, path: readonly string[]): Level[] {
  return followLevels(
    {
      has: (folder) => diagramFileSet(files, folder) !== null,
      load: (folder) => parseCached(files, folder),
    },
    path,
  );
}

/** A nested zoom under way, and what to do when it lands (switch level, set the camera). */
export type EditorLevelZoom = LevelZoomPlan & { readonly finish: () => void };

export interface EditorInit {
  readonly files: ProjectFiles;
  readonly panels?: Partial<Record<PanelId, boolean>>;
  readonly save?: SaveStatus;
}

let messageId = 0;

export function createEditorStore(init: EditorInit): EditorStore {
  return createStore<EditorState & EditorActions>()((set, get) => ({
    files: init.files,
    folder: "",
    levelPath: [],
    past: [],
    future: [],
    selection: [],
    hovered: null,
    tool: "select",
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1200, height: 800 },
    scene: null,
    previousScene: null,
    transitionStart: null,
    playing: false,
    // Reduced-motion users start paused; the motion button plays it if they want (PR-9).
    motionPaused: prefersReducedMotion(),
    showGrid: false,
    panels: { library: true, inspector: true, code: false, tours: false, ...init.panels },
    inspectorBehind: false,
    codeFile: null,
    drag: null,
    resize: null,
    connect: null,
    marquee: null,
    bend: null,
    editingLabel: null,
    levelZoom: null,
    openCard: null,
    tour: null,
    tourAuthoring: null,
    viewerEntries: [],
    dialog: null,
    save: init.save ?? { kind: "saved", at: 0 },
    busy: null,
    typing: null,
    message: null,

    parsed: () => parseCached(get().files, get().folder),
    diagram: () => get().parsed().diagram,

    edit: (label, run, options) => {
      const state = get();
      if (state.busy !== null) return false;
      // The canvas may be showing the last version that parsed: editing it would write to
      // files that no longer match. The YAML has to be fixed first.
      const broken = parseExact(state.files, state.folder).brokenFiles[0];
      if (broken !== undefined) {
        get().notify(`Fix the YAML in ${broken} first, then keep editing on the canvas.`, "error");
        return false;
      }
      let result: EditResult;
      try {
        result = run(state.files, state.diagram());
      } catch (error) {
        if (error instanceof EditError) {
          get().notify(error.message, "error");
          return false;
        }
        throw error;
      }
      const changed =
        Object.keys(result.files).length !== Object.keys(state.files).length ||
        Object.entries(result.files).some(([path, text]) => state.files[path] !== text);
      if (!changed) {
        if (result.select !== undefined) set({ selection: result.select });
        return true;
      }
      const now = Date.now();
      const last = state.past[state.past.length - 1];
      const typing = state.typing ?? undefined;
      const coalesce =
        last !== undefined &&
        ((typing !== undefined && last.typing === typing) ||
          (options?.coalesce === true && last.label === label && now - last.at < COALESCE_MS));
      const snapshot: Snapshot = {
        files: state.files,
        selection: state.selection,
        label,
        at: now,
        ...(typing === undefined ? {} : { typing }),
      };
      const past = coalesce
        ? [...state.past.slice(0, -1), { ...last, at: now }]
        : [...state.past, snapshot].slice(-HISTORY_LIMIT);
      set({
        files: result.files,
        past,
        future: [],
        selection:
          result.select ??
          state.selection.filter((name) => existsIn(result.files, state.folder, name)),
        save: dirty(state.save),
      });
      return true;
    },

    replaceFiles: (files, label, options) => {
      const state = get();
      if (state.busy !== null) return;
      if (files === state.files) return;
      if (options?.typed === true && !typedFrom.has(files)) typedFrom.set(files, state.files);
      set({
        files,
        past: [
          ...state.past,
          { files: state.files, selection: state.selection, label, at: Date.now() },
        ].slice(-HISTORY_LIMIT),
        future: [],
        selection: state.selection.filter((name) => existsIn(files, state.folder, name)),
        save: dirty(state.save),
      });
    },

    undo: () => {
      const state = get();
      if (state.busy !== null) return;
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return;
      set({
        files: previous.files,
        selection: previous.selection,
        past: state.past.slice(0, -1),
        future: [
          { files: state.files, selection: state.selection, label: previous.label, at: Date.now() },
          ...state.future,
        ],
        save: dirty(state.save),
      });
    },

    redo: () => {
      const state = get();
      if (state.busy !== null) return;
      const next = state.future[0];
      if (next === undefined) return;
      set({
        files: next.files,
        selection: next.selection,
        future: state.future.slice(1),
        past: [
          ...state.past,
          { files: state.files, selection: state.selection, label: next.label, at: Date.now() },
        ],
        save: dirty(state.save),
      });
    },

    select: (names, mode = "replace") => {
      const current = get().selection;
      if (mode === "replace") set({ selection: [...new Set(names)] });
      else if (mode === "add") set({ selection: [...new Set([...current, ...names])] });
      else {
        const next = new Set(current);
        for (const name of names) {
          if (next.has(name)) next.delete(name);
          else next.add(name);
        }
        set({ selection: [...next] });
      }
    },
    setHovered: (hovered) => {
      if (get().hovered !== hovered) set({ hovered });
    },
    setTool: (tool) => set({ tool, connect: null }),
    setCamera: (camera) => set({ camera }),
    setViewport: (viewport) => set({ viewport }),
    setScene: (scene, now) => {
      const state = get();
      if (scene === state.scene) return;
      set({ previousScene: state.scene, scene, transitionStart: now, viewerEntries: [] });
    },
    settleTransition: () => set({ previousScene: null, transitionStart: null }),
    setPlaying: (playing) => set({ playing }),
    setMotionPaused: (motionPaused) => set({ motionPaused }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    togglePanel: (panel, open) => {
      const { panels: current, viewport } = get();
      let { inspectorBehind } = get();
      const panels = { ...current };
      const next = open ?? !panels[panel];
      panels[panel] = next;
      const covers = panel === "code" || panel === "tours";
      if (next && covers && current.inspector) inspectorBehind = true;
      if (panel === "inspector") inspectorBehind = false;
      // The right column shows one of inspector / code / tours at a time.
      if (next && panel !== "library") {
        for (const other of ["inspector", "code", "tours"] as const)
          if (other !== panel) panels[other] = false;
      }
      // On narrow screens the canvas needs the room: one side panel at a time.
      const narrow = viewport.width < NARROW_WIDTH;
      if (next && narrow) {
        for (const other of ["library", "inspector", "code", "tours"] as const)
          if (other !== panel) panels[other] = false;
      }
      // Closing code or tours uncovers the inspector, where there's room for it.
      if (!next && covers && inspectorBehind && !panels.code && !panels.tours) {
        inspectorBehind = false;
        if (!narrow || !panels.library) panels.inspector = true;
      }
      if (panel === "library" && next && narrow) inspectorBehind = false;
      set({ panels, inspectorBehind });
    },
    setCodeFile: (codeFile) => set({ codeFile }),
    setDrag: (drag) => set({ drag }),
    setResize: (resize) => set({ resize }),
    setConnect: (connect) => set({ connect }),
    setMarquee: (marquee) => set({ marquee }),
    setBend: (bend) => set({ bend }),
    setEditingLabel: (editingLabel) => set({ editingLabel }),
    setLevelZoom: (levelZoom) => set({ levelZoom }),
    // The scene carries on inside: scenes belong to the top diagram and reach every level.
    openLevel: (component, folder) =>
      set({
        folder,
        levelPath: [...get().levelPath, component],
        selection: [],
        openCard: null,
        drag: null,
        previousScene: null,
        transitionStart: null,
      }),
    closeLevel: (depth) => {
      const state = get();
      const target = depth ?? state.levelPath.length - 1;
      if (target < 0 || target >= state.levelPath.length) return;
      const path = state.levelPath.slice(0, target);
      const folder = levelsAlong(state.files, path).at(-1)?.folder ?? "";
      set({
        folder,
        levelPath: path,
        selection: [state.levelPath[target] ?? ""].filter((n) => n.length > 0),
        openCard: null,
        previousScene: null,
        transitionStart: null,
      });
    },
    setOpenCard: (openCard) => set({ openCard }),
    setTour: (tour) => set({ tour }),
    setTourAuthoring: (tourAuthoring) => set({ tourAuthoring }),
    setViewerEntries: (viewerEntries) => set({ viewerEntries }),
    setSave: (save) => set({ save }),
    setBusy: (busy) => set({ busy }),
    startTyping: (session) => set({ typing: session }),
    stopTyping: (session) => {
      if (get().typing === session) set({ typing: null });
    },
    revertTyping: (session) => {
      const last = get().past.at(-1);
      if (last?.typing !== session) return false;
      get().undo();
      return true;
    },
    setDialog: (dialog) => set({ dialog }),
    notify: (text, tone = "info") => set({ message: { id: ++messageId, text, tone } }),
  }));
}

/** A change marks the document unsaved, except while a save conflict waits for a decision. */
function dirty(save: SaveStatus): SaveStatus {
  return save.kind === "conflict" ? save : { kind: "unsaved" };
}

function existsIn(files: ProjectFiles, folder: string, name: string): boolean {
  const { diagram } = parseCached(files, folder);
  return (
    diagram.components.has(name) ||
    diagram.containers.has(name) ||
    diagram.groups.has(name) ||
    diagram.connections.has(name) ||
    diagram.decorations.has(name)
  );
}
