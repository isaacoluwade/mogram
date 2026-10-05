"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import { conceptPlatformLabel } from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import type { ConceptEntry } from "@/features/concepts/catalog";
import { loadEntry, shelfLabel } from "@/features/concepts/browse";
import { TopicIcon } from "./topic-icon";

/**
 * A concept as a card (D-85): its preview, drawn when it comes into view and playing while the
 * pointer is over it, and what it is. The gallery's cards say more; the Concepts tab's are
 * compact, two to a row, with the topic only where the list mixes topics.
 */
export function ConceptCard({
  entry,
  onOpen,
  compact = false,
  showTopic = true,
}: {
  entry: ConceptEntry;
  onOpen: () => void;
  compact?: boolean;
  showTopic?: boolean;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const files = useFilesInView(entry, frame);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={`Concept: ${entry.title}`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden border border-border bg-fill-faint text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis",
        compact ? "rounded-xl" : "rounded-2xl",
      )}
    >
      <div
        ref={frame}
        className="relative aspect-[16/10] w-full shrink-0 bg-page"
        data-testid="concept-card-preview"
      >
        {files === null ? (
          <Skeleton
            className={cn(
              "absolute opacity-40",
              compact ? "inset-2 rounded-lg" : "inset-3 rounded-xl",
            )}
          />
        ) : (
          <DiagramPreview
            files={files}
            className="absolute inset-0"
            padding={compact ? 8 : 18}
            animate={hover}
          />
        )}
      </div>
      {compact ? <CompactText entry={entry} showTopic={showTopic} /> : <FullText entry={entry} />}
    </button>
  );
}

function CompactText({ entry, showTopic }: { entry: ConceptEntry; showTopic: boolean }) {
  const meta = [
    showTopic ? (entry.topic === null ? "Other" : shelfLabel(entry.topic)) : null,
    entry.platform === "any" ? null : conceptPlatformLabel(entry.platform),
    entry.kind === "explainer" ? "Explainer" : null,
  ].filter((part) => part !== null);
  return (
    <span className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
      <span className="line-clamp-2 text-caption font-medium text-fg-soft group-hover:text-fg">
        {entry.title}
      </span>
      {meta.length > 0 ? (
        <span className="truncate text-micro text-fg-muted">{meta.join(" · ")}</span>
      ) : null}
    </span>
  );
}

function FullText({ entry }: { entry: ConceptEntry }) {
  return (
    <span className="flex flex-col gap-1 p-3">
      <span className="flex items-center gap-1.5 text-micro text-fg-muted [&_svg]:size-3.5">
        <TopicIcon topic={entry.topic} />
        <span className="truncate">{entry.topic === null ? "Other" : shelfLabel(entry.topic)}</span>
      </span>
      <span className="truncate text-label font-medium text-fg">{entry.title}</span>
      <span className="line-clamp-2 min-h-8 text-caption text-fg-muted">
        {entry.summary === "" ? "No summary yet" : entry.summary}
      </span>
      <span className="mt-1 flex flex-wrap gap-1">
        {entry.platform !== "any" ? (
          <Badge tone="neutral" size="sm">
            {conceptPlatformLabel(entry.platform)}
          </Badge>
        ) : null}
        <Badge tone={entry.kind === "pattern" ? "violet" : "neutral"} size="sm">
          {entry.kind === "pattern" ? "Apply to your diagram" : "Explainer"}
        </Badge>
        {entry.source !== "builtin" ? (
          <Badge tone="green" size="sm">
            Yours
          </Badge>
        ) : null}
      </span>
    </span>
  );
}

/** The concept's files once its card has come near the screen (so hundreds cost nothing). */
function useFilesInView(
  entry: ConceptEntry,
  frame: React.RefObject<HTMLDivElement | null>,
): ProjectFiles | null {
  const [seen, setSeen] = useState(false);
  const [files, setFiles] = useState<ProjectFiles | null>(null);
  useEffect(() => {
    const node = frame.current;
    if (node === null || seen) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) setSeen(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, frame]);
  useEffect(() => {
    if (!seen) return;
    let live = true;
    loadEntry(entry)
      .then((loaded) => live && setFiles(loaded))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [seen, entry]);
  return files;
}
