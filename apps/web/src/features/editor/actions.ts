import {
  addComponent,
  addConnection,
  addContainer,
  addDecoration,
  addGroup,
  copySnippet,
  deleteElements,
  isMogramSnippet,
  moveElements,
  pasteSnippet,
  planZOrder,
  reorderZ,
  setSceneEntry,
  updateElement,
  type Move,
  type ZOrderMove,
} from "@mogram/core/edit";
import {
  CONTAINER_UNITS,
  GRID,
  computeLayout,
  descendantsOf,
  toUnits,
  type Box,
  type LayoutResult,
  type Point,
} from "@mogram/core/layout";
import type { Diagram, SceneEntry, Tone } from "@mogram/core/model";
import { NOTE_SIZE } from "@mogram/core/presets";
import type {
  ContainerStyleName,
  FlowPreset,
  MotionPreset,
  StatePreset,
} from "@mogram/core/presets";
import {
  clampZoom,
  fitBox,
  PHONE_MIN_ZOOM,
  PHONE_WIDTH,
  zoomAt,
  type Camera,
} from "@/features/canvas/camera";
import { STUB_ROOM } from "@/features/canvas/svg/stubs";
import { clearOf, PANEL } from "./panel-sizes";
import { parseCached, sceneTarget, storyDiagram, type EditorStore } from "./store/editor-store";

/**
 * Editor operations shared by shortcuts, menus, the toolbar and the inspector. Each one is a
 * single undo step and writes YAML through @mogram/core/edit.
 */

/** Chrome that floats over the canvas, kept clear when fitting the view. */
/** Room the desktop chrome takes around the canvas: top bars, open side panels, bottom dock. */
export const CANVAS_INSETS = {
  top: 76,
  right: clearOf(PANEL.right),
  bottom: 128,
  left: clearOf(PANEL.library),
} as const;

const clipboard = { text: "" };

export function layoutOf(store: EditorStore): LayoutResult {
  return computeLayout(store.getState().diagram());
}

/** The innermost container whose box contains `point`, skipping `exclude` and its contents. */
export function containerAt(
  layout: LayoutResult,
  point: Point,
  exclude: ReadonlySet<string> = new Set(),
): string | null {
  let best: { name: string; depth: number } | null = null;
  for (const element of layout.elements.values()) {
    if (element.kind !== "container" || exclude.has(element.name)) continue;
    let ancestor = element.parent;
    let excluded = false;
    while (ancestor !== null) {
      if (exclude.has(ancestor)) excluded = true;
      ancestor = layout.elements.get(ancestor)?.parent ?? null;
    }
    if (excluded) continue;
    const { box } = element;
    if (
      point.x >= box.x &&
      point.x <= box.x + box.w &&
      point.y >= box.y &&
      point.y <= box.y + box.h
    ) {
      if (best === null || element.depth > best.depth)
        best = { name: element.name, depth: element.depth };
    }
  }
  return best?.name ?? null;
}

/** Position of `topLeft` (pixels) relative to `parent`, in whole grid units, kept below the header. */
export function relativeTo(
  layout: LayoutResult,
  parent: string | null,
  topLeft: Point,
): { x: number; y: number } {
  const origin =
    parent === null ? { x: 0, y: 0 } : (layout.elements.get(parent)?.box ?? { x: 0, y: 0 });
  const x = toUnits(topLeft.x - origin.x);
  const y = toUnits(topLeft.y - origin.y);
  if (parent === null) return { x, y };
  return { x: Math.max(1, x), y: Math.max(CONTAINER_UNITS.header, y) };
}

/** Selected elements whose ancestors aren't also selected (moving a parent moves its children). */
export function topLevelSelection(layout: LayoutResult, selection: readonly string[]): string[] {
  const set = new Set(selection);
  return selection.filter((name) => {
    let parent = layout.elements.get(name)?.parent ?? null;
    while (parent !== null) {
      if (set.has(parent)) return false;
      parent = layout.elements.get(parent)?.parent ?? null;
    }
    return layout.elements.has(name);
  });
}

