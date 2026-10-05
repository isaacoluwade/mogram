"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { restoreElements } from "@mogram/core/edit";
import type { ProjectFiles } from "@mogram/core/model";
import { momentLabel } from "@/features/history/format";
import type { HistorySource, VersionItem } from "@/features/history/source";
import { preference, setPreference, type HistoryChanges } from "@/lib/preferences";
import { useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";
import { parseCached, type EditorStore, type Viewing } from "../store/editor-store";

/** A version's files, cached for good (a version never changes). */
export const versionFilesKey = (history: HistorySource, id: string) =>
  ["version-files", ...history.key, id] as const;

export function fetchVersionFiles(
  client: QueryClient,
  history: HistorySource,
  id: string,
): Promise<ProjectFiles> {
  return client.fetchQuery({
    queryKey: versionFilesKey(history, id),
    queryFn: () => history.files(id),
    staleTime: Infinity,
  });
}

/** The diagram's versions, newest first (read again whenever the panel opens). */
export function useVersions() {
  const host = useEditorHost();
  return useQuery({
    queryKey: host.history.key,
    queryFn: () => host.history.list(),
    staleTime: 0,
  });
}

/** The version before this one in the list (lists are newest first). */
export function previousOf(list: readonly VersionItem[], id: string): VersionItem | null {
  const index = list.findIndex((v) => v.id === id);
  return index < 0 ? null : (list[index + 1] ?? null);
}

/** What can be brought back from a version: elements by name, and scenes. */
export interface BringBack {
  readonly from: ProjectFiles;
  readonly folder: string;
  readonly names: readonly string[];
  readonly scenes?: readonly string[];
  /** What people read in the message ("Orders DB", "3 elements"). */
  readonly label: string;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Everything the history panel and the banner do with versions: show one on the canvas, show its
 * changes, restore it, copy it, name it, and bring parts of it back.
 */
export function useVersionActions() {
  const store = useEditorStore();
  const host = useEditorHost();
  const client = useQueryClient();
  const history = host.history;

  return useMemo(() => {
    const refresh = () => client.invalidateQueries({ queryKey: history.key });
    const filesOf = (id: string) => fetchVersionFiles(client, history, id);
    const fail = (error: unknown, fallback: string) =>
      store.getState().notify(errorText(error, fallback), "error");
    /** While the assistant changes the diagram, history waits (its turn becomes a version too). */
    const assistantBusy = () => {
      if (store.getState().assistant === null) return false;
      store.getState().notify("Wait for the assistant to finish, or stop it, first.");
      return true;
    };

    const compareFor = async (
      mode: HistoryChanges,
      previousId: string | null,
    ): Promise<Viewing["compare"]> => {
      if (mode === "off") return null;
      if (mode === "current") return { mode: "current" };
      return previousId === null ? null : { mode: "previous", files: await filesOf(previousId) };
    };

    return {
      refresh,

      /** Shows a version on the canvas, read-only; null goes back to the current one. */
      view: async (version: VersionItem | null, previous: VersionItem | null) => {
        if (version === null) {
          store.getState().setViewing(null);
          return true;
        }
        if (assistantBusy()) return false;
        try {
          const [files, compare] = await Promise.all([
            filesOf(version.id),
            compareFor(preference("historyChanges"), previous?.id ?? null),
          ]);
          store.getState().setViewing({
            id: version.id,
            files,
            title: momentLabel(version.updatedAt),
            previousId: previous?.id ?? null,
            compare,
          });
          return true;
        } catch (error) {
          fail(error, "That version couldn't load.");
          return false;
        }
      },

      /** Show changes: off, in this version (against the one before), or since (against now). */
      showChanges: async (mode: HistoryChanges) => {
        setPreference("historyChanges", mode);
        const viewing = store.getState().viewing;
        if (viewing === null) return;
        try {
          const compare = await compareFor(mode, viewing.previousId);
          // Still the same version on show (another may have been chosen meanwhile).
          const now = store.getState().viewing;
          if (now?.id === viewing.id) store.getState().setViewing({ ...now, compare });
        } catch (error) {
          fail(error, "The changes couldn't load.");
        }
      },

      restore: async (version: VersionItem) => {
        if (assistantBusy()) return;
        // Back to the current version first: restoring replaces it (as a new version on top).
        store.getState().setViewing(null);
        try {
          await history.restore(version.id);
          store
            .getState()
            .notify(
              `Restored the version from ${momentLabel(version.updatedAt)}. What it replaced is still in history.`,
            );
        } catch (error) {
          fail(error, "Couldn't restore that version.");
        }
        await refresh();
      },

      copy: async (version: VersionItem) => {
        try {
          await history.copy(version.id);
        } catch (error) {
          fail(error, "Couldn't make a copy.");
        }
      },

      rename: async (version: VersionItem, name: string | null) => {
        try {
          await history.rename(version.id, name);
        } catch (error) {
          fail(error, "Couldn't name that version.");
        }
        await refresh();
      },

      nameCurrent: async (name: string) => {
        if (assistantBusy()) return;
        try {
          await history.nameCurrent(name);
          store.getState().notify(`Named this version "${name}".`);
        } catch (error) {
          fail(error, "Couldn't name this version.");
        }
        await refresh();
      },

      /**
       * Puts elements (and scenes) back as they were in another version, leaving everything else
       * as it is now, and goes back to the current version to show them.
       */
      bringBack: (items: BringBack) => bringBack(store, items),
    };
  }, [client, history, store]);
}

function bringBack(store: EditorStore, items: BringBack): boolean {
  store.getState().setViewing(null);
  const here = store.getState().folder === items.folder;
  const ok = store.getState().edit(`Bring back ${items.label}`, (files) => {
    const result = restoreElements(files, parseCached(files, items.folder).diagram, {
      from: items.from,
      names: items.names,
      ...(items.scenes !== undefined ? { scenes: items.scenes } : {}),
    });
    // Elements of another level can't be selected from this one.
    return here ? result : { files: result.files };
  });
  if (ok) store.getState().notify(`Brought back ${items.label}.`);
  return ok;
}
