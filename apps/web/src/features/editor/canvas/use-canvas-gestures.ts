"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  appendTourStep,
  isLocked,
  moveElements,
  resizeElement,
  splitConnection,
  updateElement,
  type Move,
} from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import { SHAPE_ADJUST } from "@mogram/core/presets";
import { routeConnections, type RoutedPath } from "@mogram/core/routing";
import { snapToGuides } from "./guides";
import { splitTarget } from "./split";
import {
  GRID,
  computeLayout,
  descendantsOf,
  toUnits,
  type Box,
  type LayoutResult,
  type Point,
} from "@mogram/core/layout";
import { toWorld, wheelZoomFactor, zoomAt } from "@/features/canvas/camera";
import {
  addContainerBox,
  addNoteAt,
  addTextAt,
  addZoneBox,
  connect,
  containerAt,
  cloneAndConnect,
  cloneTo,
  following,
  isResizable,
  minimumSize,
  openQuickAdd,
  relativeTo,
  spotBeside,
  topLevelSelection,
} from "../actions";
import { openNested } from "../levels";
import type { EditorStore } from "../store/editor-store";
import {
  beginHandleDrag,
  beginLineDrag,
  endConnectionDrag,
  moveConnectionDrag,
  removeWaypointAt,
} from "./connection-drag";
import {
  intersectsFully,
  touches,
  MOVE_THRESHOLD,
  thresholdFor,
  normalize,
  sameParents,
  snap,
  type Gesture,
} from "./gesture-geometry";
import { hitAt } from "./hit";
import { resizeHandleOf } from "./overlays";

/** The element under a pointer or mouse event (see `hitAt` for how the hover halo is treated). */
function elementAt(event: { target: EventTarget | null; clientX: number; clientY: number }) {
  return hitAt(event.target, event.clientX, event.clientY);
}

/** The centre of a connection's label when `target` is (inside) one, else null. */
function labelCentre(target: EventTarget | null): Point | null {
  if (!(target instanceof Element)) return null;
  const label = target.closest('[data-part="label"]');
  if (label === null) return null;
  const x = Number(label.getAttribute("data-x"));
  const y = Number(label.getAttribute("data-y"));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Numbers each shape-handle drag, so its edits merge into one undo step of their own. */
let adjustSessions = 0;

function handleAt(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-handle]");
}

