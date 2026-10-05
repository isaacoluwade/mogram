import type { ComponentType } from "react";
import type { Point } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import type { EditorStore } from "../store/editor-store";
import type { KeyInput } from "./keys";
import type { SelectionInfo } from "./selection";

/**
 * The command registry's types (05-ui-shell-commands §13.1, after draw.io's Action/Menu split):
 * a command is defined once, with its label, keys and when it applies, and every surface (keys,
 * context menu, dropdowns, quick bar, palette, shortcuts dialog) reads it from there.
 */

export type CommandGroup =
  | "tools"
  | "edit"
  | "select"
  | "arrange"
  | "connection"
  | "style"
  | "view"
  | "scene"
  | "file"
  | "help";

/** What only the editor shell can do: saving, scenes, opening the viewer. */
export interface CommandHost {
  save(): void;
  nextScene(direction: 1 | -1): void;
  /** Shows a scene (null: the diagram as written). */
  goToScene(scene: string | null): void;
  togglePlay(): void;
  preview(): void;
  present(): void;
  download(): void;
  saveToCloud?: () => void;
  history?: () => void;
  /** Opens the assistant (or hides it when it's showing). */
  assistant?: () => void;
  /** Opens the assistant to ask about what's selected. */
  askAbout?: () => void;
}

export interface CommandContext {
  readonly store: EditorStore;
  readonly host: CommandHost;
  readonly diagram: Diagram;
  readonly sel: SelectionInfo;
  /** Where the context menu was opened, in world px (Paste here, Add bend here). */
  readonly pointer: Point | null;
  /** The key press that ran the command, if any. */
  readonly event?: KeyInput;
}

export interface Command {
  /** "edit.duplicate": the group, then what it does. */
  readonly id: string;
  /** The full name, for the palette and the shortcuts dialog ("Bring to front"). */
  readonly label: string | ((c: CommandContext) => string);
  /** A shorter name inside a submenu that already says what it is about ("Front"). */
  readonly menuLabel?: string;
  readonly group: CommandGroup;
  /** Shown and bound from here; the first is the one shown. */
  readonly keys?: readonly string[];
  readonly icon?: ComponentType<{ className?: string }>;
  readonly description?: string;
  /** Whether it applies now. Context menus hide it when false; dropdowns disable it. */
  readonly when?: (c: CommandContext) => boolean;
  readonly checked?: (c: CommandContext) => boolean;
  readonly danger?: boolean;
  /** Kept out of the command palette (Escape, arrow nudges). */
  readonly palette?: false;
  /** Kept out of the shortcuts dialog (covered by a hint row instead). */
  readonly listed?: false;
  /** Leaves the browser's own handling of the key in place too (copy keeps working in text). */
  readonly passive?: true;
  readonly run: (c: CommandContext) => unknown;
}

/** A menu: command ids, separators ("-") and submenus. */
export type MenuSpec = readonly MenuEntry[];
export type MenuEntry =
  | string
  | "-"
  | {
      readonly submenu: string;
      readonly icon?: ComponentType<{ className?: string }>;
      readonly items: MenuSpec;
    };
