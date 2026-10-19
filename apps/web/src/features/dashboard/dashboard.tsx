"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowDownAZ,
  ArrowRight,
  Clock,
  CloudUpload,
  FileUp,
  LayoutGrid,
  Layers,
  List,
  Plus,
  Shapes,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AssistantConfig } from "@/lib/ai/protocol";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageHeader } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiagramSummary } from "@/lib/api/contracts";
import { cn } from "@/lib/cn";
import { preference, setPreference, usePreference } from "@/lib/preferences";
import { TEMPLATES } from "@/features/templates";
import { AppShell, chooseFiles, type DashboardUser } from "./app-shell";
import {
  ContinueCard,
  DeleteDialog,
  DiagramCard,
  DiagramRow,
  type CardActions,
} from "./diagram-card";
import { TemplateCard } from "./template-card";
import { useDashboard, type DashboardItem } from "./use-dashboard";

export type { DashboardUser };

type Kind = "all" | "diagram" | "deck";
type Source = "all" | "cloud" | "draft";

const keyOf = (item: DashboardItem): string => `${item.kind}:${item.id}`;

/** Templates the home page shows a taste of; the rest are on their own page. */
const FEATURED = ["web-app", "failover", "aks", "aws-serverless"];

/**
 * Home (AC-1 … AC-6): ways to start, the thing worked on last, and everything there is, in
 * Eden's app shell. What's pinned comes first, here and in the sidebar.
 */
