"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Pause, Play, Plus, Wand2 } from "lucide-react";
import { applyConcept, suggestBindings, type ConceptBindings } from "@mogram/core/concepts";
import { EditError } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import { conceptPlatformLabel, conceptTopicLabel } from "@mogram/core/presets";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import { SCENE_HOLD } from "@mogram/core/timeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { rememberConcept, type ConceptEntry } from "@/features/concepts/catalog";
import { loadEntry } from "@/features/concepts/browse";
import { applyConceptTo, insertConceptExample } from "../actions";
import { useEditor, useEditorStore } from "../editor-context";

const NONE = "__none";

/** Where a concept comes from, and what it's about: "Scaling & performance · Azure · Yours". */
export function conceptMeta(entry: ConceptEntry): string {
  return [
    entry.topic === null ? null : conceptTopicLabel(entry.topic),
    entry.platform === "any" ? null : conceptPlatformLabel(entry.platform),
    entry.source === "builtin"
      ? "Comes with Mogram"
      : entry.source === "draft"
        ? "Yours, in this browser"
        : "Yours, in your account",
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/**
 * A concept, opened from the Concepts tab or the gallery (D-83, D-85): it plays its story so you
 * can see the idea. A pattern can be applied to your own elements; any concept can be inserted, or
 * opened as a diagram of its own. `onDone` follows using it (the gallery closes too).
 */
export function ConceptDialog({
  entry,
  onClose,
  onDone,
}: {
  entry: ConceptEntry | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {entry !== null ? (
        <DialogContent size="lg" title={entry.title} description={conceptMeta(entry)}>
          <ConceptBody
            key={entry.key}
            entry={entry}
            onClose={() => {
              onClose();
              onDone?.();
            }}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ConceptBody({ entry, onClose }: { entry: ConceptEntry; onClose: () => void }) {
  const [files, setFiles] = useState<ProjectFiles | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadEntry(entry)
      .then((loaded) => live && setFiles(loaded))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [entry]);
  const concept = useMemo(() => (files === null ? null : parseDiagram(files).diagram), [files]);
  if (failed)
    return (
      <p className="text-body-sm text-fg-muted">This concept couldn’t be loaded. Try again.</p>
    );
  if (files === null || concept === null)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  return <Loaded entry={entry} files={files} concept={concept} onClose={onClose} />;
}

function Loaded({
  entry,
  files,
  concept,
  onClose,
}: {
  entry: ConceptEntry;
  files: ProjectFiles;
  concept: Diagram;
  onClose: () => void;
}) {
  const store = useEditorStore();
  const diagram = useEditor((s) => s.parsed().diagram);
  const current = useEditor((s) => s.files);
  const selection = useEditor((s) => s.selection);
  const roles = concept.settings.concept?.roles ?? [];

  // Picks start from the selection; with nothing selected, from look-alikes in the diagram.
  const [bindings, setBindings] = useState<Record<string, string>>(() => {
    const all = [...diagram.components.keys(), ...diagram.containers.keys()];
    return selection.length > 0
      ? suggestBindings(concept, diagram, selection)
      : suggestBindings(concept, diagram, all, 4);
  });

  // Who could play a part: containers for a container, components for a component (but not
  // shapes for one that scales: shapes don't).
  const choices = (role: string) => {
    if (concept.containers.has(role))
      return [...diagram.containers.values()]
        .map((element) => ({ value: element.name, label: element.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const scales = concept.components.get(role)?.scale != null;
    return [...diagram.components.values()]
      .filter((element) => !scales || element.shape === null)
      .map((element) => ({ value: element.name, label: element.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  // An empty diagram has nothing to apply it to: the example is the way in.
  const empty = diagram.components.size + diagram.containers.size === 0;
  const explainer = roles.length === 0;
  const changes = useMemo(
    () => (empty || explainer ? null : dryRun(current, diagram, concept, bindings)),
    [empty, explainer, current, diagram, concept, bindings],
  );

  const finish = (report: readonly string[] | null) => {
    if (report === null) return;
    rememberConcept(entry.key);
    onClose();
    store.getState().notify(report.join(" "));
  };

  return (
    <>
      <ScenePlayer files={files} concept={concept} />
      {concept.settings.concept?.summary != null ? (
        <p className="mt-4 text-body-sm text-fg-secondary">{concept.settings.concept.summary}</p>
      ) : null}
      {explainer ? (
        <p className="mt-5 rounded-lg border border-border-subtle bg-fill-faint px-3 py-2.5 text-caption text-fg-muted">
          An explainer: insert it into your diagram to build on it, or open it on its own.
        </p>
      ) : (
        <section aria-label="Apply to your elements" className="mt-5 flex flex-col gap-2.5">
          <h3 className="text-label font-medium text-fg">Apply to your elements</h3>
          {empty ? (
            <p
              className="rounded-lg border border-border-subtle bg-fill-faint px-3 py-2.5 text-caption text-fg-muted"
              data-testid="concept-empty"
            >
              Your diagram is empty, so there’s nothing to apply it to yet. Insert the example to
              start from it, or add your own components first and come back: you’ll pick which of
              them plays each part.
            </p>
          ) : (
            <p className="text-caption text-fg-muted">
              Your own elements take on what the concept does, so the idea plays out on your
              diagram. Pick which one plays each part
              {selection.length > 0
                ? " (filled in from what you selected)."
                : "; selecting them on the canvas first fills these in."}
            </p>
          )}
          {(empty ? [] : roles).map((role) => {
            const options = choices(role.element);
            return (
              <div
                key={role.element}
                className="flex min-h-9 items-center gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-1"
              >
                <span className="w-44 shrink-0 text-caption text-fg-soft max-sm:w-auto">
                  {role.label}
                  {role.optional ? <span className="text-fg-faint"> (optional)</span> : null}
                </span>
                <Select
                  label={role.label}
                  className="min-w-0 flex-1"
                  disabled={options.length === 0}
                  value={bindings[role.element] ?? NONE}
                  onChange={(value) =>
                    setBindings((current) => {
                      const next = { ...current };
                      if (value === NONE) delete next[role.element];
                      else next[role.element] = value;
                      return next;
                    })
                  }
                  options={[
                    {
                      value: NONE,
                      label:
                        options.length === 0
                          ? concept.containers.has(role.element)
                            ? "No containers to choose from"
                            : "Nothing here can play this"
                          : role.optional
                            ? "Leave out"
                            : "Choose…",
                    },
                    ...options,
                  ]}
                />
              </div>
            );
          })}
          {changes !== null ? <Changes changes={changes} /> : null}
        </section>
      )}
      <DialogFooter className="justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            rememberConcept(entry.key);
            const query = entry.source === "builtin" ? `concept=${entry.id}` : null;
            if (query !== null) window.open(`/draft/new?${query}`, "_blank", "noopener");
            else
              window.open(
                entry.source === "draft" ? `/draft/${entry.id}` : `/edit/${entry.id}`,
                "_blank",
                "noopener",
              );
          }}
        >
          <ExternalLink />
          {entry.source === "builtin" ? "Open as a new diagram" : "Open it"}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={empty || explainer ? "primary" : "secondary"}
            onClick={() => finish(insertConceptExample(store, concept))}
          >
            <Plus />
            Insert the example
          </Button>
          {empty || explainer ? null : (
            <Button
              variant="primary"
              disabled={changes?.kind !== "ok"}
              title={changes?.kind === "ok" ? undefined : (changes?.message ?? undefined)}
              onClick={() => finish(applyConceptTo(store, concept, bindings))}
            >
              <Wand2 />
              Apply
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  );
}

/** What applying would change, worked out by applying it to a copy (so it can't disagree). */
type DryRun =
  | { readonly kind: "ok"; readonly report: readonly string[]; readonly notes: readonly string[] }
  | { readonly kind: "blocked"; readonly message: string };

function dryRun(
  files: ProjectFiles,
  diagram: Diagram,
  concept: Diagram,
  bindings: ConceptBindings,
): DryRun {
  try {
    const result = applyConcept(files, diagram, { concept, bindings });
    const changed =
      Object.keys(result.files).length !== Object.keys(files).length ||
      Object.entries(result.files).some(([path, text]) => files[path] !== text);
    return changed
      ? { kind: "ok", report: result.report, notes: result.notes }
      : { kind: "blocked", message: "Nothing to change: what you picked already does all this." };
  } catch (error) {
    if (error instanceof EditError) return { kind: "blocked", message: error.message };
    throw error;
  }
}

function Changes({ changes }: { changes: DryRun }) {
  return (
    <div
      className="mt-1 flex flex-col gap-2 rounded-lg border border-border-subtle bg-fill-faint px-3 py-2.5"
      data-testid="concept-changes"
      aria-live="polite"
    >
      <h4 className="text-caption font-medium text-fg-soft">What changes</h4>
      {changes.kind === "blocked" ? (
        <p className="text-caption text-fg-muted">{changes.message}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {changes.report.map((line) => (
              <li key={line} className="flex gap-2 text-caption text-fg-secondary">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-violet" />
                {line}
              </li>
            ))}
          </ul>
          {changes.notes.map((note) => (
            <p key={note} className="text-caption text-amber">
              {note}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * The concept, playing: its story if it has one, with its scenes one after another over it; a
 * scene chip shows (or picks) one.
 */
function ScenePlayer({ files, concept }: { files: ProjectFiles; concept: Diagram }) {
  const scenes = useMemo(
    () => [
      { name: null as string | null, label: "Normal" },
      ...concept.scenes.map((s) => ({ name: s.name as string | null, label: s.label })),
    ],
    [concept.scenes],
  );
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || scenes.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % scenes.length),
      SCENE_HOLD * 1000,
    );
    return () => window.clearInterval(timer);
  }, [playing, scenes.length]);
  const scene = scenes[index]?.name ?? null;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-page"
        data-testid="concept-preview"
        data-scene={scene ?? "normal"}
      >
        {/* A concept with a story plays it, with its words (D-86). */}
        <DiagramPreview
          files={files}
          scene={scene}
          className="absolute inset-0"
          padding={28}
          captions
          {...(concept.stories.length > 0
            ? { insets: { top: 0, right: 0, bottom: 56, left: 0 } }
            : {})}
        />
      </div>
      {scenes.length > 1 ? (
        <div className="flex items-center gap-1" role="group" aria-label="Concept scenes">
          <IconButton
            label={playing ? "Pause the scenes" : "Play the scenes"}
            size="sm"
            shape="round"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <div className="scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto">
            {scenes.map((item, i) => (
              <button
                key={item.name ?? "normal"}
                type="button"
                aria-pressed={i === index}
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
                className={cn(
                  "h-7 shrink-0 rounded-full px-2.5 text-caption font-medium transition-colors",
                  i === index
                    ? "bg-fill-active text-fg-strong"
                    : "text-fg-faint hover:bg-fill-hover hover:text-fg-soft",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
