import {
  addComponent,
  addConnection,
  addContainer,
  addDecoration,
  addGroup,
  addShape,
  applyStyle,
  autoSize,
  copySnippet,
  deleteElements,
  followTerminals,
  isLocked,
  isMogramSnippet,
  moveElements,
  pasteSnippet,
  planZOrder,
  readStyle,
  reorderZ,
  resizeElement,
  setConcept,
  setFlowValue,
  setLocked,
  setSceneCapacity,
  setSceneEntry,
  splitConnection,
  updateElement,
  type CopiedStyle,
  type EditResult,
  type Move,
  type ZOrderMove,
} from "@mogram/core/edit";
import {
  CONTAINER_UNITS,
  GRID,
  ancestorsOf,
  computeLayout,
  descendantsOf,
  toPx,
  toUnits,
  type Box,
  type LayoutResult,
  type Point,
} from "@mogram/core/layout";
import type { Diagram, ProjectFiles, SceneEntry, Tone } from "@mogram/core/model";
import { applyConcept, insertConcept, type ConceptBindings } from "@mogram/core/concepts";
import { routeConnections } from "@mogram/core/routing";
import {
  NOTE_SIZE,
  SHAPE_INFO,
  containerIcon,
  isCloud,
  isContainerStyle,
  isShapeId,
} from "@mogram/core/presets";
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
  nextZoomStep,
} from "@/features/canvas/camera";
import { STUB_ROOM } from "@/features/canvas/svg/stubs";
import { clearOf, PANEL } from "./panel-sizes";
import { parseCached, sceneTarget, storyDiagram, type EditorStore } from "./store/editor-store";

/**
 * Editor operations shared by shortcuts, menus, the toolbar and the inspector. Each one is a
 * single undo step and writes YAML through @mogram/core/edit.
 */

/** Chrome that floats over the canvas, kept clear when fitting the view. */
/**
 * An edit that moves or resizes elements, with connection bends carried along in the same undo
 * step (ED-29, draw.io's `followTerminals`).
 */
export function following(
  store: EditorStore,
  run: (files: ProjectFiles, diagram: Diagram) => EditResult,
): (files: ProjectFiles, diagram: Diagram) => EditResult {
  return (files, diagram) => followTerminals(diagram, run(files, diagram), store.getState().folder);
}

/** Room the desktop chrome takes around the canvas: top bars, open side panels, bottom dock. */
export const CANVAS_INSETS = {
  top: 76,
  right: clearOf(PANEL.right),
  bottom: 128,
  left: clearOf(PANEL.library),
} as const;

/**
 * What was copied last in this tab, and where it came from, so "Paste in place" can put it back
 * exactly there (only while the system clipboard still holds the same snippet).
 */
const clipboard: { text: string; place: { parent: string | null; at: Point } | null } = {
  text: "",
  place: null,
};

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
  const diagram = state.diagram();
  const held = state.selection.filter((name) => isLocked(diagram, name));
  const selection = state.selection.filter((name) => !isLocked(diagram, name));
  if (held.length > 0)
    state.notify(
      held.length === 1
        ? `"${held[0] ?? ""}" is locked. Unlock it (⇧⌘L) to delete it.`
        : `${held.length} locked elements were kept. Unlock them (⇧⌘L) to delete them.`,
    );
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
  const top = topLevelSelection(layout, state.selection)
    .map((name) => layout.elements.get(name))
    .filter((element) => element !== undefined);
  const first = top[0];
  clipboard.text = text;
  clipboard.place =
    first === undefined
      ? null
      : {
          parent: first.parent,
          at: {
            x: Math.min(...top.map((element) => element.rel.x)),
            y: Math.min(...top.map((element) => element.rel.y)),
          },
        };
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard permission can be denied; the in-app clipboard still works.
  }
  return true;
}

/** The style copied last (⌥⌘C), kept in this tab only. */
let copiedStyle: CopiedStyle | null = null;

export function hasCopiedStyle(): boolean {
  return copiedStyle !== null;
}