export function Dashboard({
  user,
  initialCloud,
}: {
  user: DashboardUser | null;
  initialCloud: readonly DiagramSummary[];
}) {
  const signedIn = user !== null;
  const dashboard = useDashboard(signedIn, initialCloud);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const [kind, setKind] = useState<Kind>("all");
  const [source, setSource] = useState<Source>("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const view = usePreference("homeView");
  const sort = usePreference("homeSort");
  const pins = usePreference("homePinned");
  const search = useRef<HTMLInputElement | null>(null);

  const { items } = dashboard;
  const pinned = useMemo(() => new Set(pins), [pins]);
  const hasDecks = items.some((item) => item.about.kind === "deck");
  const hasDiagrams = items.some((item) => item.about.kind === "diagram");

  const visible = useMemo(() => {
    const matching = items.filter(
      (item) =>
        (kind === "all" || item.about.kind === kind) &&
        (source === "all" || item.kind === source) &&
        (deferred === "" || item.name.toLowerCase().includes(deferred)),
    );
    const byOrder = (a: DashboardItem, b: DashboardItem) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt);
    // What's pinned comes first, whatever the order of the rest.
    return matching.sort(
      (a, b) => Number(pinned.has(keyOf(b))) - Number(pinned.has(keyOf(a))) || byOrder(a, b),
    );
  }, [items, kind, source, deferred, sort, pinned]);

  // Only what's still there stays chosen.
  const chosen = items.filter((item) => selected.has(keyOf(item)));
  const chosenDrafts = chosen.filter((item) => item.kind === "draft");

  // "/" goes to the search; Escape lets go of what's selected.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        search.current?.focus();
      } else if (event.key === "Escape" && !typing) setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions: CardActions = {
    signedIn,
    rename: dashboard.rename,
    duplicate: dashboard.duplicate,
    remove: dashboard.remove,
    download: dashboard.download,
    moveToAccount: dashboard.moveToAccount,
    backfillThumbnail: dashboard.backfillThumbnail,
    files: dashboard.files,
    isPinned: (item) => pinned.has(keyOf(item)),
    togglePin: (item) => {
      const key = keyOf(item);
      const now = preference("homePinned");
      setPreference("homePinned", now.includes(key) ? now.filter((k) => k !== key) : [key, ...now]);
    },
    isSelected: (item) => selected.has(keyOf(item)),
    toggleSelect: (item) =>
      setSelected((was) => {
        const next = new Set(was);
        const key = keyOf(item);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    selecting: chosen.length > 0,
  };

  const latest = items[0];
  const featured = FEATURED.flatMap((id) => TEMPLATES.filter((template) => template.id === id));

  return (
    <AppShell user={user} active="home" create={dashboard} items={items}>
      <PageHeader
        title="Home"
        description={
          signedIn
            ? "Start something, or carry on with what's in your account and this browser."
            : "Start something, or carry on with the drafts in this browser."
        }
      />

      <section aria-label="Start" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StartTile
          icon={<Plus />}
          title="Blank diagram"
          detail="An empty canvas"
          disabled={dashboard.creating}
          onClick={() => dashboard.createFromTemplate("blank")}
        />
        <StartTile
          icon={<Layers />}
          title="Blank deck"
          detail="Slides for a talk or a course"
          disabled={dashboard.creating}
          onClick={() => dashboard.createFromTemplate("blank-deck")}
        />
        <StartTile
          icon={<FileUp />}
          title="Open files"
          detail="A .mogram.yaml, a folder or a zip"
          disabled={dashboard.creating}
          onClick={chooseFiles}
        />
        <StartTile
          icon={<Shapes />}
          title="Templates"
          detail="Real architectures to start from"
          href={"/templates" as Route}
        />
      </section>

      <Describe
        disabled={dashboard.creating}
        onBuild={(text) => dashboard.createFromDescription(text)}
      />

      {/* With only a couple of things, the list below is already "where you left off". */}
      {!dashboard.loading && latest !== undefined && items.length >= 3 ? (
        <section aria-labelledby="continue-heading" className="flex flex-col gap-3">
          <SectionHeading id="continue-heading" title="Continue" />
          <ContinueCard item={latest} actions={actions} />
        </section>
      ) : null}

      <section aria-labelledby="everything-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="everything-heading"
          title="Everything"
          aside={
            dashboard.loading || items.length === 0
              ? undefined
              : visible.length === items.length
                ? String(items.length)
                : `${visible.length} of ${items.length}`
          }
        />
        {items.length > 0 ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchField
              ref={search}
              placeholder="Search by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search diagrams"
              aria-keyshortcuts="/"
              className="flex-1"
            />
            <div className="flex flex-wrap items-center gap-2">
              {hasDecks && hasDiagrams ? (
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
              {signedIn ? (
                <SegmentedControl
                  label="Where"
                  size="sm"
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: "all", label: "Anywhere" },
                    { value: "cloud", label: "Account" },
                    { value: "draft", label: "This browser" },
                  ]}
                />
              ) : null}
              <Panel shape="pill" className="flex items-center gap-0.5 p-0.5">
                <IconButton
                  label={sort === "recent" ? "Sorted by last edited" : "Sort by last edited"}
                  size="sm"
                  shape="round"
                  active={sort === "recent"}
                  onClick={() => setPreference("homeSort", "recent")}
                >
                  <Clock />
                </IconButton>
                <IconButton
                  label={sort === "name" ? "Sorted by name" : "Sort by name"}
                  size="sm"
                  shape="round"
                  active={sort === "name"}
                  onClick={() => setPreference("homeSort", "name")}
                >
                  <ArrowDownAZ />
                </IconButton>
              </Panel>
              <Panel shape="pill" className="flex items-center gap-0.5 p-0.5">
                <IconButton
                  label="Show as cards"
                  size="sm"
                  shape="round"
                  active={view === "grid"}
                  onClick={() => setPreference("homeView", "grid")}
                >
                  <LayoutGrid />
                </IconButton>
                <IconButton
                  label="Show as a list"
                  size="sm"
                  shape="round"
                  active={view === "list"}
                  onClick={() => setPreference("homeView", "list")}
                >
                  <List />
                </IconButton>
              </Panel>
            </div>
          </div>
        ) : null}

        {dashboard.cloudError !== null ? (
          <p
            role="alert"
            className="rounded-md border border-rose-line bg-rose-fill px-3 py-2 text-label text-rose"
          >
            Your account&apos;s diagrams couldn&apos;t load. {dashboard.cloudError.message}
          </p>
        ) : null}

        {dashboard.loading ? (
          <Grid>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[16/12] rounded-xl" />
            ))}
          </Grid>
        ) : visible.length > 0 ? (
          view === "grid" ? (
            <Grid>
              {visible.map((item) => (
                <DiagramCard key={keyOf(item)} item={item} actions={actions} />
              ))}
            </Grid>
          ) : (
            <div className="flex flex-col gap-0.5" role="list" aria-label="Everything">
              {visible.map((item) => (
                <DiagramRow key={keyOf(item)} item={item} actions={actions} />
              ))}
            </div>
          )
        ) : items.length > 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-center text-body-sm text-fg-muted">
              {deferred === "" ? "Nothing here matches." : `Nothing is called “${query.trim()}”.`}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setKind("all");
                setSource("all");
              }}
            >
              Show everything
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={<LayoutGrid />}
            title="Nothing here yet"
            description="Start with a blank diagram or a deck above, pick a template, or drop a .mogram.yaml file anywhere on this page."
            action={
              <Button
                variant="primary"
                disabled={dashboard.creating}
                onClick={() => dashboard.createFromTemplate("blank")}
              >
                <Plus />
                New diagram
              </Button>
            }
            className="rounded-xl border border-dashed border-border-strong"
          />
        )}
      </section>

      <section aria-labelledby="templates-heading" className="flex flex-col gap-4">
        <SectionHeading
          id="templates-heading"
          title="Start from a template"
          aside={
            <Link
              href={"/templates" as Route}
              className="inline-flex items-center gap-1 text-label text-fg-soft transition-colors hover:text-fg"
            >
              All templates
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <Grid>
          {featured.map((template, index) => (
            // The fourth shows where it fills a row (two across, or four), not as an orphan.
            <div key={template.id} className={cn("flex", index === 3 && "xl:max-2xl:hidden")}>
              <TemplateCard
                template={template}
                onUse={() => dashboard.createFromTemplate(template.id)}
                disabled={dashboard.creating}
              />
            </div>
          ))}
        </Grid>
      </section>

      {chosen.length > 0 ? (
        <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
          <Panel
            shape="pill"
            role="toolbar"
            aria-label="Selected"
            className="pointer-events-auto flex items-center gap-1 py-1 pl-4 pr-1 shadow-popover"
          >
            <span className="pr-2 text-label tabular-nums text-fg" data-testid="selected-count">
              {chosen.length} selected
            </span>
            {signedIn && chosenDrafts.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dashboard.moveManyToAccount(chosenDrafts);
                  setSelected(new Set());
                }}
              >
                <CloudUpload />
                Save to account
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 />
              Delete
            </Button>
            <IconButton
              label="Clear the selection"
              shortcut="Esc"
              size="sm"
              shape="round"
              onClick={() => setSelected(new Set())}
            >
              <X />
            </IconButton>
          </Panel>
        </div>
      ) : null}
      <DeleteDialog
        open={deleting}
        items={chosen}
        onClose={() => setDeleting(false)}
        onDelete={() => {
          dashboard.removeMany(chosen);
          setSelected(new Set());
        }}
      />
    </AppShell>
  );
}

