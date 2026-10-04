"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  CloudUpload,
  Copy,
  Download,
  Eye,
  Globe,
  HardDrive,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { LogoGlyph } from "@/components/ui/logo";
import { editedLabel } from "@/lib/format";
import type { DashboardItem } from "./use-dashboard";

export interface CardActions {
  readonly signedIn: boolean;
  rename(item: DashboardItem, name: string): void;
  duplicate(item: DashboardItem): void;
  remove(item: DashboardItem): void;
  download(item: DashboardItem): Promise<void>;
  moveToAccount(item: DashboardItem): void;
  backfillThumbnail(item: DashboardItem): Promise<void>;
}

function Tag({ item }: { item: DashboardItem }) {
  const [icon, label] =
    item.kind === "draft"
      ? [<HardDrive key="i" />, "This browser"]
      : item.visibility === "link"
        ? [<Globe key="i" />, "Shared"]
        : [<Lock key="i" />, "Private"];
  return (
    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-micro font-medium text-white backdrop-blur-sm [&_svg]:size-3">
      {icon}
      {label}
    </span>
  );
}

/** A diagram on the dashboard, in Eden's marketplace-card style: thumbnail, tag, title, meta. */
export function DiagramCard({ item, actions }: { item: DashboardItem; actions: CardActions }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { backfillThumbnail } = actions;

  useEffect(() => {
    if (item.thumbnail === null) void backfillThumbnail(item);
  }, [item, backfillThumbnail]);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border-muted bg-fill-faint transition-colors hover:border-border-strong">
      <Link
        href={item.href as Route}
        className="flex flex-col outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
        aria-label={`Open ${item.name}`}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-surface">
          {item.thumbnail !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL rendered in the browser; nothing for next/image to optimise
            <img
              src={item.thumbnail}
              alt=""
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-fg-ghost">
              <LogoGlyph className="size-8" />
            </span>
          )}
          <Tag item={item} />
        </div>
        <div className="flex flex-col gap-0.5 px-3.5 pb-3 pt-3">
          <h3 className="truncate font-sans text-body font-medium text-fg">{item.name}</h3>
          <p className="text-caption tabular-nums text-fg-muted">{editedLabel(item.updatedAt)}</p>
        </div>
      </Link>

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`${item.name} options`}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-56">
          <MenuItem icon={<Eye />} onSelect={() => router.push(item.previewHref as Route)}>
            Preview
          </MenuItem>
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
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
          <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setDeleting(true)}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      <RenameDialog
        open={renaming}
        name={item.name}
        onClose={() => setRenaming(false)}
        onRename={(name) => actions.rename(item, name)}
      />
      <DeleteDialog
        open={deleting}
        item={item}
        onClose={() => setDeleting(false)}
        onDelete={() => actions.remove(item)}
      />
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

function DeleteDialog({
  open,
  item,
  onClose,
  onDelete,
}: {
  open: boolean;
  item: DashboardItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <DialogContent
          size="sm"
          title={`Delete “${item.name}”?`}
          description={
            item.kind === "cloud"
              ? "It's removed from your account with its version history, and its share link stops working. This can't be undone."
              : "It's removed from this browser. This can't be undone. Download the files first if you want a copy."
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
