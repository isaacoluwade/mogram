"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Cloud, FolderOpen, Layers, Lightbulb, Shapes } from "lucide-react";
import { deckInfo } from "@mogram/core/deck";
import { findDiagramFolders } from "@mogram/core/format";
import type { ProjectFiles } from "@mogram/core/model";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { builtinConcepts, type ConceptEntry } from "@/features/concepts/catalog";
import { loadEntry } from "@/features/concepts/browse";
import { getDraft, listDrafts } from "@/features/drafts/drafts";
import { TEMPLATES } from "@/features/templates";
import { loaderFor } from "@/features/canvas/use-diagram";
import type { SlideOrigin } from "@mogram/core/edit";

type SourceTab = "project" | "templates" | "concepts" | "saved";

type SavedSource =
  | { readonly kind: "draft"; readonly id: string; readonly name: string }
  | { readonly kind: "cloud"; readonly id: string; readonly name: string };

interface SavedSources {
  readonly items: readonly SavedSource[];
  readonly draftsUnavailable: boolean;
  readonly accountUnavailable: boolean;
}

export interface ImportedSlide {
  readonly files: ProjectFiles;
  readonly name: string;
  readonly origin?: SlideOrigin;
}

interface AddSlideProps {
  readonly files: ProjectFiles;
  readonly deckRoot: string;
  /** Whether there's an account to list diagrams from. */
  readonly signedIn: boolean;
  readonly onAddExisting: (folder: string, title: string) => boolean;
  readonly onImport: (project: ImportedSlide) => boolean;
  readonly onDone: () => void;
}

