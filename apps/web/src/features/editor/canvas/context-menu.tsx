"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Point } from "@mogram/core/layout";
import { toWorld } from "@/features/canvas/camera";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/menu";
import { useCommandContext } from "../commands/context";
import { CommandMenuItems } from "../commands/menu-items";
import { menuFor, resolveMenu } from "../commands/menus";
import type { CommandContext } from "../commands/types";
import { useEditorStore } from "../editor-context";
import { hitAt } from "./hit";

interface Aim {
  readonly name: string | null;
  readonly point: Point;
}

/**
 * Right-click menu for the canvas (05-ui-shell-commands §13.5): selects what was clicked, then
 * lists the commands that apply to it, built from the command registry when it opens.
 */
export function CanvasContextMenu({ children }: { children: ReactNode }) {
  const store = useEditorStore();
  const contextAt = useCommandContext();
  /** Where a touch long-press began: Radix opens the menu from its own timer, not `contextmenu`. */
  const pressed = useRef<Aim | null>(null);
  const [context, setContext] = useState<CommandContext | null>(null);

  const locate = (event: MouseEvent<HTMLElement>): Aim => {
    const rect = event.currentTarget.getBoundingClientRect();
    // A selected connection's handles belong to it: keep it selected.
    const onHandle =
      event.target instanceof Element && event.target.closest("[data-handle]") !== null;
    const selected = store.getState().selection;
    return {
      name:
        onHandle && selected.length === 1
          ? (selected[0] ?? null)
          : (hitAt(event.target, event.clientX, event.clientY)?.name ?? null),
      point: toWorld(store.getState().camera, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }),
    };
  };
  /** Points the menu at what was pressed, selecting it first. */
  const aim = ({ name, point }: Aim) => {
    const { selection, select } = store.getState();
    if (name !== null && !selection.includes(name)) select([name]);
    if (name === null) select([]);
    setContext(contextAt(point));
  };

  const entries = context === null ? [] : resolveMenu(menuFor(context.sel), context, true);

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open && pressed.current !== null) aim(pressed.current);
        pressed.current = null;
        if (!open) setContext(null);
      }}
    >
      <ContextMenuTrigger
        asChild
        onPointerDown={(event) => {
          pressed.current = event.pointerType === "mouse" ? null : locate(event);
        }}
        onContextMenu={(event) => {
          pressed.current = null;
          aim(locate(event));
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60" aria-label="Canvas actions">
        {context === null ? null : (
          <CommandMenuItems entries={entries} context={context} variant="context" />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
