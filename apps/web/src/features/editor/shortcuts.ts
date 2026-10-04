"use client";

import { useEffect } from "react";
import {
  copySelection,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  nudge,
  paste,
  zOrder,
  zoomBy,
  zoomTo,
  zoomToFit,
  zoomToSelection,
} from "./actions";
import { exitNested, openNested } from "./levels";
import type { EditorStore, Tool } from "./store/editor-store";

/** Every editor shortcut, used both for handling keys and for the shortcuts dialog (ED-7). */
export interface Shortcut {
  readonly combo: string;
  readonly label: string;
  readonly group: "Tools" | "Edit" | "Arrange" | "View" | "Scenes";
}

export const SHORTCUTS: readonly Shortcut[] = [
  { combo: "v", label: "Select", group: "Tools" },
  { combo: "h", label: "Hand (or hold Space)", group: "Tools" },
  { combo: "c", label: "Connect", group: "Tools" },
  { combo: "b", label: "Container", group: "Tools" },
  { combo: "z", label: "Highlight zone", group: "Tools" },
  { combo: "t", label: "Text", group: "Tools" },
  { combo: "n", label: "Sticky note", group: "Tools" },
  { combo: "l", label: "Label", group: "Tools" },
  { combo: "mod+z", label: "Undo", group: "Edit" },
  { combo: "mod+shift+z", label: "Redo", group: "Edit" },
  { combo: "mod+c", label: "Copy", group: "Edit" },
  { combo: "mod+x", label: "Cut", group: "Edit" },
  { combo: "mod+v", label: "Paste", group: "Edit" },
  { combo: "mod+d", label: "Duplicate", group: "Edit" },
  { combo: "mod+a", label: "Select all", group: "Edit" },
  { combo: "backspace", label: "Delete", group: "Edit" },
  { combo: "enter", label: "Rename, or open nested diagram", group: "Edit" },
  { combo: "escape", label: "Deselect / back out one level", group: "Edit" },
  { combo: "arrows", label: "Nudge 1 grid unit (Shift: 4)", group: "Arrange" },
  { combo: "mod+g", label: "Group selection", group: "Arrange" },
  { combo: "mod+]", label: "Bring forward", group: "Arrange" },
  { combo: "mod+[", label: "Send backward", group: "Arrange" },
  { combo: "mod+alt+]", label: "Bring to front", group: "Arrange" },
  { combo: "mod+alt+[", label: "Send to back", group: "Arrange" },
  { combo: "shift+1", label: "Zoom to fit", group: "View" },
  { combo: "shift+2", label: "Zoom to selection", group: "View" },
  { combo: "shift+0", label: "Zoom to 100%", group: "View" },
  { combo: "mod+=", label: "Zoom in", group: "View" },
  { combo: "mod+-", label: "Zoom out", group: "View" },
  { combo: "mod+'", label: "Show or hide the grid", group: "View" },
  { combo: "mod+e", label: "Export", group: "View" },
  { combo: "shift+p", label: "Preview as viewers see it", group: "View" },
  { combo: "?", label: "Keyboard shortcuts", group: "View" },
  { combo: "p", label: "Play scenes", group: "Scenes" },
  { combo: "[", label: "Previous scene", group: "Scenes" },
  { combo: "]", label: "Next scene", group: "Scenes" },
  { combo: "m", label: "Pause or resume motion", group: "Scenes" },
];

const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** "mod+shift+z" → "⇧⌘Z" on Mac, "Ctrl+Shift+Z" elsewhere. */
export function shortcutLabel(combo: string): string {
  const mac = isMac();
  const parts = combo.split("+");
  const key = parts[parts.length - 1] ?? "";
  const mods = parts.slice(0, -1);
  const names: Record<string, [string, string]> = {
    mod: ["⌘", "Ctrl"],
    shift: ["⇧", "Shift"],
    alt: ["⌥", "Alt"],
  };
  const keyLabel =
    key === "backspace"
      ? "⌫"
      : key === "enter"
        ? "↵"
        : key === "escape"
          ? "Esc"
          : key === "arrows"
            ? "←↑→↓"
            : key.toUpperCase();
  if (mac) return `${mods.map((m) => names[m]?.[0] ?? m).join("")}${keyLabel}`;
  return [...mods.map((m) => names[m]?.[1] ?? m), keyLabel].join("+");
}

