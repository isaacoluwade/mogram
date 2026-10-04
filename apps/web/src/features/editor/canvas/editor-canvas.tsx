"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Box } from "@mogram/core/layout";
import { GRID } from "@mogram/core/layout";
import { viaOrigin } from "@mogram/core/routing";
import { toWorld } from "@/features/canvas/camera";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { LevelTransition } from "@/features/canvas/level-transition";
import { StubsOverlay } from "@/features/canvas/svg/stubs";
import { onReducedMotionChange, prefersReducedMotion } from "@/lib/use-reduced-motion";
import { addComponentAt, zoomToFit } from "../actions";
import { LIBRARY_DRAG_TYPE, decodeLibraryDrag } from "../dnd";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { nestedStubs } from "../levels";
import { useEditorScene } from "../use-editor-scene";
import { CanvasContextMenu } from "./context-menu";
import { EditorOverlay } from "./overlays";
import { LabelEditor } from "./label-editor";
import { QuickBar } from "./quick-bar";
import { useCanvasGestures } from "./use-canvas-gestures";

/** The editable canvas: diagram + editor overlays + every pointer interaction (ED-1). */
export function EditorCanvas() {
  const store = useEditorStore();
  const clock = useEditorClock();
  const host = useRef<HTMLDivElement | null>(null);
  const { diagram, layout, routes, scene, theme } = useEditorScene();
  const view = useEditorShallow((s) => ({
    camera: s.camera,
    viewport: s.viewport,
    selection: s.selection,
    hovered: s.hovered,
    tool: s.tool,
    showGrid: s.showGrid,
    marquee: s.marquee,
    connect: s.connect,
    drag: s.drag,
    bend: s.bend,
    motionPaused: s.motionPaused,
    editingLabel: s.editingLabel,
    levelZoom: s.levelZoom,
  }));
  const fitted = useRef(false);
  const gestures = useCanvasGestures(store, host);
  const { files, levelPath } = useEditorShallow((s) => ({
    files: s.files,
    levelPath: s.levelPath,
  }));

  // At a nested level, the parent's neighbours show as stubs at the edge (NE-5, NE-7).
  const nested = useMemo(() => nestedStubs(files, levelPath, diagram), [files, levelPath, diagram]);

  // Track the canvas size; fit the diagram the first time we know it.
  useEffect(() => {
    const node = host.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      store
        .getState()
        .setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
      if (!fitted.current && entry.contentRect.width > 0) {
        fitted.current = true;
        zoomToFit(store);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [store]);

  // The motion toggle pauses the shared clock (PR-9); it starts paused for reduced motion.
  useEffect(() => {
    if (view.motionPaused) clock.pause();
    else clock.resume();
    clock.tick();
  }, [clock, view.motionPaused]);
  // Changing the system setting mid-session follows it.
  useEffect(
    () => onReducedMotionChange(() => store.getState().setMotionPaused(prefersReducedMotion())),
    [store],
  );

  const connectionNames = useMemo(() => new Set(diagram.connections.keys()), [diagram]);
  const unpinned = useMemo(
    () =>
      new Set(
        [...layout.elements.values()]
          .filter((e) => !e.pinned && e.kind !== "decoration")
          .map((e) => e.name),
      ),
    [layout],
  );
  const single = view.selection.length === 1 ? view.selection[0] : undefined;
  const waypoints = useMemo(() => {
    if (single === undefined || !connectionNames.has(single)) return null;
    const connection = diagram.connections.get(single);
    if (connection === undefined || connection.route !== "orthogonal") return null;
    if (view.bend?.connection === single) return { connection: single, points: view.bend.via };
    const stored = diagram.layout.get(single)?.via ?? [];
    const origin = viaOrigin(layout, connection);
    return {
      connection: single,
      points: stored.map((p) => ({ x: origin.x + p.x * GRID, y: origin.y + p.y * GRID })),
    };
  }, [single, connectionNames, diagram, layout, view.bend]);

  const hoveredTile =
    view.tool === "select" && view.hovered !== null && view.drag === null && view.connect === null
      ? (layout.tiles.get(view.hovered) ?? null)
      : null;
  const connectFrom =
    view.connect === null
      ? null
      : (layout.tiles.get(view.connect.from) ??
        layout.elements.get(view.connect.from)?.box ??
        null);
  const connectTarget: Box | null =
    view.connect?.target == null
      ? null
      : (layout.tiles.get(view.connect.target) ??
        layout.elements.get(view.connect.target)?.box ??
        null);
  const dropTarget =
    view.drag?.target == null ? null : (layout.elements.get(view.drag.target)?.box ?? null);
  // Stable between renders, so the memoised overlay skips frames where only the camera pans.
  const resizable = useCallback(
    (name: string) =>
      diagram.containers.has(name) ||
      diagram.decorations.get(name)?.variant === "zone" ||
      diagram.decorations.get(name)?.variant === "note",
    [diagram],
  );
  const connect = useMemo(
    () =>
      view.connect === null || connectFrom === null
        ? null
        : {
            from: { x: connectFrom.x + connectFrom.w / 2, y: connectFrom.y + connectFrom.h / 2 },
            to: view.connect.pointer,
            target: connectTarget,
          },
    [view.connect, connectFrom, connectTarget],
  );

  const overlay = (
    <EditorOverlay
      layout={layout}
      routes={routes}
      theme={theme}
      zoom={view.camera.zoom}
      selection={view.selection}
      hovered={view.drag === null ? view.hovered : null}
      groups={layout.groups}
      connectionNames={connectionNames}
      resizable={resizable}
      marquee={view.marquee}
      marqueeKind={
        view.tool === "container" ? "container" : view.tool === "zone" ? "zone" : "select"
      }
      connect={connect}
      dropTarget={dropTarget}
      waypoints={waypoints}
      showConnectHandles={hoveredTile}
      unpinned={unpinned}
    />
  );

  const cursor =
    view.tool === "hand"
      ? "grab"
      : view.tool === "select"
        ? "default"
        : view.tool === "text" || view.tool === "label"
          ? "text"
          : view.tool === "note"
            ? "copy"
            : "crosshair";

  return (
    <CanvasContextMenu>
      <div
        ref={host}
        data-testid="editor-canvas"
        className="absolute inset-0 touch-none select-none overflow-hidden outline-none"
        style={{ background: theme.css, cursor }}
        onPointerDown={gestures.onPointerDown}
        onPointerMove={gestures.onPointerMove}
        onPointerUp={gestures.onPointerUp}
        onPointerCancel={gestures.onPointerCancel}
        onPointerLeave={() => store.getState().setHovered(null)}
        onDoubleClick={gestures.onDoubleClick}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const drag = decodeLibraryDrag(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
          if (drag === null) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const world = toWorld(store.getState().camera, {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          addComponentAt(store, drag.type, drag.label, world);
        }}
      >
        <DiagramSvg
          scene={scene}
          time={{ kind: "live", clock }}
          mode="edit"
          fontFamily="var(--font-sans)"
          camera={view.camera}
          size={view.viewport}
          showGrid={view.showGrid}
          overlay={overlay}
          underlay={
            nested !== null && nested.stubs.length > 0 ? (
              <StubsOverlay
                stubs={nested.stubs}
                flows={nested.flows}
                layout={layout}
                theme={theme}
              />
            ) : undefined
          }
          title={diagram.settings.name}
          editingText={
            view.editingLabel !== null && diagram.decorations.has(view.editingLabel)
              ? view.editingLabel
              : null
          }
        />
        {view.levelZoom !== null ? (
          <LevelTransition
            plan={view.levelZoom}
            viewport={view.viewport}
            time={{ kind: "live", clock }}
            fontFamily="var(--font-sans)"
            onDone={view.levelZoom.finish}
          />
        ) : null}
        <LabelEditor layout={layout} scene={scene} theme={theme} />
        <QuickBar layout={layout} routes={routes} theme={theme} />
      </div>
    </CanvasContextMenu>
  );
}

export function useIsEmptyDiagram(): boolean {
  return useEditor((s) => {
    const d = s.diagram();
    return d.components.size + d.containers.size + d.decorations.size === 0;
  });
}
