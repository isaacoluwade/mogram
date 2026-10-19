"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  BookOpen,
  FileUp,
  Home,
  Layers,
  Lightbulb,
  LogIn,
  LogOut,
  Menu as MenuIcon,
  Pin,
  Plus,
  ScrollText,
  Shapes,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Sidebar, SidebarItem, SidebarLabel } from "@/components/ui/sidebar";
import { PROJECT_ACCEPT } from "@/lib/api/contracts";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { usePreference } from "@/lib/preferences";
import { OpenError, readProject } from "@/features/files/open";
import type { DashboardItem } from "./use-dashboard";

export interface DashboardUser {
  readonly email: string;
  readonly name: string;
}

/** The places the app's home has: where work is, and where it starts from. */
export type AppPlace = "home" | "templates" | "concepts" | "script";

/** What every page of the shell can start: a new diagram, a new deck, or files from a computer. */
export interface ShellCreate {
  readonly creating: boolean;
  createFromTemplate(id: string): void;
  createFromFiles(files: Readonly<Record<string, string>>): void;
}

const PLACES: readonly {
  readonly id: AppPlace;
  readonly label: string;
  readonly href: Route;
  readonly icon: ReactNode;
}[] = [
  { id: "home", label: "Home", href: "/diagrams", icon: <Home /> },
  { id: "templates", label: "Templates", href: "/templates" as Route, icon: <Shapes /> },
  { id: "concepts", label: "Concepts", href: "/concepts" as Route, icon: <Lightbulb /> },
  { id: "script", label: "Script", href: "/prompter", icon: <ScrollText /> },
];

/** Reference pages: read now and then, so kept out of the way of the places work happens. */
const HELP: readonly { readonly label: string; readonly href: Route; readonly icon: ReactNode }[] =
  [
    { label: "File format", href: "/docs/format", icon: <BookOpen /> },
    { label: "Security", href: "/security", icon: <ShieldCheck /> },
  ];

/**
 * The app's shell (Eden's): a floating sidebar with the places work happens, what's pinned,
 * help and the account; a header on phones; and the page. Files dropped anywhere open as a
 * new diagram.
 */
