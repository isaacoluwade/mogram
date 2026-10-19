"use client";

import { useCapacity } from "@/features/canvas/capacity";
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "@mogram/core/layout";
import { centerOn, toWorld, wheelZoomFactor, zoomAt, type Camera } from "@/features/canvas/camera";
import { buildScene } from "@/features/canvas/scene";
import { resolveFor } from "@/features/canvas/use-diagram";
import { useFontsVersion } from "@/features/canvas/text";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { LevelTransition } from "@/features/canvas/level-transition";
import { useMounted } from "@/lib/use-mounted";
import { StubsOverlay } from "@/features/canvas/svg/stubs";
import { onReducedMotionChange, prefersReducedMotion } from "@/lib/use-reduced-motion";
import {
  useViewer,
  useViewerClock,
  useViewerController,
  useViewerShallow,
  useViewerStore,
} from "./viewer-context";

const CLICK_SLOP = 5;
/** How long after a change of picture ends its "from" side is kept, in ms. */
const SETTLE_MARGIN = 100;

type Gesture =
  | {
      kind: "pan";
      pointerId: number;
      start: Point;
      camera: Camera;
      moved: boolean;
      target: EventTarget | null;
    }
  | { kind: "pinch"; startDistance: number; startCenter: Point; camera: Camera };

function elementAt(target: EventTarget | null): { name: string; kind: string } | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-element]");
  const name = node?.getAttribute("data-element");
  const kind = node?.getAttribute("data-kind");
  return name == null || kind == null ? null : { name, kind };
}