/** Copies the selected element's look: colours, line, arrowheads, motion, typography. */
export function copyStyle(store: EditorStore): boolean {
  const state = store.getState();
  const name = state.selection[0];
  if (name === undefined) return false;
  copiedStyle = readStyle(state.files, state.diagram(), name);
  if (copiedStyle !== null) state.notify("Style copied. Select elements and paste it.");
  return copiedStyle !== null;
}

/** Gives the selection the copied look (only what each kind of element can take). */
export function pasteStyle(store: EditorStore): void {
  const style = copiedStyle;
  const state = store.getState();
  if (style === null || state.selection.length === 0) return;
  const names = [...state.selection];
  state.edit("Paste style", (files, diagram) => applyStyle(files, diagram, { names, style }));
}

/** Copies the whole diagram, as it shows now, to the clipboard as a PNG or as SVG markup. */
export async function copyImage(store: EditorStore, format: "png" | "svg"): Promise<void> {
  const state = store.getState();
  const request = {
    files: state.files,
    folder: state.folder,
    scene: state.scene,
    options: {
      format,
      scale: 2,
      transparent: false,
      area: "fit",
      animation: "loop",
      fps: 10,
      fileName: state.parsed().diagram.settings.name,
    },
  } as const;
  // The clipboard write starts inside the key press or click (Safari needs that); the image
  // arrives when it's rendered.
  const rendered = import("@/features/export/export").then(({ runExport }) =>
    runExport(request, () => undefined).then((result) => result.blob),
  );
  try {
    if (format === "png") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": rendered })]);
    } else {
      await navigator.clipboard.writeText(await (await rendered).text());
    }
    state.notify(format === "png" ? "Copied the diagram as a PNG." : "Copied the diagram as SVG.");
  } catch {
    state.notify("Couldn't copy the image here. Export it instead.", "error");
  }
}

export async function cutSelection(store: EditorStore): Promise<void> {
  if (await copySelection(store)) deleteSelection(store);
}

export async function paste(
  store: EditorStore,
  at: Point | null,
  options: { readonly inPlace?: boolean } = {},
): Promise<void> {
  let text = clipboard.text;
  try {
    const system = await navigator.clipboard.readText();
    if (isMogramSnippet(system)) text = system;
  } catch {
    // Fall back to the in-app clipboard.
  }
  if (text.length === 0) return;
  const place = options.inPlace === true && text === clipboard.text ? clipboard.place : null;
  if (place !== null) {
    store.getState().edit("Paste in place", (files, diagram) =>
      pasteSnippet(files, diagram, {
        text,
        parent: place.parent !== null && diagram.containers.has(place.parent) ? place.parent : null,
        at: place.at,
      }),
    );
    return;
  }
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

/**
 * Copies `names` (with what's inside them and the connections between them) to where `moves`
 * would have put them, leaving the originals: Ctrl/Cmd while dropping a drag.
 */
export function cloneTo(
  store: EditorStore,
  names: readonly string[],
  moves: readonly Move[],
): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const top = topLevelSelection(layout, names);
  const first = moves.find((move) => move.name === top[0]);
  const origin = top[0] === undefined ? undefined : layout.elements.get(top[0]);
  if (first === undefined || origin === undefined) return;
  const positions = new Map([...layout.elements].map(([name, element]) => [name, element.rel]));
  const text = copySnippet(state.diagram(), top, positions);
  if (text.length === 0) return;
  // The snippet keeps the elements' places relative to its top-left one.
  const corner = {
    x: Math.min(...top.map((name) => layout.elements.get(name)?.rel.x ?? 0)),
    y: Math.min(...top.map((name) => layout.elements.get(name)?.rel.y ?? 0)),
  };
  const at = {
    x: first.at.x - (origin.rel.x - corner.x),
    y: first.at.y - (origin.rel.y - corner.y),
  };
  state.edit("Copy", (files, diagram) =>
    pasteSnippet(files, diagram, { text, parent: first.parent, at }),
  );
}

