"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api/client";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { useEditor, useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Version history for cloud diagrams: browse earlier saves and restore one. */
export function HistoryDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "history");
  const host = useEditorHost();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => store.getState().setDialog(next ? "history" : null)}
    >
      {open && host.kind === "cloud" ? (
        <DialogContent
          size="xl"
          title="Version history"
          description="Saves made within a few minutes of each other are kept as one version."
        >
          <HistoryBody diagramId={host.id} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function HistoryBody({ diagramId }: { diagramId: string }) {
  const store = useEditorStore();
  const host = useEditorHost();
  const queryClient = useQueryClient();
  const revisions = useQuery({
    queryKey: ["revisions", diagramId],
    queryFn: () => api.listRevisions(diagramId),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const current = revisions.data?.[0]?.id ?? null;
  const active = selected ?? current;
  const files = useQuery({
    queryKey: ["revision", diagramId, active],
    queryFn: () => api.getRevisionFiles(diagramId, active ?? ""),
    enabled: active !== null,
    staleTime: Infinity,
  });

  const restore = async () => {
    if (active === null || active === current) return;
    setRestoring(true);
    try {
      // Save what's on screen first, so the version being replaced is in history too.
      if (!(await host.saveNow())) {
        store
          .getState()
          .notify("Your latest changes couldn't be saved, so nothing was restored.", "error");
        return;
      }
      await api.restoreRevision(diagramId, active);
      await host.reload?.();
      await queryClient.invalidateQueries({ queryKey: ["revisions", diagramId] });
      store.getState().setDialog(null);
      store.getState().notify("Version restored. The version it replaced is still in history.");
    } catch (cause) {
      store
        .getState()
        .notify(cause instanceof Error ? cause.message : "Couldn't restore that version.", "error");
    } finally {
      setRestoring(false);
    }
  };

  if (revisions.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
        <Skeleton className="aspect-[16/10]" />
      </div>
    );
  }
  if (revisions.isError) {
    return (
      <EmptyState
        icon={<History />}
        title="History couldn't load"
        description={revisions.error.message}
      />
    );
  }
  if (revisions.data.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No versions yet"
        description="Versions appear here as you save."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <ol
        className="flex max-h-[min(420px,40dvh)] flex-col gap-1 overflow-y-auto md:max-h-[460px]"
        aria-label="Versions"
      >
        {revisions.data.map((revision) => (
          <li key={revision.id}>
            <button
              type="button"
              onClick={() => setSelected(revision.id)}
              aria-current={revision.id === active}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                revision.id === active ? "bg-fill-active" : "hover:bg-fill-hover",
              )}
            >
              <span className="flex w-full items-center gap-2 text-label font-medium text-fg">
                {dateFormat.format(new Date(revision.updatedAt))}
                {revision.id === current ? (
                  <Badge size="sm" tone="green" className="ml-auto">
                    Current
                  </Badge>
                ) : null}
              </span>
              <span className="text-caption text-fg-muted">
                Version {revision.version}
                {revision.author !== null ? ` · ${revision.author}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border-subtle">
          {files.data !== undefined ? (
            <DiagramPreview files={files.data} className="absolute inset-0" padding={24} />
          ) : files.isError ? (
            <p className="absolute inset-0 flex items-center justify-center text-label text-fg-muted">
              This version couldn’t load.
            </p>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          {active === current ? (
            <span className="mr-auto text-caption text-fg-muted">
              This is the version you’re editing.
            </span>
          ) : null}
          <Button
            variant="primary"
            disabled={active === current || restoring || files.data === undefined}
            onClick={() => void restore()}
          >
            <RotateCcw />
            {restoring ? "Restoring…" : "Restore this version"}
          </Button>
        </div>
      </div>
    </div>
  );
}
