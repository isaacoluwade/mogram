"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import type { ProjectAbout } from "@mogram/core/deck";
import type { ProjectFiles } from "@mogram/core/model";
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  Eye,
  Globe,
  HardDrive,
  Layers,
  MonitorPlay,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { IconLink } from "@/components/ui/icon-button";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { LogoGlyph } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { editedLabel } from "@/lib/format";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import type { DashboardItem } from "./use-dashboard";

export interface CardActions {
  readonly signedIn: boolean;
  rename(item: DashboardItem, name: string): void;
  duplicate(item: DashboardItem): void;
  remove(item: DashboardItem): void;
  download(item: DashboardItem): Promise<void>;
  moveToAccount(item: DashboardItem): void;
  backfillThumbnail(item: DashboardItem): Promise<void>;
  /** The item's files, for a live preview while it's pointed at. */
  files(item: DashboardItem): Promise<ProjectFiles | null>;
  isPinned(item: DashboardItem): boolean;
  togglePin(item: DashboardItem): void;
  isSelected(item: DashboardItem): boolean;
  toggleSelect(item: DashboardItem): void;
  /** Whether anything is selected: every card then shows its box. */
  readonly selecting: boolean;
}

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

/**
 * What an item is and how far along, in a few words each: a deck's slides and how much of its
 * script is recorded; a diagram's scenes and its story.
 */
export function aboutParts(about: ProjectAbout): string[] {
  const recorded =
    about.scripted === 0
      ? null
      : about.recorded === about.scripted
        ? "All recorded"
        : `${about.recorded} of ${about.scripted} recorded`;
  const parts =
    about.kind === "deck"
      ? [plural(about.slides, "slide"), recorded]
      : [
          about.scenes > 0 ? plural(about.scenes, "scene") : null,
          about.beats > 0 ? `${about.beats}-beat story` : null,
          recorded,
        ];
  return parts.filter((part): part is string => part !== null);
}

/** Where an item lives, said only when it tells you something. */
function Where({ item, signedIn }: { item: DashboardItem; signedIn: boolean }) {
  // Signed out, everything is in this browser: saying so on every card is noise.
  if (item.kind === "draft" && !signedIn) return null;
  if (item.kind === "cloud" && item.visibility !== "link") return null;
  const [icon, label] =
    item.kind === "draft" ? [<HardDrive key="i" />, "This browser"] : [<Globe key="i" />, "Shared"];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-micro font-medium text-white backdrop-blur-sm [&_svg]:size-3">
      {icon}
      {label}
    </span>
  );
}

function AboutLine({ item }: { item: DashboardItem }) {
  return (
    <div className="flex min-w-0 items-center gap-x-1.5 text-caption tabular-nums text-fg-muted">
      {aboutParts(item.about).map((part) => (
        <span
          key={part}
          className="flex shrink-0 items-center gap-1.5 after:text-fg-ghost after:content-['·']"
        >
          <span>{part}</span>
        </span>
      ))}
      <span className="truncate">{editedLabel(item.updatedAt)}</span>
    </div>
  );
}

/** The stored picture; while pointed at, a diagram's live one (its traffic moving) over it. */
function Thumbnail({
  item,
  actions,
  hover,
  className,
}: {
  item: DashboardItem;
  actions: CardActions;
  hover: boolean;
  className?: string;
}) {
  // A moment's pause first: passing over a card on the way somewhere else loads nothing.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!hover || item.about.kind === "deck") return;
    const timer = window.setTimeout(() => setLive(true), 350);
    return () => {
      window.clearTimeout(timer);
      setLive(false);
    };
  }, [hover, item.about.kind]);
  const files = useQuery({
    queryKey: ["preview-files", item.kind, item.id, item.updatedAt],
    queryFn: () => actions.files(item),
    enabled: live,
    staleTime: Infinity,
  });
  return (
    <div className={cn("relative overflow-hidden bg-surface", className)}>
      {item.thumbnail !== null ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL rendered in the browser; nothing for next/image to optimise
        <img src={item.thumbnail} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-fg-ghost">
          <LogoGlyph className="size-8" />
        </span>
      )}
      {live && files.data != null ? (
        <DiagramPreview
          files={files.data}
          className="absolute inset-0 animate-fade-in bg-surface"
          padding={20}
          animate
        />
      ) : null}
    </div>
  );
}

