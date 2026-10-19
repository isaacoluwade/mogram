"use client";

import { createStore, del, entries, get, set, values, type UseStore } from "idb-keyval";
import { nanoid } from "nanoid";
import { conceptInfo } from "@mogram/core/concepts";
import { deckInfo, projectAbout, type ProjectAbout } from "@mogram/core/deck";
import { DiagramLoader } from "@mogram/core/nested";
import type { ConceptSummary } from "@/lib/api/contracts";
import type { ProjectFiles } from "@mogram/core/model";
import { withName } from "@/features/files/project-name";
import { deleteConversation } from "@/features/assistant/storage";
import { deleteLocalHistory } from "@/features/history/local-history";

/**
 * Local drafts (AC-1, AC-2): diagrams kept in this browser's IndexedDB, no account needed.
 * They never leave the device unless the person downloads them or saves them to the cloud.
 * Thumbnails live in their own store, so writing one can never race a save of the files.
 */
export interface Draft {
  readonly id: string;
  readonly name: string;
  readonly files: ProjectFiles;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Small JPEG data URL for the dashboard, or null until one has been rendered. */
  readonly thumbnail: string | null;
  /** Set when the draft is a concept (D-83, D-85), so the library can offer it. */
  readonly concept: ConceptSummary | null;
  readonly deck: { readonly slides: number } | null;
  /** What it is and how far along: slides, scenes, beats written and recorded. */
  readonly about: ProjectAbout;
}

let stores: { drafts: UseStore; thumbnails: UseStore } | null = null;

function db(): { drafts: UseStore; thumbnails: UseStore } {
  stores ??= {
    drafts: createStore("mogram-drafts", "drafts"),
    thumbnails: createStore("mogram-thumbnails", "thumbnails"),
  };
  return stores;
}

const DRAFT_ID = /^[A-Za-z0-9_-]{8,40}$/;

export function isDraftId(id: string): boolean {
  return DRAFT_ID.test(id);
}

function conceptSummary(files: ProjectFiles): DraftSummary["concept"] {
  try {
    const info = conceptInfo(files);
    if (info === null) return null;
    const { summary, topic, platform, tags, kind } = info;
    return { summary, topic, platform, tags, kind };
  } catch {
    return null;
  }
}

function deckSummary(files: ProjectFiles): DraftSummary["deck"] {
  try {
    const info = deckInfo(files, new DiagramLoader(files));
    return info === null ? null : { slides: info.slides };
  } catch {
    return null;
  }
}

function aboutSummary(files: ProjectFiles): ProjectAbout {
  try {
    return projectAbout(files, new DiagramLoader(files));
  } catch {
    return { kind: "diagram", slides: 0, scenes: 0, beats: 0, scripted: 0, recorded: 0 };
  }
}

export async function listDrafts(): Promise<DraftSummary[]> {
  const [drafts, thumbnails] = await Promise.all([
    values<Draft>(db().drafts),
    entries<string, string>(db().thumbnails),
  ]);
  const thumbnailOf = new Map(thumbnails);
  return drafts
    .map((draft) => ({
      id: draft.id,
      name: draft.name,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      thumbnail: thumbnailOf.get(draft.id) ?? null,
      concept: conceptSummary(draft.files),
      deck: deckSummary(draft.files),
      about: aboutSummary(draft.files),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDraft(id: string): Promise<Draft | null> {
  if (!isDraftId(id)) return null;
  return (await get<Draft>(id, db().drafts)) ?? null;
}

export async function getDraftThumbnail(id: string): Promise<string | null> {
  return (await get<string>(id, db().thumbnails)) ?? null;
}

export async function createDraft(name: string, files: ProjectFiles): Promise<Draft> {
  const now = new Date().toISOString();
  const draft: Draft = { id: nanoid(16), name, files, createdAt: now, updatedAt: now };
  await set(draft.id, draft, db().drafts);
  return draft;
}

/**
 * Saves a draft's files in one IndexedDB transaction, and only if the draft still exists: a draft
 * that was moved to the account or deleted (perhaps in another tab) is never brought back.
 * Returns false in that case.
 */
export async function saveDraft(
  id: string,
  patch: { name: string; files: ProjectFiles },
): Promise<boolean> {
  const now = new Date().toISOString();
  return db().drafts("readwrite", (store) => {
    return new Promise<boolean>((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(request.error ?? new Error("The draft couldn't be read."));
      request.onsuccess = () => {
        const current = request.result as Draft | undefined;
        if (current === undefined) {
          resolve(false);
          return;
        }
        store.put(
          { ...current, name: patch.name, files: patch.files, updatedAt: now } satisfies Draft,
          id,
        );
        store.transaction.oncomplete = () => resolve(true);
        store.transaction.onerror = () =>
          reject(store.transaction.error ?? new Error("The draft couldn't be saved."));
      };
    });
  });
}

export async function setDraftThumbnail(id: string, thumbnail: string): Promise<void> {
  await set(id, thumbnail, db().thumbnails);
}

export async function deleteDraft(id: string): Promise<void> {
  await Promise.all([
    del(id, db().drafts),
    del(id, db().thumbnails),
    deleteLocalHistory(id),
    deleteConversation(`local:${id}`),
  ]);
}

export async function duplicateDraft(id: string): Promise<Draft | null> {
  const [draft, thumbnail] = await Promise.all([getDraft(id), getDraftThumbnail(id)]);
  if (draft === null) return null;
  const name = `${draft.name} copy`;
  const copy = await createDraft(name, withName(draft.files, name));
  if (thumbnail !== null) await setDraftThumbnail(copy.id, thumbnail);
  return copy;
}
