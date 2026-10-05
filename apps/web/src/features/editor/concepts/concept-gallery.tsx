"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { History, LayoutGrid, UserRound } from "lucide-react";
import { conceptPlatformLabel, diagramCloud } from "@mogram/core/presets";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  builtinConcepts,
  useOwnConcepts,
  useRecentConcepts,
  type ConceptEntry,
} from "@/features/concepts/catalog";
import {
  bothKinds,
  choosePlatform,
  defaultPlatform,
  filterConcepts,
  platformChoices,
  shelfLabel,
  topicShelves,
  type ConceptFilter,
  type PlatformFilter,
  type Shelf,
} from "@/features/concepts/browse";
import { ConceptDialog } from "../dialogs/concept-dialog";
import { useEditor, useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";
import { ConceptCard } from "./concept-card";
import { TopicIcon } from "./topic-icon";

/**
 * Every concept at once (D-85): topics down the side, filters and search across the top, and a
 * grid of previews — drawn as they scroll into view, playing while the pointer is over one.
 * Opening one shows the concept window over the gallery; using it closes both.
 */
export function ConceptGallery() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "concepts");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => store.getState().setDialog(next ? "concepts" : null)}
    >
      {open ? (
        <DialogContent
          size="xl"
          title="Concepts"
          description="Ideas worth explaining: watch one, apply it to your diagram, or insert it."
          className="h-[calc(100dvh-2rem)] max-w-6xl"
        >
          <GalleryBody onDone={() => store.getState().setDialog(null)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function GalleryBody({ onDone }: { onDone: () => void }) {
  const store = useEditorStore();
  const host = useEditorHost();
  const own = useOwnConcepts(host.signedIn, host.id);
  const recent = useRecentConcepts();
  const entries = useMemo(() => [...own, ...builtinConcepts()], [own]);
  const [query, setQuery] = useState("");
  const text = useDeferredValue(query);
  const [wanted, setPlatform] = useState<PlatformFilter>(() =>
    defaultPlatform(diagramCloud(store.getState().parsed().diagram)),
  );
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [wantedKind, setKind] = useState<ConceptFilter["kind"]>("all");
  const [open, setOpen] = useState<ConceptEntry | null>(null);
  // Filters appear only when they'd change something: a platform with concepts of its own,
  // and both kinds.
  const platforms = platformChoices(entries);
  const platform = choosePlatform(platforms, wanted);
  const kinds = bothKinds(entries);
  const kind = kinds ? wantedKind : "all";

  const shown = filterConcepts(entries, { text, platform, shelf, kind }, recent);
  const shelves = topicShelves(entries, platform);
  const yours = filterConcepts(entries, { text: "", platform, shelf: "yours", kind: "all" });
  const side: { shelf: Shelf | null; label: string; count?: number; icon: React.ReactNode }[] = [
    { shelf: null, label: "All concepts", icon: <LayoutGrid /> },
    ...(yours.length > 0
      ? [{ shelf: "yours" as const, label: "Yours", count: yours.length, icon: <UserRound /> }]
      : []),
    ...(recent.length > 0
      ? [{ shelf: "recent" as const, label: "Recently used", icon: <History /> }]
      : []),
    ...shelves.map((item) => ({
      shelf: item.shelf,
      label: item.label,
      count: item.count,
      icon: <TopicIcon topic={item.shelf === "other" ? null : item.shelf} />,
    })),
  ];

  return (
    <div className="flex h-full min-h-0 gap-5">
      <nav aria-label="Concept topics" className="hidden w-52 shrink-0 overflow-y-auto md:block">
        <ul role="list" className="flex flex-col gap-0.5">
          {side.map((item) => (
            <li key={item.shelf ?? "all"}>
              <button
                type="button"
                aria-current={shelf === item.shelf ? "true" : undefined}
                onClick={() => setShelf(item.shelf)}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-label transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                  shelf === item.shelf
                    ? "bg-fill-active text-fg-strong"
                    : "text-fg-soft hover:bg-fill-hover hover:text-fg",
                )}
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.count !== undefined ? (
                  <span className="text-micro tabular-nums text-fg-ghost">{item.count}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            placeholder="Search concepts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search all concepts"
            className="min-h-9 min-w-48 flex-1"
          />
          <div className="min-w-0 flex-1 basis-32 md:hidden">
            <Select
              label="Topic"
              value={shelf ?? "all"}
              onChange={(value) => setShelf(value === "all" ? null : (value as Shelf))}
              options={[
                { value: "all", label: "All topics" },
                ...side
                  .filter((s) => s.shelf !== null)
                  .map((s) => ({ value: s.shelf as string, label: s.label })),
              ]}
            />
          </div>
          {platforms.length > 0 ? (
            <div className="min-w-0 flex-1 basis-32 md:w-40 md:flex-none">
              <Select
                label="Platform"
                value={platform}
                onChange={setPlatform}
                options={platforms}
              />
            </div>
          ) : null}
          {kinds ? (
            <SegmentedControl
              label="Kind"
              size="sm"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All" },
                {
                  value: "pattern",
                  label: "Apply",
                  ariaLabel: "Patterns to apply to your diagram",
                },
                { value: "explainer", label: "Explain", ariaLabel: "Explainers to insert or open" },
              ]}
            />
          ) : null}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-label font-medium text-fg">
            {shelf === null ? "All concepts" : shelfLabel(shelf)}
          </h3>
          <span className="text-caption tabular-nums text-fg-muted" data-testid="gallery-count">
            {shown.length} {shown.length === 1 ? "concept" : "concepts"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {shown.length === 0 ? (
            <p className="py-16 text-center text-label text-fg-muted">
              No concepts here
              {text.trim() !== "" ? ` match “${text}”` : ""}
              {platform === "all" ? "" : ` for ${conceptPlatformLabel(platform)}`}.
            </p>
          ) : (
            <ul
              role="list"
              aria-label="Concepts"
              className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 pb-2"
            >
              {shown.map((entry) => (
                <li key={entry.key}>
                  <ConceptCard entry={entry} onOpen={() => setOpen(entry)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConceptDialog entry={open} onClose={() => setOpen(null)} onDone={onDone} />
    </div>
  );
}