/** The read-only canvas (SH-2): pan, pinch and wheel zoom, click for cards, double-click to go inside. */
export function ViewerCanvas() {
  const store = useViewerStore();
  const controller = useViewerController();
  const clock = useViewerClock();
  const mounted = useMounted();
  const host = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const view = useViewerShallow((s) => ({
    levelPath: s.levelPath,
    scene: s.scene,
    story: s.story,
    previous: s.previous,
    transitionStart: s.transitionStart,
    transitionSeconds: s.transitionSeconds,
    controls: s.controls,
    ramp: s.ramp,
    viewerEntries: s.viewerEntries,
    camera: s.camera,
    viewport: s.viewport,
    focus: s.focus,
    levelZoom: s.levelZoom,
    ready: s.ready,
    slide: s.slide,
  }));

  const geometry = controller.geometry(view.levelPath);
  const current = useMemo(
    () =>
      controller.levels.resolve(
        view.levelPath,
        { scene: view.scene, story: view.story, controls: view.controls },
        view.viewerEntries,
      ),
    [controller, view.levelPath, view.scene, view.story, view.controls, view.viewerEntries],
  );
  const previous = useMemo(
    () =>
      view.transitionStart === null || view.previous === null
        ? null
        : controller.levels.resolve(view.levelPath, view.previous, view.viewerEntries),
    [controller, view.levelPath, view.previous, view.transitionStart, view.viewerEntries],
  );
  const stubs = useMemo(
    () => controller.levels.stubs(view.levelPath),
    [controller, view.levelPath],
  );
  const parentFlows = useMemo(
    () => controller.parentFlows(view.levelPath),
    // The flows follow the scene and "what if" changes, which the controller reads from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, view.levelPath, view.scene, view.story, view.controls, view.viewerEntries],
  );
  const fonts = useFontsVersion();
  const model = useMemo(
    () =>
      current === null
        ? null
        : buildScene({
            diagram: geometry.diagram,
            files: controller.levels.files,
            layout: geometry.layout,
            routes: geometry.routes,
            current,
            previous,
            transitionStart: view.transitionStart,
            transitionSeconds: view.transitionSeconds,
            ramp: view.ramp,
            theme: geometry.theme,
            fontFamily: "Inter",
            fontsVersion: fonts,
          }),
    [
      controller,
      geometry,
      current,
      previous,
      view.transitionStart,
      view.transitionSeconds,
      view.ramp,
      fonts,
    ],
  );

  // A deck's frame (D-99): one diagram drawn under every slide's own, with the slide's number
  // and section in whatever labels ask for them. It isn't part of the slide: nothing in it
  // can be clicked, and it doesn't play.
  const frameFolder = view.levelPath.length === 0 ? controller.frameFolder : null;
  const frame = useMemo(() => {
    if (frameFolder === null) return null;
    const under = controller.levels.geometry(frameFolder);
    return buildScene({
      diagram: under.diagram,
      files: controller.levels.files,
      layout: under.layout,
      routes: under.routes,
      current: resolveFor(controller.levels.files, frameFolder, under.diagram, null),
      previous: null,
      transitionStart: null,
      theme: under.theme,
      fontFamily: "Inter",
      fontsVersion: fonts,
    });
    // The frame is dressed for the slide showing, which `view.slide` says has changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, frameFolder, view.slide, fonts]);

  // Size tracking; the first size known also frames the diagram (deep links override this).
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined || entry.contentRect.width === 0) return;
      store
        .getState()
        .setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [store]);

  // A change of scene or step animates; then the "from" state is dropped so nothing keeps ticking.
  useEffect(() => {
    if (view.transitionStart === null) return;
    const settle = view.transitionSeconds * 1000 + SETTLE_MARGIN;
    const remaining = Math.max(0, settle - (clock.time() - view.transitionStart) * 1000);
    const timer = window.setTimeout(() => store.getState().settleTransition(), remaining);
    return () => window.clearTimeout(timer);
  }, [view.transitionStart, view.transitionSeconds, clock, store]);

  // The motion toggle holds every animation still (PR-9); it starts paused for reduced motion,
  // and follows the system setting if that changes mid-session.
  const motionPaused = useViewer((s) => s.motionPaused);
  // Capacity over time (D-82, D-84): copies boot and drain as scenes or traffic patterns change.
  const capacity = useCapacity(geometry.diagram, current, () => clock.time(), motionPaused);
  const animating = useViewer((s) => s.animating);
  useEffect(() => {
    if (motionPaused) clock.pause();
    else clock.resume();
    clock.tick();
  }, [clock, motionPaused]);
  useEffect(
    () => onReducedMotionChange(() => store.getState().setMotionPaused(prefersReducedMotion())),
    [store],
  );

  // Wheel: ctrl/⌘ or pinch zooms around the pointer, otherwise pans.
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      controller.animator.cancel();
      const state = store.getState();
      if (state.tour !== null) state.setWandered(true);
      const rect = node.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (event.ctrlKey || event.metaKey) {
        const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
        state.setCamera(zoomAt(state.camera, anchor, state.camera.zoom * factor));
      } else {
        state.setCamera({
          ...state.camera,
          x: state.camera.x - event.deltaX,
          y: state.camera.y - event.deltaY,
        });
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [controller, store]);

  const screen = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = screen(event);
    pointers.current.set(event.pointerId, point);
    const state = store.getState();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a === undefined || b === undefined) return;
      controller.animator.cancel();
      for (const id of pointers.current.keys()) host.current?.setPointerCapture(id);
      gesture.current = {
        kind: "pinch",
        startDistance: Math.hypot(a.x - b.x, a.y - b.y),
        startCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        camera: state.camera,
      };
      return;
    }
    gesture.current = {
      kind: "pan",
      pointerId: event.pointerId,
      start: point,
      camera: state.camera,
      moved: false,
      target: event.target,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current === null) return;
    const point = screen(event);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point);
    const state = store.getState();
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
      if (state.tour !== null) state.setWandered(true);
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    if (
      !current.moved &&
      Math.hypot(point.x - current.start.x, point.y - current.start.y) < CLICK_SLOP
    )
      return;
    if (!current.moved) {
      // Capture only once it's a drag, so plain clicks and double-clicks still reach the element.
      controller.animator.cancel();
      current.moved = true;
      host.current?.setPointerCapture(event.pointerId);
      if (host.current !== null) host.current.style.cursor = "grabbing";
      if (state.tour !== null) state.setWandered(true);
    }
    state.setCamera({
      ...current.camera,
      x: current.camera.x + point.x - current.start.x,
      y: current.camera.y + point.y - current.start.y,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (host.current !== null) host.current.style.cursor = "";
    if (current?.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (current === null || current.pointerId !== event.pointerId || current.moved) return;
    void click(current.target);
  };

  const click = async (target: EventTarget | null) => {
    const state = store.getState();
    const hit = elementAt(target);
    // Text and labels can link somewhere too (a "Runbook" label, a "See the outage" note).
    const decorationLink =
      hit?.kind === "decoration"
        ? (controller.geometry().diagram.decorations.get(hit.name)?.link ?? null)
        : null;
    if (decorationLink !== null) {
      await controller.followElementLink(decorationLink);
      return;
    }
    if (hit === null || hit.kind === "decoration" || hit.kind === "group") {
      if (state.openCard !== null && state.tour === null) await controller.closeCard();
      else if (state.inspected !== null) controller.inspect(null);
      return;
    }
    const diagram = controller.geometry().diagram;
    if (
      !diagram.components.has(hit.name) &&
      !diagram.containers.has(hit.name) &&
      !diagram.connections.has(hit.name)
    )
      return;
    const component = diagram.components.get(hit.name);
    const card =
      component?.card ??
      diagram.containers.get(hit.name)?.card ??
      diagram.connections.get(hit.name)?.card ??
      null;
    if (state.tour !== null) state.setWandered(true);
    if (card !== null) {
      await controller.openCard(hit.name, { travelFrom: state.openCard });
      return;
    }
    if (controller.canEnter(hit.name)) {
      await controller.enterLevel(hit.name);
      return;
    }
    const link =
      component?.link ??
      diagram.containers.get(hit.name)?.link ??
      diagram.connections.get(hit.name)?.link ??
      null;
    if (link !== null) {
      await controller.followElementLink(link);
      return;
    }
    controller.inspect(state.inspected === hit.name ? null : hit.name);
  };

  if (model === null) return null;

  return (
    <div
      ref={host}
      data-testid="viewer-canvas"
      // State a test (or anything else outside) can wait on instead of guessing durations.
      data-ready={view.ready ? "true" : undefined}
      data-animating={animating ? "true" : undefined}
      data-zoom={view.camera.zoom.toFixed(3)}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      style={{ background: geometry.theme.css }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        gesture.current = null;
      }}
      onDoubleClick={(event) => {
        // Double-click goes inside a nested diagram even when the component also has a card.
        const hit = elementAt(event.target);
        if (hit !== null && controller.canEnter(hit.name)) void controller.enterLevel(hit.name);
      }}
      // Keyboard: Tab reaches each element (see actionProps); Enter or Space does what a click does.
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!(event.target instanceof Element) || event.target.closest("[data-element]") === null)
          return;
        event.preventDefault();
        void click(event.target);
      }}
      onFocus={(event) => {
        const node = host.current;
        if (node === null || !(event.target instanceof Element)) return;
        if (event.target.closest("[data-element]") === null) return;
        // Focus can scroll the clipped canvas; the camera moves instead, to show what's focused.
        node.scrollTo(0, 0);
        const rect = event.target.getBoundingClientRect();
        const bounds = node.getBoundingClientRect();
        const margin = 48;
        const inView =
          rect.left >= bounds.left + margin &&
          rect.right <= bounds.right - margin &&
          rect.top >= bounds.top + margin &&
          rect.bottom <= bounds.bottom - margin;
        if (inView) return;
        const { camera, viewport } = store.getState();
        const centre = toWorld(camera, {
          x: rect.left + rect.width / 2 - bounds.left,
          y: rect.top + rect.height / 2 - bounds.top,
        });
        void controller.animator.to(centerOn(centre, camera.zoom, viewport), 350);
      }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-500 ease-out"
        style={{ opacity: view.ready ? 1 : 0 }}
      >
        {mounted && frame !== null ? (
          <div className="pointer-events-none absolute inset-0" data-testid="deck-frame">
            <DiagramSvg
              scene={frame}
              time={{ kind: "live", clock }}
              mode="view"
              fontFamily="var(--font-sans)"
              camera={view.camera}
              size={view.viewport}
            />
          </div>
        ) : null}
        {mounted ? (
          <DiagramSvg
            scene={model}
            capacity={capacity}
            time={{ kind: "live", clock }}
            mode="view"
            interactive
            fontFamily="var(--font-sans)"
            camera={view.camera}
            size={view.viewport}
            focus={view.focus}
            title={geometry.diagram.settings.name}
            underlay={
              stubs.length > 0 ? (
                <StubsOverlay
                  stubs={stubs}
                  flows={parentFlows}
                  layout={geometry.layout}
                  theme={geometry.theme}
                />
              ) : undefined
            }
          />
        ) : null}
      </div>
      {view.levelZoom !== null && mounted ? (
        <LevelTransition
          plan={view.levelZoom}
          viewport={view.viewport}
          time={{ kind: "live", clock }}
          fontFamily="var(--font-sans)"
          onDone={view.levelZoom.finish}
        />
      ) : null}
    </div>
  );
}