export function deleteSelection(store: EditorStore): void {
  const state = store.getState();
  const { selection } = state;
  if (selection.length === 0) return;
  // Deleting a container takes everything inside it too: say so, since undo is the way back.
  const layout = layoutOf(store);
  const inside = new Set(
    selection
      .filter((name) => layout.elements.get(name)?.kind === "container")
      .flatMap((name) => descendantsOf(layout, name))
      .filter((name) => !selection.includes(name)),
  );
  const deleted = state.edit("Delete", (files, diagram) =>
    deleteElements(files, diagram, selection),
  );
  if (deleted && inside.size > 0)
    state.notify(
      `Deleted with ${inside.size} thing${inside.size === 1 ? "" : "s"} inside. Undo brings ${inside.size === 1 ? "it" : "them"} back.`,
    );
}

export async function copySelection(store: EditorStore): Promise<boolean> {
  const state = store.getState();
  const layout = layoutOf(store);
  const positions = new Map([...layout.elements].map(([name, element]) => [name, element.rel]));
  const text = copySnippet(state.diagram(), state.selection, positions);
  if (text.length === 0) return false;
  clipboard.text = text;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard permission can be denied; the in-app clipboard still works.
  }
  return true;
}

export async function cutSelection(store: EditorStore): Promise<void> {
  if (await copySelection(store)) deleteSelection(store);
}

export async function paste(store: EditorStore, at: Point | null): Promise<void> {
  let text = clipboard.text;
  try {
    const system = await navigator.clipboard.readText();
    if (isMogramSnippet(system)) text = system;
  } catch {
    // Fall back to the in-app clipboard.
  }
  if (text.length === 0) return;
  const layout = layoutOf(store);
  const point = at ?? viewportCenter(store);
  const parent = containerAt(layout, point);
  const rel = relativeTo(layout, parent, { x: point.x - 48, y: point.y - 48 });
  store
    .getState()
    .edit("Paste", (files, diagram) => pasteSnippet(files, diagram, { text, parent, at: rel }));
}

export function duplicateSelection(store: EditorStore): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const top = topLevelSelection(layout, state.selection);
  const first = top[0] === undefined ? undefined : layout.elements.get(top[0]);
  if (first === undefined) return;
  const positions = new Map([...layout.elements].map(([name, element]) => [name, element.rel]));
  const text = copySnippet(state.diagram(), top, positions);
  if (text.length === 0) return;
  const at = { x: first.rel.x + 3, y: first.rel.y + 3 };
  state.edit("Duplicate", (files, diagram) =>
    pasteSnippet(files, diagram, { text, parent: first.parent, at }),
  );
}

export function nudge(store: EditorStore, dx: number, dy: number): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const moves: Move[] = [];
  for (const name of topLevelSelection(layout, state.selection)) {
    const element = layout.elements.get(name);
    if (element === undefined) continue;
    moves.push({
      name,
      parent: element.parent,
      at: { x: element.rel.x + dx, y: element.rel.y + dy },
    });
  }
  if (moves.length > 0)
    state.edit("Nudge", (files, diagram) => moveElements(files, diagram, moves), {
      coalesce: true,
    });
}

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** Align selected elements (ED-6) using their absolute boxes. */
export function align(store: EditorStore, mode: AlignMode): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const elements = topLevelSelection(layout, state.selection)
    .map((name) => layout.elements.get(name))
    .filter((element) => element !== undefined);
  if (elements.length < 2) return;
  const left = Math.min(...elements.map((e) => e.box.x));
  const right = Math.max(...elements.map((e) => e.box.x + e.box.w));
  const top = Math.min(...elements.map((e) => e.box.y));
  const bottom = Math.max(...elements.map((e) => e.box.y + e.box.h));
  const moves: Move[] = elements.map((element) => {
    const { box } = element;
    let x = box.x;
    let y = box.y;
    if (mode === "left") x = left;
    if (mode === "right") x = right - box.w;
    if (mode === "center") x = (left + right) / 2 - box.w / 2;
    if (mode === "top") y = top;
    if (mode === "bottom") y = bottom - box.h;
    if (mode === "middle") y = (top + bottom) / 2 - box.h / 2;
    return {
      name: element.name,
      parent: element.parent,
      at: relativeTo(layout, element.parent, { x, y }),
    };
  });
  state.edit(`Align ${mode}`, (files, diagram) => moveElements(files, diagram, moves));
}

