"use client";

import { Copy, History, RotateCcw, Undo2 } from "lucide-react";
import type { ChangeKind } from "@mogram/core/diff";
import type { Diagram } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { versionTitle } from "@/features/history/format";
import { usePreference, type HistoryChanges } from "@/lib/preferences";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { useVersionActions, useVersions } from "./use-versions";

const CHANGE_OPTIONS = [
  { value: "previous", label: "Changes in this version" },
  { value: "current", label: "Changes since then" },
  { value: "off", label: "Changes hidden" },
] as const satisfies readonly { value: HistoryChanges; label: string }[];

const NONE: readonly string[] = [];

const labelIn = (diagram: Diagram, name: string): string =>
  diagram.components.get(name)?.label ??
  diagram.containers.get(name)?.label ??
  diagram.groups.get(name)?.label ??
  diagram.connections.get(name)?.text ??
  name;

/**
 * Over the canvas while an earlier version is shown: which version it is, what its changes are
 * drawn against, and what can be done with it (restore it, copy it, bring parts of it back, or
 * go back to the current version).
 */
export function VersionBanner() {
  const id = useEditor((s) => s.viewing?.id ?? null);
  return id === null ? null : <Banner id={id} />;
}

function Banner({ id }: { id: string }) {
  const store = useEditorStore();
  const actions = useVersionActions();
  const versions = useVersions();
  const mode = usePreference("historyChanges");
  const viewing = useEditorShallow((s) => ({
    title: s.viewing?.title ?? "",
    first: s.viewing?.previousId === null,
  }));
  const selected = useEditor((s) => (s.viewing === null ? NONE : s.selection));
  const version = versions.data?.find((v) => v.id === id) ?? null;
  const named = version === null ? null : versionTitle(version);

  const bringBackSelected = () => {
    const state = store.getState();
    const shown = state.viewing;
    if (shown === null || selected.length === 0) return;
    const only = selected.length === 1 ? selected[0] : undefined;
    const label =
      only !== undefined ? labelIn(state.diagram(), only) : `${selected.length} elements`;
    actions.bringBack({ from: shown.files, folder: state.folder, names: selected, label });
  };

  return (
    <Panel
      role="region"
      aria-label="Earlier version"
      data-testid="version-banner"
      className="pointer-events-auto flex w-[min(660px,100%)] flex-col gap-2 rounded-xl px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <History aria-hidden className="size-4 shrink-0 text-fg-secondary" />
        <p className="min-w-0 flex-1 truncate text-label text-fg-soft" title={named ?? undefined}>
          <span className="font-medium text-fg">{viewing.title}</span>
          {named !== null ? ` · ${named}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label="Make a copy"
            size="sm"
            disabled={version === null}
            onClick={() => version !== null && void actions.copy(version)}
          >
            <Copy />
          </IconButton>
          <Button size="sm" variant="secondary" onClick={() => void actions.view(null, null)}>
            <Undo2 />
            Back to current
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={version === null}
            onClick={() => version !== null && void actions.restore(version)}
          >
            <RotateCcw />
            Restore
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Select
          label="Show changes"
          value={mode}
          options={CHANGE_OPTIONS}
          className="h-7 w-auto"
          onChange={(next) => void actions.showChanges(next)}
        />
        {mode === "previous" && viewing.first ? (
          <span className="text-caption text-fg-muted">This is the first version.</span>
        ) : mode !== "off" ? (
          <Legend mode={mode} />
        ) : null}
        {selected.length > 0 ? (
          <Button size="sm" variant="secondary" className="ml-auto" onClick={bringBackSelected}>
            Bring back {selected.length === 1 ? "selected" : `${selected.length} selected`}
          </Button>
        ) : (
          <span className="ml-auto text-caption text-fg-muted max-md:hidden">
            Read-only · select things to bring them back
          </span>
        )}
      </div>
    </Panel>
  );
}

const SWATCH: Readonly<Record<ChangeKind, string>> = {
  added: "border-green bg-green-fill",
  changed: "border-amber bg-amber-fill",
  removed: "border-rose bg-rose-fill",
};

const WORDS: Readonly<Record<ChangeKind, string>> = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
};

/** The colours on the canvas. Dashed: drawn where it was, since it isn't in this version. */
function Legend({ mode }: { mode: "previous" | "current" }) {
  const ghost: ChangeKind = mode === "previous" ? "removed" : "added";
  return (
    <ul aria-label="Colours" className="flex items-center gap-3 text-caption text-fg-soft">
      {(["added", "changed", "removed"] as const).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "size-3 rounded-[3px] border-[1.5px]",
              SWATCH[kind],
              kind === ghost && "border-dashed",
            )}
          />
          {WORDS[kind]}
        </li>
      ))}
    </ul>
  );
}