function SelectBox({ item, actions }: { item: DashboardItem; actions: CardActions }) {
  const selected = actions.isSelected(item);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${item.name}`}
      onClick={() => actions.toggleSelect(item)}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm border transition-opacity [&_svg]:size-3.5",
        selected
          ? "border-transparent bg-fg text-main"
          : "border-white/50 bg-black/60 text-transparent backdrop-blur-sm",
        !selected &&
          !actions.selecting &&
          "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100",
      )}
    >
      <Check aria-hidden />
    </button>
  );
}

/** Everything that can be done with an item, behind its "…". */
function ItemMenu({
  item,
  actions,
  trigger,
  onRename,
  onDelete,
}: {
  item: DashboardItem;
  actions: CardActions;
  trigger: ReactNode;
  onRename: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const pinned = actions.isPinned(item);
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align="end" className="w-56">
        <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={() => actions.togglePin(item)}>
          {pinned ? "Unpin" : "Pin to the top"}
        </MenuItem>
        <MenuItem icon={<Eye />} onSelect={() => router.push(item.previewHref as Route)}>
          Preview
        </MenuItem>
        <MenuItem
          icon={<MonitorPlay />}
          onSelect={() => router.push(`${item.previewHref}?present=1` as Route)}
        >
          Present
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Pencil />} onSelect={onRename}>
          Rename
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={() => actions.duplicate(item)}>
          Duplicate
        </MenuItem>
        <MenuItem icon={<Download />} onSelect={() => void actions.download(item)}>
          Download files
        </MenuItem>
        {item.kind === "draft" && actions.signedIn ? (
          <MenuItem
            icon={<CloudUpload />}
            description="Keep it in your account"
            onSelect={() => actions.moveToAccount(item)}
          >
            Save to account
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Preview and Present, one click from the card. */
function QuickActions({ item }: { item: DashboardItem }) {
  return (
    <>
      <IconLink href={item.previewHref as Route} label={`Preview ${item.name}`} size="sm">
        <Eye />
      </IconLink>
      <IconLink
        href={`${item.previewHref}?present=1` as Route}
        label={`Present ${item.name}`}
        size="sm"
      >
        <MonitorPlay />
      </IconLink>
    </>
  );
}

function useItemDialogs(item: DashboardItem, actions: CardActions) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { backfillThumbnail } = actions;
  useEffect(() => {
    if (item.thumbnail === null) void backfillThumbnail(item);
  }, [item, backfillThumbnail]);
  return {
    rename: () => setRenaming(true),
    remove: () => setDeleting(true),
    dialogs: (
      <>
        <RenameDialog
          open={renaming}
          name={item.name}
          onClose={() => setRenaming(false)}
          onRename={(name) => actions.rename(item, name)}
        />
        <DeleteDialog
          open={deleting}
          items={[item]}
          onClose={() => setDeleting(false)}
          onDelete={() => actions.remove(item)}
        />
      </>
    ),
  };
}

/**
 * A diagram or a deck on the home page: its picture (live while pointed at), what it is and how
 * far along, and Preview and Present beside its name. A deck looks like a stack.
 */
export function DiagramCard({ item, actions }: { item: DashboardItem; actions: CardActions }) {
  const [hover, setHover] = useState(false);
  const { rename, remove, dialogs } = useItemDialogs(item, actions);
  const deck = item.about.kind === "deck";
  const selected = actions.isSelected(item);
  return (
    <article
      data-kind={item.about.kind}
      // Room above for a deck's stack; every card has it, so their pictures line up.
      className="group relative flex flex-col pt-2"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {deck ? (
        // The slides behind the first: a deck reads as a stack at a glance.
        <>
          <span
            aria-hidden
            className="absolute inset-x-5 top-0 h-2 rounded-t-lg border border-b-0 border-border-muted bg-fill-faint"
          />
          <span
            aria-hidden
            className="absolute inset-x-2.5 top-1 h-2 rounded-t-lg border border-b-0 border-border-muted bg-fill-subtle"
          />
        </>
      ) : null}
      <div
        className={cn(
          "relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-fill-faint transition-colors",
          selected
            ? "border-border-emphasis"
            : "border-border-muted group-hover:border-border-strong",
        )}
      >
        <Link
          href={item.href as Route}
          className="flex flex-col outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
          aria-label={`Open ${item.name}`}
        >
          <Thumbnail item={item} actions={actions} hover={hover} className="aspect-[16/10]" />
        </Link>
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <SelectBox item={item} actions={actions} />
          {deck ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-micro font-medium text-white backdrop-blur-sm [&_svg]:size-3">
              <Layers aria-hidden />
              Deck
            </span>
          ) : null}
          <Where item={item} signedIn={actions.signedIn} />
        </div>
        {actions.isPinned(item) ? (
          <span
            className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm"
            aria-label="Pinned"
            role="img"
          >
            <Pin className="size-3" />
          </span>
        ) : null}
        <div className="flex items-center gap-1 py-2.5 pl-3.5 pr-2">
          <Link
            href={item.href as Route}
            tabIndex={-1}
            className="flex min-w-0 flex-1 flex-col gap-0.5"
          >
            <h3 className="truncate font-sans text-body font-medium text-fg">{item.name}</h3>
            <AboutLine item={item} />
          </Link>
          <QuickActions item={item} />
          <ItemMenu
            item={item}
            actions={actions}
            onRename={rename}
            onDelete={remove}
            trigger={
              <button
                type="button"
                aria-label={`${item.name} options`}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg data-[state=open]:bg-fill-hover"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
        </div>
      </div>
      {dialogs}
    </article>
  );
}

/** The item worked on last, large: one click back into it, or straight to showing it. */
export function ContinueCard({ item, actions }: { item: DashboardItem; actions: CardActions }) {
  const [hover, setHover] = useState(false);
  return (
    <article
      data-testid="continue"
      className="group flex flex-col overflow-hidden rounded-xl border border-border-muted bg-fill-faint transition-colors hover:border-border-strong sm:flex-row"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <Link
        href={item.href as Route}
        aria-label={`Open ${item.name}`}
        className="block shrink-0 sm:w-72 lg:w-80"
      >
        <Thumbnail
          item={item}
          actions={actions}
          hover={hover}
          className="aspect-[16/10] h-full max-sm:aspect-[16/8]"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5 lg:px-7">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption font-medium text-fg-muted">
            {item.about.kind === "deck" ? "Deck" : "Diagram"} · pick up where you left off
          </p>
          <h3 className="truncate font-display text-heading font-medium tracking-snug text-fg">
            {item.name}
          </h3>
          <AboutLine item={item} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link href={item.href as Route}>
              <Pencil />
              Open
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={item.previewHref as Route}>
              <Eye />
              Preview
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${item.previewHref}?present=1` as Route}>
              <MonitorPlay />
              Present
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/** The same item as a row of the list: more of them on screen, the same things to do. */
export function DiagramRow({ item, actions }: { item: DashboardItem; actions: CardActions }) {
  const [hover, setHover] = useState(false);
  const { rename, remove, dialogs } = useItemDialogs(item, actions);
  const selected = actions.isSelected(item);
  return (
    <article
      data-kind={item.about.kind}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-2 py-1.5 transition-colors",
        selected
          ? "border-border-emphasis bg-fill-faint"
          : "border-transparent hover:bg-fill-faint",
      )}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <SelectBox item={item} actions={actions} />
      <Link
        href={item.href as Route}
        aria-label={`Open ${item.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none"
      >
        <Thumbnail
          item={item}
          actions={actions}
          hover={hover}
          className="aspect-[16/10] w-20 shrink-0 rounded-md ring-1 ring-border-muted"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-sans text-body font-medium text-fg">{item.name}</h3>
            {actions.isPinned(item) ? (
              <Pin aria-label="Pinned" role="img" className="size-3 shrink-0 text-fg-muted" />
            ) : null}
          </span>
          <AboutLine item={item} />
        </span>
      </Link>
      <span className="w-24 shrink-0 text-caption text-fg-muted max-lg:hidden">
        {item.about.kind === "deck" ? "Deck" : "Diagram"}
      </span>
      {/* Signed out, everything is in this browser: a column saying so says nothing. */}
      {actions.signedIn ? (
        <span className="w-28 shrink-0 text-caption text-fg-muted max-md:hidden">
          {item.kind === "draft"
            ? "This browser"
            : item.visibility === "link"
              ? "Shared"
              : "Account"}
        </span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1">
        <span className="flex items-center gap-1 max-sm:hidden">
          <QuickActions item={item} />
        </span>
        <ItemMenu
          item={item}
          actions={actions}
          onRename={rename}
          onDelete={remove}
          trigger={
            <button
              type="button"
              aria-label={`${item.name} options`}
              className="flex size-7 items-center justify-center rounded-md text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg data-[state=open]:bg-fill-hover"
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
        />
      </span>
      {dialogs}
    </article>
  );
}

function RenameDialog({
  open,
  name,
  onClose,
  onRename,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent size="sm" title="Rename diagram">
          <RenameForm name={name} onClose={onClose} onRename={onRename} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function RenameForm({
  name,
  onClose,
  onRename,
}: {
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  const id = useId();
  const trimmed = value.trim();
  const invalid = trimmed.length === 0 || trimmed.length > 120;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        if (trimmed !== name) onRename(trimmed);
        onClose();
      }}
    >
      <Field
        label="Name"
        htmlFor={id}
        error={trimmed.length > 120 ? "Names can be up to 120 characters." : null}
      >
        <Input id={id} value={value} autoFocus onChange={(event) => setValue(event.target.value)} />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={invalid}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Asks before deleting one item, or several chosen together. */
export function DeleteDialog({
  open,
  items,
  onClose,
  onDelete,
}: {
  open: boolean;
  items: readonly DashboardItem[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const one = items.length === 1 ? items[0] : undefined;
  const cloud = items.some((item) => item.kind === "cloud");
  const local = items.some((item) => item.kind === "draft");
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent
          size="sm"
          title={one !== undefined ? `Delete “${one.name}”?` : `Delete ${items.length} items?`}
          description={
            one !== undefined
              ? one.kind === "cloud"
                ? "It's removed from your account with its version history, and its share link stops working. This can't be undone."
                : "It's removed from this browser. This can't be undone. Download the files first if you want a copy."
              : `${cloud ? "Those in your account go with their version history, and their share links stop working. " : ""}${local ? "Those in this browser are removed from it. " : ""}This can't be undone.`
          }
        >
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
