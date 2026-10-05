"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SearchField } from "@/components/ui/search-field";
import { useCommandContext } from "../commands/context";
import { shortcutLabel } from "../commands/keys";
import { COMMANDS, GROUP_LABELS, KEY_HINTS, labelOf } from "../commands/registry";
import type { CommandGroup } from "../commands/types";
import { useEditor, useEditorStore } from "../editor-context";

const ORDER: readonly CommandGroup[] = [
  "tools",
  "edit",
  "select",
  "arrange",
  "connection",
  "view",
  "scene",
  "file",
  "help",
];

interface Row {
  readonly id: string;
  readonly group: CommandGroup;
  readonly label: string;
  readonly keys: readonly string[];
}

/**
 * Every shortcut, generated from the command registry the key handler uses (ED-7,
 * 05-ui-shell-commands §13.4), so what it shows is what the keys do. A filter finds one fast.
 */
export function ShortcutsDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "shortcuts");
  const contextNow = useCommandContext();
  const [filter, setFilter] = useState("");

  const context = open ? contextNow() : null;
  const rows: Row[] =
    context === null
      ? []
      : [
          ...COMMANDS.filter((c) => c.keys !== undefined && c.listed !== false).map((c) => ({
            id: c.id,
            group: c.group,
            label: labelOf(c, context),
            keys: c.keys ?? [],
          })),
          ...KEY_HINTS.map((hint) => ({
            id: `hint:${hint.label}`,
            group: hint.group,
            label: hint.label,
            keys: [hint.keys],
          })),
        ];
  const query = filter.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      query.length === 0 ||
      row.label.toLowerCase().includes(query) ||
      row.keys.some((key) => shortcutLabel(key).toLowerCase().includes(query)),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        store.getState().setDialog(next ? "shortcuts" : null);
        if (!next) setFilter("");
      }}
    >
      {open ? (
        <DialogContent
          size="lg"
          title="Keyboard shortcuts"
          description="⌘ on Mac, Ctrl elsewhere. Hold Space and drag to pan; pinch or ⌘-scroll to zoom."
        >
          <SearchField
            aria-label="Filter shortcuts"
            placeholder="Find a shortcut"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="mb-4"
          />
          {shown.length === 0 ? (
            <p className="py-6 text-center text-label text-fg-muted">No shortcut matches that.</p>
          ) : (
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {ORDER.map((group) => {
                const list = shown.filter((row) => row.group === group);
                if (list.length === 0) return null;
                return (
                  <section key={group} aria-labelledby={`shortcuts-${group}`}>
                    <h3
                      id={`shortcuts-${group}`}
                      className="mb-2 font-sans text-caption font-medium text-fg-muted"
                    >
                      {GROUP_LABELS[group]}
                    </h3>
                    <dl>
                      {/* One rule per row, unbroken between the action and its keys. */}
                      {list.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center gap-4 border-b border-border-subtle py-1.5"
                        >
                          <dt className="min-w-0 flex-1 text-label text-fg-soft">{row.label}</dt>
                          <dd className="flex gap-1">
                            {row.keys.slice(0, 1).map((key) => (
                              <Kbd key={key}>{shortcutLabel(key)}</Kbd>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
