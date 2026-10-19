"use client";

import { useEffect, useState, type PointerEvent } from "react";
import type { Diagram } from "@mogram/core/model";
import { uniqueName } from "@mogram/core/model";
import { imageContentBox, type Box, type LayoutResult, type Point } from "@mogram/core/layout";
import { setPart } from "@mogram/core/edit";
import { toWorld, type Camera } from "@/features/canvas/camera";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useEditorStore } from "../editor-context";

/** A region smaller than this share of the picture each way is a slip, not a region. */
const SMALLEST = 0.01;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Drawing a part on a picture (D-104): "Draw a region" in the Parts section starts it, a drag
 * across the picture draws it, and it's named and written as a part. Esc or Cancel stops.
 */
export function PartDrawing({
  diagram,
  layout,
  camera,
}: {
  diagram: Diagram;
  layout: LayoutResult;
  camera: Camera;
}) {
  const store = useEditorStore();
  const [owner, setOwner] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ readonly start: Point; readonly end: Point } | null>(null);

  useEffect(() => {
    const start = (event: Event) => {
      const name = (event as CustomEvent<unknown>).detail;
      if (typeof name !== "string" || diagram.components.get(name)?.image == null) return;
      if (store.getState().viewing !== null) return;
      setDrag(null);
      setOwner(name);
    };
    window.addEventListener("mogram:draw-part", start);
    return () => window.removeEventListener("mogram:draw-part", start);
  }, [diagram, store]);

  useEffect(() => {
    if (owner === null) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOwner(null);
      setDrag(null);
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [owner]);

  if (owner === null) return null;
  const component = diagram.components.get(owner);
  const box = layout.elements.get(owner)?.box;
  if (component?.image == null || box === undefined) return null;
  // The picture as drawn, clipped to its element: where a region can be.
  const content = imageContentBox(component, box);
  const area: Box = {
    x: Math.max(box.x, content.x),
    y: Math.max(box.y, content.y),
    w: Math.min(box.x + box.w, content.x + content.w) - Math.max(box.x, content.x),
    h: Math.min(box.y + box.h, content.y + content.h) - Math.max(box.y, content.y),
  };

  const stop = () => {
    setOwner(null);
    setDrag(null);
  };
  const local = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  /** A point on screen as a share of the picture, kept on it. */
  const share = (point: Point): Point => {
    const world = toWorld(camera, point);
    return {
      x: (clamp(world.x, area.x, area.x + area.w) - content.x) / content.w,
      y: (clamp(world.y, area.y, area.y + area.h) - content.y) / content.h,
    };
  };
  const finish = (end: Point) => {
    if (drag === null) return stop();
    const a = share(drag.start);
    const b = share(end);
    const region = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
    if (region.w >= SMALLEST && region.h >= SMALLEST) {
      const name = uniqueName("region", new Set(component.parts.keys()));
      store
        .getState()
        .edit("Draw a region", (files, current) =>
          setPart(files, current, { element: owner, name, set: { area: region } }),
        );
    }
    stop();
  };

  return (
    <div
      data-testid="part-drawing"
      className="absolute inset-0 z-30 cursor-crosshair touch-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = local(event);
        setDrag({ start: point, end: point });
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (drag !== null) setDrag({ ...drag, end: local(event) });
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        event.stopPropagation();
        finish(local(event));
      }}
      onPointerCancel={stop}
    >
      {drag !== null ? (
        <div
          className="pointer-events-none absolute rounded-sm border border-border-emphasis bg-fill-hover"
          style={{
            left: Math.min(drag.start.x, drag.end.x),
            top: Math.min(drag.start.y, drag.end.y),
            width: Math.abs(drag.end.x - drag.start.x),
            height: Math.abs(drag.end.y - drag.start.y),
          }}
        />
      ) : null}
      <Panel
        shape="pill"
        className="absolute left-1/2 top-20 flex -translate-x-1/2 items-center gap-3 py-1 pl-4 pr-1 text-caption text-fg-soft"
        onPointerDown={(event) => event.stopPropagation()}
      >
        Drag across the picture to draw a region.
        <Button size="sm" variant="ghost" onClick={stop}>
          Cancel
        </Button>
      </Panel>
    </div>
  );
}
