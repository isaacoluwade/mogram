import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpToLine,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  ClipboardPaste,
  Cloud,
  Code2,
  Copy,
  CornerLeftUp,
  Download,
  Eye,
  FileCode2,
  FileUp,
  Grid3x3,
  Group,
  Hand,
  History,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Lock,
  Map as MapIcon,
  LibraryBig,
  Maximize,
  MonitorPlay,
  MousePointer2,
  PanelRight,
  PaintRoller,
  Paintbrush,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Route,
  Save,
  Scaling,
  Scissors,
  Search,
  SkipBack,
  Settings2,
  Shrink,
  Sparkles,
  SkipForward,
  SlidersHorizontal,
  Spline,
  Square,
  SquareDashed,
  StickyNote,
  Tag,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlink,
  X,
  Lightbulb,
  LayoutGrid,
} from "lucide-react";
import {
  deleteElements,
  isLocked,
  tidyUp,
  resetConnectionPath,
  reverseConnection,
  setConnectionLook,
  setConnectionRoute,
} from "@mogram/core/edit";
import type { RouteStyle } from "@mogram/core/model";
import { nearestAlong } from "@mogram/core/routing";
import {
  FLOW_INFO,
  FLOW_PRESETS,
  LINE_PATTERNS,
  LINE_PATTERN_LABELS,
  MOTION_INFO,
  MOTION_PRESETS,
  STATE_INFO,
  STATE_PRESETS,
} from "@mogram/core/presets";
import {
  align,
  canZOrder,
  cloneAndConnect,
  copyImage,
  copySelection,
  copyStyle,
  cutSelection,
  deleteSelection,
  distribute,
  duplicateSelection,
  fitToContents,
  following,
  groupSelection,
  hasCopiedStyle,
  isResizable,
  nudge,
  paste,
  pasteStyle,
  resizeBy,
  revealSelection,
  setFlow,
  setMotion,
  setState,
  toggleLock,
  zOrder,
  zoomBy,
  zoomTo,
  makeConceptFrom,
  zoomToFit,
  zoomToSelection,
  type AlignMode,
} from "../actions";
import {
  addWaypointAt,
  connectionRoute,
  removeWaypointAt,
  waypointNear,
} from "../canvas/connection-drag";
import { exitNested, openNested } from "../levels";
import type { Tool } from "../store/editor-store";
import { matchesCombo, type KeyInput } from "./keys";
import type { Command, CommandContext, CommandGroup } from "./types";
import { preference } from "@/lib/preferences";

/**
 * Every editor command (05-ui-shell-commands §13). Key handling, menus, the quick bar, the
 * palette and the shortcuts dialog all read this list, so a command's label, keys and when it
 * applies are written once.
 */

const any = (list: readonly unknown[]): boolean => list.length > 0;

type Icon = NonNullable<Command["icon"]>;

/** Within this many screen px of the pointer counts as "on" a bend or a line. */
const POINTER_REACH = 10;

function tool(id: Tool, label: string, key: string, icon: Icon): Command {
  return {
    id: `tool.${id}`,
    label,
    group: "tools",
    keys: [key],
    icon,
    checked: (c) => c.store.getState().tool === id,
    run: (c) => c.store.getState().setTool(id),
  };
}

const TOOLS: readonly Command[] = [
  tool("select", "Select", "v", MousePointer2),
  tool("hand", "Hand", "h", Hand),
  tool("connect", "Connect", "c", Spline),
  tool("container", "Container", "b", Square),
  tool("zone", "Highlight zone", "z", SquareDashed),
  tool("text", "Text", "t", Type),
  tool("note", "Sticky note", "n", StickyNote),
  tool("label", "Label", "l", Tag),
];

/**
 * Esc backs out one step at a time: connecting, Find, a tool, an open card, the selection, a
 * level, an earlier version.
 */
function escape(c: CommandContext): void {
  const state = c.store.getState();
  if (state.connect !== null) return state.setConnect(null);
  if (state.findOpen) return state.setFindOpen(false);
  if (state.tool !== "select") return state.setTool("select");
  if (state.openCard !== null) return state.setOpenCard(null);
  if (state.selection.length > 0) return state.select([]);
  if (state.levelPath.length > 0) {
    exitNested(c.store);
    return;
  }
  if (state.viewing !== null) state.setViewing(null);
}

/** Where an element is defined in the files. */
function sourceOf(c: CommandContext, name: string): { file: string; line: number } | null {
  const d = c.diagram;
  return (
    d.components.get(name)?.source ??
    d.containers.get(name)?.source ??
    d.connections.get(name)?.source ??
    d.groups.get(name)?.source ??
    d.decorations.get(name)?.source ??
    null
  );
}

