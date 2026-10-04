"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import type { DiagramDetail, Visibility } from "@/lib/api/contracts";
import { api } from "@/lib/api/client";
import { useMounted } from "@/lib/use-mounted";
import { nameOf } from "@/features/files/project-name";
import { EditorProvider, useEditorStore } from "../editor-context";
import { EditorShell } from "../editor-shell";
import { useAutosave } from "./autosave";
import { EditorLoading } from "../../../components/screens";
import { EditorHostContext, initialPanels, type EditorHost } from "./host";
import { useThumbnails } from "./thumbnails";

/** The editor for a diagram in the signed-in person's account (AC-3, AC-4). */
export function CloudEditor({ initial }: { initial: DiagramDetail }) {
  const mounted = useMounted();
  if (!mounted) return <EditorLoading />;
  return (
    <EditorProvider init={{ files: initial.files, panels: initialPanels() }}>
      <CloudHost initial={initial}>
        <EditorShell />
      </CloudHost>
    </EditorProvider>
  );
}

interface ShareState {
  readonly visibility: Visibility;
  readonly shareId: string | null;
  readonly allowViewerState: boolean;
}

function CloudHost({ initial, children }: { initial: DiagramDetail; children: ReactNode }) {
  const store = useEditorStore();
  const version = useRef(initial.version);
  const [share, setShare] = useState<ShareState>({
    visibility: initial.visibility,
    shareId: initial.shareId,
    allowViewerState: initial.allowViewerState,
  });

  const persist = useCallback(
    async (files: ProjectFiles) => {
      const result = await api.saveDiagram(initial.id, {
        files,
        baseVersion: version.current,
        name: nameOf(files),
      });
      version.current = result.version;
    },
    [initial.id],
  );
  const autosave = useAutosave(store, persist, 1200);
  const storeThumbnail = useCallback(
    async (thumbnail: string) => {
      await api.updateDiagram(initial.id, { thumbnail });
    },
    [initial.id],
  );
  useThumbnails(store, storeThumbnail, initial.thumbnail !== null);

  const host = useMemo<EditorHost>(() => {
    const reload = async () => {
      const latest = await api.getDiagram(initial.id);
      version.current = latest.version;
      autosave.markSaved(latest.files);
      store.getState().closeLevel(0);
      store.getState().replaceFiles(latest.files, "Load newer version");
      store.getState().setSave({ kind: "saved", at: Date.now() });
      setShare({
        visibility: latest.visibility,
        shareId: latest.shareId,
        allowViewerState: latest.allowViewerState,
      });
    };
    return {
      kind: "cloud",
      id: initial.id,
      signedIn: true,
      viewerHref: `/edit/${initial.id}/view`,
      share,
      saveNow: () => autosave.flush(),
      reload,
      resolveConflict: async (choice) => {
        try {
          if (choice === "reload") {
            await reload();
            store.getState().notify("Loaded the newer version. Undo brings back your changes.");
            return;
          }
          const save = store.getState().save;
          if (save.kind === "conflict") version.current = save.currentVersion;
          store.getState().setSave({ kind: "unsaved" });
          await autosave.flush();
        } catch (error) {
          store
            .getState()
            .notify(
              error instanceof Error ? error.message : "Couldn't resolve the conflict.",
              "error",
            );
        }
      },
      updateShare: async (input) => {
        const updated = await api.updateShare(initial.id, input);
        setShare({
          visibility: updated.visibility,
          shareId: updated.shareId,
          allowViewerState: updated.allowViewerState,
        });
      },
    };
  }, [initial.id, share, autosave, store]);

  return <EditorHostContext value={host}>{children}</EditorHostContext>;
}
