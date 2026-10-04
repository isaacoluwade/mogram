"use client";

import { useDeferredValue, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileUp,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Shapes,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageHeader, Sidebar, SidebarItem, SidebarLabel } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiagramSummary } from "@/lib/api/contracts";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/format";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { OpenError, readProject } from "@/features/files/open";
import { TEMPLATES, type Template } from "@/features/templates";
import { DiagramCard } from "./diagram-card";
import { useDashboard, type DashboardItem } from "./use-dashboard";

type Source = "all" | "cloud" | "draft";

export interface DashboardUser {
  readonly email: string;
  readonly name: string;
}

/** Your diagrams (AC-1 … AC-6), in Eden's app shell: floating sidebar, page header, card grid. */
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
  const [source, setSource] = useState<Source>("all");
  const upload = useRef<HTMLInputElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const templates = useRef<HTMLElement | null>(null);

  const visible = dashboard.items.filter(
    (item) =>
      (source === "all" || item.kind === source) &&
      (deferred.length === 0 || item.name.toLowerCase().includes(deferred)),
  );

  const openFiles = async (list: FileList | null) => {
    if (list === null || list.length === 0) return;
    try {
      dashboard.createFromFiles(await readProject([...list]));
    } catch (error) {
      toast.error(error instanceof OpenError ? error.message : "Those files couldn't be opened.");
    }
  };

  const newMenu = (trigger: ReactNode) => (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align="end" className="w-72">
        <MenuLabel>
          {signedIn ? "New diagram in your account" : "New diagram in this browser"}
        </MenuLabel>
        {TEMPLATES.map((template) => (
          <MenuItem
            key={template.id}
            icon={template.id === "blank" ? <Plus /> : <Shapes />}
            description={template.description}
            onSelect={() => dashboard.createFromTemplate(template.id)}
          >
            {template.id === "blank" ? "Blank diagram" : template.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          icon={<FileUp />}
          description=".mogram.yaml, a folder zip or files"
          onSelect={() => upload.current?.click()}
        >
          Open from computer…
        </MenuItem>
      </MenuContent>
    </Menu>
  );

  return (
    <div className="flex min-h-dvh bg-main md:h-dvh md:gap-2 md:p-2">
      <input
        ref={upload}
        type="file"
        multiple
        accept=".yaml,.yml,.mogram,.zip,.md,.svg,.png,.jpg,.jpeg,.gif,.webp"
        hidden
        onChange={(event) => void openFiles(event.target.files)}
      />

      <Sidebar className="w-[260px] shrink-0 p-2 max-md:hidden" aria-label="Mogram">
        <div className="flex h-10 items-center gap-2.5 px-1.5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Mogram home">
            <LogoMark size="sm" />
            <Wordmark />
          </Link>
        </div>
        <nav className="mt-3 flex flex-col gap-0.5" aria-label="Main">
          {newMenu(<SidebarItem icon={<Plus />}>New diagram</SidebarItem>)}
          <SidebarItem icon={<LayoutGrid />} active onClick={() => search.current?.focus()}>
            Diagrams
          </SidebarItem>
          <SidebarItem
            icon={<Shapes />}
            onClick={() =>
              templates.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Templates
          </SidebarItem>
          <SidebarItem asChild>
            <Link href="/docs/format">
              <BookOpen className="text-fg-faint" />
              <span className="min-w-0 flex-1 truncate">File format</span>
            </Link>
          </SidebarItem>
          <SidebarItem asChild>
            <Link href="/security">
              <ShieldCheck className="text-fg-faint" />
              <span className="min-w-0 flex-1 truncate">Security</span>
            </Link>
          </SidebarItem>
        </nav>
        {dashboard.items.length > 0 ? (
          <>
            <SidebarLabel>Recent</SidebarLabel>
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {dashboard.items.slice(0, 8).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <SidebarItem asChild>
                    <Link
                      href={item.href as Parameters<typeof Link>[0]["href"]}
                      className="text-fg-soft"
                    >
                      <span
                        aria-hidden
                        className="mx-1 size-1.5 shrink-0 rounded-full bg-fg-ghost"
                      />
                      <span className="min-w-0 flex-1 truncate text-body-sm">{item.name}</span>
                      <span className="shrink-0 text-micro tabular-nums text-fg-ghost">
                        {relativeTime(item.updatedAt).replace(" ago", "")}
                      </span>
                    </Link>
                  </SidebarItem>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="mt-auto pt-3">
          <AccountBlock user={user} />
        </div>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-lg">
        <MobileHeader
          user={user}
          newButton={newMenu(
            // Eden's header "New" is the soft pill: the white one is kept for the page's main action.
            <Button variant="secondary" size="sm">
              <Plus />
              New
            </Button>,
          )}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-6 sm:px-8 md:pt-10 lg:px-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <PageHeader
              title="Diagrams"
              description={
                signedIn
                  ? "Everything in your account and in this browser."
                  : "Drafts in this browser. Sign in to keep diagrams in your account and share them."
              }
              actions={newMenu(
                <Button
                  variant="secondary"
                  size="sm"
                  className="max-md:hidden"
                  disabled={dashboard.creating}
                >
                  <Plus />
                  New
                </Button>,
              )}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchField
                ref={search}
                placeholder="Search diagrams"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search diagrams"
                className="flex-1"
              />
              {signedIn ? (
                <SegmentedControl
                  label="Where"
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: "all", label: "All" },
                    { value: "cloud", label: "Account" },
                    { value: "draft", label: "This browser" },
                  ]}
                />
              ) : null}
            </div>

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
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[16/12] rounded-xl" />
                ))}
              </Grid>
            ) : visible.length > 0 ? (
              <Grid>
                {visible.map((item) => (
                  <DiagramCard
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    actions={{ signedIn, ...dashboard }}
                  />
                ))}
              </Grid>
            ) : dashboard.items.length > 0 ? (
              <p className="py-10 text-center text-body-sm text-fg-muted">
                No diagrams match “{query}”.
              </p>
            ) : (
              <EmptyState
                icon={<LayoutGrid />}
                title="Make your first diagram"
                description="Start from a template below, open a .mogram.yaml from your computer, or begin with a blank canvas."
                action={newMenu(
                  <Button variant="primary" disabled={dashboard.creating}>
                    <Plus />
                    New diagram
                  </Button>,
                )}
                className="rounded-xl border border-dashed border-border-strong"
              />
            )}

            <section
              ref={templates}
              aria-labelledby="templates-heading"
              className="scroll-mt-6 pt-6"
            >
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2
                    id="templates-heading"
                    className="font-display text-heading font-medium tracking-snug text-fg"
                  >
                    Start from a template
                  </h2>
                  <p className="mt-1 text-body-sm text-fg-faint">
                    Real architectures with scenes, cards and tours you can change.
                  </p>
                </div>
              </div>
              <Grid>
                {TEMPLATES.filter((t) => t.id !== "blank").map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={() => dashboard.createFromTemplate(template.id)}
                    disabled={dashboard.creating}
                  />
                ))}
              </Grid>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