function parentOf(c: CommandContext, name: string): string | null {
  const d = c.diagram;
  return (
    d.components.get(name)?.parent ??
    d.containers.get(name)?.parent ??
    d.decorations.get(name)?.parent ??
    null
  );
}

/** Components, containers and decorations in file order: what Tab steps through. */
function elementOrder(c: CommandContext): string[] {
  const d = c.diagram;
  return [...d.containers.keys(), ...d.components.keys(), ...d.decorations.keys()];
}

function step(c: CommandContext, by: 1 | -1): void {
  const order = elementOrder(c);
  if (order.length === 0) return;
  const current = order.indexOf(c.sel.names[c.sel.names.length - 1] ?? "");
  const next = order[(current + by + order.length) % order.length];
  if (next === undefined) return;
  c.store.getState().select([next]);
  revealSelection(c.store);
}

const EDIT: readonly Command[] = [
  {
    id: "edit.undo",
    label: "Undo",
    group: "edit",
    keys: ["mod+z"],
    icon: Undo2,
    when: (c) => c.store.getState().past.length > 0,
    run: (c) => c.store.getState().undo(),
  },
  {
    id: "edit.redo",
    label: "Redo",
    group: "edit",
    keys: ["mod+shift+z", "mod+y"],
    icon: Redo2,
    when: (c) => c.store.getState().future.length > 0,
    run: (c) => c.store.getState().redo(),
  },
  {
    id: "edit.cut",
    label: "Cut",
    group: "edit",
    keys: ["mod+x"],
    icon: Scissors,
    when: (c) => any(c.sel.placeables),
    run: (c) => cutSelection(c.store),
  },
  {
    id: "edit.copy",
    label: "Copy",
    group: "edit",
    keys: ["mod+c"],
    icon: Clipboard,
    passive: true,
    when: (c) => any(c.sel.placeables),
    run: (c) => copySelection(c.store),
  },
  {
    id: "edit.paste",
    label: (c) => (c.pointer === null ? "Paste" : "Paste here"),
    group: "edit",
    keys: ["mod+v"],
    icon: ClipboardPaste,
    run: (c) => paste(c.store, c.pointer),
  },
  {
    id: "edit.paste-in-place",
    label: "Paste in place",
    description: "Where the copied elements were",
    group: "edit",
    keys: ["mod+shift+v"],
    icon: ClipboardPaste,
    run: (c) => paste(c.store, null, { inPlace: true }),
  },
  {
    id: "edit.duplicate",
    label: "Duplicate",
    group: "edit",
    keys: ["mod+d"],
    icon: Copy,
    when: (c) => any(c.sel.placeables),
    run: (c) => duplicateSelection(c.store),
  },
  {
    id: "edit.copy-style",
    label: "Copy style",
    description: "Colours, line, arrowheads, motion and typography",
    group: "style",
    keys: ["mod+alt+c"],
    icon: Paintbrush,
    when: (c) => c.sel.single !== null && c.sel.kind !== "group",
    run: (c) => copyStyle(c.store),
  },
  {
    id: "edit.paste-style",
    label: "Paste style",
    group: "style",
    keys: ["mod+alt+v"],
    icon: PaintRoller,
    when: (c) => any(c.sel.names) && hasCopiedStyle(),
    run: (c) => pasteStyle(c.store),
  },
  {
    id: "edit.rename",
    label: (c) => (c.sel.kind === "decoration" ? "Edit text" : "Rename"),
    group: "edit",
    keys: ["f2"],
    icon: Pencil,
    when: (c) => c.sel.single !== null,
    run: (c) => c.store.getState().setEditingLabel(c.sel.single),
  },
  {
    id: "edit.enter",
    label: "Rename, or open a nested diagram",
    group: "edit",
    keys: ["enter"],
    palette: false,
    run: (c) => {
      const name = c.sel.names[0];
      if (name === undefined) return zoomToFit(c.store);
      if (!openNested(c.store, name)) c.store.getState().setEditingLabel(name);
    },
  },
  {
    id: "edit.escape",
    label: "Cancel, deselect, or back out one level",
    group: "edit",
    keys: ["escape"],
    palette: false,
    run: escape,
  },
  {
    id: "edit.delete",
    label: (c) => (c.sel.names.length > 1 ? `Delete (${c.sel.names.length})` : "Delete"),
    group: "edit",
    keys: ["backspace", "delete"],
    icon: Trash2,
    danger: true,
    when: (c) => any(c.sel.names),
    run: (c) => deleteSelection(c.store),
  },
];

