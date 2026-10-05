"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TILE, type Box, type Point } from "@mogram/core/layout";
import { isLocked } from "@mogram/core/edit";
import { BOX_ANCHORS } from "@mogram/core/presets";
import { anchorPoint, endpointBox } from "@mogram/core/routing";
import { toWorld } from "@/features/canvas/camera";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { LevelTransition } from "@/features/canvas/level-transition";
import { StubsOverlay } from "@/features/canvas/svg/stubs";
import { onReducedMotionChange, prefersReducedMotion } from "@/lib/use-reduced-motion";
import { insertFromLibrary, zoomToFit } from "../actions";
import { LIBRARY_DRAG_TYPE, decodeLibraryDrag } from "../dnd";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { nestedStubs } from "../levels";
import { useEditorScene } from "../use-editor-scene";
import type { ConnectionEditInfo, LooseEnd } from "./connection-handles";
import { CanvasContextMenu } from "./context-menu";
import { EditorOverlay } from "./overlays";
import { LabelEditor } from "./label-editor";
import { QuickBar } from "./quick-bar";
import type { Guide } from "./guides";
import { splitTarget } from "./split";
import { useCanvasGestures } from "./use-canvas-gestures";
import { usePreference } from "@/lib/preferences";
import { shownFiles } from "../store/editor-store";
import { VersionChangesOverlay } from "../history/changes-overlay";
import { AssistantOverlay } from "../assistant/assistant-overlay";

const NO_GUIDES: readonly Guide[] = [];

