"use client";

import { useEffect } from "react";
import { commandContext } from "./commands/context";
import { matchesCombo } from "./commands/keys";
import { COMMANDS, commandForKey } from "./commands/registry";
import type { CommandHost } from "./commands/types";
import type { EditorStore } from "./store/editor-store";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    return true;
  return target.closest(".cm-editor") !== null;
}

/** Keys a focused control uses itself: Enter/Space press it, arrows move within it, Tab leaves. */
const CONTROL_KEYS = new Set([
  "Enter",
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Backspace",
  "Delete",
  "Tab",
]);

function isControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest(
      "button, a[href], [role=button], [role=menuitem], [role=tab], [role=radio], [role=option], [role=switch], [role=slider]",
    ) !== null
  );
}

/** Keys that stay the browser's when their command doesn't apply (Tab moves focus). */
const YIELDING = new Set(["tab", "shift+tab"]);

/**
 * Global key handling while the editor is open, from the command registry: the first command
 * whose keys match and that applies runs. A combo the editor owns is kept from the browser even
 * when nothing applies (⌘D never bookmarks the page), except copy, which stays native in text.
 */
export function useEditorShortcuts(store: EditorStore, host: CommandHost) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.defaultPrevented) return;
      if (CONTROL_KEYS.has(event.key) && isControlTarget(event.target)) return;
      // AltGr arrives as Ctrl+Alt on Windows: it types characters, not commands.
      if (event.getModifierState("AltGraph")) return;
      if (store.getState().dialog !== null) return;
      const context = commandContext(store, host, null, event);
      const command = commandForKey(event, context);
      if (command !== undefined) {
        if (command.passive !== true) event.preventDefault();
        void command.run(context);
        return;
      }
      const claimed = COMMANDS.some((cmd) =>
        cmd.keys?.some((combo) => !YIELDING.has(combo) && matchesCombo(event, combo)),
      );
      if (
        claimed &&
        !COMMANDS.some(
          (cmd) => cmd.passive === true && cmd.keys?.some((combo) => matchesCombo(event, combo)),
        )
      )
        event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, host]);
}