const TOOL_KEYS: Readonly<Record<string, Tool>> = {
  v: "select",
  h: "hand",
  c: "connect",
  b: "container",
  z: "zone",
  t: "text",
  n: "note",
  l: "label",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    return true;
  return target.closest(".cm-editor") !== null;
}

/** Keys a focused control uses itself: Enter/Space press it, arrows move within it. */
const CONTROL_KEYS = new Set([
  "Enter",
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Backspace",
  "Delete",
]);

function isControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest(
      "button, a[href], [role=button], [role=menuitem], [role=tab], [role=radio], [role=option], [role=switch], [role=slider]",
    ) !== null
  );
}

/** Global key handling while the editor is open. */
export function useEditorShortcuts(
  store: EditorStore,
  actions: {
    save: () => void;
    nextScene: (direction: 1 | -1) => void;
    togglePlay: () => void;
    preview: () => void;
  },
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.defaultPrevented) return;
      if (CONTROL_KEYS.has(event.key) && isControlTarget(event.target)) return;
      const state = store.getState();
      if (state.dialog !== null) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const handled = (): void => event.preventDefault();
      /** Prevents the browser default (save page, zoom…) and runs the action. */
      const run = (action: () => unknown): void => {
        event.preventDefault();
        void action();
      };

      if (mod) {
        if (key === "z" && event.shiftKey) return run(() => state.redo());
        if (key === "z") return run(() => state.undo());
        if (key === "y") return run(() => state.redo());
        if (key === "c") return void copySelection(store); // no preventDefault: native copy keeps working in text
        if (key === "x") return run(() => cutSelection(store));
        if (key === "v") return run(() => paste(store, null));
        if (key === "d") return run(() => duplicateSelection(store));
        if (key === "g") return run(() => groupSelection(store));
        if (key === "s") return run(() => actions.save());
        if (key === "e") return run(() => state.setDialog("export"));
        if (key === "'") return run(() => state.toggleGrid());
        if (key === "=" || key === "+") return run(() => zoomBy(store, 1.2));
        if (key === "-") return run(() => zoomBy(store, 1 / 1.2));
        if (key === "a") {
          handled();
          const d = state.diagram();
          state.select([...d.containers.keys(), ...d.components.keys(), ...d.decorations.keys()]);
          return;
        }
        // Option changes the character on Mac keyboards (⌥] types ‘), so match the physical key too.
        if (key === "]" || event.code === "BracketRight")
          return run(() => zOrder(store, event.altKey ? "front" : "forward"));
        if (key === "[" || event.code === "BracketLeft")
          return run(() => zOrder(store, event.altKey ? "back" : "backward"));
        return;
      }

      if (event.shiftKey && (event.code === "Digit1" || key === "!"))
        return run(() => zoomToFit(store));
      if (event.shiftKey && (event.code === "Digit2" || key === "@"))
        return run(() => zoomToSelection(store));
      if (event.shiftKey && (event.code === "Digit0" || key === ")"))
        return run(() => zoomTo(store, 1));
      if (key === "?") return run(() => state.setDialog("shortcuts"));

      if (key === "backspace" || key === "delete") return run(() => deleteSelection(store));
      if (key === "escape") {
        handled();
        if (state.connect !== null) return state.setConnect(null);
        if (state.tool !== "select") return state.setTool("select");
        if (state.openCard !== null) return state.setOpenCard(null);
        if (state.selection.length > 0) return state.select([]);
        if (state.levelPath.length > 0) exitNested(store);
        return;
      }
      if (key === "enter") {
        const name = state.selection[0];
        if (name === undefined) return;
        handled();
        if (!openNested(store, name)) state.setEditingLabel(name);
        return;
      }
      if (key.startsWith("arrow")) {
        handled();
        const step = event.shiftKey ? 4 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        return nudge(store, dx, dy);
      }
      if (key === "p" && event.shiftKey) return run(() => actions.preview());
      if (key === "p") return run(() => actions.togglePlay());
      if (key === "m") return run(() => state.setMotionPaused(!state.motionPaused));
      if (key === "[") return run(() => actions.nextScene(-1));
      if (key === "]") return run(() => actions.nextScene(1));
      const tool = TOOL_KEYS[key];
      if (tool !== undefined && !event.altKey) return run(() => state.setTool(tool));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, actions]);
}
