"use client";

import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { nanoid } from "nanoid";
import type { ProjectFiles } from "@mogram/core/model";
import {
  continuesSession,
  sameFiles,
  versionChanges,
  versionsToPrune,
  type Checkpoint,
  type VersionChanges,
  type VersionSource,
} from "@/lib/history/rules";

/**
 * Version history for drafts, kept in this browser beside the draft (same rules as the cloud:
 * `lib/history/rules`), and uploaded with the draft when it's saved to an account.
 */
export interface StoredVersion {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly files: ProjectFiles;
  readonly name: string | null;
  readonly source: VersionSource;
  readonly label: string | null;
  readonly changes: VersionChanges | null;
  readonly restoredFromAt: string | null;
}

/** The most versions a draft keeps (named ones are kept regardless). */
const MAX_VERSIONS = 200;
/** Drafts have one author: this browser. */
const LOCAL_AUTHOR = "local";

let store: UseStore | null = null;
const versions = (): UseStore => (store ??= createStore("mogram-history", "versions"));

/** A draft's versions, newest first. */
export async function localVersions(draftId: string): Promise<StoredVersion[]> {
  return (await get<StoredVersion[]>(draftId, versions())) ?? [];
}

function prune(list: StoredVersion[], now: Date): StoredVersion[] {
  const doomed = new Set(
    versionsToPrune(
      list.map((v) => ({ id: v.id, createdAt: new Date(v.createdAt), name: v.name })),
      now,
    ),
  );
  const kept = list.filter((v) => !doomed.has(v.id));
  // Past the cap, the oldest unnamed versions go (the very first stays).
  while (kept.length > MAX_VERSIONS) {
    const index = kept.findLastIndex((v, i) => v.name === null && i !== kept.length - 1);
    if (index < 0) break;
    kept.splice(index, 1);
  }
  return kept;
}

/**
 * Records `files` as saved: joins the version being edited, or starts a new one (always, for a
 * checkpoint). Nothing changes when the files are what the latest version already holds, except
 * that naming them names that version.
 */
export async function recordLocalVersion(
  draftId: string,
  files: ProjectFiles,
  options: { readonly source?: VersionSource; readonly checkpoint?: Checkpoint } = {},
  now = new Date(),
): Promise<void> {
  const list = await localVersions(draftId);
  const latest = list[0];
  const checkpoint = options.checkpoint;
  if (latest !== undefined && sameFiles(latest.files, files)) {
    if (checkpoint?.name !== undefined) {
      list[0] = { ...latest, name: checkpoint.name };
      await set(draftId, list, versions());
    }
    return;
  }
  const source = options.source ?? checkpoint?.source ?? "save";
  const joins =
    checkpoint === undefined &&
    source === "save" &&
    latest !== undefined &&
    continuesSession(
      {
        createdAt: new Date(latest.createdAt),
        updatedAt: new Date(latest.updatedAt),
        name: latest.name,
        source: latest.source,
        authorId: LOCAL_AUTHOR,
      },
      LOCAL_AUTHOR,
      now,
    );
  if (joins && latest !== undefined) {
    list[0] = {
      ...latest,
      files,
      updatedAt: now.toISOString(),
      changes: versionChanges(list[1]?.files, files),
    };
  } else {
    list.unshift({
      id: nanoid(12),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      files,
      name: checkpoint?.name ?? null,
      source,
      label: checkpoint?.label ?? null,
      changes: versionChanges(latest?.files, files),
      restoredFromAt: checkpoint?.restoredFromAt ?? null,
    });
  }
  await set(draftId, prune(list, now), versions());
}

export async function renameLocalVersion(
  draftId: string,
  id: string,
  name: string | null,
): Promise<void> {
  const list = await localVersions(draftId);
  const clean = name === null || name.trim() === "" ? null : name.trim().slice(0, 120);
  await set(
    draftId,
    list.map((v) => (v.id === id ? { ...v, name: clean } : v)),
    versions(),
  );
}

export async function deleteLocalHistory(draftId: string): Promise<void> {
  await del(draftId, versions());
}