const SELECT: readonly Command[] = [
  {
    id: "select.find",
    label: "Find",
    description: "Find elements by label, name, type or card text",
    group: "select",
    keys: ["mod+f"],
    icon: Search,
    run: (c) => {
      c.store.getState().setFindOpen(true);
      // Already open: put the cursor back in the box.
      document.querySelector<HTMLInputElement>("[data-find-input]")?.select();
    },
  },
  {
    id: "select.all",
    label: "Select all",
    group: "select",
    keys: ["mod+a"],
    icon: MousePointer2,
    run: (c) => c.store.getState().select(elementOrder(c)),
  },
  {
    id: "select.none",
    label: "Select none",
    group: "select",
    keys: ["mod+shift+a"],
    when: (c) => any(c.sel.names),
    run: (c) => c.store.getState().select([]),
  },
  {
    id: "select.next",
    label: "Select next",
    group: "select",
    keys: ["tab"],
    // With nothing selected Tab moves focus through the page as usual.
    when: (c) => any(c.sel.names),
    run: (c) => step(c, 1),
  },
  {
    id: "select.previous",
    label: "Select previous",
    group: "select",
    keys: ["shift+tab"],
    when: (c) => any(c.sel.names),
    run: (c) => step(c, -1),
  },
  {
    id: "select.connections",
    label: "Select connections",
    menuLabel: "Connections",
    description: "The connections to and from the selection",
    group: "select",
    keys: ["alt+shift+e"],
    when: (c) => any(c.sel.placeables),
    run: (c) => {
      const chosen = new Set(c.sel.placeables);
      const touching = [...c.diagram.connections.values()]
        .filter((x) => chosen.has(x.from.element) || chosen.has(x.to.element))
        .map((x) => x.name);
      if (touching.length > 0) c.store.getState().select(touching);
    },
  },
  {
    id: "select.connected",
    label: "Select connected elements",
    menuLabel: "Connected elements",
    group: "select",
    when: (c) => any(c.sel.placeables),
    run: (c) => {
      const chosen = new Set(c.sel.placeables);
      const found = new Set(chosen);
      for (const x of c.diagram.connections.values()) {
        if (chosen.has(x.from.element)) found.add(x.to.element);
        if (chosen.has(x.to.element)) found.add(x.from.element);
      }
      c.store.getState().select([...found]);
    },
  },
  {
    id: "select.children",
    label: "Select children",
    menuLabel: "Children",
    group: "select",
    keys: ["alt+shift+c"],
    when: (c) => elementOrder(c).some((n) => c.sel.containers.includes(parentOf(c, n) ?? "")),
    run: (c) =>
      c.store
        .getState()
        .select(elementOrder(c).filter((n) => c.sel.containers.includes(parentOf(c, n) ?? ""))),
  },
  {
    id: "select.parent",
    label: "Select parent container",
    menuLabel: "Parent container",
    group: "select",
    keys: ["alt+shift+p"],
    when: (c) => c.sel.single !== null && parentOf(c, c.sel.single) !== null,
    run: (c) => {
      const parent = c.sel.single === null ? null : parentOf(c, c.sel.single);
      if (parent !== null) c.store.getState().select([parent]);
    },
  },
  {
    id: "select.siblings",
    label: "Select siblings",
    menuLabel: "Siblings",
    group: "select",
    keys: ["alt+shift+s"],
    when: (c) => c.sel.single !== null && elementOrder(c).includes(c.sel.single),
    run: (c) => {
      const parent = c.sel.single === null ? null : parentOf(c, c.sel.single);
      c.store.getState().select(elementOrder(c).filter((n) => parentOf(c, n) === parent));
    },
  },
  {
    id: "select.source",
    label: "Select source",
    menuLabel: "Source",
    group: "select",
    when: (c) => any(c.sel.connections),
    run: (c) =>
      c.store
        .getState()
        .select(
          unique(c.sel.connections.map((n) => c.diagram.connections.get(n)?.from.element ?? "")),
        ),
  },
  {
    id: "select.target",
    label: "Select target",
    menuLabel: "Target",
    group: "select",
    when: (c) => any(c.sel.connections),
    run: (c) =>
      c.store
        .getState()
        .select(
          unique(c.sel.connections.map((n) => c.diagram.connections.get(n)?.to.element ?? "")),
        ),
  },
];

const unique = (names: readonly string[]): string[] => [...new Set(names)].filter(Boolean);

function zCommand(
  move: "front" | "forward" | "backward" | "back",
  label: string,
  key: string,
  icon: Icon,
): Command {
  return {
    id: `arrange.${move}`,
    label,
    group: "arrange",
    keys: [key],
    icon,
    when: (c) => c.sel.stackable && canZOrder(c.store, move),
    run: (c) => zOrder(c.store, move),
  };
}

/** What can be locked: anything selected but groups. */
const lockable = (c: CommandContext): readonly string[] =>
  c.sel.names.filter((n) => !c.diagram.groups.has(n));

const ALIGNABLE = (c: CommandContext): boolean =>
  c.sel.placeables.length + c.sel.decorations.length > 1;