export function nudge(store: EditorStore, dx: number, dy: number): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const moves: Move[] = [];
  const diagram = state.diagram();
  for (const name of topLevelSelection(layout, state.selection)) {
    if (isLocked(diagram, name)) continue;
    const element = layout.elements.get(name);
    if (element === undefined) continue;
    moves.push({
      name,
      parent: element.parent,
      at: { x: element.rel.x + dx, y: element.rel.y + dy },
    });
  }
  if (moves.length > 0)
    state.edit(
      "Nudge",
      following(store, (files, diagram) => moveElements(files, diagram, moves)),
      {
        coalesce: true,
      },
    );
}

/** Whether `name` can be given a size by hand: shapes, containers, highlight zones and notes. */
export function isResizable(diagram: Diagram, name: string): boolean {
  const variant = diagram.decorations.get(name)?.variant;
  return (
    diagram.containers.has(name) ||
    diagram.components.get(name)?.shape != null ||
    variant === "zone" ||
    variant === "note"
  );
}

/** The smallest a resizable element can be, in grid units: a container still holds its contents. */
export function minimumSize(diagram: Diagram, name: string): { w: number; h: number } {
  if (diagram.components.get(name)?.shape != null) return { w: 2, h: 2 };
  const variant = diagram.decorations.get(name)?.variant;
  if (variant === "note") return { w: 8, h: 6 };
  if (variant === "zone") return { w: 4, h: 3 };
  const fitted = computeLayout(diagram, { sizes: new Map([[name, { w: 0, h: 0 }]]) }).elements.get(
    name,
  )?.size;
  return { w: fitted?.w ?? CONTAINER_UNITS.minW, h: fitted?.h ?? CONTAINER_UNITS.minH };
}

/**
 * Resizes the selected containers, zones and notes (locked ones stay as they are): `change`
 * gives each one's new size from its current one, and nothing shrinks below what it holds.
 */
function resizeSelection(
  store: EditorStore,
  change: (size: { w: number; h: number }) => { w: number; h: number },
  options: { readonly label: string; readonly coalesce: boolean },
): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const names = state.selection.filter(
    (name) => isResizable(state.diagram(), name) && !isLocked(state.diagram(), name),
  );
  if (names.length === 0) return;
  state.edit(
    options.label,
    following(store, (files, diagram) => {
      let result: EditResult = { files };
      let current = diagram;
      for (const name of names) {
        const element = layout.elements.get(name);
        if (element === undefined) continue;
        const min = minimumSize(current, name);
        const wanted = change(element.size);
        const size = { w: Math.max(min.w, wanted.w), h: Math.max(min.h, wanted.h) };
        if (size.w === element.size.w && size.h === element.size.h) continue;
        result = resizeElement(result.files, current, { name, size });
        current = reparse(store, result.files);
      }
      return { ...result, select: names };
    }),
    { coalesce: options.coalesce },
  );
}

/** Grows or shrinks the selected containers, zones and notes (⌘ + arrows; ⇧ for 4 units). */
export function resizeBy(store: EditorStore, dw: number, dh: number): void {
  resizeSelection(store, (size) => ({ w: size.w + dw, h: size.h + dh }), {
    label: "Resize",
    coalesce: true,
  });
}

/**
 * Gives the selected containers, zones and notes one width or height (the inspector); `step`
 * marks an arrow-key step, which folds into the steps before it.
 */
export function resizeTo(store: EditorStore, axis: "w" | "h", value: number, step = false): void {
  resizeSelection(store, (size) => ({ ...size, [axis]: value }), {
    label: step ? "Step size" : "Set size",
    coalesce: step,
  });
}

/** Locks the selection, or unlocks it when everything selected is locked already (⇧⌘L). */
export function toggleLock(store: EditorStore): void {
  const state = store.getState();
  const diagram = state.diagram();
  const names = state.selection.filter((name) => !diagram.groups.has(name));
  if (names.length === 0) return;
  const locked = !names.every((name) => isLocked(diagram, name));
  state.edit(locked ? "Lock" : "Unlock", (files, d) => setLocked(files, d, { names, locked }));
}

