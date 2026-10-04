"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  appendTourStep,
  moveElements,
  resizeElement,
  setConnectionPath,
  type Move,
} from "@mogram/core/edit";
import {
  CONTAINER_UNITS,
  computeLayout,
  toUnits,
  type LayoutResult,
  type Point,
} from "@mogram/core/layout";
import { viaOrigin } from "@mogram/core/routing";
import { toWorld, wheelZoomFactor, zoomAt } from "@/features/canvas/camera";
import {
  addContainerBox,
  addNoteAt,
  addTextAt,
  addZoneBox,
  connect,
  containerAt,
  relativeTo,
  topLevelSelection,
} from "../actions";
import { openNested } from "../levels";
import type { EditorStore } from "../store/editor-store";
import {
  currentVia,
  insertionIndex,
  intersectsFully,
  MOVE_THRESHOLD,
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
  const beginMove = (): { names: string[]; layout: LayoutResult } | null => {
    const state = store.getState();
    const diagram = state.diagram();
    const layout = computeLayout(diagram);
    const selection = state.selection.flatMap(
      (name) => diagram.groups.get(name)?.members ?? [name],
    );
    const names = topLevelSelection(layout, selection);
    return names.length === 0 ? null : { names, layout };
  };

  /**
   * Commits a move from where the pointer was released (not from the last preview frame, which
   * a quick flick may never have drawn).
   */
  const finishMove = (
    names: readonly string[],
    layout: LayoutResult,
    start: Point,
    world: Point,
  ): void => {
    const dx = snap(world.x - start.x);
    const dy = snap(world.y - start.y);
    const target = containerAt(layout, world, new Set(names));
    if (dx === 0 && dy === 0 && sameParents(layout, names, target)) return;
    const moves: Move[] = names.flatMap((name) => {
      const element = layout.elements.get(name);
      if (element === undefined) return [];
      const topLeft = { x: element.box.x + dx, y: element.box.y + dy };
      return [{ name, parent: target, at: relativeTo(layout, target, topLeft) }];
    });
    store.getState().edit("Move", (files, diagram) => moveElements(files, diagram, moves));
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

    const handle = handleAt(event.target);
    if (handle !== null) {
      const kind = handle.getAttribute("data-handle");
      const selected = state.selection[0];
      if (kind === "resize" && selected !== undefined) {
        const layout = computeLayout(state.diagram());
        const element = layout.elements.get(selected);
        if (element === undefined) return;
        const isZone = element.kind === "decoration";
        const isNote = state.diagram().decorations.get(selected)?.variant === "note";
        // A container can't be smaller than what it holds: lay it out with no size of its own
        // to find that (its label, its children and their padding).
        const fitted = isZone
          ? null
          : computeLayout(state.diagram(), {
              sizes: new Map([[selected, { w: 0, h: 0 }]]),
            }).elements.get(selected)?.size;
        gesture.current = {
          kind: "resize",
          pointerId: event.pointerId,
          name: selected,
          handle: resizeHandleOf(handle.getAttribute("data-dir")),
          start: world,
          at: element.rel,
          size: element.size,
          minW: isNote ? 8 : isZone ? 4 : (fitted?.w ?? CONTAINER_UNITS.minW),
          minH: isNote ? 6 : isZone ? 3 : (fitted?.h ?? CONTAINER_UNITS.minH),
          isZone,
        };
        return;
      }
      if (kind === "connect") {
        const from = state.hovered ?? selected;
        if (from !== undefined && from !== null) {
          gesture.current = { kind: "connect", pointerId: event.pointerId, from };
          state.setConnect({ from, pointer: world, target: null });
        }
        return;
      }
      if ((kind === "waypoint" || kind === "add-waypoint") && selected !== undefined) {
        const layout = computeLayout(state.diagram());
        const via = currentVia(state.diagram(), layout, selected);
        let index = Number(handle.getAttribute("data-index") ?? "0");
        if (kind === "add-waypoint") {
          const point = {
            x: Number(handle.getAttribute("data-x")),
            y: Number(handle.getAttribute("data-y")),
          };
          index = insertionIndex(state, layout, selected, via, point);
          via.splice(index, 0, { x: snap(point.x), y: snap(point.y) });
        }
        gesture.current = {
          kind: "bend",
          pointerId: event.pointerId,
          connection: selected,
          index,
          via,
          layout,
        };
        state.setBend({ connection: selected, via });
        return;
      }
    }

    const hit = elementAt(event);
    if (state.tool === "connect") {
      if (hit !== null && (hit.kind === "component" || hit.kind === "container")) {
        gesture.current = { kind: "connect", pointerId: event.pointerId, from: hit.name };
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
      pointerId: event.pointerId,
      element: hit.name,
      start: world,
      startScreen: screen,
      additive,
      wasSelected,
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
          MOVE_THRESHOLD
        )
          return;
        const moving = beginMove();
        if (moving === null) {
          gesture.current = null;
          return;
        }
        gesture.current = {
          kind: "move",
          pointerId: current.pointerId,
          ...moving,
          start: current.start,
        };
        // Preview straight away, so even a single move event shows where it's going.
        const target = containerAt(moving.layout, world, new Set(moving.names));
        const [dx, dy] = [snap(world.x - current.start.x), snap(world.y - current.start.y)];
        schedule(() => store.getState().setDrag({ names: moving.names, dx, dy, target }));
        return;
      }
      case "move": {
        const dx = snap(world.x - current.start.x);
        const dy = snap(world.y - current.start.y);
        const target = containerAt(current.layout, world, new Set(current.names));
        schedule(() => store.getState().setDrag({ names: current.names, dx, dy, target }));
        return;
      }
      case "marquee":
      case "draw": {
        const box = normalize(current.start, world);
        schedule(() => store.getState().setMarquee(box));
        if (current.kind === "marquee") {
          const { layout } = current;
          const inside = [...layout.elements.values()]
            .filter((element) =>
              intersectsFully(
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
        schedule(() =>
          store.getState().setResize({ name: current.name, at: { x, y }, size: { w, h } }),
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
      case "bend": {
        const via = current.via.map((point, index) =>
          index === current.index ? { x: snap(world.x), y: snap(world.y) } : point,
        );
        current.via = via;
        schedule(() => store.getState().setBend({ connection: current.connection, via }));
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
        if (travelled >= MOVE_THRESHOLD && state.tourAuthoring === null) {
          const moving = beginMove();
          if (moving !== null) finishMove(moving.names, moving.layout, current.start, world);
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
      case "move":
        state.setDrag(null);
        finishMove(current.names, current.layout, current.start, world);
        return;
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
        state.edit("Resize", (files, diagram) =>
          resizeElement(files, diagram, {
            name: current.name,
            size: preview.size,
            ...(atChanged ? { at: preview.at } : {}),
          }),
        );
        return;
      }
      case "connect": {
        const draft = state.connect;
        state.setConnect(null);
        if (draft?.target != null) {
          connect(store, current.from, draft.target);
          if (state.tool === "connect") state.setTool("select");
        }
        return;
      }
      case "bend": {
        state.setBend(null);
        const connection = state.diagram().connections.get(current.connection);
        if (connection === undefined) return;
        const origin = viaOrigin(current.layout, connection);
        const via = current.via.map((point) => ({
          x: toUnits(point.x - origin.x),
          y: toUnits(point.y - origin.y),
        }));
        state.edit("Bend connection", (files, diagram) =>
          setConnectionPath(files, diagram, { name: current.connection, via }),
        );
        return;
      }
      case "pan":
        return;
    }
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const state = store.getState();
    const handle = handleAt(event.target);
    if (handle?.getAttribute("data-handle") === "waypoint") {
      const name = state.selection[0];
      if (name === undefined) return;
      const layout = computeLayout(state.diagram());
      const via = currentVia(state.diagram(), layout, name);
      via.splice(Number(handle.getAttribute("data-index") ?? "0"), 1);
      const connection = state.diagram().connections.get(name);
      if (connection === undefined) return;
      const origin = viaOrigin(layout, connection);
      state.edit("Remove bend", (files, diagram) =>
        setConnectionPath(files, diagram, {
          name,
          via:
            via.length === 0
              ? null
              : via.map((p) => ({ x: toUnits(p.x - origin.x), y: toUnits(p.y - origin.y) })),
        }),
      );
      return;
    }
    const hit = elementAt(event);
    if (hit === null) return;
    if (hit.kind === "component" && openNested(store, hit.name)) return;
    state.select([hit.name]);
    state.setEditingLabel(hit.name);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
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
    state.setBend(null);
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick };
}
