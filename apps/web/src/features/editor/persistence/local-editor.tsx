"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ProjectFiles } from "@mogram/core/model";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { renderThumbnail } from "@/features/export/export";
import { nameOf, withName } from "@/features/files/project-name";
import {
  localVersions,
  recordLocalVersion,
  renameLocalVersion,
} from "@/features/history/local-history";
import type { HistorySource } from "@/features/history/source";
import { sameFiles, type Checkpoint } from "@/lib/history/rules";
import { EditorProvider, useEditorStore } from "../editor-context";
import { moveConversation } from "@/features/assistant/storage";
import { EditorShell } from "../editor-shell";
import { PermanentSaveError, useAutosave } from "./autosave";
import {
  createDraft,
  deleteDraft,
  getDraft,
  getDraftThumbnail,
  saveDraft,
  setDraftThumbnail,
  type Draft,
} from "../../drafts/drafts";
import { EditorHostContext, initialPanels, type EditorHost } from "./host";
import { EditorLoading, EditorUnavailable } from "../../../components/screens";
import { useThumbnails } from "./thumbnails";

type Loaded =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; draft: Draft; hasThumbnail: boolean };

/** The editor for a draft stored in this browser (AC-1). No account needed. */
export function LocalEditor({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    void Promise.all([getDraft(id), getDraftThumbnail(id)])
      .then(([draft, thumbnail]) => {
        if (alive)
          setLoaded(
            draft === null
              ? { kind: "missing" }
              : { kind: "ready", draft, hasThumbnail: thumbnail !== null },
          );
      })
      .catch(() => {
        if (alive) setLoaded({ kind: "missing" });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loaded.kind === "loading") return <EditorLoading />;
  if (loaded.kind === "missing") {
    return (
      <EditorUnavailable
        title="This draft isn't in this browser"
        description="Drafts are saved only in the browser they were made in. Open it on that device, or start a new diagram."
      />
    );
  }
  return (
    <EditorProvider init={{ files: loaded.draft.files, panels: initialPanels() }}>
      <LocalHost draft={loaded.draft} hasThumbnail={loaded.hasThumbnail}>
        <EditorShell />
      </LocalHost>
    </EditorProvider>
  );
}

function LocalHost({
  draft,
  hasThumbnail,
  children,
}: {
  draft: Draft;
  hasThumbnail: boolean;
  children: ReactNode;
}) {
  const store = useEditorStore();
  const router = useRouter();
  const session = useSession();
  const signedIn = session.data != null;

  const persist = useCallback(
    async (files: ProjectFiles, checkpoint?: Checkpoint) => {
      if (!(await saveDraft(draft.id, { name: nameOf(files), files }))) {
        throw new PermanentSaveError(
          "This draft is no longer in this browser: it was saved to your account or deleted.",
        );
      }
      await recordLocalVersion(draft.id, files, checkpoint === undefined ? {} : { checkpoint });
    },
    [draft.id],
  );
  // A draft's first version is the one it was opened with (drafts made before history start here).
  useEffect(() => {
    void localVersions(draft.id).then((list) => {
      if (list.length === 0)
        return recordLocalVersion(
          draft.id,
          draft.files,
          { source: "create" },
          new Date(draft.createdAt),
        );
    });
  }, [draft.id, draft.files, draft.createdAt]);
  const autosave = useAutosave(store, persist, 400);
  const storeThumbnail = useCallback(
    (thumbnail: string) => setDraftThumbnail(draft.id, thumbnail),
    [draft.id],
  );
  useThumbnails(store, storeThumbnail, hasThumbnail);

  const history = useMemo<HistorySource>(
    () => ({
      key: ["local-history", draft.id],
      list: async () =>
        (await localVersions(draft.id)).map((v) => ({
          id: v.id,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          author: "You",
          name: v.name,
          source: v.source,
          label: v.label,
          changes: v.changes,
          restoredFromAt: v.restoredFromAt,
        })),
      files: async (id) => {
        const version = (await localVersions(draft.id)).find((v) => v.id === id);
        if (version === undefined) throw new Error("That version is no longer here.");
        return version.files;
      },
      rename: (id, name) => renameLocalVersion(draft.id, id, name),
      nameCurrent: async (name) => {
        if (!(await autosave.flush())) throw new Error("Save the diagram first.");
        await recordLocalVersion(draft.id, store.getState().files, {
          checkpoint: { source: "named", name },
        });
      },
      restore: async (id) => {
        const version = (await localVersions(draft.id)).find((v) => v.id === id);
        if (version === undefined) throw new Error("That version is no longer here.");
        if (!(await autosave.flush())) throw new Error("Save the diagram first.");
        store.getState().closeLevel(0);
        store.getState().replaceFiles(version.files, "Restore version");
        await autosave.checkpoint({ source: "restore", restoredFromAt: version.createdAt });
      },
      copy: async (id) => {
        const version = (await localVersions(draft.id)).find((v) => v.id === id);
        if (version === undefined) throw new Error("That version is no longer here.");
        const name = `${nameOf(version.files)} copy`;
        const copy = await createDraft(name, withName(version.files, name));
        router.push(`/draft/${copy.id}`);
      },
    }),
    [draft.id, autosave, store, router],
  );

  const host = useMemo<EditorHost>(
    () => ({
      kind: "local",
      id: draft.id,
      signedIn,
      viewerHref: `/draft/${draft.id}/view`,
      saveNow: () => autosave.flush(),
      checkpoint: (checkpoint) => autosave.checkpoint(checkpoint),
      history,
      saveToCloud: async () => {
        if (store.getState().assistant !== null) {
          store.getState().notify("Wait for the assistant to finish, or stop it, first.");
          return;
        }
        if (!(await autosave.flush())) return;
        if (!signedIn) {
          router.push(`/sign-in?next=${encodeURIComponent(`/draft/${draft.id}`)}`);
          return;
        }
        // Edits wait while the draft is uploaded, so nothing is changed after the copy is taken.
        store.getState().setBusy("Saving to your account…");
        const files = store.getState().files;
        try {
          const thumbnail = await renderThumbnail(files).catch(() => null);
          const created = await api.createDiagram({
            name: nameOf(files),
            files,
            thumbnail,
            source: "import",
          });
          // Its history goes with it: oldest first, in batches the server accepts (by size), and
          // without the newest when that's just what was uploaded.
          const local = await localVersions(draft.id);
          const earlier = (
            local[0] !== undefined && sameFiles(local[0].files, files) ? local.slice(1) : local
          )
            .slice(0, 100)
            .reverse()
            .map((v) => ({
              files: v.files,
              createdAt: v.createdAt,
              name: v.name,
              source: v.source,
              label: v.label,
              restoredFromAt: v.restoredFromAt,
            }));
          let batch: typeof earlier = [];
          let bytes = 0;
          for (const version of earlier) {
            const size = JSON.stringify(version.files).length;
            if (batch.length > 0 && (bytes + size > 4_000_000 || batch.length === 50)) {
              await api.importVersions(created.id, batch);
              batch = [];
              bytes = 0;
            }
            batch.push(version);
            bytes += size;
          }
          if (batch.length > 0) await api.importVersions(created.id, batch);
          await moveConversation(`local:${draft.id}`, `cloud:${created.id}`);
          await deleteDraft(draft.id);
          autosave.markSaved(files);
          store.getState().notify("Saved to your account. It stays private until you share it.");
          router.replace(`/edit/${created.id}`);
        } catch (error) {
          store.getState().setBusy(null);
          store
            .getState()
            .notify(
              error instanceof Error ? error.message : "Couldn't save to your account.",
              "error",
            );
        }
      },
    }),
    [draft.id, signedIn, autosave, router, store, history],
  );

  return <EditorHostContext value={host}>{children}</EditorHostContext>;
}
