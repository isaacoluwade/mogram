"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { deleteElements, updateElement } from "@mogram/core/edit";
import { TEXT_LINE_HEIGHT, textStyleSize } from "@mogram/core/layout";
import type { Box } from "@mogram/core/layout";
import { toScreen, type Camera } from "@/features/canvas/camera";
import { fitRich, parseRich, BOLD_WEIGHT } from "@/features/canvas/rich-text";
import { NOTE_PADDING, type SceneDecoration } from "@/features/canvas/scene";
import { decorationInk } from "@/features/canvas/svg/decoration-nodes";
import type { CanvasTheme } from "@/features/canvas/theme";
import { useEditorStore } from "../editor-context";

/** Saves typing this long after the last key, like the inspector fields. */
const SAVE_AFTER_MS = 400;

/**
 * What the quick-edit toolbar can do to the words being typed: B and I wrap the selected words
 * in `**` and `*`, the list button bullets the selected lines. Null when nothing is being typed.
 */
export interface TextCommands {
  readonly bold: () => void;
  readonly italic: () => void;
  readonly list: () => void;
  /** Some words are selected (B and I apply to them rather than the whole text). */
  readonly hasSelection: () => boolean;
}
export const activeTextCommands: { current: TextCommands | null } = { current: null };

let editSessions = 0;

/**
 * Typing into free text or a sticky note in place (ED-25): a text box laid exactly over the
 * words, in their font, size and colour. Saves as you type; Escape or a click away finishes.
 * Markdown-style markers (`**bold**`, `- item`) show while typing and render once done.
 */
