"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { deckInfo } from "@mogram/core/deck";
import { parseDiagram } from "@mogram/core/format";
import type { ProjectFiles } from "@mogram/core/model";
import { DiagramLoader } from "@mogram/core/nested";
import { CLOUD_LABELS, diagramCloud, type Cloud } from "@mogram/core/presets";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageHeader } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import {
  filterConcepts,
  loadEntry,
  platformChoices,
  shelfLabel,
  topicShelves,
  type PlatformFilter,
  type Shelf,
} from "@/features/concepts/browse";
import { builtinConcepts, type ConceptEntry } from "@/features/concepts/catalog";
import { TEMPLATES, type Template } from "@/features/templates";
import { AppShell, type DashboardUser } from "./app-shell";
import { Grid } from "./dashboard";
import { TemplateCard } from "./template-card";
import { useDashboard } from "./use-dashboard";

/** What the shell needs on any page: ways to start, and what's pinned. */
function useShell(user: DashboardUser | null) {
  const dashboard = useDashboard(user !== null);
  return { dashboard, signedIn: user !== null };
}

/** A template with what it's of: a diagram or a deck, and the cloud its icons are from. */
interface Described {
  readonly template: Template;
  readonly deck: boolean;
  readonly cloud: Cloud | null;
}

function describe(template: Template): Described {
  const loader = new DiagramLoader(template.files);
  const deck = deckInfo(template.files, loader) !== null;
  return {
    template,
    deck,
    cloud: deck ? null : diagramCloud(parseDiagram(template.files).diagram),
  };
}

/** Every template (AC-6): real architectures and decks to start from, by kind and cloud. */
export function TemplatesPage({ user }: { user: DashboardUser | null }) {
  const { dashboard } = useShell(user);
  const all = useMemo(
    () => TEMPLATES.filter((t) => t.id !== "blank" && t.id !== "blank-deck").map(describe),
    [],
  );
  const [kind, setKind] = useState<"all" | "diagram" | "deck">("all");
  const [cloud, setCloud] = useState<Cloud | "all">("all");
  const clouds = [...new Set(all.flatMap((each) => (each.cloud === null ? [] : [each.cloud])))];
  const shown = all.filter(
    (each) =>
      (kind === "all" || each.deck === (kind === "deck")) &&
      (cloud === "all" || each.cloud === cloud),
  );
  return (
    <AppShell user={user} active="templates" create={dashboard} items={dashboard.items}>
      <PageHeader
        title="Templates"
        description="Real architectures with scenes, cards and tours, ready to change into your own."
      />
      <div className="flex flex-wrap items-center gap-2">
        {all.some((each) => each.deck) ? (
          <SegmentedControl
            label="Kind"
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "diagram", label: "Diagrams" },
              { value: "deck", label: "Decks" },
            ]}
          />
        ) : null}
        {clouds.length > 1 ? (
          <SegmentedControl
            label="Cloud"
            size="sm"
            value={cloud}
            onChange={setCloud}
            options={[
              { value: "all", label: "Any cloud" },
              ...clouds.map((id) => ({ value: id, label: CLOUD_LABELS[id] })),
            ]}
          />
        ) : null}
      </div>
      {shown.length > 0 ? (
        <Grid>
          {shown.map(({ template }) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => dashboard.createFromTemplate(template.id)}
              disabled={dashboard.creating}
            />
          ))}
        </Grid>
      ) : (
        <p className="py-10 text-center text-body-sm text-fg-muted">
          No templates of that kind for that cloud yet.
        </p>
      )}
    </AppShell>
  );
}

/** Every concept (D-83): ideas explained by a diagram that plays, by topic and platform. */
export function ConceptsPage({ user }: { user: DashboardUser | null }) {
  const { dashboard } = useShell(user);
  const entries = useMemo(() => builtinConcepts(), []);
  const [query, setQuery] = useState("");
  const text = useDeferredValue(query);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const platforms = platformChoices(entries);
  const shelves = topicShelves(entries, platform);
  const shown = filterConcepts(entries, { text, platform, shelf, kind: "all" });

  const open = async (entry: ConceptEntry) => {
    try {
      dashboard.createNamed(entry.title, await loadEntry(entry));
    } catch {
      toast.error("That concept couldn't be opened. Check your connection and try again.");
    }
  };

  return (
    <AppShell user={user} active="concepts" create={dashboard} items={dashboard.items}>
      <PageHeader
        title="Concepts"
        description="Ideas explained by a diagram that plays: scaling, failover, caching, networking and more. Open one to read it, change it, or build on it."
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField
            placeholder="Search concepts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search concepts"
            className="flex-1"
          />
          {platforms.length > 0 ? (
            <SegmentedControl
              label="Platform"
              size="sm"
              value={platform}
              onChange={setPlatform}
              options={platforms}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic">
          <TopicChip label="All topics" active={shelf === null} onClick={() => setShelf(null)} />
          {shelves.map((each) => (
            <TopicChip
              key={each.shelf}
              label={`${each.label} ${each.count}`}
              active={shelf === each.shelf}
              onClick={() => setShelf(each.shelf)}
            />
          ))}
        </div>
      </div>
      {shown.length > 0 ? (
        <Grid>
          {shown.map((entry) => (
            <ConceptCard
              key={entry.key}
              entry={entry}
              disabled={dashboard.creating}
              onOpen={() => void open(entry)}
            />
          ))}
        </Grid>
      ) : (
        <p className="py-10 text-center text-body-sm text-fg-muted">
          No concept matches. Try another word, or all topics.
        </p>
      )}
    </AppShell>
  );
}

function TopicChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

/** A concept: its diagram once it's near the screen, what it explains, and a way in. */
function ConceptCard({
  entry,
  onOpen,
  disabled,
}: {
  entry: ConceptEntry;
  onOpen: () => void;
  disabled: boolean;
}) {
  const host = useRef<HTMLElement | null>(null);
  const [files, setFiles] = useState<ProjectFiles | null>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (node === null || files !== null) return;
    let alive = true;
    const load = () =>
      void loadEntry(entry).then(
        (loaded) => alive && setFiles(loaded),
        () => undefined,
      );
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        alive = false;
      };
    }
    const observer = new IntersectionObserver(
      (seen) => {
        if (seen.some((each) => each.isIntersecting)) load();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [entry, files]);
  return (
    <article
      ref={host}
      className="group flex flex-col overflow-hidden rounded-xl border border-border-muted bg-fill-faint transition-colors hover:border-border-strong"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={`Open the ${entry.title} concept`}
        className="relative aspect-[16/10] overflow-hidden text-left"
      >
        <Skeleton className="absolute inset-0 rounded-none" />
        {files !== null ? (
          <DiagramPreview files={files} className="absolute inset-0" padding={20} animate={hover} />
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-sans text-body font-medium text-fg">
            {entry.title}
          </h3>
          <Button
            variant="secondary"
            size="sm"
            className="hit-area -mt-0.5 h-7"
            onClick={onOpen}
            disabled={disabled}
          >
            Open
          </Button>
        </div>
        <p className="line-clamp-2 text-caption text-fg-muted">{entry.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {entry.topic !== null ? <Badge size="sm">{shelfLabel(entry.topic)}</Badge> : null}
          <Badge size="sm">{entry.kind === "pattern" ? "Pattern" : "Explainer"}</Badge>
        </div>
      </div>
    </article>
  );
}