function SectionHeading({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 id={id} className="font-display text-heading font-medium tracking-snug text-fg">
        {title}
      </h2>
      {typeof aside === "string" ? (
        <span className="text-label tabular-nums text-fg-muted">{aside}</span>
      ) : aside !== undefined ? (
        <span className="ml-auto">{aside}</span>
      ) : null}
    </div>
  );
}

/** One way to start: a big, plain target with what it makes said under it. */
function StartTile({
  icon,
  title,
  detail,
  onClick,
  href,
  disabled = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick?: () => void;
  href?: Route;
  disabled?: boolean;
}) {
  const className = cn(
    "group flex items-center gap-3 rounded-xl border border-border-muted bg-fill-faint p-3.5 text-left transition-colors max-sm:gap-2.5 max-sm:p-2.5",
    "hover:border-border-strong hover:bg-fill-hover disabled:pointer-events-none disabled:opacity-50",
  );
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-fill-subtle text-fg-soft transition-colors group-hover:text-fg max-sm:size-8 [&_svg]:size-5 max-sm:[&_svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-fg max-sm:text-body-sm">{title}</span>
        <span className="truncate text-caption text-fg-muted max-sm:hidden">{detail}</span>
      </span>
    </>
  );
  return href !== undefined ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}

/**
 * "Describe what you want to build" (A5): a new diagram that the assistant draws from the
 * description. Shown only when the assistant is on for this person.
 */
function Describe({ onBuild, disabled }: { onBuild: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const config = useQuery({
    queryKey: ["assistant-config"],
    queryFn: async (): Promise<AssistantConfig> => {
      const response = await fetch("/api/ai/config", { credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      return ((await response.json()) as { assistant: AssistantConfig }).assistant;
    },
    staleTime: 60_000,
  });
  if (config.data?.enabled !== true) return null;
  const build = () => {
    if (text.trim() !== "") onBuild(text);
  };
  return (
    <form
      aria-label="Describe a new diagram"
      onSubmit={(event) => {
        event.preventDefault();
        build();
      }}
      className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3 focus-within:border-border-strong"
    >
      <label
        htmlFor="describe"
        className="flex items-center gap-2 px-1 text-label font-medium text-fg"
      >
        <Sparkles aria-hidden className="size-4 text-violet" />
        Or describe what you want to build
      </label>
      <textarea
        id="describe"
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            build();
          }
        }}
        placeholder="e.g. An online shop on Azure: Front Door, a web app and an API in a virtual network, Azure SQL, and a Redis cache"
        className="w-full resize-none bg-transparent px-1 text-body-sm text-fg outline-none placeholder:text-fg-ghost"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="px-1 text-caption text-fg-faint">
          {config.data.name} drafts it on the canvas; you can keep changing it together.
        </p>
        <Button type="submit" variant="primary" size="sm" disabled={disabled || text.trim() === ""}>
          <Sparkles />
          Build it
        </Button>
      </div>
    </form>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {children}
    </div>
  );
}

export type { DashboardItem };