/** Template card: a live preview that animates on hover, name, what it shows, and "Use". */
function TemplateCard({
  template,
  onUse,
  disabled,
}: {
  template: Template;
  onUse: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border border-border-muted bg-fill-faint transition-colors hover:border-border-strong"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onUse}
        disabled={disabled}
        className="relative aspect-[16/10] overflow-hidden text-left"
        aria-label={`Use the ${template.name} template`}
      >
        <DiagramPreview
          files={template.files}
          className="absolute inset-0"
          padding={20}
          animate={hover}
        />
      </button>
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-sans text-body font-medium text-fg">
            {template.name}
          </h3>
          <Button
            variant="secondary"
            size="sm"
            className="hit-area -mt-0.5 h-7"
            onClick={onUse}
            disabled={disabled}
          >
            Use
          </Button>
        </div>
        <p className="line-clamp-2 text-caption text-fg-muted">{template.description}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {template.features.map((feature) => (
            <Badge key={feature} size="sm">
              {feature}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

function AccountBlock({ user }: { user: DashboardUser | null }) {
  const router = useRouter();
  if (user === null) {
    return (
      <div className="rounded-md border border-border-muted bg-fill-faint p-3">
        <p className="text-label font-medium text-fg">Keep diagrams in the cloud</p>
        <p className="mt-1 text-caption text-fg-muted">
          Sign in to save to your account and share links. Drafts here stay in this browser.
        </p>
        <Button variant="secondary" size="sm" className="mt-3 w-full" asChild>
          <Link href="/sign-in?next=%2Fdiagrams">
            <LogIn />
            Sign in
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-fill-hover"
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill-active text-caption font-medium uppercase text-fg"
          >
            {(user.name || user.email).charAt(0)}
          </span>
          <span className="min-w-0 flex-1 truncate text-body-sm text-fg-soft">{user.email}</span>
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-56">
        <MenuLabel className="truncate">{user.email}</MenuLabel>
        <MenuItem
          icon={<LogOut />}
          onSelect={() => {
            authClient.signOut().then(
              () => router.refresh(),
              () => toast.error("Couldn't sign out. Check your connection and try again."),
            );
          }}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function MobileHeader({ user, newButton }: { user: DashboardUser | null; newButton: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border-muted bg-main/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label="Mogram home">
        <LogoMark size="sm" />
        <Wordmark />
      </Link>
      <span className="flex-1" />
      {newButton}
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-full text-fg-soft hover:bg-fill-hover hover:text-fg"
          >
            <MenuIcon className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-60">
          <MenuItem icon={<BookOpen />} onSelect={() => router.push("/docs/format")}>
            File format
          </MenuItem>
          <MenuItem icon={<ShieldCheck />} onSelect={() => router.push("/security")}>
            Security
          </MenuItem>
          <MenuSeparator />
          {user === null ? (
            <MenuItem icon={<LogIn />} onSelect={() => router.push("/sign-in?next=%2Fdiagrams")}>
              Sign in
            </MenuItem>
          ) : (
            <MenuItem
              icon={<LogOut />}
              description={user.email}
              onSelect={() => void authClient.signOut().then(() => router.refresh())}
            >
              Sign out
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
    </header>
  );
}

export type { DashboardItem };