/** Adds a linked project diagram or imports a template, concept, draft, or account diagram. */
export function AddSlideDialog({
  open,
  onOpenChange,
  ...props
}: Omit<AddSlideProps, "onDone"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title="Add a slide"
        description="Link a diagram already in this project, or bring in a copy."
      >
        {/* Drawn afresh each time it opens: what's saved may have changed since. */}
        <Sources {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The diagrams of a project that can be a slide of the deck at `deckRoot`: not the deck, not
 * its frame, not another deck, and not a nested level of another diagram (a folder inside one).
 */
export function slideCandidates(
  files: ProjectFiles,
  deckRoot: string,
): readonly { readonly folder: string; readonly name: string }[] {
  const source = loaderFor(files);
  const folders = findDiagramFolders(files);
  const diagrams = new Set(folders);
  const frame = source.load(deckRoot).diagram.settings.deck?.frame ?? null;
  const nested = (folder: string) => {
    const parts = folder.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      const parent = parts.slice(0, depth).join("/");
      // Inside the deck's folder is where its slides live; inside any other diagram, a level.
      if (parent !== deckRoot && diagrams.has(parent)) return true;
    }
    return false;
  };
  return folders.flatMap((folder) => {
    if (folder === deckRoot || folder === "" || nested(folder)) return [];
    if (folder === frame) return [];
    const diagram = source.load(folder).diagram;
    return diagram.settings.deck === null ? [{ folder, name: diagram.settings.name }] : [];
  });
}

function Sources({ files, deckRoot, signedIn, onAddExisting, onImport, onDone }: AddSlideProps) {
  const [tab, setTab] = useState<SourceTab>("project");
  const [pending, setPending] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSources | null>(null);
  const [retry, setRetry] = useState(0);
  const projectDiagrams = useMemo(() => slideCandidates(files, deckRoot), [files, deckRoot]);
  const templates = useMemo(
    () =>
      TEMPLATES.filter(
        (template) =>
          template.id !== "blank" && deckInfo(template.files, loaderFor(template.files)) === null,
      ),
    [],
  );
  const concepts = useMemo(() => builtinConcepts(), []);

  useEffect(() => {
    let live = true;
    void Promise.all([
      listDrafts().then(
        (items) => ({ items, unavailable: false }),
        () => ({ items: [], unavailable: true }),
      ),
      // Signed out, there's no account to ask.
      signedIn
        ? api.listDiagrams().then(
            (items) => ({ items, unavailable: false }),
            () => ({ items: [], unavailable: true }),
          )
        : Promise.resolve({ items: [], unavailable: false }),
    ]).then(([drafts, diagrams]) => {
      if (!live) return;
      setSaved({
        items: [
          ...drafts.items
            .filter((draft) => draft.deck === null)
            .map((draft) => ({ kind: "draft" as const, id: draft.id, name: draft.name })),
          ...diagrams.items
            .filter((diagram) => diagram.deck === null)
            .map((diagram) => ({ kind: "cloud" as const, id: diagram.id, name: diagram.name })),
        ],
        draftsUnavailable: drafts.unavailable,
        accountUnavailable: diagrams.unavailable,
      });
    });
    return () => {
      live = false;
    };
  }, [signedIn, retry]);

  const choose = async (key: string, action: () => boolean | Promise<boolean>) => {
    if (pending !== null) return;
    setPending(key);
    try {
      if (await action()) onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "That slide couldn't be added.";
      const { toast } = await import("sonner");
      toast.error(message);
    } finally {
      setPending(null);
    }
  };

  const importConcept = async (entry: ConceptEntry) => {
    const conceptFiles = await loadEntry(entry);
    return onImport({ files: conceptFiles, name: entry.title });
  };

  const importSaved = async (item: SavedSource) => {
    if (item.kind === "draft") {
      const draft = await getDraft(item.id);
      if (draft === null) throw new Error("That draft is no longer available.");
      return onImport({ files: draft.files, name: draft.name });
    }
    const diagram = await api.getDiagram(item.id);
    return onImport({
      files: diagram.files,
      name: diagram.name,
      origin: { diagram: diagram.id, version: diagram.version },
    });
  };

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as SourceTab)}>
      <TabsList
        aria-label="Slide source"
        className="grid w-full grid-cols-4 rounded-md bg-fill-track p-1"
      >
        <TabsTrigger variant="pill" value="project" className="w-full justify-center">
          Project
        </TabsTrigger>
        <TabsTrigger variant="pill" value="templates" className="w-full justify-center">
          Templates
        </TabsTrigger>
        <TabsTrigger variant="pill" value="concepts" className="w-full justify-center">
          Concepts
        </TabsTrigger>
        <TabsTrigger variant="pill" value="saved" className="w-full justify-center">
          Saved
        </TabsTrigger>
      </TabsList>

      <TabsContent value="project" className="mt-3">
        <SourceList>
          {projectDiagrams.map((item) => (
            <SourceRow
              key={item.folder}
              icon={<FolderOpen />}
              title={item.name}
              detail={item.folder}
              pending={pending === item.folder}
              disabled={pending !== null}
              onSelect={() => void choose(item.folder, () => onAddExisting(item.folder, item.name))}
            />
          ))}
          {projectDiagrams.length === 0 ? (
            <Empty>There are no other diagrams in this project yet.</Empty>
          ) : null}
        </SourceList>
      </TabsContent>

      <TabsContent value="templates" className="mt-3">
        <SourceList>
          {templates.map((template) => (
            <SourceRow
              key={template.id}
              icon={<Shapes />}
              title={template.name}
              detail={template.description}
              pending={pending === template.id}
              disabled={pending !== null}
              onSelect={() =>
                void choose(template.id, () =>
                  onImport({ files: template.files, name: template.name }),
                )
              }
            />
          ))}
        </SourceList>
      </TabsContent>

      <TabsContent value="concepts" className="mt-3">
        <SourceList>
          {concepts.map((entry) => (
            <SourceRow
              key={entry.key}
              icon={<Lightbulb />}
              title={entry.title}
              detail={entry.summary}
              pending={pending === entry.key}
              disabled={pending !== null}
              onSelect={() => void choose(entry.key, () => importConcept(entry))}
            />
          ))}
          {concepts.length === 0 ? <Empty>No built-in concepts are available.</Empty> : null}
        </SourceList>
      </TabsContent>

      <TabsContent value="saved" className="mt-3">
        {saved === null ? (
          <SourceList>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </SourceList>
        ) : (
          <SourceList>
            {saved.items.map((item) => (
              <SourceRow
                key={`${item.kind}:${item.id}`}
                icon={item.kind === "cloud" ? <Cloud /> : <Layers />}
                title={item.name}
                detail={item.kind === "cloud" ? "Account diagram" : "Browser draft"}
                pending={pending === `${item.kind}:${item.id}`}
                disabled={pending !== null}
                onSelect={() => void choose(`${item.kind}:${item.id}`, () => importSaved(item))}
              />
            ))}
            {saved.items.length === 0 ? (
              <Empty>
                {saved.draftsUnavailable && (saved.accountUnavailable || !signedIn)
                  ? "Saved diagrams couldn't be loaded. Check your connection and try again."
                  : signedIn
                    ? "No saved diagrams are available to add."
                    : "No other drafts in this browser. Sign in to add diagrams from your account."}
              </Empty>
            ) : null}
            {saved.accountUnavailable && saved.items.length > 0 ? (
              <p className="px-1 text-caption text-fg-muted">
                Account diagrams couldn&apos;t be loaded. Browser drafts are still available.
              </p>
            ) : null}
            {saved.draftsUnavailable && saved.items.length > 0 ? (
              <p className="px-1 text-caption text-fg-muted">
                Browser drafts couldn&apos;t be loaded. Account diagrams are still available.
              </p>
            ) : null}
            {saved.draftsUnavailable && (saved.accountUnavailable || !signedIn) ? (
              <button
                type="button"
                onClick={() => {
                  setSaved(null);
                  setRetry((current) => current + 1);
                }}
                className="self-start px-1 text-caption font-medium text-fg-soft underline decoration-border-strong underline-offset-4 hover:text-fg"
              >
                Try again
              </button>
            ) : null}
          </SourceList>
        )}
      </TabsContent>
    </Tabs>
  );
}

function SourceList({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-h-[min(52dvh,26rem)] min-h-64 flex-col gap-2 overflow-y-auto pr-1">
      {children}
    </div>
  );
}

function SourceRow({
  icon,
  title,
  detail,
  pending,
  disabled,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="group flex min-h-14 w-full items-center gap-3 rounded-md border border-border-subtle px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-fill-hover disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-fill-subtle text-fg-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-medium text-fg">{title}</span>
        <span className="block truncate text-caption text-fg-muted">{detail}</span>
      </span>
      {pending ? (
        <span
          role="status"
          aria-label="Adding slide"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-border-strong border-t-fg"
        />
      ) : (
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary"
        />
      )}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-48 items-center justify-center px-6 text-center text-body-sm text-fg-muted">
      {children}
    </p>
  );
}
