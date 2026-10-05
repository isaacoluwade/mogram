"use client";

import { useEffect, useRef, useState } from "react";
import { updateElement } from "@mogram/core/edit";
import { LABEL, type LayoutResult } from "@mogram/core/layout";
import { SHAPE_INFO, shapeGeometry } from "@mogram/core/presets";
import { capacityLabelAt } from "@/features/canvas/capacity-frames";
import { toScreen } from "@/features/canvas/camera";
import type { SceneModel } from "@/features/canvas/scene";
import type { CanvasTheme } from "@/features/canvas/theme";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { TextEditor } from "./text-editor";

/**
 * Inline label editing (double-click or Enter), positioned over the element on screen. Free
 * text and sticky notes get a multi-line editor in their own type instead.
 */
export function LabelEditor({
  layout,
  scene,
  theme,
}: {
  layout: LayoutResult;
  scene: SceneModel;
  theme: CanvasTheme;
}) {
  const store = useEditorStore();
  const { name, camera } = useEditorShallow((s) => ({ name: s.editingLabel, camera: s.camera }));
  const diagram = useEditor((s) => s.parsed().diagram);
  const element = name === null ? undefined : layout.elements.get(name);
  const connection = name === null ? undefined : diagram.connections.get(name);
  const initial =
    name === null
      ? ""
      : (diagram.components.get(name)?.label ??
        diagram.containers.get(name)?.label ??
        diagram.decorations.get(name)?.text ??
        diagram.groups.get(name)?.label ??
        connection?.text ??
        "");
  if (
    name === null ||
    (element === undefined && connection === undefined && !diagram.groups.has(name))
  )
    return null;

  const rich = scene.texts.find((item) => item.name === name);
  if (element !== undefined && rich !== undefined && rich.rich !== null) {
    return <TextEditor key={name} item={rich} box={element.box} camera={camera} theme={theme} />;
  }

  const commit = (value: string) => {
    const state = store.getState();
    state.setEditingLabel(null);
    const next = value.trim();
    if (next === initial.trim()) return;
    state.edit("Rename label", (files, d) =>
      updateElement(files, d, { name, set: { label: next } }),
    );
  };

  let left = camera.x + 40;
  let top = camera.y + 40;
  let width = 180;
  const shape = name === null ? null : (diagram.components.get(name)?.shape ?? null);
  if (element !== undefined && shape !== null) {
    // Inside the shape's own label box (under it, for a person).
    const box = element.box;
    const label = shapeGeometry(
      shape,
      box.w,
      box.h,
      diagram.components.get(element.name)?.look ?? {},
    ).label;
    width = Math.max(120, label.w * camera.zoom);
    const point = toScreen(camera, {
      x: box.x + label.x + label.w / 2,
      y: box.y + label.y + (SHAPE_INFO[shape].labelBelow === true ? 0 : label.h / 2),
    });
    left = point.x - width / 2;
    top = point.y - (SHAPE_INFO[shape].labelBelow === true ? 0 : 16);
  } else if (element !== undefined) {
    const box = element.box;
    const scaled = scene.components.find((c) => c.name === element.name);
    const under = scaled === undefined ? null : capacityLabelAt(scaled, scene.settled);
    if (under !== null) {
      // Under a scale set's frame or a machine's panel.
      const point = toScreen(camera, under);
      width = Math.max(140, LABEL.maxWidth * camera.zoom);
      left = under.align === "start" ? point.x - 6 : point.x - width / 2;
      top = point.y - 16;
    } else if (element.kind === "component") {
      const point = toScreen(camera, { x: box.x + box.w / 2, y: box.y + LABEL.top });
      width = Math.max(140, LABEL.maxWidth * camera.zoom);
      left = point.x - width / 2;
      top = point.y - 4;
    } else {
      const point = toScreen(camera, {
        x: box.x + (element.kind === "container" ? 28 : 0),
        y: box.y + (element.kind === "container" ? 8 : 0),
      });
      left = point.x;
      top = point.y;
      width = Math.max(180, Math.min(320, box.w * camera.zoom - 40));
    }
  }

  // Keyed by element, so each edit starts from that element's current label.
  return (
    <LabelInput
      key={name}
      initial={initial}
      style={{ left, top, width }}
      onCommit={commit}
      onCancel={() => store.getState().setEditingLabel(null)}
    />
  );
}

function LabelInput({
  initial,
  style,
  onCommit,
  onCancel,
}: {
  initial: string;
  style: React.CSSProperties;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <input
      ref={input}
      aria-label="Label"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value)}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onCommit(value);
        // Escape keeps what was typed (draw.io, Figma: losing words is worse than keeping
        // them); Shift, Ctrl or Cmd with Escape puts the label back (06 §20 P1-11).
        if (event.key === "Escape") {
          if (event.shiftKey || event.metaKey || event.ctrlKey) onCancel();
          else onCommit(value);
        }
      }}
      className="absolute z-20 h-7 rounded-md border border-border-emphasis bg-card px-2 text-center text-label font-medium text-fg shadow-popover outline-none"
      style={style}
    />
  );
}
