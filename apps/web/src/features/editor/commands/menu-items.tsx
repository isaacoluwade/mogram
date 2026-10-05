"use client";

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@/components/ui/menu";
import { shortcutLabel } from "./keys";
import type { ResolvedEntry } from "./menus";
import type { CommandContext } from "./types";

/**
 * Draws a resolved menu (menus.ts) with the dropdown or right-click primitives. Every row runs
 * its command with the context the menu opened with. A right-click menu's top-level rows stay
 * one line, with the description as a tooltip.
 */
export function CommandMenuItems({
  entries,
  context,
  variant,
  nested = false,
}: {
  entries: readonly ResolvedEntry[];
  context: CommandContext;
  variant: "dropdown" | "context";
  /** Inside a submenu: rows show their descriptions (the presets explain themselves there). */
  nested?: boolean;
}) {
  const Item = variant === "context" ? ContextMenuItem : MenuItem;
  const Separator = variant === "context" ? ContextMenuSeparator : MenuSeparator;
  const Sub = variant === "context" ? ContextMenuSub : MenuSub;
  const SubTrigger = variant === "context" ? ContextMenuSubTrigger : MenuSubTrigger;
  const SubContent = variant === "context" ? ContextMenuSubContent : MenuSubContent;
  // Right-click menus stay compact; dropdowns and submenus explain their rows.
  const describe = nested || variant === "dropdown";
  return entries.map((entry, index) => {
    if (entry.kind === "separator") return <Separator key={`separator-${index}`} />;
    if (entry.kind === "submenu") {
      const Icon = entry.icon;
      return (
        <Sub key={`submenu-${entry.label}`}>
          <SubTrigger {...(Icon === undefined ? {} : { icon: <Icon /> })}>{entry.label}</SubTrigger>
          <SubContent className="w-56">
            <CommandMenuItems entries={entry.items} context={context} variant={variant} nested />
          </SubContent>
        </Sub>
      );
    }
    const { command } = entry;
    const Icon = command.icon;
    const key = command.keys?.[0];
    return (
      <Item
        key={command.id}
        data-command={command.id}
        {...(command.description === undefined || describe ? {} : { title: command.description })}
        disabled={!entry.enabled}
        tone={command.danger === true ? "danger" : "default"}
        {...(Icon === undefined ? {} : { icon: <Icon /> })}
        {...(key === undefined ? {} : { shortcut: shortcutLabel(key) })}
        {...(entry.checked === null ? {} : { checked: entry.checked })}
        {...(command.description === undefined || !describe
          ? {}
          : { description: command.description })}
        onSelect={() => void command.run(context)}
      >
        {entry.label}
      </Item>
    );
  });
}