function alignCommand(mode: AlignMode, label: string, key: string, icon: Icon): Command {
  return {
    id: `arrange.align-${mode}`,
    label,
    group: "arrange",
    keys: [key],
    icon,
    when: ALIGNABLE,
    run: (c) => align(c.store, mode),
  };
}

function resizeCommand(direction: "left" | "right" | "up" | "down"): Command {
  const [dw, dh] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
  return {
    id: `arrange.resize-${direction}`,
    label: { left: "Narrower", right: "Wider", up: "Shorter", down: "Taller" }[direction],
    group: "arrange",
    keys: [`mod+arrow${direction}`, `mod+shift+arrow${direction}`],
    palette: false,
    listed: false,
    when: (c) => c.sel.names.some((n) => isResizable(c.diagram, n)),
    run: (c) => {
      const by = c.event?.shiftKey === true ? 4 : 1;
      resizeBy(c.store, (dw ?? 0) * by, (dh ?? 0) * by);
    },
  };
}

/** ⌥⇧ + arrow: a connected copy of the one selected element that way (06 §9). */
function cloneCommand(direction: "left" | "right" | "up" | "down"): Command {
  return {
    id: `arrange.clone-${direction}`,
    label: `Add a connected copy ${direction === "up" ? "above" : direction === "down" ? "below" : `to the ${direction}`}`,
    group: "arrange",
    keys: [`alt+shift+arrow${direction}`],
    palette: false,
    listed: false,
    when: (c) => c.sel.single !== null && c.diagram.components.has(c.sel.single),
    run: (c) => {
      if (c.sel.single !== null) cloneAndConnect(c.store, c.sel.single, direction);
    },
  };
}

function nudgeCommand(direction: "left" | "right" | "up" | "down"): Command {
  const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
  return {
    id: `arrange.nudge-${direction}`,
    label: `Nudge ${direction}`,
    group: "arrange",
    keys: [`arrow${direction}`, `shift+arrow${direction}`],
    palette: false,
    listed: false,
    run: (c) => {
      const by = c.event?.shiftKey === true ? 4 : 1;
      nudge(c.store, (dx ?? 0) * by, (dy ?? 0) * by);
    },
  };
}

const ARRANGE: readonly Command[] = [
  zCommand("front", "Bring to front", "mod+alt+]", ChevronsUp),
  zCommand("forward", "Bring forward", "mod+]", ArrowUpToLine),
  zCommand("backward", "Send backward", "mod+[", ArrowDownToLine),
  zCommand("back", "Send to back", "mod+alt+[", ChevronsDown),
  {
    id: "arrange.group",
    label: "Group",
    group: "arrange",
    keys: ["mod+g"],
    icon: Group,
    when: (c) => any(c.sel.placeables),
    run: (c) => groupSelection(c.store),
  },
  {
    id: "arrange.ungroup",
    label: "Ungroup",
    description: "Remove the group outline; its members stay",
    group: "arrange",
    keys: ["mod+shift+g"],
    icon: Ungroup,
    when: (c) => any(c.sel.groups),
    run: (c) =>
      c.store
        .getState()
        .edit("Ungroup", (files, diagram) => deleteElements(files, diagram, c.sel.groups)),
  },
  alignCommand("left", "Align left", "alt+a", AlignStartVertical),
  alignCommand("center", "Align centres", "alt+h", AlignCenterHorizontal),
  alignCommand("right", "Align right", "alt+d", AlignEndVertical),
  alignCommand("top", "Align top", "alt+w", AlignStartHorizontal),
  alignCommand("middle", "Align middles", "alt+v", AlignCenterVertical),
  alignCommand("bottom", "Align bottom", "alt+s", AlignEndHorizontal),
  {
    id: "arrange.distribute-horizontal",
    label: "Distribute horizontally",
    group: "arrange",
    keys: ["alt+shift+h"],
    icon: AlignHorizontalJustifyCenter,
    when: (c) => c.sel.placeables.length + c.sel.decorations.length > 2,
    run: (c) => distribute(c.store, "horizontal"),
  },
  {
    id: "arrange.distribute-vertical",
    label: "Distribute vertically",
    group: "arrange",
    keys: ["alt+shift+v"],
    icon: AlignVerticalJustifyCenter,
    when: (c) => c.sel.placeables.length + c.sel.decorations.length > 2,
    run: (c) => distribute(c.store, "vertical"),
  },
  nudgeCommand("left"),
  nudgeCommand("right"),
  nudgeCommand("up"),
  nudgeCommand("down"),
  resizeCommand("left"),
  resizeCommand("right"),
  resizeCommand("up"),
  resizeCommand("down"),
  cloneCommand("left"),
  cloneCommand("right"),
  cloneCommand("up"),
  cloneCommand("down"),
  {
    id: "arrange.lock",
    label: (c) => (lockable(c).every((n) => isLocked(c.diagram, n)) ? "Unlock" : "Lock"),
    description: "Keep it from being moved, resized or deleted",
    group: "arrange",
    keys: ["mod+shift+l"],
    icon: Lock,
    when: (c) => lockable(c).length > 0,
    run: (c) => toggleLock(c.store),
  },
  {
    id: "arrange.tidy-up",
    label: (c) =>
      c.sel.kind === "container" && c.sel.single !== null
        ? "Tidy up inside"
        : "Tidy up the diagram",
    description: "Lay things out again by their traffic, sources on the left",
    group: "arrange",
    keys: ["mod+alt+t"],
    icon: Sparkles,
    when: (c) => c.sel.kind === "none" || (c.sel.kind === "container" && c.sel.single !== null),
    run: (c) => {
      const parent = c.sel.kind === "container" ? c.sel.single : null;
      const folder = c.store.getState().folder;
      c.store.getState().edit(
        parent === null ? "Tidy up" : "Tidy up inside",
        following(c.store, (files, diagram) => tidyUp(files, diagram, { parent, folder })),
      );
    },
  },
  {
    id: "arrange.fit-contents",
    label: "Fit to contents",
    description: "Shrink or grow the container around what it holds",
    group: "arrange",
    icon: Shrink,
    when: (c) => any(c.sel.containers),
    run: (c) => fitToContents(c.store, c.sel.containers),
  },
];

