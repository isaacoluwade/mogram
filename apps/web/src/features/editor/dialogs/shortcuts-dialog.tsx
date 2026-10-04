"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useEditor, useEditorStore } from "../editor-context";
import { SHORTCUTS, shortcutLabel, type Shortcut } from "../shortcuts";

const GROUPS: readonly Shortcut["group"][] = ["Tools", "Edit", "Arrange", "View", "Scenes"];

/** Every shortcut, generated from the same table the key handler uses (ED-7). */
export function ShortcutsDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "shortcuts");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => store.getState().setDialog(next ? "shortcuts" : null)}
    >
      {open ? (
        <DialogContent
          size="lg"
          title="Keyboard shortcuts"
          description="Hold Space and drag to pan. Pinch or ⌘-scroll to zoom."
        >
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <section key={group} aria-labelledby={`shortcuts-${group}`}>
                <h3
                  id={`shortcuts-${group}`}
                  className="mb-2 font-sans text-caption font-medium text-fg-muted"
                >
                  {group}
                </h3>
                <dl>
                  {/* One rule per row, unbroken between the action and its keys. */}
                  {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => (
                    <div
                      key={shortcut.combo}
                      className="flex items-center gap-4 border-b border-border-subtle py-1.5"
                    >
                      <dt className="min-w-0 flex-1 text-label text-fg-soft">{shortcut.label}</dt>
                      <dd>
                        <Kbd>{shortcutLabel(shortcut.combo)}</Kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