export function AppShell({
  user,
  active,
  create,
  items = [],
  children,
}: {
  user: DashboardUser | null;
  active: AppPlace;
  create: ShellCreate;
  /** Everything there is: what's pinned is listed, and drafts that live only here counted. */
  items?: readonly DashboardItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const upload = useRef<HTMLInputElement | null>(null);
  const [dropping, setDropping] = useState(false);
  const signedIn = user !== null;
  const pins = usePreference("homePinned");
  const pinned = items.filter((item) => pins.includes(`${item.kind}:${item.id}`));
  // Signed out, every draft lives only in this browser: said beside the way to sign in.
  const drafts = signedIn ? 0 : items.filter((item) => item.kind === "draft").length;

  const openFiles = async (list: readonly File[]) => {
    if (list.length === 0) return;
    try {
      create.createFromFiles(await readProject([...list]));
    } catch (error) {
      toast.error(error instanceof OpenError ? error.message : "Those files couldn't be opened.");
    }
  };
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  // "N" opens New, from anywhere on the page that isn't a field.
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest('[role="menu"], [role="dialog"]') != null) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const newMenu = (trigger: ReactNode, align: "start" | "end" = "start", keyed = false) => (
    <Menu {...(keyed ? { open: newOpen, onOpenChange: setNewOpen } : {})}>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align={align} className="w-72">
        <MenuLabel>{signedIn ? "New, in your account" : "New, in this browser"}</MenuLabel>
        <MenuItem
          icon={<Plus />}
          description="An empty canvas"
          onSelect={() => create.createFromTemplate("blank")}
        >
          Blank diagram
        </MenuItem>
        <MenuItem
          icon={<Layers />}
          description="Slides for a talk or a course"
          onSelect={() => create.createFromTemplate("blank-deck")}
        >
          Blank deck
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<FileUp />}
          description=".mogram.yaml, a folder zip or files"
          onSelect={() => upload.current?.click()}
        >
          Open from computer…
        </MenuItem>
        <MenuItem
          icon={<Shapes />}
          description="Real architectures to start from"
          onSelect={() => router.push("/templates" as Route)}
        >
          Browse templates
        </MenuItem>
      </MenuContent>
    </Menu>
  );

  return (
    <div
      className="relative flex min-h-dvh bg-main md:h-dvh md:gap-2 md:p-2"
      onDragEnter={(event) => {
        if (hasFiles(event)) setDropping(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        // Leaving the window, not moving between its children.
        if (event.relatedTarget === null) setDropping(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDropping(false);
        void openFiles([...event.dataTransfer.files]);
      }}
    >
      <input
        ref={upload}
        type="file"
        multiple
        accept={PROJECT_ACCEPT}
        hidden
        data-testid="open-files"
        onChange={(event) => {
          const chosen = [...(event.target.files ?? [])];
          event.target.value = "";
          void openFiles(chosen);
        }}
      />

      <Sidebar className="w-[248px] shrink-0 p-2 max-md:hidden" aria-label="Mogram">
        <div className="flex h-10 items-center gap-2.5 px-1.5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Mogram home">
            <LogoMark size="sm" />
            <Wordmark />
          </Link>
        </div>
        <div className="mt-3 px-0.5">
          {newMenu(
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={create.creating}
              aria-keyshortcuts="N"
            >
              <Plus />
              New
            </Button>,
            "start",
            true,
          )}
        </div>
        <nav className="mt-3 flex flex-col gap-0.5" aria-label="Main">
          {PLACES.map((place) => (
            <SidebarItem key={place.id} asChild active={place.id === active}>
              <Link href={place.href}>
                <span className={cn("flex", place.id === active ? "text-fg" : "text-fg-faint")}>
                  {place.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{place.label}</span>
              </Link>
            </SidebarItem>
          ))}
        </nav>
        {pinned.length > 0 ? (
          <>
            <SidebarLabel>Pinned</SidebarLabel>
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto" aria-label="Pinned">
              {pinned.slice(0, 12).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <SidebarItem asChild>
                    <Link href={item.href as Route} className="text-fg-soft">
                      <Pin aria-hidden className="text-fg-ghost" />
                      <span className="min-w-0 flex-1 truncate text-body-sm">{item.name}</span>
                    </Link>
                  </SidebarItem>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <nav className="flex flex-col gap-0.5" aria-label="Help">
            {HELP.map((page) => (
              <SidebarItem key={page.href} asChild className="h-7 text-body-sm text-fg-muted">
                <Link href={page.href}>
                  <span className="flex text-fg-ghost">{page.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{page.label}</span>
                </Link>
              </SidebarItem>
            ))}
          </nav>
          <AccountBlock user={user} drafts={drafts} />
        </div>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-lg">
        <MobileHeader
          user={user}
          newButton={newMenu(
            <Button variant="primary" size="sm" disabled={create.creating}>
              <Plus />
              New
            </Button>,
            "end",
          )}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-6 sm:px-8 md:pt-10 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">{children}</div>
        </main>
      </div>

      {dropping ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-border-emphasis bg-overlay"
        >
          <p className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-body font-medium text-fg shadow-popover">
            <FileUp className="size-4" />
            Drop to open as a new diagram
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Opens the hidden file chooser the shell keeps: for a tile that says "Open files". */
export function chooseFiles(): void {
  document.querySelector<HTMLInputElement>('input[data-testid="open-files"]')?.click();
}

function AccountBlock({ user, drafts }: { user: DashboardUser | null; drafts: number }) {
  const router = useRouter();
  if (user === null) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border-muted bg-fill-faint p-2 pl-3">
        <p className="min-w-0 flex-1 text-caption leading-snug text-fg-muted">
          {drafts > 0
            ? `${drafts} ${drafts === 1 ? "draft lives" : "drafts live"} only in this browser.`
            : "Drafts stay in this browser."}
        </p>
        <Button variant="secondary" size="sm" asChild>
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
          {PLACES.map((place) => (
            <MenuItem key={place.id} icon={place.icon} onSelect={() => router.push(place.href)}>
              {place.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          {HELP.map((page) => (
            <MenuItem key={page.href} icon={page.icon} onSelect={() => router.push(page.href)}>
              {page.label}
            </MenuItem>
          ))}
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