/** Whether the right-click point is on the one selected connection's line. */
function onSelectedLine(c: CommandContext): string | null {
  const name = c.sel.kind === "connection" ? c.sel.single : null;
  if (name === null || c.pointer === null) return null;
  const route = connectionRoute(c.store, name);
  if (route === null) return null;
  const reach = POINTER_REACH / c.store.getState().camera.zoom;
  return nearestAlong(route, c.pointer).distance <= reach ? name : null;
}

function bendUnderPointer(c: CommandContext): { name: string; index: number } | null {
  const name = c.sel.kind === "connection" ? c.sel.single : null;
  if (name === null || c.pointer === null) return null;
  const reach = POINTER_REACH / c.store.getState().camera.zoom;
  const index = waypointNear(c.store, name, c.pointer, reach);
  return index === null ? null : { name, index };
}

function routeCommand(route: RouteStyle, label: string): Command {
  return {
    id: `connection.route-${route}`,
    label: `Route: ${label}`,
    menuLabel: label,
    group: "connection",
    when: (c) => any(c.sel.connections),
    checked: (c) => c.sel.connections.every((n) => c.diagram.connections.get(n)?.route === route),
    run: (c) =>
      c.store
        .getState()
        .edit("Change route", (files, diagram) =>
          setConnectionRoute(files, diagram, { names: c.sel.connections, route }),
        ),
  };
}

const CONNECTION: readonly Command[] = [
  {
    id: "connection.reverse",
    label: "Reverse direction",
    menuLabel: "Reverse",
    group: "connection",
    keys: ["mod+r"],
    icon: ArrowLeftRight,
    when: (c) => any(c.sel.connections),
    run: (c) =>
      c.store
        .getState()
        .edit("Reverse connection", (files, diagram) =>
          reverseConnection(files, diagram, { names: c.sel.connections }),
        ),
  },
  {
    id: "connection.add-bend",
    label: "Add bend here",
    group: "connection",
    icon: Plus,
    palette: false,
    when: (c) => {
      const name = onSelectedLine(c);
      return (
        name !== null &&
        c.diagram.connections.get(name)?.route !== "orthogonal" &&
        bendUnderPointer(c) === null
      );
    },
    run: (c) => {
      const name = onSelectedLine(c);
      if (name !== null && c.pointer !== null) addWaypointAt(c.store, name, c.pointer);
    },
  },
  {
    id: "connection.remove-bend",
    label: "Remove bend",
    group: "connection",
    icon: X,
    palette: false,
    when: (c) => bendUnderPointer(c) !== null,
    run: (c) => {
      const bend = bendUnderPointer(c);
      if (bend !== null) removeWaypointAt(c.store, bend.name, bend.index);
    },
  },
  {
    id: "connection.clear-bends",
    label: "Clear bends",
    description: "Let the router choose the path again",
    group: "connection",
    keys: ["alt+shift+r"],
    icon: RotateCcw,
    when: (c) => c.sel.connections.some((n) => (c.diagram.layout.get(n)?.via?.length ?? 0) > 0),
    run: (c) =>
      c.store
        .getState()
        .edit("Clear bends", (files, diagram) =>
          resetConnectionPath(files, diagram, { names: c.sel.connections }),
        ),
  },
  {
    id: "connection.free-ends",
    label: "Free the ends",
    description: "Let both ends move around their elements again",
    group: "connection",
    icon: Unlink,
    when: (c) =>
      c.sel.connections.some((n) => {
        const entry = c.diagram.layout.get(n);
        return (entry?.fromAnchor ?? null) !== null || (entry?.toAnchor ?? null) !== null;
      }),
    run: (c) =>
      c.store
        .getState()
        .edit("Reset connection ends", (files, diagram) =>
          resetConnectionPath(files, diagram, { names: c.sel.connections, anchors: true }),
        ),
  },
  routeCommand("orthogonal", "Orthogonal"),
  routeCommand("curved", "Curved"),
  routeCommand("straight", "Straight"),
  ...LINE_PATTERNS.map((pattern): Command => ({
    id: `connection.line-${pattern}`,
    label: `Line: ${LINE_PATTERN_LABELS[pattern]}`,
    menuLabel: LINE_PATTERN_LABELS[pattern],
    group: "connection",
    when: (c) => any(c.sel.connections),
    checked: (c) =>
      c.sel.connections.every((n) => {
        const x = c.diagram.connections.get(n);
        return x?.dash === null && x.line === pattern;
      }),
    run: (c) =>
      c.store.getState().edit("Change line", (files, diagram) =>
        setConnectionLook(files, diagram, {
          names: c.sel.connections,
          look: { line: pattern, dash: null },
        }),
      ),
  })),
  ...FLOW_PRESETS.map((flow): Command => ({
    id: `connection.flow-${flow}`,
    label: `Flow: ${FLOW_INFO[flow].label}`,
    menuLabel: FLOW_INFO[flow].label,
    description: FLOW_INFO[flow].description,
    group: "connection",
    when: (c) => any(c.sel.connections),
    checked: (c) => c.sel.connections.every((n) => c.diagram.connections.get(n)?.flow === flow),
    run: (c) => setFlow(c.store, c.sel.connections, flow),
  })),
];

