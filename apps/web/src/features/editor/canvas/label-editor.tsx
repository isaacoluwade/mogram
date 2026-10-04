"use client";

import { useEffect, useRef, useState } from "react";
import { updateElement } from "@mogram/core/edit";
import { LABEL, type LayoutResult } from "@mogram/core/layout";
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
  if (element !== undefined) {
    const box = element.box;
    if (element.kind === "component") {
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
        if (event.key === "Escape") onCancel();
      }}
      className="absolute z-20 h-7 rounded-md border border-border-emphasis bg-card px-2 text-center text-label font-medium text-fg shadow-popover outline-none"
      style={style}
    />
  );
}
