"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookmarkPlus,
  Copy,
  History,
  MoreHorizontal,
  PanelRightClose,
  PenLine,
  RotateCcw,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { diffProjects, isMoveOnly, type Change } from "@mogram/core/diff";
import type { ProjectFiles } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { dayLabel, timeLabel, versionDetail, versionTitle } from "@/features/history/format";
import type { VersionItem } from "@/features/history/source";
import { useInView } from "@/features/history/use-in-view";
import { useEditor, useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";
import { CHANGE_TONES } from "./changes-overlay";
import { previousOf, useVersionActions, useVersions, versionFilesKey } from "./use-versions";

/**
 * Version history (on the right, in place of the inspector): versions by day, each with what
 * changed, who made it and a thumbnail. Choosing one shows it on the canvas, read-only, with
 * its changes; from there it can be restored, copied, named, or parts of it brought back.
 */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const versions = useVersions();
  const actions = useVersionActions();
  const viewingId = useEditor((s) => s.viewing?.id ?? null);
  const [opening, setOpening] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  // A save made while the panel is open becomes (or joins) the newest version.
  const savedAt = useEditor((s) => (s.save.kind === "saved" ? s.save.at : null));
  const firstSave = useRef(savedAt);
  useEffect(() => {
    if (savedAt === null || savedAt === firstSave.current) return;
    void actions.refresh();
  }, [savedAt, actions]);

  const list = useMemo(() => versions.data ?? [], [versions.data]);
  const days = useMemo(() => {
    const groups: { day: string; versions: VersionItem[] }[] = [];
    for (const version of list) {
      const day = dayLabel(version.updatedAt);
      const last = groups.at(-1);
      if (last?.day === day) last.versions.push(version);
      else groups.push({ day, versions: [version] });
    }
    return groups;
  }, [list]);
  const currentId = list[0]?.id ?? null;
  const shownId = opening ?? viewingId ?? currentId;

  const choose = async (version: VersionItem) => {
    if (version.id === currentId) {
      setOpening(null);
      await actions.view(null, null);
      return;
    }
    setOpening(version.id);
    await actions.view(version, previousOf(list, version.id));
    setOpening((now) => (now === version.id ? null : now));
  };

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="Version history"
    >
      <PanelHeader>
        <PanelTitle>Version history</PanelTitle>
        <IconButton
          label="Name the current version"
          size="sm"
          active={naming}
          onClick={() => setNaming((open) => !open)}
        >
          <BookmarkPlus />
        </IconButton>
        <IconButton label="Hide version history" size="sm" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </PanelHeader>
      {naming ? (
        <div className="border-b border-border-muted p-3">
          <NameForm
            label="Name for the current version"
            placeholder="e.g. Reviewed with the team"
            initial=""
            submit="Name it"
            onCancel={() => setNaming(false)}
            onSubmit={async (name) => {
              setNaming(false);
              await actions.nameCurrent(name);
            }}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {versions.isPending ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : versions.isError ? (
          <EmptyState
            icon={<History />}
            title="History couldn't load"
            description={versions.error.message}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No versions yet"
            description="Versions appear here as you edit."
          />
        ) : (
          <ol aria-label="Versions" className="flex flex-col pb-3">
            {days.map((group) => (
              <li key={group.day}>
                <h3 className="sticky top-0 z-10 bg-sidebar/95 px-4 pb-1.5 pt-3 text-micro font-medium uppercase tracking-wide text-fg-muted backdrop-blur-xl">
                  {group.day}
                </h3>
                <ol className="flex flex-col gap-0.5 px-2">
                  {group.versions.map((version) => (
                    <VersionRow
                      key={version.id}
                      version={version}
                      current={version.id === currentId}
                      selected={version.id === shownId}
                      loading={version.id === opening}
                      previous={previousOf(list, version.id)}
                      onChoose={() => void choose(version)}
                    />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="border-t border-border-muted px-4 py-2.5 text-micro text-fg-muted">
        Every version from the last day is kept, then one an hour for a month and one a day after
        that. Named versions are always kept.
      </p>
    </Panel>
  );
}

function VersionRow({
  version,
  current,
  selected,
  loading,
  previous,
  onChoose,
}: {
  version: VersionItem;
  current: boolean;
  selected: boolean;
  loading: boolean;
  previous: VersionItem | null;
  onChoose: () => void;
}) {
  const actions = useVersionActions();
  const [renaming, setRenaming] = useState(false);
  const detail = versionDetail(version);
  const ai = version.source === "ai";

  return (
    <li
      data-testid="version"
      data-version={version.id}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group/version relative rounded-lg transition-colors",
        selected ? "bg-fill-active" : "hover:bg-fill-hover",
      )}
    >
      {renaming ? (
        <div className="p-2">
          <NameForm
            label="Version name"
            placeholder="Name this version"
            initial={version.name ?? ""}
            submit="Save"
            onCancel={() => setRenaming(false)}
            onSubmit={async (name) => {
              setRenaming(false);
              await actions.rename(version, name);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          aria-label={`${current ? "Current version: " : ""}${versionTitle(version)}, ${timeLabel(version)}`}
          className="flex w-full items-start gap-3 rounded-lg px-2 py-2 pr-9 text-left outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
        >
          <VersionThumbnail id={version.id} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {current ? (
              <span className="text-micro font-medium text-green">Current version</span>
            ) : null}
            <span className="flex min-w-0 items-start gap-1.5 text-label font-medium text-fg">
              {ai ? (
                <Sparkles aria-label="Assistant" className="mt-0.5 size-3.5 shrink-0 text-violet" />
              ) : version.name !== null ? (
                <Tag aria-label="Named" className="mt-0.5 size-3.5 shrink-0 text-fg-secondary" />
              ) : null}
              <span className="line-clamp-2 break-words">
                {ai && version.name === null ? `“${versionTitle(version)}”` : versionTitle(version)}
              </span>
            </span>
            {detail !== null ? (
              <span className="truncate text-caption text-fg-soft">{detail}</span>
            ) : null}
            <span className="truncate text-caption text-fg-muted">
              {timeLabel(version)}
              {version.author !== null && version.author !== "" ? ` · ${version.author}` : ""}
            </span>
          </span>
          {loading ? <Spinner className="mt-1 size-3.5" label="Opening this version" /> : null}
        </button>
      )}
      {!renaming ? (
        <div
          className={cn(
            "absolute right-1.5 top-1.5 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-0 group-hover/version:opacity-100 group-focus-within/version:opacity-100",
          )}
        >
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Version actions" size="sm">
                <MoreHorizontal />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem icon={<PenLine />} onSelect={() => setRenaming(true)}>
                {version.name === null ? "Name this version" : "Rename"}
              </MenuItem>
              {version.name !== null ? (
                <MenuItem icon={<X />} onSelect={() => void actions.rename(version, null)}>
                  Remove the name
                </MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuItem
                icon={<RotateCcw />}
                disabled={current}
                onSelect={() => void actions.restore(version)}
              >
                Restore this version
              </MenuItem>
              <MenuItem icon={<Copy />} onSelect={() => void actions.copy(version)}>
                Make a copy
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ) : null}
      {selected && !current && !loading ? (
        <VersionChanges version={version} previous={previous} />
      ) : null}
    </li>
  );
}

/** A small picture of the version, drawn once it scrolls into view. */
function VersionThumbnail({ id }: { id: string }) {
  const host = useEditorHost();
  const [ref, seen] = useInView<HTMLSpanElement>();
  const files = useQuery({
    queryKey: versionFilesKey(host.history, id),
    queryFn: () => host.history.files(id),
    staleTime: Infinity,
    enabled: seen,
  });
  return (
    <span
      ref={ref}
      aria-hidden
      className="relative mt-0.5 block h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface"
    >
      {files.data !== undefined ? (
        <DiagramPreview
          files={files.data}
          className="pointer-events-none absolute inset-0"
          padding={6}
          animate={false}
        />
      ) : null}
    </span>
  );
}

const RESTORABLE = new Set<Change["thing"]>([
  "component",
  "shape",
  "container",
  "group",
  "connection",
  "note",
  "scene",
]);

const KIND_ORDER = { added: 0, changed: 1, removed: 2 } as const;
const SHOWN = 8;

/** What changed in a version (against the one before), each with Bring back. */
function VersionChanges({
  version,
  previous,
}: {
  version: VersionItem;
  previous: VersionItem | null;
}) {
  const host = useEditorHost();
  const store = useEditorStore();
  const actions = useVersionActions();
  const folder = useEditor((s) => s.folder);
  const [all, setAll] = useState(false);
  const files = useQuery({
    queryKey: versionFilesKey(host.history, version.id),
    queryFn: () => host.history.files(version.id),
    staleTime: Infinity,
  });
  const before = useQuery({
    queryKey: versionFilesKey(host.history, previous?.id ?? ""),
    queryFn: () => host.history.files(previous?.id ?? ""),
    staleTime: Infinity,
    enabled: previous !== null,
  });
  const changes = useMemo(() => {
    if (files.data === undefined || before.data === undefined) return null;
    return [...diffProjects(before.data, files.data).changes].sort(
      (a, b) => KIND_ORDER[a.change] - KIND_ORDER[b.change],
    );
  }, [files.data, before.data]);

  if (previous === null)
    return <p className="px-3 pb-3 text-caption text-fg-muted">The first version.</p>;
  if (files.isError || before.isError)
    return <p className="px-3 pb-3 text-caption text-rose">The changes couldn&apos;t load.</p>;
  if (changes === null || files.data === undefined || before.data === undefined)
    return (
      <div className="px-3 pb-3">
        <Skeleton className="h-10" />
      </div>
    );
  if (changes.length === 0)
    return <p className="px-3 pb-3 text-caption text-fg-muted">Nothing changed.</p>;

  const thisVersion = files.data;
  const versionBefore = before.data;
  const shown = all ? changes : changes.slice(0, SHOWN);
  return (
    <div className="px-2 pb-2">
      <ul aria-label="Changes in this version" className="flex flex-col gap-px">
        {shown.map((change) => (
          <ChangeRow
            key={`${change.folder}:${change.thing}:${change.name}`}
            change={change}
            selectable={change.folder === folder && change.change !== "removed"}
            onSelect={() => store.getState().select([change.name])}
            onBringBack={
              RESTORABLE.has(change.thing)
                ? () =>
                    actions.bringBack(
                      bringBackOf(
                        change,
                        change.change === "removed" ? versionBefore : thisVersion,
                      ),
                    )
                : null
            }
          />
        ))}
      </ul>
      {changes.length > SHOWN ? (
        <Button size="sm" variant="ghost" className="mt-1" onClick={() => setAll((open) => !open)}>
          {all ? "Show fewer" : `Show all ${changes.length}`}
        </Button>
      ) : null}
    </div>
  );
}

function bringBackOf(change: Change, from: ProjectFiles) {
  return change.thing === "scene"
    ? { from, folder: change.folder, names: [], scenes: [change.name], label: change.label }
    : { from, folder: change.folder, names: [change.name], label: change.label };
}

const CHANGE_WORDS = { added: "Added", changed: "Changed", removed: "Removed" } as const;
const THING_WORDS: Partial<Record<Change["thing"], string>> = {
  scene: "scene",
  tour: "tour",
  settings: "diagram settings",
  style: "style",
  file: "file",
};

function ChangeRow({
  change,
  selectable,
  onSelect,
  onBringBack,
}: {
  change: Change;
  selectable: boolean;
  onSelect: () => void;
  onBringBack: (() => void) | null;
}) {
  const moved = change.change === "changed" && isMoveOnly(change);
  const what = moved
    ? "Moved"
    : change.change === "changed" && change.fields.length > 0
      ? `Changed ${change.fields.slice(0, 3).join(", ")}`
      : CHANGE_WORDS[change.change];
  const thing = THING_WORDS[change.thing];
  const name: ReactNode = (
    <>
      <span className="truncate text-label text-fg">
        {change.thing === "settings" ? "Diagram settings" : change.label}
      </span>
      <span className="truncate text-micro text-fg-muted">
        {what}
        {thing !== undefined && change.thing !== "settings" ? ` · ${thing}` : ""}
        {change.folder !== "" && change.thing !== "file" ? ` · in ${change.folder}` : ""}
      </span>
    </>
  );
  return (
    <li
      data-testid="version-change"
      data-change={change.change}
      className="group/change flex items-center gap-2 rounded-md py-1 pl-2 pr-1 hover:bg-fill-hover"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          CHANGE_TONES[change.change] === "green"
            ? "bg-green"
            : CHANGE_TONES[change.change] === "amber"
              ? "bg-amber"
              : "bg-rose",
        )}
      />
      {selectable ? (
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 flex-col text-left outline-none focus-visible:underline"
        >
          {name}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col">{name}</span>
      )}
      {onBringBack !== null ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 opacity-0 group-hover/change:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
          aria-label={`Bring back ${change.label}`}
          onClick={onBringBack}
        >
          Bring back
        </Button>
      ) : null}
    </li>
  );
}

/** A name typed in place: Enter saves, Escape cancels. */
function NameForm({
  label,
  placeholder,
  initial,
  submit,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  initial: string;
  submit: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const name = value.trim();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.length > 0) void onSubmit(name.slice(0, 120));
      }}
    >
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={120}
        autoFocus
        className="h-8 text-label"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <Button type="submit" size="sm" variant="primary" disabled={name.length === 0}>
        {submit}
      </Button>
    </form>
  );
}