/** The pointer state machine for the editor canvas (ED-1, ED-5, ED-16, ED-18, ED-23). */
export function useCanvasGestures(
  store: EditorStore,
  host: React.RefObject<HTMLDivElement | null>,
) {
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const spaceDown = useRef(false);
  const frame = useRef<number | null>(null);

  // Space held = temporary hand tool.
  useEffect(() => {
    const isTyping = (event: KeyboardEvent): boolean =>
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTyping(event)) {
        spaceDown.current = true;
        if (host.current !== null) host.current.style.cursor = "grab";
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceDown.current = false;
        if (host.current !== null) host.current.style.cursor = "";
      }
    };
    // A keyup that happens in another app is never seen: forget Space whenever focus leaves.
    const reset = () => {
      spaceDown.current = false;
      if (host.current !== null) host.current.style.cursor = "";
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") reset();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [host]);

  // Escape cancels whatever is being dragged and puts everything back (draw.io does the same).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const current = gesture.current;
      if (current === null || current.kind === "pan" || current.kind === "pinch") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if ("pointerId" in current && host.current?.hasPointerCapture(current.pointerId) === true)
        host.current.releasePointerCapture(current.pointerId);
      gesture.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      const state = store.getState();
      if (current.kind === "adjust") {
        state.revertTyping(current.session);
        state.stopTyping(current.session);
      }
      state.setDrag(null);
      state.setMarquee(null);
      state.setResize(null);
      state.setConnect(null);
      state.setPathEdit(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [host, store]);

  // A preview frame queued just before the component goes away must not run afterwards.
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Wheel: pinch/ctrl zooms around the pointer, otherwise pans. Needs a non-passive listener.
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = store.getState();
      const rect = node.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (event.ctrlKey || event.metaKey) {
        const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
        state.setCamera(zoomAt(state.camera, anchor, state.camera.zoom * factor));
      } else {
        const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
        state.setCamera({ ...state.camera, x: state.camera.x - dx, y: state.camera.y - dy });
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [host, store]);

  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const worldPoint = (event: { clientX: number; clientY: number }): Point =>
    toWorld(store.getState().camera, screenPoint(event));

  /** What a press turns into once it moves: the selection's top-level elements, or null. */
  const beginMove = (): {
    names: string[];
    layout: LayoutResult;
    routes: ReadonlyMap<string, RoutedPath> | null;
    bounds: Box | null;
    neighbours: Box[];
    offset: { dx: number; dy: number };
  } | null => {
    const state = store.getState();
    const diagram = state.diagram();
    const layout = computeLayout(diagram);
    const selection = state.selection.flatMap(
      (name) => diagram.groups.get(name)?.members ?? [name],
    );
    // Locked elements stay put (they can still be selected and edited).
    const names = topLevelSelection(layout, selection).filter((name) => !isLocked(diagram, name));
    if (names.length === 0) return null;
    // One component on its own can be dropped onto a connection to split it (ED-29).
    const single = names.length === 1 && diagram.components.has(names[0] ?? "");
    // Smart guides: what's drawn (tiles for icons) beside the moving elements, in their container.
    const drawn = (name: string) => layout.tiles.get(name) ?? layout.elements.get(name)?.box;
    const moving = new Set(names.flatMap((name) => [name, ...descendantsOf(layout, name)]));
    const parent = layout.elements.get(names[0] ?? "")?.parent ?? null;
    const neighbours = [...layout.elements.values()]
      .filter((element) => element.parent === parent && !moving.has(element.name))
      .map((element) => drawn(element.name))
      .filter((box) => box !== undefined);
    const parentBox = parent === null ? undefined : layout.elements.get(parent)?.box;
    if (parentBox !== undefined) neighbours.push(parentBox);
    const boxes = names.map(drawn).filter((box) => box !== undefined);
    const bounds =
      boxes.length === 0
        ? null
        : {
            x: Math.min(...boxes.map((b) => b.x)),
            y: Math.min(...boxes.map((b) => b.y)),
            w: Math.max(...boxes.map((b) => b.x + b.w)) - Math.min(...boxes.map((b) => b.x)),
            h: Math.max(...boxes.map((b) => b.y + b.h)) - Math.min(...boxes.map((b) => b.y)),
          };
    return {
      names,
      layout,
      routes: single ? routeConnections(diagram, layout) : null,
      bounds,
      neighbours,
      offset: { dx: 0, dy: 0 },
    };
  };

  /**
   * The move's preview: the grid offset pulled onto smart guides (Alt turns them off), the
   * guides to draw, and where it will sit. Remembers the offset for the drop.
   */
  const previewMove = (
    move: {
      names: readonly string[];
      layout: LayoutResult;
      bounds: Box | null;
      neighbours: readonly Box[];
      offset: { dx: number; dy: number };
      routes: ReadonlyMap<string, RoutedPath> | null;
    },
    start: Point,
    world: Point,
    event: { altKey: boolean; shiftKey: boolean },
  ) => {
    const grid = { dx: snap(world.x - start.x), dy: snap(world.y - start.y) };
    const guided =
      move.bounds === null || event.altKey
        ? { ...grid, guides: [] }
        : snapToGuides(move.bounds, move.neighbours, grid.dx, grid.dy);
    move.offset = { dx: guided.dx, dy: guided.dy };
    const first = move.layout.elements.get(move.names[0] ?? "");
    const hint =
      move.names.length === 1 && first !== undefined && move.bounds !== null
        ? {
            text: `${first.rel.x + guided.dx / GRID}, ${first.rel.y + guided.dy / GRID}`,
            // Under the whole footprint, so it never covers a component's name.
            at: {
              x: first.box.x + guided.dx + first.box.w / 2,
              y: first.box.y + guided.dy + first.box.h + 6,
            },
          }
        : null;
    const target = containerAt(move.layout, world, new Set(move.names));
    const split = splitFor(move, guided.dx, guided.dy, event);
    schedule(() =>
      store.getState().setDrag({
        names: move.names,
        dx: guided.dx,
        dy: guided.dy,
        target,
        split,
        guides: guided.guides,
        hint,
      }),
    );
  };

  /** The connection the moving component would split if dropped now (no Alt or Shift). */
  const splitFor = (
    move: {
      names: readonly string[];
      layout: LayoutResult;
      routes: ReadonlyMap<string, RoutedPath> | null;
    },
    dx: number,
    dy: number,
    event: { altKey: boolean; shiftKey: boolean },
  ): string | null => {
    const name = move.names[0];
    const tile =
      name === undefined
        ? undefined
        : (move.layout.tiles.get(name) ?? move.layout.elements.get(name)?.box);
    if (move.routes === null || name === undefined || tile === undefined) return null;
    if (event.altKey || event.shiftKey) return null;
    const centre = { x: tile.x + tile.w / 2 + dx, y: tile.y + tile.h / 2 + dy };
    return splitTarget(store.getState().diagram(), move.layout, move.routes, name, tile, centre);
  };

  /**
   * Commits a move from where the pointer was released (not from the last preview frame, which
   * a quick flick may never have drawn).
   */
  const finishMove = (
    names: readonly string[],
    layout: LayoutResult,
    offset: { dx: number; dy: number },
    world: Point,
    split: string | null = null,
    clone = false,
  ): void => {
    const { dx, dy } = offset;
    const target = containerAt(layout, world, new Set(names));
    if (dx === 0 && dy === 0 && sameParents(layout, names, target)) return;
    const moves: Move[] = names.flatMap((name) => {
      const element = layout.elements.get(name);
      if (element === undefined) return [];
      const topLeft = { x: element.box.x + dx, y: element.box.y + dy };
      return [{ name, parent: target, at: relativeTo(layout, target, topLeft) }];
    });
    // Ctrl/Cmd held at the drop leaves the originals and puts copies there (06 §20 P1-13).
    if (clone) {
      cloneTo(store, names, moves);
      return;
    }
    const element = names[0];
    if (split !== null && element !== undefined) {
      const folder = store.getState().folder;
      const move = following(store, (files, diagram) => moveElements(files, diagram, moves));
      store.getState().edit("Insert into connection", (files, diagram) => {
        const moved = move(files, diagram);
        const next = parseDiagram(moved.files, folder).diagram;
        return splitConnection(moved.files, next, { name: split, element });
      });
      return;
    }
    store.getState().edit(
      "Move",
      following(store, (files, diagram) => moveElements(files, diagram, moves)),
    );
  };

  /** Coalesces preview updates to one per animation frame. */
  const schedule = (update: () => void) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      update();
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A field being typed in (the inspector's) saves as it loses focus. The browser would blur it
    // only after this press, once the selection had already moved to what was pressed; blurring
    // first saves the text while its element is still the selected one.
    const active = document.activeElement;
    if (active instanceof HTMLElement && !event.currentTarget.contains(active)) active.blur();
    const state = store.getState();
    const screen = screenPoint(event);
    pointers.current.set(event.pointerId, screen);

    if (pointers.current.size === 2) {
      // Second finger: switch to pinch-zoom, cancelling whatever the first finger started.
      cancelPreviews();
      const [a, b] = [...pointers.current.values()];
      if (a !== undefined && b !== undefined) {
        gesture.current = {
          kind: "pinch",
          startDistance: Math.hypot(a.x - b.x, a.y - b.y),
          startCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          camera: state.camera,
        };
      }
      return;
    }
    if (event.button === 2) return; // context menu handles right-click
    // Pointer capture starts with the first movement (see onPointerMove), not here: capturing on
    // press would retarget clicks and double-clicks to the canvas instead of the element.
    const world = toWorld(state.camera, screen);

    if (event.button === 1 || spaceDown.current || state.tool === "hand") {
      gesture.current = {
        kind: "pan",
        pointerId: event.pointerId,
        start: screen,
        camera: state.camera,
      };
      return;
    }

    // An earlier version is only looked at: a press selects (or draws a selection box), and
    // nothing moves, resizes or connects.
    if (state.viewing !== null) {
      const hit = elementAt(event);
      const additive = event.shiftKey || event.metaKey;
      if (hit !== null && !event.altKey) {
        state.select([hit.name], additive ? "add" : "replace");
        return;
      }
      if (!additive) state.select([]);
      state.setOpenCard(null);
      gesture.current =
        event.pointerType === "touch"
          ? { kind: "pan", pointerId: event.pointerId, start: screen, camera: state.camera }
          : {
              kind: "marquee",
              pointerId: event.pointerId,
              start: world,
              base: additive ? state.selection : [],
              layout: computeLayout(state.diagram()),
            };
      return;
    }

    const handle = handleAt(event.target);
    if (handle !== null) {
      const kind = handle.getAttribute("data-handle");
      const selected = state.selection[0];
      if (kind === "resize" && selected !== undefined) {
        const layout = computeLayout(state.diagram());
        const element = layout.elements.get(selected);
        if (element === undefined) return;
        const isZone = element.kind === "decoration";
        // A container can't be smaller than what it holds; shapes, zones and notes have a floor.
        const min = minimumSize(state.diagram(), selected);
        gesture.current = {
          kind: "resize",
          pointerId: event.pointerId,
          name: selected,
          handle: resizeHandleOf(handle.getAttribute("data-dir")),
          start: world,
          at: element.rel,
          size: element.size,
          minW: min.w,
          minH: min.h,
          siblings: [...layout.elements.values()]
            .filter(
              (other) =>
                other.parent === element.parent &&
                other.name !== selected &&
                isResizable(state.diagram(), other.name),
            )
            .map((other) => ({ name: other.name, w: other.size.w, h: other.size.h })),
          isZone,
        };
        return;
      }
      if (kind === "adjust" && selected !== undefined) {
        const shape = state.diagram().components.get(selected)?.shape;
        const box = computeLayout(state.diagram()).elements.get(selected)?.box;
        if (shape == null || box === undefined) return;
        const session = `adjust-${selected}-${++adjustSessions}`;
        state.startTyping(session);
        gesture.current = {
          kind: "adjust",
          pointerId: event.pointerId,
          name: selected,
          shape,
          box,
          session,
          last: null,
        };
        return;
      }
      if (kind === "connect") {
        const from = state.hovered ?? selected;
        if (from !== undefined && from !== null) {
          const direction = handle.getAttribute("data-direction");
          gesture.current = {
            kind: "connect",
            pointerId: event.pointerId,
            from,
            direction:
              direction === "up" ||
              direction === "right" ||
              direction === "down" ||
              direction === "left"
                ? direction
                : null,
            startScreen: screen,
          };
          state.setConnect({ from, pointer: world, target: null });
        }
        return;
      }
      if (
        (kind === "waypoint" || kind === "add-waypoint" || kind === "segment" || kind === "end") &&
        selected !== undefined
      ) {
        const drag = beginHandleDrag(store, event.pointerId, selected, handle, world);
        if (drag !== null)
          gesture.current = {
            kind: "path",
            pointerId: event.pointerId,
            drag,
            startScreen: screen,
            moved: false,
          };
        return;
      }
    }

    const hit = elementAt(event);
    if (state.tool === "connect") {
      if (hit !== null && (hit.kind === "component" || hit.kind === "container")) {
        gesture.current = {
          kind: "connect",
          pointerId: event.pointerId,
          from: hit.name,
          direction: null,
          startScreen: screen,
        };
        state.setConnect({ from: hit.name, pointer: world, target: null });
      }
      return;
    }
    if (state.tool === "container" || state.tool === "zone") {
      gesture.current = {
        kind: "draw",
        pointerId: event.pointerId,
        start: { x: snap(world.x), y: snap(world.y) },
        tool: state.tool,
      };
      return;
    }
    if (state.tool === "text" || state.tool === "label") {
      addTextAt(store, state.tool, { x: snap(world.x), y: snap(world.y) });
      state.setTool("select");
      return;
    }
    if (state.tool === "note") {
      addNoteAt(store, { x: snap(world.x), y: snap(world.y) });
      state.setTool("select");
      return;
    }

    // On a touch screen one finger on empty canvas pans, like every map and photo app (the Hand
    // tool and two-finger drag do too); drag-to-select needs a mouse or pen.
    if (hit === null && event.pointerType === "touch") {
      state.select([]);
      state.setOpenCard(null);
      gesture.current = {
        kind: "pan",
        pointerId: event.pointerId,
        start: screen,
        camera: state.camera,
      };
      return;
    }

    if (hit === null || event.altKey) {
      const additive = event.shiftKey || event.metaKey;
      if (!additive) state.select([]);
      state.setOpenCard(null);
      gesture.current = {
        kind: "marquee",
        pointerId: event.pointerId,
        start: world,
        base: additive ? state.selection : [],
        layout: computeLayout(state.diagram()),
      };
      return;
    }

    const wasSelected = state.selection.includes(hit.name);
    const additive = event.shiftKey || event.metaKey;
    if (!wasSelected) state.select([hit.name], additive ? "add" : "replace");
    gesture.current = {
      kind: "press",
      threshold: thresholdFor(event.pointerType),
      pointerId: event.pointerId,
      element: hit.name,
      start: world,
      startScreen: screen,
      additive,
      wasSelected,
      label: hit.kind === "connection" ? labelCentre(event.target) : null,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = store.getState();
    const screen = screenPoint(event);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, screen);
    const current = gesture.current;
    // A gesture that is really dragging keeps receiving events even outside the canvas.
    if (
      current !== null &&
      current.kind !== "press" &&
      current.kind !== "pinch" &&
      host.current?.hasPointerCapture(current.pointerId) === false
    ) {
      host.current.setPointerCapture(current.pointerId);
    }

    if (current === null) {
      if (state.tool === "select" || state.tool === "connect") {
        const hit = elementAt(event);
        const handle = handleAt(event.target);
        if (handle?.getAttribute("data-handle") !== "connect") state.setHovered(hit?.name ?? null);
      }
      return;
    }

    if (current.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (a === undefined || b === undefined) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(
        current.camera,
        current.startCenter,
        current.camera.zoom * (distance / Math.max(1, current.startDistance)),
      );
      state.setCamera({
        ...zoomed,
        x: zoomed.x + center.x - current.startCenter.x,
        y: zoomed.y + center.y - current.startCenter.y,
      });
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    const world = toWorld(state.camera, screen);

    switch (current.kind) {
      case "pan":
        state.setCamera({
          ...current.camera,
          x: current.camera.x + screen.x - current.start.x,
          y: current.camera.y + screen.y - current.start.y,
        });
        return;
      case "press": {
        if (
          Math.hypot(screen.x - current.startScreen.x, screen.y - current.startScreen.y) <
          current.threshold
        )
          return;
        // Dragging a connection reshapes it: its end, label, segment or a new bend (ED-29).
        if (state.diagram().connections.has(current.element)) {
          // Shift or Cmd while pressing adds the connection to the selection; it doesn't reshape it.
          const drag = current.additive
            ? null
            : beginLineDrag(
                store,
                current.pointerId,
                current.element,
                current.start,
                current.label,
              );
          if (drag === null) {
            gesture.current = null;
            return;
          }
          state.select([current.element]);
          gesture.current = {
            kind: "path",
            pointerId: current.pointerId,
            drag,
            startScreen: current.startScreen,
            moved: true,
          };
          moveConnectionDrag(store, drag, world, event);
          return;
        }
        const moving = beginMove();
        if (moving === null) {
          gesture.current = null;
          return;
        }
        const move = {
          kind: "move" as const,
          pointerId: current.pointerId,
          ...moving,
          start: current.start,
        };
        gesture.current = move;
        // Preview straight away, so even a single move event shows where it's going.
        previewMove(move, current.start, world, event);
        return;
      }
      case "move": {
        previewMove(current, current.start, world, event);
        return;
      }
      case "marquee":
      case "draw": {
        const box = normalize(current.start, world);
        schedule(() => store.getState().setMarquee(box));
        if (current.kind === "marquee") {
          const { layout } = current;
          // Enclosed by default, so big containers aren't always caught; Alt takes whatever the
          // box touches (06 §20 P2-16).
          const caught = event.altKey ? touches : intersectsFully;
          const inside = [...layout.elements.values()]
            .filter((element) =>
              caught(
                box,
                element.kind === "component"
                  ? (layout.tiles.get(element.name) ?? element.box)
                  : element.box,
              ),
            )
            .map((element) => element.name);
          state.select([...new Set([...current.base, ...inside])]);
        }
        return;
      }
      case "adjust": {
        const adjust = SHAPE_ADJUST[current.shape];
        if (adjust === undefined) return;
        const { w, h } = current.box;
        const local = { x: world.x - current.box.x, y: world.y - current.box.y };
        const value = Math.round(Math.max(0, Math.min(adjust.from(w, h, local), adjust.max(w, h))));
        if (value === current.last) return;
        current.last = value;
        // The shape's own measure isn't written (FI-3).
        const written = value === Math.round(adjust.initial(w, h)) ? null : value;
        schedule(() =>
          store.getState().edit(`Change ${adjust.label.toLowerCase()}`, (files, diagram) =>
            updateElement(files, diagram, {
              name: current.name,
              set: { [adjust.key]: written },
            }),
          ),
        );
        return;
      }
      case "resize": {
        const du = toUnits(world.x - current.start.x);
        const dv = toUnits(world.y - current.start.y);
        let { x, y } = current.at;
        let { w, h } = current.size;
        if (current.handle.includes("e")) w = Math.max(current.minW, current.size.w + du);
        if (current.handle.includes("s")) h = Math.max(current.minH, current.size.h + dv);
        if (current.handle.includes("w")) {
          const next = Math.max(current.minW, current.size.w - du);
          x = current.at.x + (current.size.w - next);
          w = next;
        }
        if (current.handle.includes("n")) {
          const next = Math.max(current.minH, current.size.h - dv);
          y = current.at.y + (current.size.h - next);
          h = next;
        }
        // Size guides: within a cell of a sibling's width or height, take it (Alt: don't).
        const matches = { w: [] as string[], h: [] as string[] };
        if (!event.altKey) {
          // Only the sides being dragged snap and get marked.
          const sideways = current.handle.includes("e") || current.handle.includes("w");
          const upDown = current.handle.includes("n") || current.handle.includes("s");
          const near = (value: number, axis: "w" | "h") =>
            current.siblings.find((other) => Math.abs(other[axis] - value) <= 1)?.[axis];
          const snapW = sideways ? near(w, "w") : undefined;
          const snapH = upDown ? near(h, "h") : undefined;
          if (snapW !== undefined && snapW >= current.minW) {
            if (current.handle.includes("w")) x += w - snapW;
            w = snapW;
          }
          if (snapH !== undefined && snapH >= current.minH) {
            if (current.handle.includes("n")) y += h - snapH;
            h = snapH;
          }
          for (const other of current.siblings) {
            if (sideways && other.w === w) matches.w.push(other.name);
            if (upDown && other.h === h) matches.h.push(other.name);
          }
        }
        schedule(() =>
          store.getState().setResize({ name: current.name, at: { x, y }, size: { w, h }, matches }),
        );
        return;
      }
      case "connect": {
        // The canvas holds the pointer capture, so ask what is under the pointer instead.
        const hit = elementAt({
          target: document.elementFromPoint(event.clientX, event.clientY),
          clientX: event.clientX,
          clientY: event.clientY,
        });
        const target =
          hit !== null &&
          hit.name !== current.from &&
          (hit.kind === "component" || hit.kind === "container")
            ? hit.name
            : null;
        schedule(() => store.getState().setConnect({ from: current.from, pointer: world, target }));
        return;
      }
      case "path": {
        if (
          !current.moved &&
          Math.hypot(screen.x - current.startScreen.x, screen.y - current.startScreen.y) <
            MOVE_THRESHOLD
        )
          return;
        current.moved = true;
        const pointer = {
          clientX: event.clientX,
          clientY: event.clientY,
          shiftKey: event.shiftKey,
        };
        schedule(() => moveConnectionDrag(store, current.drag, world, pointer));
        return;
      }
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    const state = store.getState();
    if (current === null) return;
    if (current.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const world = worldPoint(event);

    switch (current.kind) {
      case "press": {
        // Released past the drag threshold without a move event in between: still a move.
        const screen = screenPoint(event);
        const travelled = Math.hypot(
          screen.x - current.startScreen.x,
          screen.y - current.startScreen.y,
        );
        if (travelled >= current.threshold && state.tourAuthoring === null) {
          const moving = beginMove();
          if (moving !== null)
            finishMove(
              moving.names,
              moving.layout,
              { dx: snap(world.x - current.start.x), dy: snap(world.y - current.start.y) },
              world,
            );
          return;
        }
        // Tour authoring: clicking elements in order appends steps (TO-9).
        const diagram = state.diagram();
        if (
          state.tourAuthoring !== null &&
          (diagram.components.has(current.element) || diagram.containers.has(current.element))
        ) {
          const tour = state.tourAuthoring;
          state.edit("Add tour step", (files, d) =>
            appendTourStep(files, d, { tour, target: current.element }),
          );
          return;
        }
        // A plain click on something already selected narrows (or with shift, toggles) the selection.
        if (current.wasSelected)
          state.select([current.element], current.additive ? "toggle" : "replace");
        return;
      }
      case "move": {
        state.setDrag(null);
        const clone = event.ctrlKey || event.metaKey;
        finishMove(
          current.names,
          current.layout,
          current.offset,
          world,
          clone ? null : splitFor(current, current.offset.dx, current.offset.dy, event),
          clone,
        );
        return;
      }
      case "marquee":
        state.setMarquee(null);
        return;
      case "draw": {
        state.setMarquee(null);
        const box = normalize(current.start, { x: snap(world.x), y: snap(world.y) });
        const sized =
          box.w < 32 || box.h < 32
            ? {
                x: box.x,
                y: box.y,
                w: current.tool === "zone" ? 240 : 320,
                h: current.tool === "zone" ? 160 : 200,
              }
            : box;
        if (current.tool === "container") addContainerBox(store, "box", "Container", sized);
        else addZoneBox(store, sized);
        state.setTool("select");
        return;
      }
      case "adjust": {
        state.stopTyping(current.session);
        return;
      }
      case "resize": {
        const preview = state.resize;
        state.setResize(null);
        if (preview === null) return;
        const unchanged =
          preview.size.w === current.size.w &&
          preview.size.h === current.size.h &&
          preview.at.x === current.at.x &&
          preview.at.y === current.at.y;
        if (unchanged) return;
        const atChanged = preview.at.x !== current.at.x || preview.at.y !== current.at.y;
        state.edit(
          "Resize",
          following(store, (files, diagram) =>
            resizeElement(files, diagram, {
              name: current.name,
              size: preview.size,
              ...(atChanged ? { at: preview.at } : {}),
            }),
          ),
        );
        return;
      }
      case "connect": {
        const draft = state.connect;
        state.setConnect(null);
        // A click on a hover arrow (no drag): add a connected copy that way, or with Alt,
        // choose what to add there (06-canvas-interactions §9).
        const screen = screenPoint(event);
        const clicked =
          Math.hypot(screen.x - current.startScreen.x, screen.y - current.startScreen.y) <
          MOVE_THRESHOLD;
        if (clicked && current.direction !== null) {
          if (event.altKey) {
            const spot = spotBeside(
              computeLayout(state.diagram()),
              current.from,
              current.direction,
            );
            if (spot !== null)
              openQuickAdd(
                store,
                { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 },
                { name: current.from, direction: current.direction },
              );
          } else {
            cloneAndConnect(store, current.from, current.direction);
          }
          return;
        }
        if (draft?.target != null) {
          connect(store, current.from, draft.target);
          if (state.tool === "connect") state.setTool("select");
        }
        return;
      }
      case "path": {
        if (!current.moved) {
          state.setPathEdit(null);
          return;
        }
        endConnectionDrag(store, current.drag, event);
        return;
      }
      case "pan":
        return;
    }
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const state = store.getState();
    const handle = state.viewing === null ? handleAt(event.target) : null;
    if (handle?.getAttribute("data-handle") === "waypoint") {
      const name = state.selection[0];
      if (name !== undefined)
        removeWaypointAt(store, name, Number(handle.getAttribute("data-index") ?? "0"));
      return;
    }
    if (handle !== null) return;
    const hit = elementAt(event);
    // An earlier version can be gone into (nested diagrams), not added to or typed in.
    if (state.viewing !== null) {
      if (hit?.kind === "component") openNested(store, hit.name);
      return;
    }
    // Double-click on empty canvas: choose something to add right there (06 §20 P1-10).
    if (hit === null) {
      // Not while going in or out of a nested diagram: the canvas under the pointer is moving.
      if (state.tool === "select" && state.levelZoom === null)
        openQuickAdd(store, worldPoint(event));
      return;
    }
    if (hit.kind === "component" && openNested(store, hit.name)) return;
    state.select([hit.name]);
    state.setEditingLabel(hit.name);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (current?.kind === "adjust") store.getState().stopTyping(current.session);
    gesture.current = null;
    cancelPreviews();
  };

  function cancelPreviews() {
    // Drop any queued preview update first, or it would re-apply after the reset below.
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const state = store.getState();
    state.setDrag(null);
    state.setMarquee(null);
    state.setResize(null);
    state.setConnect(null);
    state.setPathEdit(null);
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick };
}