export function TextEditor({
  item,
  box,
  camera,
  theme,
}: {
  item: SceneDecoration;
  box: Box;
  camera: Camera;
  theme: CanvasTheme;
}) {
  const store = useEditorStore();
  const [draft, setDraft] = useState(item.text);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const saved = useRef(item.text);
  const timer = useRef<number | null>(null);
  const session = useRef<string | null>(null);
  const finished = useRef(false);
  const name = item.name;
  const isNote = item.variant === "note";

  const save = (text: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (text.trim() === saved.current.trim()) return;
    saved.current = text;
    store
      .getState()
      .edit(isNote ? "Edit sticky note" : "Edit text", (files, diagram) =>
        updateElement(files, diagram, { name, set: { label: text } }),
      );
  };
  const finish = (text: string) => {
    if (finished.current) return;
    finished.current = true;
    save(text);
    const state = store.getState();
    if (session.current !== null) state.stopTyping(session.current);
    state.setEditingLabel(null);
    activeTextCommands.current = null;
    // Free text left empty goes away, as on any whiteboard; an empty note stays a note.
    if (!isNote && text.trim().length === 0 && state.diagram().decorations.has(name)) {
      state.edit("Delete text", (files, diagram) => deleteElements(files, diagram, [name]));
    }
  };
  const latest = useRef({ draft, save });
  useEffect(() => {
    latest.current = { draft, save };
  });

  useEffect(() => {
    finished.current = false;
    editSessions += 1;
    session.current = `text-${editSessions}`;
    store.getState().startTyping(session.current);
    const frame = requestAnimationFrame(() => {
      const node = field.current;
      if (node === null) return;
      node.focus();
      // New text is a placeholder to type over; existing words get the caret at the end.
      if (item.text === "Text") node.select();
      else node.setSelectionRange(node.value.length, node.value.length);
    });
    // Unmounting (the element was deleted, another was opened) keeps what was typed.
    return () => {
      cancelAnimationFrame(frame);
      latest.current.save(latest.current.draft);
      if (session.current !== null) store.getState().stopTyping(session.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per element (the parent keys this by name)
  }, []);

  const change = (text: string) => {
    setDraft(text);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(text), SAVE_AFTER_MS);
  };

  /** Replaces the selection (or the whole text) and keeps the selection on the result. */
  const replace = (next: string, start: number, end: number) => {
    change(next);
    requestAnimationFrame(() => field.current?.setSelectionRange(start, end));
  };
  const wrap = (marker: string) => {
    const node = field.current;
    if (node === null) return;
    const { selectionStart: start, selectionEnd: end, value } = node;
    if (start === end) return;
    const inner = value.slice(start, end);
    const before = value.slice(Math.max(0, start - marker.length), start);
    const after = value.slice(end, end + marker.length);
    if (before === marker && after === marker) {
      const next = value.slice(0, start - marker.length) + inner + value.slice(end + marker.length);
      replace(next, start - marker.length, end - marker.length);
    } else {
      replace(
        value.slice(0, start) + marker + inner + marker + value.slice(end),
        start + marker.length,
        end + marker.length,
      );
    }
  };
  const toggleList = () => {
    const node = field.current;
    if (node === null) return;
    const { selectionStart, selectionEnd, value } = node;
    const from = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const toBreak = value.indexOf("\n", selectionEnd);
    const to = toBreak === -1 ? value.length : toBreak;
    const lines = value.slice(from, to).split("\n");
    const listed = lines.filter((line) => line.trim().length > 0).every((l) => /^- /.test(l));
    const next = lines.map((line) =>
      listed ? line.replace(/^- /, "") : line.trim().length === 0 ? line : `- ${line}`,
    );
    const text = next.join("\n");
    replace(value.slice(0, from) + text + value.slice(to), from, from + text.length);
  };
  const commands = useRef<TextCommands | null>(null);
  useEffect(() => {
    commands.current = {
      bold: () => wrap("**"),
      italic: () => wrap("*"),
      list: toggleList,
      hasSelection: () =>
        field.current !== null && field.current.selectionStart !== field.current.selectionEnd,
    };
  });
  useEffect(() => {
    activeTextCommands.current = {
      bold: () => commands.current?.bold(),
      italic: () => commands.current?.italic(),
      list: () => commands.current?.list(),
      hasSelection: () => commands.current?.hasSelection() ?? false,
    };
    return () => {
      activeTextCommands.current = null;
    };
  }, []);

  const look = item.look;
  const inner = isNote
    ? {
        x: box.x + NOTE_PADDING,
        y: box.y + NOTE_PADDING,
        w: box.w - NOTE_PADDING * 2,
        h: box.h - NOTE_PADDING * 2,
      }
    : box;
  const display = item.style === "title" || item.style === "heading";
  const weight = look?.bold === true ? BOLD_WEIGHT : display ? 500 : 400;
  const family = item.family ?? "var(--font-sans)";
  // A note's automatic size follows the words as they're typed.
  const fontSize =
    look?.fontSize ??
    (isNote
      ? fitRich(
          parseRich(draft),
          {
            family,
            weight,
            bold: look?.bold ?? false,
            italic: look?.italic ?? false,
            tracking: 0,
            maxWidth: inner.w,
          },
          inner.h,
        ).fontSize
      : textStyleSize(item.style));
  const lines = draft.split("\n").length;
  const corner = toScreen(camera, { x: inner.x, y: inner.y });
  const zoom = camera.zoom;
  const width = isNote ? inner.w * zoom : Math.max(inner.w * zoom, 160);
  const height = isNote
    ? inner.h * zoom
    : Math.max(lines, 1) * fontSize * TEXT_LINE_HEIGHT * zoom + 2;

  // Grow free text with what is typed (notes keep their size and clip like the canvas does).
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null || isNote) return;
    node.style.width = "0px";
    node.style.width = `${Math.max(width, node.scrollWidth + 8)}px`;
  });

  return (
    <textarea
      ref={field}
      aria-label={isNote ? "Sticky note text" : "Text on canvas"}
      value={draft}
      spellCheck
      onChange={(event) => change(event.target.value)}
      onBlur={() => finish(draft)}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        const mod = event.metaKey || event.ctrlKey;
        if (event.key === "Escape" || (mod && event.key === "Enter")) {
          event.preventDefault();
          field.current?.blur();
        } else if (mod && event.key.toLowerCase() === "b") {
          event.preventDefault();
          wrap("**");
        } else if (mod && event.key.toLowerCase() === "i") {
          event.preventDefault();
          wrap("*");
        } else if (mod && event.shiftKey && event.key === "8") {
          event.preventDefault();
          toggleList();
        }
      }}
      wrap={isNote ? "soft" : "off"}
      className="absolute z-20 resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
      style={{
        left: corner.x,
        top: corner.y,
        width,
        height,
        fontFamily: family,
        fontSize: fontSize * zoom,
        fontWeight: weight,
        fontStyle: look?.italic === true ? "italic" : undefined,
        lineHeight: TEXT_LINE_HEIGHT,
        textAlign: look?.align ?? "left",
        color: decorationInk(item, theme),
        caretColor: decorationInk(item, theme),
        whiteSpace: isNote ? "pre-wrap" : "pre",
      }}
    />
  );
}
