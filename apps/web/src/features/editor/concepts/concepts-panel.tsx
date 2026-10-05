"use client";

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, LayoutGrid, PanelLeftClose } from "lucide-react";
import { conceptPlatformLabel, diagramCloud } from "@mogram/core/presets";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SearchField } from "@/components/ui/search-field";
import { Select } from "@/components/ui/select";
import {
  builtinConcepts,
  useOwnConcepts,
  useRecentConcepts,
  type ConceptEntry,
} from "@/features/concepts/catalog";
import {
  choosePlatform,
  defaultPlatform,
  filterConcepts,
  platformChoices,
  shelfLabel,
  topicShelves,
  type PlatformFilter,
  type Shelf,
} from "@/features/concepts/browse";
import { LeftTabs } from "../assistant/assistant-panel";
import { ConceptDialog } from "../dialogs/concept-dialog";
import { useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";
import { ConceptCard } from "./concept-card";
import { TopicIcon } from "./topic-icon";

/** Yours and Recently used show this many (two rows of two), with the rest a click away. */
const SHOWN = 4;

/**
 * The Concepts tab (D-85): ideas worth explaining, found by search or by topic, with yours and
 * the ones used lately first. Once some concepts are a platform's own, a platform filter appears
 * (opening on the diagram's cloud; general concepts always show). Browse all opens the gallery.
 */
export function ConceptsPanel({ onClose }: { onClose: () => void }) {
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
  const [open, setOpen] = useState<ConceptEntry | null>(null);
  const platforms = platformChoices(entries);
  const platform = choosePlatform(platforms, wanted);

  const filter = { text, platform, kind: "all" as const };
  const yours = filterConcepts(entries, { ...filter, text: "", shelf: "yours" });
  const used = filterConcepts(entries, { ...filter, text: "", shelf: "recent" }, recent);
  const shelves = topicShelves(entries, platform);
  const found = text.trim() === "" ? null : filterConcepts(entries, { ...filter, shelf });
  const listed = shelf === null ? null : filterConcepts(entries, { ...filter, shelf }, recent);

  return (
    <Panel
      role="region"
      aria-label="Concepts"
      className="flex h-full w-full flex-col overflow-hidden"
    >
      <PanelHeader>
        <LeftTabs current="concepts" />
        <IconButton label="Hide panel" size="sm" onClick={onClose}>
          <PanelLeftClose />
        </IconButton>
      </PanelHeader>
      <div className="flex flex-col gap-2 px-3 pt-3">
        <SearchField
          placeholder="Search concepts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search concepts"
          className="min-h-9"
        />
        {platforms.length > 0 ? (
          <Select label="Platform" value={platform} onChange={setPlatform} options={platforms} />
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-4">
        {found !== null ? (
          found.length === 0 ? (
            <p className="px-1 py-6 text-center text-label text-fg-muted">
              No concepts match “{text}”
              {platform === "all" ? "" : ` for ${conceptPlatformLabel(platform)}`}.
            </p>
          ) : (
            <Block title={shelf === null ? "Results" : `${shelfLabel(shelf)} · results`}>
              <ConceptGrid
                entries={found}
                onOpen={setOpen}
                showTopic={shelf === null || shelf === "yours" || shelf === "recent"}
              />
            </Block>
          )
        ) : listed !== null && shelf !== null ? (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setShelf(null)}
              className="-mx-1 flex h-8 items-center gap-1.5 rounded-md px-1 text-left text-label text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-4"
            >
              <ArrowLeft aria-hidden />
              <span className="sr-only">Back to topics: </span>
              <span className="min-w-0 flex-1 truncate">{shelfLabel(shelf)}</span>
              <span className="text-micro tabular-nums text-fg-ghost">{listed.length}</span>
            </button>
            <ConceptGrid
              entries={listed}
              onOpen={setOpen}
              showTopic={shelf === "yours" || shelf === "recent"}
            />
          </div>
        ) : (
          <>
            {yours.length > 0 ? (
              <Block
                title="Yours"
                count={yours.length}
                onMore={yours.length > SHOWN ? () => setShelf("yours") : undefined}
              >
                <ConceptGrid entries={yours.slice(0, SHOWN)} onOpen={setOpen} showTopic />
              </Block>
            ) : null}
            {used.length > 0 ? (
              <Block
                title="Recently used"
                count={used.length}
                onMore={used.length > SHOWN ? () => setShelf("recent") : undefined}
              >
                <ConceptGrid entries={used.slice(0, SHOWN)} onOpen={setOpen} showTopic />
              </Block>
            ) : null}
            <Block
              title="Topics"
              action={
                <button
                  type="button"
                  onClick={() => store.getState().setDialog("concepts")}
                  className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-caption text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-3.5"
                >
                  <LayoutGrid aria-hidden />
                  Browse all
                </button>
              }
            >
              <ul role="list" aria-label="Concept topics" className="-mx-1 flex flex-col">
                {shelves.map((item) => (
                  <li key={item.shelf}>
                    <button
                      type="button"
                      onClick={() => setShelf(item.shelf)}
                      aria-label={`${item.label}, ${item.count} concepts`}
                      className="group flex h-10 w-full items-center gap-2.5 rounded-md px-1 text-left transition-colors hover:bg-fill-hover"
                    >
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fill-faint text-fg-soft group-hover:text-fg [&_svg]:size-4"
                      >
                        <TopicIcon topic={item.shelf === "other" ? null : item.shelf} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-label text-fg-soft group-hover:text-fg">
                        {item.label}
                      </span>
                      <span className="text-micro tabular-nums text-fg-ghost">{item.count}</span>
                      <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </Block>
          </>
        )}
      </div>
      <ConceptDialog entry={open} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function Block({
  title,
  count,
  onMore,
  action,
  children,
}: {
  title: string;
  count?: number;
  onMore?: (() => void) | undefined;
  /** Something to do from the heading, in place of a count. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col">
      <div className="mb-1.5 flex h-7 items-center justify-between gap-2">
        <h3 className="text-caption font-medium text-fg-soft">{title}</h3>
        {action !== undefined ? (
          action
        ) : onMore !== undefined ? (
          <button
            type="button"
            onClick={onMore}
            className="rounded-sm px-1 text-micro text-fg-muted transition-colors hover:text-fg"
          >
            See all {count}
          </button>
        ) : count !== undefined ? (
          <span className="text-micro tabular-nums text-fg-ghost">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Concepts as small cards, two to a row, each previewing its diagram (playing on hover). */
function ConceptGrid({
  entries,
  onOpen,
  showTopic = false,
}: {
  entries: readonly ConceptEntry[];
  onOpen: (entry: ConceptEntry) => void;
  showTopic?: boolean;
}) {
  return (
    <ul role="list" className="grid grid-cols-2 gap-2">
      {entries.map((entry) => (
        <li key={entry.key}>
          <ConceptCard entry={entry} onOpen={() => onOpen(entry)} compact showTopic={showTopic} />
        </li>
      ))}
    </ul>
  );
}
