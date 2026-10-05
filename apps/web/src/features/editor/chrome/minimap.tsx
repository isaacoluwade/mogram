"use client";

import { memo, useMemo, useRef } from "react";
import { buildScene } from "@/features/canvas/scene";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { resolveTheme } from "@/features/canvas/theme";
import { resolveFor, useLayout, useRoutes } from "@/features/canvas/use-diagram";
import type { LayoutResult } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import type { RoutedPath } from "@mogram/core/routing";
import { Panel } from "@/components/ui/panel";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { shownFiles } from "../store/editor-store";

const SIZE = { width: 208, height: 136 } as const;
const PAD = 32;

/**
 * The minimap (06-canvas-interactions §16, §20 P2-20): the whole diagram small, with the part on
 * screen outlined. Press or drag on it to move the view there.
 */
export function Minimap() {
  const store = useEditorStore();
  const diagram = useEditor((s) => s.parsed().diagram);
  const { camera, viewport } = useEditorShallow((s) => ({
    camera: s.camera,
    viewport: s.viewport,
  }));
  const layout = useLayout(diagram);
  const routes = useRoutes(diagram, layout);
  const dragging = useRef(false);

  const diagramBounds = layout.bounds.w === 0 ? { x: 0, y: 0, w: 400, h: 260 } : layout.bounds;
  // The map covers the diagram and the part on screen, so the view's outline is always on it.
  const seen = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    w: viewport.width / camera.zoom,
    h: viewport.height / camera.zoom,
  };
  const left = Math.min(diagramBounds.x, seen.x);
  const top = Math.min(diagramBounds.y, seen.y);
  const bounds = {
    x: left,
    y: top,
    w: Math.max(diagramBounds.x + diagramBounds.w, seen.x + seen.w) - left,
    h: Math.max(diagramBounds.y + diagramBounds.h, seen.y + seen.h) - top,
  };
  const ratio = SIZE.width / SIZE.height;
  let frame = {
    x: bounds.x - PAD,
    y: bounds.y - PAD,
    w: bounds.w + PAD * 2,
    h: bounds.h + PAD * 2,
  };
  if (frame.w / frame.h > ratio) {
    const h = frame.w / ratio;
    frame = { ...frame, y: frame.y - (h - frame.h) / 2, h };
  } else {
    const w = frame.h * ratio;
    frame = { ...frame, x: frame.x - (w - frame.w) / 2, w };
  }
  const scale = SIZE.width / frame.w;
  // The world rectangle on screen, in minimap pixels.
  const view = {
    x: (seen.x - frame.x) * scale,
    y: (seen.y - frame.y) * scale,
    w: seen.w * scale,
    h: seen.h * scale,
  };

  const centreOn = (clientX: number, clientY: number, node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const world = {
      x: frame.x + (clientX - rect.left) / scale,
      y: frame.y + (clientY - rect.top) / scale,
    };
    const state = store.getState();
    state.setCamera({
      ...state.camera,
      x: state.viewport.width / 2 - world.x * state.camera.zoom,
      y: state.viewport.height / 2 - world.y * state.camera.zoom,
    });
  };

  return (
    <Panel
      role="img"
      aria-label="Minimap: press or drag to move the view"
      className="relative cursor-pointer overflow-hidden p-0 shadow-popover"
      style={{ width: SIZE.width, height: SIZE.height }}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        centreOn(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (dragging.current) centreOn(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <MinimapDiagram diagram={diagram} layout={layout} routes={routes} frame={frame} />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={SIZE.width}
        height={SIZE.height}
      >
        <rect
          data-minimap="view"
          x={view.x}
          y={view.y}
          width={Math.max(4, view.w)}
          height={Math.max(4, view.h)}
          rx={3}
          className="fill-fg/10 stroke-fg"
          strokeWidth={1.5}
        />
      </svg>
    </Panel>
  );
}

const MinimapDiagram = memo(function MinimapDiagram({
  diagram,
  layout,
  routes,
  frame,
}: {
  diagram: Diagram;
  layout: LayoutResult;
  routes: ReadonlyMap<string, RoutedPath>;
  frame: { x: number; y: number; w: number; h: number };
}) {
  const { files, folder } = useEditorShallow((s) => ({ files: shownFiles(s), folder: s.folder }));
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  const model = useMemo(
    () =>
      buildScene({
        diagram,
        files,
        layout,
        routes,
        current: resolveFor(files, folder, diagram, null),
        theme,
        fontFamily: "Inter",
      }),
    [diagram, files, folder, layout, routes, theme],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 [&>svg]:size-full">
      <DiagramSvg
        scene={model}
        time={{ kind: "static", t: 0 }}
        mode="view"
        fontFamily="var(--font-sans)"
        frame={frame}
      />
    </div>
  );
});
