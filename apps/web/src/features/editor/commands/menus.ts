import {
  Activity,
  BringToFront,
  Download,
  Eye,
  MousePointer2,
  PenLine,
  Spline,
  Waves,
} from "lucide-react";
import { FLOW_PRESETS, LINE_PATTERNS, MOTION_PRESETS, STATE_PRESETS } from "@mogram/core/presets";
import { command, isEnabled, labelOf } from "./registry";
import type { SelectionInfo } from "./selection";
import type { Command, CommandContext, MenuEntry, MenuSpec } from "./types";

/**
 * Menus as lists of command ids (05-ui-shell-commands §13.5), resolved against the editor when
 * they open: context menus hide what doesn't apply, dropdowns show it disabled, and separators
 * never lead, trail or double up.
 */

const ARRANGE: MenuEntry = {
  submenu: "Arrange",
  icon: BringToFront,
  items: [
    "arrange.front",
    "arrange.forward",
    "arrange.backward",
    "arrange.back",
    "-",
    "arrange.align-left",
    "arrange.align-center",
    "arrange.align-right",
    "arrange.align-top",
    "arrange.align-middle",
    "arrange.align-bottom",
    "-",
    "arrange.distribute-horizontal",
    "arrange.distribute-vertical",
  ],
};

const FLOW: MenuEntry = {
  submenu: "Flow",
  icon: Activity,
  items: FLOW_PRESETS.map((flow) => `connection.flow-${flow}`),
};

/** Right-click on empty canvas. */
export const CANVAS_MENU: MenuSpec = [
  "edit.paste",
  "edit.paste-in-place",
  "select.all",
  "-",
  "view.zoom-fit",
  "view.zoom-100",
  "view.grid",
  "-",
  "arrange.tidy-up",
  "view.exit-nested",
];

/** Right-click on components, containers, text, groups or a mixed selection. */
export const ELEMENT_MENU: MenuSpec = [
  "assistant.ask",
  "-",
  "view.open-nested",
  "edit.rename",
  "-",
  "edit.cut",
  "edit.copy",
  "edit.duplicate",
  "edit.copy-style",
  "edit.paste-style",
  "-",
  { submenu: "State", icon: Activity, items: STATE_PRESETS.map((s) => `style.state-${s}`) },
  { submenu: "Motion", icon: Waves, items: MOTION_PRESETS.map((m) => `style.motion-${m}`) },
  FLOW,
  "-",
  {
    submenu: "Select",
    icon: MousePointer2,
    items: [
      "select.connections",
      "select.connected",
      "select.children",
      "select.parent",
      "select.siblings",
    ],
  },
  ARRANGE,
  "arrange.group",
  "arrange.ungroup",
  "arrange.fit-contents",
  "arrange.tidy-up",
  "arrange.lock",
  "-",
  "view.show-yaml",
  "-",
  "edit.delete",
];

/** Right-click on a connection (02-connectors §10). */
export const CONNECTION_MENU: MenuSpec = [
  "edit.rename",
  "edit.copy-style",
  "edit.paste-style",
  "-",
  "connection.add-bend",
  "connection.remove-bend",
  "connection.clear-bends",
  "connection.free-ends",
  "-",
  "connection.reverse",
  {
    submenu: "Route",
    icon: Spline,
    items: ["connection.route-orthogonal", "connection.route-curved", "connection.route-straight"],
  },
  {
    submenu: "Line",
    icon: PenLine,
    items: LINE_PATTERNS.map((pattern) => `connection.line-${pattern}`),
  },
  FLOW,
  "-",
  { submenu: "Select", icon: MousePointer2, items: ["select.source", "select.target"] },
  "-",
  "view.show-yaml",
  "-",
  "edit.delete",
];

export function menuFor(sel: SelectionInfo): MenuSpec {
  if (sel.kind === "none") return CANVAS_MENU;
  if (sel.kind === "connection") return CONNECTION_MENU;
  return ELEMENT_MENU;
}

/** The diagram menu (top left): files, panels and help. */
export const DIAGRAM_MENU: MenuSpec = [
  "file.save-to-cloud",
  "file.download",
  "file.open",
  "file.history",
  "-",
  {
    submenu: "Export",
    icon: Download,
    items: ["file.export", "file.copy-png", "file.copy-svg"],
  },
  "-",
  {
    submenu: "View",
    icon: Eye,
    items: [
      "view.library",
      "view.concepts",
      "view.assistant",
      "view.inspector",
      "view.code",
      "view.tours",
      "-",
      "view.grid",
      "view.minimap",
      "-",
      "view.zoom-fit",
      "view.zoom-selection",
      "view.zoom-100",
      "view.zoom-in",
      "view.zoom-out",
    ],
  },
  "view.diagram-settings",
  "-",
  "palette.open",
  "help.shortcuts",
];

export type ResolvedEntry =
  | {
      readonly kind: "item";
      readonly command: Command;
      readonly label: string;
      readonly enabled: boolean;
      readonly checked: boolean | null;
    }
  | { readonly kind: "separator" }
  | {
      readonly kind: "submenu";
      readonly label: string;
      readonly icon: Command["icon"];
      readonly items: readonly ResolvedEntry[];
    };

/**
 * Turns a menu into what to draw now. `hideDisabled` (context menus) drops what doesn't apply;
 * submenus with nothing left go too. In submenus, items use their short `menuLabel`.
 */
export function resolveMenu(
  spec: MenuSpec,
  c: CommandContext,
  hideDisabled: boolean,
  nested = false,
): ResolvedEntry[] {
  const out: ResolvedEntry[] = [];
  for (const entry of spec) {
    if (entry === "-") {
      out.push({ kind: "separator" });
      continue;
    }
    if (typeof entry === "string") {
      const cmd = command(entry);
      if (cmd === undefined) continue;
      const enabled = isEnabled(cmd, c);
      if (!enabled && hideDisabled) continue;
      out.push({
        kind: "item",
        command: cmd,
        label: nested && cmd.menuLabel !== undefined ? cmd.menuLabel : labelOf(cmd, c),
        enabled,
        checked: cmd.checked === undefined ? null : cmd.checked(c),
      });
      continue;
    }
    const items = resolveMenu(entry.items, c, hideDisabled, true);
    if (items.some((item) => item.kind !== "separator" && (item.kind !== "item" || item.enabled)))
      out.push({ kind: "submenu", label: entry.submenu, icon: entry.icon, items });
  }
  return tidySeparators(out);
}

function tidySeparators(entries: readonly ResolvedEntry[]): ResolvedEntry[] {
  const out: ResolvedEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "separator" && (out.length === 0 || out.at(-1)?.kind === "separator"))
      continue;
    out.push(entry);
  }
  while (out.at(-1)?.kind === "separator") out.pop();
  return out;
}