/** The editable canvas: diagram + editor overlays + every pointer interaction (ED-1). */
export function EditorCanvas() {
  const store = useEditorStore();
  const clock = useEditorClock();
  const host = useRef<HTMLDivElement | null>(null);
  const { diagram, layout, routes, scene, theme, capacity } = useEditorScene();
  const view = useEditorShallow((s) => ({
    camera: s.camera,
    viewport: s.viewport,
    selection: s.selection,
    hovered: s.hovered,
    tool: s.tool,
    marquee: s.marquee,
    connect: s.connect,
    drag: s.drag,
    resize: s.resize,
    pathEdit: s.pathEdit,
    motionPaused: s.motionPaused,
    editingLabel: s.editingLabel,
    levelZoom: s.levelZoom,
    viewing: s.viewing !== null,
    comparing: s.viewing?.compare != null,
  }));
  const showGrid = usePreference("showGrid");
  const gridStyle = usePreference("gridStyle");
  const fitted = useRef(false);
  const gestures = useCanvasGestures(store, host);
  const { files, levelPath } = useEditorShallow((s) => ({
    files: shownFiles(s),
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

  // Undo or redo that changed the nested level asks for the new level to be framed.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.fitRequest !== previous.fitRequest) zoomToFit(store);
      }),
    [store],
  );

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
  // The selected connection's handles, and the preview while one of its ends is dragged.
  const connectionEdit = useMemo<ConnectionEditInfo | null>(() => {
    if (single === undefined || view.viewing) return null;
    const connection = diagram.connections.get(single);
    const route = routes.get(single);
    if (connection === undefined || route === undefined) return null;
    const entry = diagram.layout.get(single);
    return {
      name: single,
      route,
      style: connection.route,
      automatic: view.pathEdit?.via === undefined && (entry?.via == null || entry.via.length === 0),
      fromFixed: entry?.fromAnchor != null,
      toFixed: entry?.toAnchor != null,
    };
  }, [single, diagram, routes, view.pathEdit, view.viewing]);
  const loose = useMemo<LooseEnd | null>(() => {
    const edit = view.pathEdit;
    if (edit?.loose === undefined) return null;
    const route = routes.get(edit.connection);
    const from = edit.loose.end === "from" ? route?.through.at(-1) : route?.through[0];
    if (from === undefined) return null;
    const target = edit.loose.target === null ? null : endpointBox(layout, edit.loose.target);
    return {
      from,
      pointer: edit.loose.pointer,
      target,
      anchors: target === null ? [] : BOX_ANCHORS.map((anchor) => anchorPoint(target, anchor)),
      anchor:
        target === null || edit.loose.anchor === null
          ? null
          : anchorPoint(target, edit.loose.anchor),
    };
  }, [view.pathEdit, routes, layout]);

  const hoveredTile =
    view.tool === "select" &&
    !view.viewing &&
    view.hovered !== null &&
    view.drag === null &&
    view.connect === null
      ? (layout.tiles.get(view.hovered) ??
        // Shapes connect from their whole outline.
        (diagram.components.get(view.hovered)?.shape != null
          ? (layout.elements.get(view.hovered)?.box ?? null)
          : null))
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
  const [librarySplit, setLibrarySplit] = useState<string | null>(null);
  const locked = useMemo(
    () => new Set(view.selection.filter((name) => isLocked(diagram, name))),
    [view.selection, diagram],
  );
  const splitName = view.drag?.split ?? librarySplit;
  const splitRoute = splitName === null ? null : (routes.get(splitName) ?? null);
  // Stable between renders, so the memoised overlay skips frames where only the camera pans.
  // An earlier version on show has no handles: it can't be changed.
  const resizable = useCallback(
    (name: string) =>
      !view.viewing &&
      (diagram.containers.has(name) ||
        diagram.components.get(name)?.shape != null ||
        diagram.decorations.get(name)?.variant === "zone" ||
        diagram.decorations.get(name)?.variant === "note"),
    [diagram, view.viewing],
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

  const worldAt = (event: { clientX: number; clientY: number }, node: Element): Point => {
    const rect = node.getBoundingClientRect();
    return toWorld(store.getState().camera, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };
  /** The connection a library icon dropped here would go into: under the new tile's middle. */
  const librarySplitAt = (
    event: { clientX: number; clientY: number },
    node: Element,
  ): string | null => {
    const centre = worldAt(event, node);
    const size = TILE.size;
    const tile = { x: centre.x - size / 2, y: centre.y - size / 2, w: size, h: size };
    return splitTarget(diagram, layout, routes, null, tile, centre);
  };

  const adjustable = (name: string) => {
    const component = diagram.components.get(name);
    return view.viewing || component?.shape == null || component.look === null
      ? null
      : { shape: component.shape, params: component.look };
  };

  const overlay = (
    <>
      {view.comparing ? (
        <VersionChangesOverlay
          diagram={diagram}
          layout={layout}
          routes={routes}
          theme={theme}
          zoom={view.camera.zoom}
        />
      ) : null}
      <AssistantOverlay layout={layout} routes={routes} theme={theme} zoom={view.camera.zoom} />
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
        splitTarget={splitRoute}
        connectionEdit={connectionEdit}
        loose={loose}
        showConnectHandles={hoveredTile}
        unpinned={unpinned}
        locked={locked}
        adjustable={adjustable}
        guides={view.drag?.guides ?? NO_GUIDES}
        sizeMatches={
          view.resize?.matches === undefined
            ? null
            : { name: view.resize.name, w: view.resize.matches.w, h: view.resize.matches.h }
        }
        hint={view.drag?.hint ?? null}
      />
    </>
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
            // A new component dropped on a connection goes into it (ED-29); Alt or Shift won't.
            const next =
              event.altKey || event.shiftKey ? null : librarySplitAt(event, event.currentTarget);
            if (next !== librarySplit) setLibrarySplit(next);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setLibrarySplit(null);
        }}
        onDrop={(event) => {
          setLibrarySplit(null);
          const drag = decodeLibraryDrag(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
          if (drag === null) return;
          event.preventDefault();
          // Alt drops it on the canvas itself: not into a container, not into a connection.
          const split =
            event.altKey || event.shiftKey ? null : librarySplitAt(event, event.currentTarget);
          insertFromLibrary(store, drag.type, drag.label, worldAt(event, event.currentTarget), {
            split,
            nest: !event.altKey,
          });
        }}
      >
        <DiagramSvg
          scene={scene}
          capacity={capacity}
          time={{ kind: "live", clock }}
          mode="edit"
          fontFamily="var(--font-sans)"
          camera={view.camera}
          size={view.viewport}
          showGrid={showGrid}
          gridStyle={gridStyle}
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
        {view.viewing ? null : <QuickBar layout={layout} routes={routes} theme={theme} />}
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
