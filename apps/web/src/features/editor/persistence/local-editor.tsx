"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ProjectFiles } from "@mogram/core/model";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth-client";
import { renderThumbnail } from "@/features/export/export";
import { nameOf } from "@/features/files/project-name";
import { EditorProvider, useEditorStore } from "../editor-context";
import { EditorShell } from "../editor-shell";
import { PermanentSaveError, useAutosave } from "./autosave";
import {
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
    async (files: ProjectFiles) => {
      if (!(await saveDraft(draft.id, { name: nameOf(files), files }))) {
        throw new PermanentSaveError(
          "This draft is no longer in this browser: it was saved to your account or deleted.",
        );
      }
    },
    [draft.id],
  );
  const autosave = useAutosave(store, persist, 400);
  const storeThumbnail = useCallback(
    (thumbnail: string) => setDraftThumbnail(draft.id, thumbnail),
    [draft.id],
  );
  useThumbnails(store, storeThumbnail, hasThumbnail);

  const host = useMemo<EditorHost>(
    () => ({
      kind: "local",
      id: draft.id,
      signedIn,
      viewerHref: `/draft/${draft.id}/view`,
      saveNow: () => autosave.flush(),
      saveToCloud: async () => {
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
          const created = await api.createDiagram({ name: nameOf(files), files, thumbnail });
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
    [draft.id, signedIn, autosave, router, store],
  );

  return <EditorHostContext value={host}>{children}</EditorHostContext>;
}