/** Even spacing along an axis (ED-6). */
export function distribute(store: EditorStore, axis: "horizontal" | "vertical"): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const elements = topLevelSelection(layout, state.selection)
    .map((name) => layout.elements.get(name))
    .filter((element) => element !== undefined)
    .sort((a, b) => (axis === "horizontal" ? a.box.x - b.box.x : a.box.y - b.box.y));
  if (elements.length < 3) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (first === undefined || last === undefined) return;
  const span =
    axis === "horizontal"
      ? last.box.x + last.box.w - first.box.x
      : last.box.y + last.box.h - first.box.y;
  const sizes = elements.reduce(
    (total, e) => total + (axis === "horizontal" ? e.box.w : e.box.h),
    0,
  );
  const gap = (span - sizes) / (elements.length - 1);
  let cursor = axis === "horizontal" ? first.box.x : first.box.y;
  const moves: Move[] = elements.map((element) => {
    const point =
      axis === "horizontal" ? { x: cursor, y: element.box.y } : { x: element.box.x, y: cursor };
    cursor += (axis === "horizontal" ? element.box.w : element.box.h) + gap;
    return {
      name: element.name,
      parent: element.parent,
      at: relativeTo(layout, element.parent, point),
    };
  });
  state.edit(`Distribute ${axis}`, (files, diagram) => moveElements(files, diagram, moves));
}

/** Whether a z-order move would change anything for the selection (menus disable it if not). */
export function canZOrder(store: EditorStore, move: ZOrderMove): boolean {
  const { selection, diagram } = store.getState();
  return planZOrder(diagram(), selection, move).size > 0;
}

export function zOrder(store: EditorStore, move: ZOrderMove): void {
  const { selection } = store.getState();
  // Already in front (or nothing to stack against): no edit, so no empty undo step.
  if (selection.length === 0 || !canZOrder(store, move)) return;
  const label = {
    front: "Bring to front",
    back: "Send to back",
    forward: "Bring forward",
    backward: "Send backward",
  }[move];
  store
    .getState()
    .edit(label, (files, diagram) => reorderZ(files, diagram, { names: selection, move }));
}

export function groupSelection(store: EditorStore): void {
  const state = store.getState();
  const diagram = state.diagram();
  const members = state.selection.filter(
    (name) => diagram.components.has(name) || diagram.containers.has(name),
  );
  if (members.length === 0) {
    state.notify("Select the components the group should surround first.", "error");
    return;
  }
  state.edit("Group", (files, d) => addGroup(files, d, { members, label: "Group" }));
}

export function viewportCenter(store: EditorStore): Point {
  const { camera, viewport } = store.getState();
  return {
    x: (viewport.width / 2 - camera.x) / camera.zoom,
    y: (viewport.height / 2 - camera.y) / camera.zoom,
  };
}

/** Adds a component from the library (ED-2), centred on `at` (or the middle of the view). */
export function addComponentAt(
  store: EditorStore,
  type: string,
  label: string,
  at: Point | null,
): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const point = at ?? viewportCenter(store);
  const selected = state.selection.length === 1 ? state.selection[0] : undefined;
  const parent =
    at === null && selected !== undefined && layout.elements.get(selected)?.kind === "container"
      ? selected
      : containerAt(layout, point);
  const rel = relativeTo(layout, parent, { x: point.x - 48, y: point.y - 48 });
  state.edit(`Add ${label}`, (files, diagram) =>
    addComponent(files, diagram, { type, label, parent, at: rel }),
  );
}

export function addContainerBox(
  store: EditorStore,
  type: ContainerStyleName,
  label: string,
  box: Box,
): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const parent = containerAt(layout, { x: box.x + 4, y: box.y + 4 });
  const rel = relativeTo(layout, parent, box);
  const size = {
    w: Math.max(CONTAINER_UNITS.minW, toUnits(box.w)),
    h: Math.max(CONTAINER_UNITS.minH, toUnits(box.h)),
  };
  state.edit(`Add ${label}`, (files, diagram) =>
    addContainer(files, diagram, { type, label, parent, at: rel, size }),
  );
}