const STYLE: readonly Command[] = [
  ...STATE_PRESETS.map((state): Command => ({
    id: `style.state-${state}`,
    label: `State: ${STATE_INFO[state].label}`,
    menuLabel: STATE_INFO[state].label,
    description: STATE_INFO[state].description,
    group: "style",
    when: (c) => any(c.sel.placeables),
    run: (c) => setState(c.store, c.sel.placeables, state),
  })),
  ...MOTION_PRESETS.map((motion): Command => ({
    id: `style.motion-${motion}`,
    label: `Motion: ${MOTION_INFO[motion].label}`,
    menuLabel: MOTION_INFO[motion].label,
    description: MOTION_INFO[motion].description,
    group: "style",
    when: (c) => any(c.sel.components),
    run: (c) => setMotion(c.store, c.sel.components, motion),
  })),
];

function panelCommand(panel: "inspector" | "code" | "tours", label: string, icon: Icon): Command {
  return {
    id: `view.${panel}`,
    label,
    group: "view",
    icon,
    checked: (c) => c.store.getState().panels[panel],
    run: (c) => c.store.getState().togglePanel(panel),
  };
}

const VIEW: readonly Command[] = [
  {
    id: "view.zoom-fit",
    label: "Zoom to fit",
    group: "view",
    keys: ["shift+1"],
    icon: Maximize,
    run: (c) => zoomToFit(c.store),
  },
  {
    id: "view.zoom-selection",
    label: "Zoom to selection",
    group: "view",
    keys: ["shift+2"],
    icon: Scaling,
    when: (c) => any(c.sel.names),
    run: (c) => zoomToSelection(c.store),
  },
  {
    id: "view.zoom-100",
    label: "Zoom to 100%",
    group: "view",
    keys: ["shift+0"],
    run: (c) => zoomTo(c.store, 1),
  },
  {
    id: "view.zoom-in",
    label: "Zoom in",
    group: "view",
    keys: ["mod+=", "mod++"],
    run: (c) => zoomBy(c.store, 1.2),
  },
  {
    id: "view.zoom-out",
    label: "Zoom out",
    group: "view",
    keys: ["mod+-"],
    run: (c) => zoomBy(c.store, 1 / 1.2),
  },
  {
    id: "view.grid",
    label: "Show grid",
    group: "view",
    keys: ["mod+'"],
    icon: Grid3x3,
    checked: () => preference("showGrid"),
    run: (c) => c.store.getState().toggleGrid(),
  },
  {
    id: "view.properties",
    label: "All properties",
    description: "Open the properties panel",
    group: "view",
    icon: PanelRight,
    when: (c) => any(c.sel.names),
    run: (c) => c.store.getState().togglePanel("inspector", true),
  },
  {
    id: "view.diagram-settings",
    label: "Diagram settings",
    description: "Name, canvas, grid and files",
    group: "view",
    icon: Settings2,
    run: (c) => {
      const state = c.store.getState();
      state.select([]);
      state.togglePanel("inspector", true);
    },
  },
  {
    id: "view.minimap",
    label: "Minimap",
    group: "view",
    icon: MapIcon,
    checked: (c) => c.store.getState().showMinimap,
    run: (c) => c.store.getState().toggleMinimap(),
  },
  {
    id: "view.library",
    label: "Library",
    group: "view",
    icon: LibraryBig,
    checked: (c) => {
      const state = c.store.getState();
      return state.panels.library && state.leftTab === "library";
    },
    run: (c) => {
      const state = c.store.getState();
      if (state.panels.library && state.leftTab === "library") state.togglePanel("library", false);
      else state.showLeft("library");
    },
  },
  {
    id: "view.concepts",
    label: "Concepts",
    description: "Ready-made ideas to explain: apply, insert or open",
    group: "view",
    icon: Lightbulb,
    checked: (c) => {
      const state = c.store.getState();
      return state.panels.library && state.leftTab === "concepts";
    },
    run: (c) => {
      const state = c.store.getState();
      if (state.panels.library && state.leftTab === "concepts") state.togglePanel("library", false);
      else state.showLeft("concepts");
    },
  },
  {
    id: "view.browse-concepts",
    label: "Browse all concepts",
    description: "Every concept, with previews, by topic and platform",
    group: "view",
    icon: LayoutGrid,
    run: (c) => c.store.getState().setDialog("concepts"),
  },
  {
    id: "view.assistant",
    label: "Assistant",
    description: "Build and change the diagram by asking",
    group: "view",
    keys: ["mod+j"],
    icon: Sparkles,
    when: (c) => c.host.assistant !== undefined,
    checked: (c) => {
      const state = c.store.getState();
      return state.panels.library && state.leftTab === "assistant";
    },
    run: (c) => c.host.assistant?.(),
  },
  {
    id: "assistant.ask",
    label: "Ask the assistant about this",
    group: "view",
    icon: Sparkles,
    when: (c) => any(c.sel.names) && c.host.askAbout !== undefined,
    run: (c) => c.host.askAbout?.(),
  },
  panelCommand("inspector", "Properties", SlidersHorizontal),
  panelCommand("code", "YAML code", Code2),
  panelCommand("tours", "Tours", Route),
  {
    id: "view.open-nested",
    label: "Open nested diagram",
    group: "view",
    icon: Layers,
    when: (c) => c.sel.single !== null && c.diagram.components.get(c.sel.single)?.opens != null,
    run: (c) => {
      if (c.sel.single !== null) openNested(c.store, c.sel.single);
    },
  },
  {
    id: "view.show-yaml",
    label: "Show in YAML",
    description: "Open the code panel at this element's line",
    group: "view",
    icon: FileCode2,
    when: (c) => c.sel.single !== null && sourceOf(c, c.sel.single) !== null,
    run: (c) => {
      const source = c.sel.single === null ? null : sourceOf(c, c.sel.single);
      if (source !== null) c.store.getState().revealInCode(source.file, source.line);
    },
  },
  {
    id: "view.exit-nested",
    label: "Back to the parent diagram",
    group: "view",
    icon: CornerLeftUp,
    when: (c) => c.store.getState().levelPath.length > 0,
    run: (c) => exitNested(c.store),
  },
  {
    id: "view.preview",
    label: "Preview as viewers see it",
    group: "view",
    keys: ["shift+p"],
    icon: Eye,
    run: (c) => c.host.preview(),
  },
  {
    id: "view.present",
    label: "Present",
    group: "view",
    icon: MonitorPlay,
    run: (c) => c.host.present(),
  },
];