/** Shrinks or grows containers to fit what they hold (draw.io's Autosize). */
export function fitToContents(store: EditorStore, names: readonly string[]): void {
  const containers = names.filter((name) => store.getState().diagram().containers.has(name));
  if (containers.length === 0) return;
  store.getState().edit(
    "Fit to contents",
    following(store, (files, diagram) => {
      let result: EditResult = { files };
      let current = diagram;
      for (const name of containers) {
        result = autoSize(result.files, current, name);
        current = reparse(store, result.files);
      }
      return result;
    }),
  );
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
  // Locked elements still mark the edge to align to; they just don't move.
  const diagram = state.diagram();
  const unlocked = moves.filter((move) => !isLocked(diagram, move.name));
  if (unlocked.length === 0) return;
  state.edit(
    `Align ${mode}`,
    following(store, (files, d) => moveElements(files, d, unlocked)),
  );
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
  const diagram = state.diagram();
  const unlocked = moves.filter((move) => !isLocked(diagram, move.name));
  if (unlocked.length === 0) return;
  state.edit(
    `Distribute ${axis}`,
    following(store, (files, d) => moveElements(files, d, unlocked)),
  );
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
  /** A connection to put the new component into (dropped on its line, ED-29). */
  split: string | null = null,
  /**
   * `nest: false` keeps it out of any container under the point (Alt while dropping);
   * `connectFrom` connects that element to the new one in the same step (quick add).
   */
  options: { readonly nest?: boolean; readonly connectFrom?: string | null } = {},
): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const point = at ?? viewportCenter(store);
  const selected = state.selection.length === 1 ? state.selection[0] : undefined;
  const parent =
    options.nest === false
      ? null
      : at === null && selected !== undefined && layout.elements.get(selected)?.kind === "container"
        ? selected
        : containerAt(layout, point);
  // `shape/cylinder` from the library's Shapes section is a shape, centred where it lands.
  const shape = type.startsWith("shape/") ? type.slice("shape/".length) : null;
  const size = isShapeId(shape)
    ? { x: toPx(SHAPE_INFO[shape].size.w) / 2, y: toPx(SHAPE_INFO[shape].size.h) / 2 }
    : { x: 48, y: 48 };
  const rel = relativeTo(layout, parent, { x: point.x - size.x, y: point.y - size.y });
  const added = state.edit(
    split === null ? `Add ${label}` : `Insert ${label}`,
    (files, diagram) => {
      const result = isShapeId(shape)
        ? addShape(files, diagram, { shape, label, parent, at: rel })
        : addComponent(files, diagram, { type, label, parent, at: rel });
      const element = result.select?.[0];
      if (element === undefined) return result;
      const from = options.connectFrom ?? null;
      if (from !== null) {
        const linked = addConnection(result.files, reparse(store, result.files), {
          from,
          to: element,
          flow: "traffic",
        });
        return { ...linked, select: [element] };
      }
      if (split === null) return result;
      return splitConnection(result.files, reparse(store, result.files), { name: split, element });
    },
  );
  // A shape added with a click starts with its label open for typing (03 §5 P0-4).
  const name = store.getState().selection[0];
  if (added && isShapeId(shape) && at === null && name !== undefined)
    store.getState().setEditingLabel(name);
}

/**
 * Adds what the library offers by its type: `shape/…`, `container/…`, `annotation/…` (text,
 * label, zone, note) or an icon, centred on `at` (or the middle of the view).
 */