export function addZoneBox(store: EditorStore, box: Box, tone: Tone = "amber"): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const parent = containerAt(layout, { x: box.x + 4, y: box.y + 4 });
  const at = relativeTo(layout, parent, box);
  const size = { w: Math.max(4, toUnits(box.w)), h: Math.max(3, toUnits(box.h)) };
  state.edit("Add highlight zone", (files, diagram) =>
    addDecoration(files, diagram, { variant: "zone", text: "Highlight", size, tone, at, parent }),
  );
}

export function addTextAt(store: EditorStore, variant: "text" | "label", at: Point): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const parent = containerAt(layout, at);
  const rel = relativeTo(layout, parent, at);
  const ok = state.edit(variant === "text" ? "Add text" : "Add label", (files, diagram) =>
    variant === "text"
      ? addDecoration(files, diagram, {
          variant: "text",
          text: "Text",
          style: "heading",
          at: rel,
          parent,
        })
      : addDecoration(files, diagram, {
          variant: "label",
          text: "Label",
          tone: "neutral",
          at: rel,
          parent,
        }),
  );
  const created = store.getState().selection[0];
  if (ok && created !== undefined) store.getState().setEditingLabel(created);
}

/** Places a sticky note centred on `at`, and opens it for typing (ED-25). */
export function addNoteAt(store: EditorStore, at: Point): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const corner = {
    x: at.x - (NOTE_SIZE.w * GRID) / 2,
    y: at.y - (NOTE_SIZE.h * GRID) / 2,
  };
  const parent = containerAt(layout, at);
  const rel = relativeTo(layout, parent, corner);
  const ok = state.edit("Add sticky note", (files, diagram) =>
    addDecoration(files, diagram, {
      variant: "note",
      text: "",
      size: { ...NOTE_SIZE },
      at: rel,
      parent,
    }),
  );
  const created = store.getState().selection[0];
  if (ok && created !== undefined) store.getState().setEditingLabel(created);
}

export function connect(store: EditorStore, from: string, to: string): void {
  if (from === to) return;
  store
    .getState()
    .edit("Connect", (files, diagram) =>
      addConnection(files, diagram, { from, to, flow: "traffic" }),
    );
}

/**
 * Where a scene choice is written: the top diagram's scene, which reaches every level, naming an
 * element inside a nested diagram by its path (`aks.checkout`, SC-10, NE-14).
 */
function sceneSlot(store: EditorStore, files: Record<string, string>, diagram: Diagram) {
  const { levelPath } = store.getState();
  const story = levelPath.length === 0 ? diagram : storyDiagram(files);
  return { story, target: (name: string) => sceneTarget(levelPath, name) };
}

/**
 * Picks a state for elements (SC-2). In a scene the choice is recorded in that scene (only the
 * difference from normal, SC-5); in Normal it changes the element's base state.
 */
export function setState(store: EditorStore, names: readonly string[], state: StatePreset): void {
  const s = store.getState();
  const scene = s.scene;
  s.edit(scene === null ? "Set state" : "Set scene state", (files, diagram) => {
    let current = { files: { ...files }, diagram };
    for (const name of names) {
      const component = current.diagram.components.get(name);
      const element = component ?? current.diagram.containers.get(name);
      if (element === undefined) continue;
      let result;
      if (scene === null) {
        result = updateElement(current.files, current.diagram, { name, set: { state } });
      } else {
        const { story, target } = sceneSlot(store, current.files, current.diagram);
        result = setSceneEntry(current.files, story, {
          scene,
          target: target(name),
          value: { state, motion: sceneEntry(story, scene, target(name))?.motion ?? null },
          base: { state: element.state, motion: component?.motion ?? "none" },
        });
      }
      current = { files: result.files, diagram: reparse(store, result.files) };
    }
    return { files: current.files, select: names };
  });
}

export function setFlow(store: EditorStore, names: readonly string[], flow: FlowPreset): void {
  const s = store.getState();
  const scene = s.scene;
  s.edit(scene === null ? "Set flow" : "Set scene flow", (files, diagram) => {
    let current = { files: { ...files }, diagram };
    for (const name of names) {
      const connection = current.diagram.connections.get(name);
      if (connection === undefined) continue;
      let result;
      if (scene === null) {
        result = updateElement(current.files, current.diagram, { name, set: { flow } });
      } else {
        const { story, target } = sceneSlot(store, current.files, current.diagram);
        result = setSceneEntry(current.files, story, {
          scene,
          target: target(name),
          value: { flow },
          base: { flow: connection.flow },
        });
      }
      current = { files: result.files, diagram: reparse(store, result.files) };
    }
    return { files: current.files, select: names };
  });
}