const SCENE: readonly Command[] = [
  {
    id: "scene.play",
    label: "Play scenes",
    group: "scene",
    keys: ["p"],
    icon: Play,
    run: (c) => c.host.togglePlay(),
  },
  {
    id: "scene.previous",
    label: "Previous scene",
    group: "scene",
    keys: ["["],
    icon: SkipBack,
    run: (c) => c.host.nextScene(-1),
  },
  {
    id: "scene.next",
    label: "Next scene",
    group: "scene",
    keys: ["]"],
    icon: SkipForward,
    run: (c) => c.host.nextScene(1),
  },
  {
    id: "scene.motion",
    label: "Pause or resume motion",
    group: "scene",
    keys: ["m"],
    icon: Pause,
    run: (c) => {
      const state = c.store.getState();
      state.setMotionPaused(!state.motionPaused);
    },
  },
];

const FILE: readonly Command[] = [
  {
    id: "file.make-concept",
    label: "Make a concept from the selection",
    group: "file",
    icon: Lightbulb,
    description: "Others can apply it to their own diagrams; its scenes tell the story.",
    when: (c) => any(c.sel.names),
    run: (c) => makeConceptFrom(c.store, c.sel.names),
  },
  {
    id: "file.save",
    label: "Save",
    group: "file",
    keys: ["mod+s"],
    icon: Save,
    run: (c) => c.host.save(),
  },
  {
    id: "file.save-to-cloud",
    label: "Save to cloud",
    description: "Keep it in your account and share it",
    group: "file",
    icon: Cloud,
    when: (c) => c.host.saveToCloud !== undefined,
    run: (c) => c.host.saveToCloud?.(),
  },
  {
    id: "file.download",
    label: "Download files",
    description: "Mogram YAML, or a zip for folders",
    group: "file",
    icon: Download,
    run: (c) => c.host.download(),
  },
  {
    id: "file.open",
    label: "Open files…",
    description: "Replace with .mogram.yaml or a folder",
    group: "file",
    keys: ["mod+o"],
    icon: FileUp,
    run: (c) => c.store.getState().setDialog("open"),
  },
  {
    id: "file.history",
    label: "Version history",
    description: "Earlier versions, what changed, and restore",
    group: "file",
    icon: History,
    when: (c) => c.host.history !== undefined,
    run: (c) => c.host.history?.(),
  },
  {
    id: "file.export",
    label: "Export",
    group: "file",
    keys: ["mod+e"],
    icon: Download,
    run: (c) => c.store.getState().setDialog("export"),
  },
];