export function insertFromLibrary(
  store: EditorStore,
  type: string,
  label: string,
  at: Point | null,
  options: {
    readonly split?: string | null;
    readonly nest?: boolean;
    readonly connectFrom?: string | null;
  } = {},
): void {
  const point = at ?? viewportCenter(store);
  const [kind, value = ""] = type.split("/", 2);
  // `container/network@aws`: the kind, and the cloud whose official group icon it takes.
  const [containerKind = "", cloud = null] = value.split("@", 2);
  if (kind === "container" && isContainerStyle(containerKind)) {
    const w = toPx(CONTAINER_UNITS.minW + 8);
    const h = toPx(CONTAINER_UNITS.minH + 4);
    const icon = isCloud(cloud) ? containerIcon(containerKind, cloud) : null;
    addContainerBox(
      store,
      containerKind,
      label,
      { x: point.x - w / 2, y: point.y - h / 2, w, h },
      icon,
    );
    return;
  }
  if (kind === "annotation") {
    if (value === "text" || value === "label") addTextAt(store, value, point);
    else if (value === "note") addNoteAt(store, point);
    else if (value === "zone")
      addZoneBox(store, { x: point.x - 120, y: point.y - 64, w: 240, h: 128 });
    return;
  }
  addComponentAt(store, type, label, at, options.split ?? null, {
    ...(options.nest === undefined ? {} : { nest: options.nest }),
    connectFrom: options.connectFrom ?? null,
  });
}