export function setMotion(
  store: EditorStore,
  names: readonly string[],
  motion: MotionPreset,
): void {
  const s = store.getState();
  const scene = s.scene;
  s.edit("Set motion", (files, diagram) => {
    let current = { files: { ...files }, diagram };
    for (const name of names) {
      const component = current.diagram.components.get(name);
      if (component === undefined) continue;
      let result;
      if (scene === null) {
        result = updateElement(current.files, current.diagram, { name, set: { motion } });
      } else {
        const { story, target } = sceneSlot(store, current.files, current.diagram);
        result = setSceneEntry(current.files, story, {
          scene,
          target: target(name),
          value: {
            state: sceneEntry(story, scene, target(name))?.state ?? component.state,
            motion,
          },
          base: { state: component.state, motion: component.motion },
        });
      }
      current = { files: result.files, diagram: reparse(store, result.files) };
    }
    return { files: current.files, select: names };
  });
}

/** A scene's line for an element (`target` may be a nested path), or undefined. */
export function sceneEntry(story: Diagram, scene: string, target: string): SceneEntry | undefined {
  return story.scenes.find((s) => s.name === scene)?.entries.find((e) => e.target === target);
}

/** Multi-element edits chain commands; each needs the diagram of the previous result. */
function reparse(store: EditorStore, files: Record<string, string>): Diagram {
  return parseCached(files, store.getState().folder).diagram;
}

// -------------------------------------------------------------------------------------------------
// View

/** What fitting a level frames: its diagram, plus room for the parent's stubs when nested. */
export function fitArea(layout: LayoutResult, nested: boolean): Box {
  const base = layout.bounds.w === 0 ? { x: 0, y: 0, w: 400, h: 300 } : layout.bounds;
  const room = nested ? STUB_ROOM : 0;
  return { ...base, x: base.x - room, w: base.w + room * 2 };
}

/** The camera that frames `area` in the room the open panels leave. */
export function fitCamera(store: EditorStore, area: Box): Camera {
  const state = store.getState();
  const width = state.viewport.width;
  // Phones show panels as sheets over the canvas; elsewhere the open panels take their width.
  const phone = width < PHONE_WIDTH;
  const right = state.panels.code
    ? clearOf(width >= 1280 ? PANEL.codeXl : PANEL.code)
    : state.panels.inspector || state.panels.tours
      ? CANVAS_INSETS.right
      : 24;
  const insets = phone
    ? { top: 72, right: 16, bottom: 150, left: 16 }
    : {
        top: CANVAS_INSETS.top,
        right,
        bottom: width < 1024 ? 150 : CANVAS_INSETS.bottom,
        left: state.panels.library ? CANVAS_INSETS.left : 24,
      };
  return fitBox(area, state.viewport, {
    padding: 32,
    maxZoom: 1,
    insets,
    ...(phone ? { minZoom: PHONE_MIN_ZOOM } : {}),
  });
}

export function zoomToFit(store: EditorStore): void {
  const state = store.getState();
  state.setCamera(fitCamera(store, fitArea(layoutOf(store), state.levelPath.length > 0)));
}

export function zoomToSelection(store: EditorStore): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const boxes = state.selection
    .map((name) => layout.elements.get(name)?.box)
    .filter((b) => b !== undefined);
  if (boxes.length === 0) return zoomToFit(store);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const w = Math.max(...boxes.map((b) => b.x + b.w)) - x;
  const h = Math.max(...boxes.map((b) => b.y + b.h)) - y;
  state.setCamera(
    fitBox({ x, y, w, h }, state.viewport, { padding: 120, maxZoom: 1.5, insets: CANVAS_INSETS }),
  );
}

export function zoomBy(store: EditorStore, factor: number): void {
  const { camera, viewport } = store.getState();
  store
    .getState()
    .setCamera(
      zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, camera.zoom * factor),
    );
}

export function zoomTo(store: EditorStore, zoom: number): void {
  const { camera, viewport } = store.getState();
  store
    .getState()
    .setCamera(zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, clampZoom(zoom)));
}