const EXPORT: readonly Command[] = [
  {
    id: "file.copy-png",
    label: "Copy as PNG",
    description: "The diagram as it shows now",
    group: "file",
    keys: ["mod+shift+c"],
    icon: ImageIcon,
    run: (c) => copyImage(c.store, "png"),
  },
  {
    id: "file.copy-svg",
    label: "Copy as SVG",
    description: "SVG markup, for design tools and docs",
    group: "file",
    icon: FileCode2,
    run: (c) => copyImage(c.store, "svg"),
  },
];

const HELP: readonly Command[] = [
  {
    id: "palette.open",
    label: "Command palette",
    description: "Find any command, element or scene",
    group: "help",
    keys: ["mod+k", "/"],
    icon: Search,
    palette: false,
    run: (c) => c.store.getState().setDialog("palette"),
  },
  {
    id: "help.shortcuts",
    label: "Keyboard shortcuts",
    group: "help",
    keys: ["?"],
    icon: Keyboard,
    run: (c) => c.store.getState().setDialog("shortcuts"),
  },
];

export const COMMANDS: readonly Command[] = [
  ...TOOLS,
  ...EDIT,
  ...SELECT,
  ...ARRANGE,
  ...CONNECTION,
  ...STYLE,
  ...VIEW,
  ...SCENE,
  ...FILE,
  ...EXPORT,
  ...HELP,
];

const BY_ID = new Map(COMMANDS.map((command) => [command.id, command]));

export function command(id: string): Command | undefined {
  return BY_ID.get(id);
}

export function labelOf(cmd: Command, c: CommandContext): string {
  return typeof cmd.label === "function" ? cmd.label(c) : cmd.label;
}

export function isEnabled(cmd: Command, c: CommandContext): boolean {
  return cmd.when === undefined || cmd.when(c);
}

/** The command a key press runs now: the first that matches and applies. */
export function commandForKey(event: KeyInput, c: CommandContext): Command | undefined {
  return COMMANDS.find(
    (cmd) => cmd.keys?.some((combo) => matchesCombo(event, combo)) === true && isEnabled(cmd, c),
  );
}

export const GROUP_LABELS: Readonly<Record<CommandGroup, string>> = {
  tools: "Tools",
  edit: "Edit",
  select: "Select",
  arrange: "Arrange",
  connection: "Connections",
  style: "Style",
  view: "View",
  scene: "Scenes",
  file: "File",
  help: "Help",
};

/** Shortcuts that aren't commands of their own: held keys and drag modifiers. */
export const KEY_HINTS: readonly {
  readonly group: CommandGroup;
  readonly label: string;
  readonly keys: string;
}[] = [
  { group: "tools", label: "Pan while held", keys: "space" },
  { group: "arrange", label: "Nudge 1 grid unit (Shift: 4)", keys: "arrows" },
  {
    group: "arrange",
    label: "Resize containers, zones and notes 1 unit (Shift: 4)",
    keys: "mod+arrows",
  },
  { group: "arrange", label: "Add a connected copy that way", keys: "alt+shift+arrows" },
  { group: "arrange", label: "Copy instead of moving (at the drop)", keys: "mod+drag" },
  { group: "arrange", label: "Move without smart guides", keys: "alt+drag" },
  { group: "edit", label: "Add something here", keys: "dblclick" },
  { group: "connection", label: "Copy the connection while dragging an end", keys: "mod+drag" },
  { group: "connection", label: "Keep a bend that falls in line", keys: "alt+drag" },
  { group: "connection", label: "Drag along one axis", keys: "shift+drag" },
  { group: "connection", label: "Remove a bend", keys: "dblclick" },
];