export function addContainerBox(
  store: EditorStore,
  type: ContainerStyleName,
  label: string,
  box: Box,
  icon: string | null = null,
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
    addContainer(files, diagram, { type, label, parent, at: rel, size, icon }),
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

export type Direction = "up" | "right" | "down" | "left";

/** The gap a connected copy is placed at, in px (draw.io's default, 10 grid cells). */
export const CLONE_GAP = 80;

/**
 * Where something added `direction` of `name` goes: the same size, `CLONE_GAP` away, centred on
 * the same line (06-canvas-interactions §9).
 */
export function spotBeside(layout: LayoutResult, name: string, direction: Direction): Box | null {
  const box = layout.elements.get(name)?.box;
  if (box === undefined) return null;
  const dx =
    direction === "right" ? box.w + CLONE_GAP : direction === "left" ? -(box.w + CLONE_GAP) : 0;
  const dy =
    direction === "down" ? box.h + CLONE_GAP : direction === "up" ? -(box.h + CLONE_GAP) : 0;
  return { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
}

/** An element already sitting where `spot` would go (not a container holding `name`), or null. */
function occupant(layout: LayoutResult, name: string, spot: Box): string | null {
  const holders = new Set(ancestorsOf(layout, name));
  for (const element of layout.elements.values()) {
    if (element.name === name || holders.has(element.name) || element.kind === "decoration")
      continue;
    const b = element.box;
    const overlaps =
      b.x < spot.x + spot.w && b.x + b.w > spot.x && b.y < spot.y + spot.h && b.y + b.h > spot.y;
    if (overlaps && element.kind !== "container") return element.name;
  }
  return null;
}

/**
 * Clone and connect (06-canvas-interactions §9, draw.io's hover arrows): a copy of `name` goes
 * `direction` of it, connected from it, and is selected with its label open; if something is
 * already there, `name` is connected to that instead. One undo step.
 */
export function cloneAndConnect(store: EditorStore, name: string, direction: Direction): void {
  const state = store.getState();
  const layout = layoutOf(store);
  const spot = spotBeside(layout, name, direction);
  const element = layout.elements.get(name);
  if (spot === null || element === undefined) return;
  const existing = occupant(layout, name, spot);
  if (existing !== null) {
    connect(store, name, existing);
    return;
  }
  const positions = new Map([...layout.elements].map(([n, e]) => [n, e.rel]));
  const text = copySnippet(state.diagram(), [name], positions);
  if (text.length === 0) return;
  const at = relativeTo(layout, element.parent, spot);
  const ok = state.edit("Add connected copy", (files, diagram) => {
    const pasted = pasteSnippet(files, diagram, { text, parent: element.parent, at });
    const copy = pasted.select?.[0];
    if (copy === undefined) return pasted;
    const linked = addConnection(pasted.files, reparse(store, pasted.files), {
      from: name,
      to: copy,
      flow: "traffic",
    });
    return { ...linked, select: [copy] };
  });
  const copy = store.getState().selection[0];
  if (ok && copy !== undefined && copy !== name) store.getState().setEditingLabel(copy);
}

/** Opens the quick-add picker for a spot: beside an element, or where the canvas was clicked. */
export function openQuickAdd(
  store: EditorStore,
  at: Point,
  from: { readonly name: string; readonly direction: Direction } | null = null,
): void {
  store.getState().setQuickAdd({ at, from });
  store.getState().setDialog("palette");
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

/**
 * Traffic on a connection, its share of a split, or a cache's hit rate (D-82). In a scene the
 * value is that scene's; in Normal it's the element's own. `null` takes it away.
 */
export function setCapacityValue(
  store: EditorStore,
  name: string,
  key: "traffic" | "share" | "hit",
  value: number | null,
): void {
  const s = store.getState();
  const scene = s.scene;
  const label = { traffic: "Set traffic", share: "Set share", hit: "Set hit rate" }[key];
  s.edit(scene === null ? label : `${label} in scene`, (files, diagram) => {
    if (scene === null) {
      return { files: setFlowValue(files, diagram, { name, key, value }).files, select: [name] };
    }
    const { story, target } = sceneSlot(store, files, diagram);
    const result = setSceneCapacity(files, story, {
      scene,
      target: target(name),
      capacity: { [key]: value },
    });
    return { files: result.files, select: [name] };
  });
}

/**
 * Holds an element at a number of copies or a size in the current scene, whatever its traffic
 * (a failover drill, a cost cut); `null` lets it scale on its own again.
 */
export function pinCapacity(
  store: EditorStore,
  name: string,
  pin: { readonly copies: number | null } | { readonly size: string | null },
): void {
  const s = store.getState();
  const scene = s.scene;
  if (scene === null) return;
  s.edit("copies" in pin ? "Set copies in scene" : "Set size in scene", (files, diagram) => {
    const { story, target } = sceneSlot(store, files, diagram);
    const result = setSceneCapacity(files, story, {
      scene,
      target: target(name),
      capacity: pin,
    });
    return { files: result.files, select: [name] };
  });
}

/**
 * Applies a concept to elements of this diagram (D-83): one undo step. Returns what changed, in
 * plain words, or null if it couldn't (the reason has been shown).
 */
export function applyConceptTo(
  store: EditorStore,
  concept: Diagram,
  bindings: ConceptBindings,
): readonly string[] | null {
  let report: readonly string[] = [];
  const ok = store.getState().edit(`Apply ${concept.settings.name}`, (files, diagram) => {
    const result = applyConcept(files, diagram, { concept, bindings });
    report = [...result.report, ...result.notes];
    return result;
  });
  return ok ? report : null;
}

/**
 * Makes the diagram a concept whose parts are `names` (D-83), keeping any parts it had, and
 * shows the Concept section, where it's described and its parts named.
 */
export function makeConceptFrom(store: EditorStore, names: readonly string[]): void {
  const s = store.getState();
  const diagram = s.diagram();
  const playable = names.filter((n) => diagram.components.has(n) || diagram.containers.has(n));
  if (playable.length === 0) {
    s.notify("Select the components or containers that play a part in it first.");
    return;
  }
  const existing = diagram.settings.concept;
  const roles = [...(existing?.roles ?? [])];
  for (const name of playable)
    if (!roles.some((role) => role.element === name))
      roles.push({
        element: name,
        label: diagram.components.get(name)?.label ?? diagram.containers.get(name)?.label ?? name,
        optional: false,
      });
  const ok = s.edit(existing === null ? "Make a concept" : "Add concept parts", (files, d) =>
    setConcept(files, d, {
      concept: {
        summary: existing?.summary ?? d.settings.description,
        topic: existing?.topic ?? null,
        platform: existing?.platform ?? "any",
        tags: existing?.tags ?? [],
        roles,
      },
    }),
  );
  if (!ok) return;
  s.select([]);
  s.togglePanel("inspector", true);
  s.notify("It’s a concept now. Describe it and name its parts under Concept in the inspector.");
}

/** Puts a concept's whole example beside the diagram (D-83), then frames everything. */
export function insertConceptExample(
  store: EditorStore,
  concept: Diagram,
): readonly string[] | null {
  const layout = layoutOf(store);
  const point =
    layout.bounds.w === 0
      ? viewportCenter(store)
      : { x: layout.bounds.x + layout.bounds.w + 96, y: layout.bounds.y };
  const at = relativeTo(layout, null, point);
  let report: readonly string[] = [];
  const ok = store.getState().edit(`Insert ${concept.settings.name}`, (files, diagram) => {
    const result = insertConcept(files, diagram, { concept, at });
    report = result.report;
    return result;
  });
  if (!ok) return null;
  zoomToFit(store);
  return report;
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

/** The selection's world bounds, connections (by their lines) included; null if nothing is drawn. */
export function selectionBox(store: EditorStore): Box | null {
  const state = store.getState();
  const diagram = state.diagram();
  const layout = layoutOf(store);
  const routes = state.selection.some((name) => diagram.connections.has(name))
    ? routeConnections(diagram, layout)
    : null;
  const boxes = state.selection.flatMap((name): Box[] => {
    const box = layout.elements.get(name)?.box ?? layout.groups.get(name);
    if (box !== undefined) return [box];
    const points = routes?.get(name)?.points ?? [];
    return points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }));
  });
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const w = Math.max(...boxes.map((b) => b.x + b.w)) - x;
  const h = Math.max(...boxes.map((b) => b.y + b.h)) - y;
  return { x, y, w, h };
}

export function zoomToSelection(store: EditorStore): void {
  const state = store.getState();
  const box = selectionBox(store);
  if (box === null) return zoomToFit(store);
  state.setCamera(
    fitBox(box, state.viewport, { padding: 120, maxZoom: 1.5, insets: CANVAS_INSETS }),
  );
}

/**
 * Brings the selection into view without changing the zoom when it already fits (Find, Tab):
 * nothing moves if it's on screen; otherwise it's centred, or zoomed to if it's too big.
 */
export function revealSelection(store: EditorStore): void {
  const state = store.getState();
  const box = selectionBox(store);
  if (box === null) return;
  const { camera, viewport } = state;
  const area = {
    left: CANVAS_INSETS.left,
    top: CANVAS_INSETS.top,
    right: viewport.width - CANVAS_INSETS.right,
    bottom: viewport.height - CANVAS_INSETS.bottom,
  };
  const screen = {
    left: box.x * camera.zoom + camera.x,
    top: box.y * camera.zoom + camera.y,
    right: (box.x + box.w) * camera.zoom + camera.x,
    bottom: (box.y + box.h) * camera.zoom + camera.y,
  };
  const inside =
    screen.left >= area.left &&
    screen.top >= area.top &&
    screen.right <= area.right &&
    screen.bottom <= area.bottom;
  if (inside) return;
  const fits =
    box.w * camera.zoom <= area.right - area.left && box.h * camera.zoom <= area.bottom - area.top;
  if (!fits) return zoomToSelection(store);
  const cx = (area.left + area.right) / 2;
  const cy = (area.top + area.bottom) / 2;
  state.setCamera({
    ...camera,
    x: cx - (box.x + box.w / 2) * camera.zoom,
    y: cy - (box.y + box.h / 2) * camera.zoom,
  });
}

export function zoomBy(store: EditorStore, factor: number): void {
  const { camera, viewport } = store.getState();
  // Buttons and keys step along the zoom ladder (so 100% is always one press away); pinch and
  // the wheel zoom smoothly elsewhere.
  const zoom = nextZoomStep(camera.zoom, factor > 1 ? 1 : -1);
  store
    .getState()
    .setCamera(zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, zoom));
}

export function zoomTo(store: EditorStore, zoom: number): void {
  const { camera, viewport } = store.getState();
  store
    .getState()
    .setCamera(zoomAt(camera, { x: viewport.width / 2, y: viewport.height / 2 }, clampZoom(zoom)));
}
