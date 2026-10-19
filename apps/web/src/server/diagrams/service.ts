import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { conceptInfo } from "@mogram/core/concepts";
import { deckInfo, projectAbout, type ProjectAbout } from "@mogram/core/deck";
import { setSetting } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import { DiagramLoader } from "@mogram/core/nested";
import type {
  DiagramDetail,
  DiagramSummary,
  RevisionSummary,
  SharedDiagram,
  Visibility,
} from "@/lib/api/contracts";
import {
  continuesSession,
  versionChanges,
  versionsToPrune,
  type VersionSource,
} from "@/lib/history/rules";
import { getDb, type Database } from "../db/client";
import { diagram, revision, user, type StoredFiles } from "../db/schema";
import { isThumbnailDataUrl, sanitizeProjectFiles } from "./sanitize";
import { ownedAssetMetadata, recordAssetUses } from "../assets/service";

/**
 * Cloud diagrams (AC-3, AC-4). Every query is scoped to the owner, so a private diagram is
 * invisible to everyone else — routes answer 404, never 403, so existence never leaks (AC-5).
 */

/**
 * Saves join the version being edited while the same person keeps working (see
 * `lib/history/rules`); the first version (as created, duplicated or imported) is never merged
 * into, so it can always be restored.
 */
const FIRST_VERSION = 1;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Cleans up old versions by the retention rules (named ones always stay). */
async function pruneRevisions(tx: Tx, diagramId: string, now: Date): Promise<void> {
  const rows = await tx
    .select({ id: revision.id, createdAt: revision.createdAt, name: revision.name })
    .from(revision)
    .where(eq(revision.diagramId, diagramId));
  const doomed = versionsToPrune(rows, now);
  if (doomed.length > 0) await tx.delete(revision).where(inArray(revision.id, doomed));
}

const sameFiles = (a: StoredFiles, b: StoredFiles): boolean => {
  const keys = Object.keys(a).sort();
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

export type ServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: "not_found" | "conflict" | "invalid";
      readonly message: string;
      readonly currentVersion?: number;
    };

const ok = <T>(value: T): ServiceResult<T> => ({ ok: true, value });
const notFound = <T>(): ServiceResult<T> => ({
  ok: false,
  code: "not_found",
  message: "Diagram not found.",
});

type DiagramRow = typeof diagram.$inferSelect;

function toSummary(row: DiagramRow): DiagramSummary {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    visibility: row.visibility,
    thumbnail: row.thumbnail,
    concept: conceptOf(row.files),
    deck: deckOf(row.files),
    about: aboutOf(row.files),
  };
}

/** What the diagram is and how far along, for its card. A project that can't be read is empty. */
function aboutOf(files: StoredFiles): ProjectAbout {
  try {
    return projectAbout(files, new DiagramLoader(files));
  } catch {
    return { kind: "diagram", slides: 0, scenes: 0, beats: 0, scripted: 0, recorded: 0 };
  }
}

/** Whether the diagram is a concept (D-83), read from its files as they're listed. */
function conceptOf(files: StoredFiles): DiagramSummary["concept"] {
  const info = conceptInfo(files);
  if (info === null) return null;
  const { summary, topic, platform, tags, kind } = info;
  return { summary, topic, platform, tags, kind };
}

function deckOf(files: StoredFiles): DiagramSummary["deck"] {
  const info = deckInfo(files, new DiagramLoader(files));
  return info === null ? null : { slides: info.slides };
}

function toDetail(row: DiagramRow): DiagramDetail {
  return {
    ...toSummary(row),
    files: row.files,
    version: row.version,
    shareId: row.shareId,
    allowViewerState: row.allowViewerState,
  };
}

/** 128-bit random, URL-safe — not guessable, not derived from the diagram id. */
function newShareId(): string {
  return randomBytes(16).toString("base64url");
}

/** Thumbnails are small raster previews rendered in the browser; anything else is dropped. */
function cleanThumbnail(thumbnail: string | null | undefined): string | null | undefined {
  if (thumbnail === undefined || thumbnail === null) return thumbnail;
  return isThumbnailDataUrl(thumbnail) ? thumbnail : null;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function ownedRow(ownerId: string, id: string): Promise<DiagramRow | null> {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(diagram)
    .where(and(eq(diagram.id, id), eq(diagram.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDiagrams(ownerId: string): Promise<DiagramSummary[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(diagram)
    .where(eq(diagram.ownerId, ownerId))
    .orderBy(desc(diagram.updatedAt))
    .limit(500);
  return rows.map(toSummary);
}

export async function getDiagram(ownerId: string, id: string): Promise<DiagramDetail | null> {
  const row = await ownedRow(ownerId, id);
  return row === null ? null : toDetail(row);
}

export async function createDiagram(
  ownerId: string,
  input: {
    name: string;
    files: StoredFiles;
    thumbnail?: string | null | undefined;
    /** "import" when a draft or file is brought in; "create" otherwise. */
    source?: VersionSource | undefined;
  },
): Promise<ServiceResult<DiagramDetail>> {
  const cleaned = sanitizeProjectFiles(input.files, await ownedAssetMetadata(ownerId, input.files));
  if ("error" in cleaned) return { ok: false, code: "invalid", message: cleaned.error };
  const db = await getDb();
  // The diagram and its first revision exist together or not at all.
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(diagram)
      .values({
        ownerId,
        name: input.name,
        files: cleaned.files,
        thumbnail: cleanThumbnail(input.thumbnail) ?? null,
      })
      .returning();
    if (inserted === undefined) throw new Error("Insert returned no row");
    await recordAssetUses(tx, ownerId, inserted.id, inserted.files);
    await tx.insert(revision).values({
      diagramId: inserted.id,
      authorId: ownerId,
      files: inserted.files,
      version: inserted.version,
      source: input.source ?? "create",
      changes: versionChanges(undefined, inserted.files),
    });
    return inserted;
  });
  return ok(toDetail(row));
}

/**
 * Saves a new working copy. `baseVersion` must match the stored version; otherwise another tab
 * or device saved first and the caller gets a conflict instead of silently overwriting it.
 */
export async function saveDiagram(
  ownerId: string,
  id: string,
  input: {
    files: StoredFiles;
    baseVersion: number;
    name?: string | undefined;
    thumbnail?: string | null | undefined;
    /** Make this save its own version: an assistant turn, or one given a name. */
    checkpoint?:
      | {
          readonly source: "ai" | "named";
          readonly label?: string | undefined;
          readonly name?: string | undefined;
        }
      | undefined;
  },
): Promise<ServiceResult<{ version: number; updatedAt: string }>> {
  const cleaned = sanitizeProjectFiles(input.files, await ownedAssetMetadata(ownerId, input.files));
  if ("error" in cleaned) return { ok: false, code: "invalid", message: cleaned.error };
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(diagram)
      .where(and(eq(diagram.id, id), eq(diagram.ownerId, ownerId)))
      .limit(1)
      .for("update");
    if (current === undefined) return notFound<{ version: number; updatedAt: string }>();
    if (current.version !== input.baseVersion) {
      return {
        ok: false as const,
        code: "conflict" as const,
        message: "This diagram was changed somewhere else since you opened it.",
        currentVersion: current.version,
      };
    }
    const now = new Date();
    const thumbnail = cleanThumbnail(input.thumbnail);
    const [updated] = await tx
      .update(diagram)
      .set({
        files: cleaned.files,
        version: current.version + 1,
        updatedAt: now,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(thumbnail !== undefined ? { thumbnail } : {}),
      })
      .where(eq(diagram.id, id))
      .returning();
    if (updated === undefined) throw new Error("Update returned no row");
    await recordAssetUses(tx, ownerId, id, cleaned.files);

    const [latest, previous] = await tx
      .select()
      .from(revision)
      .where(eq(revision.diagramId, id))
      .orderBy(desc(revision.createdAt))
      .limit(2);
    const joins =
      input.checkpoint === undefined &&
      latest !== undefined &&
      latest.version !== FIRST_VERSION &&
      continuesSession({ ...latest, source: latest.source as VersionSource }, ownerId, now);
    if (joins && latest !== undefined) {
      await tx
        .update(revision)
        .set({
          files: cleaned.files,
          version: updated.version,
          updatedAt: now,
          changes: versionChanges(previous?.files, cleaned.files),
        })
        .where(eq(revision.id, latest.id));
    } else {
      await tx.insert(revision).values({
        diagramId: id,
        authorId: ownerId,
        files: cleaned.files,
        version: updated.version,
        source: input.checkpoint?.source ?? "save",
        label: input.checkpoint?.label?.slice(0, 500) ?? null,
        name: input.checkpoint?.name?.slice(0, 120) ?? null,
        changes: versionChanges(latest?.files, cleaned.files),
        createdAt: now,
        updatedAt: now,
      });
      await pruneRevisions(tx, id, now);
    }
    return ok({ version: updated.version, updatedAt: updated.updatedAt.toISOString() });
  });
}

/**
 * Renames (the YAML `name:` changes too, so the editor and dashboard agree, and that is a new
 * version) and/or replaces the dashboard thumbnail (metadata only, no new version).
 */
export async function updateDiagram(
  ownerId: string,
  id: string,
  input: { name?: string | undefined; thumbnail?: string | null | undefined },
): Promise<ServiceResult<DiagramSummary>> {
  if ((await ownedRow(ownerId, id)) === null) return notFound();
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(diagram)
      .where(eq(diagram.id, id))
      .limit(1)
      .for("update");
    if (current === undefined) return notFound<DiagramSummary>();
    const thumbnail = cleanThumbnail(input.thumbnail);
    if (input.name === undefined || input.name === current.name) {
      if (thumbnail === undefined) return ok(toSummary(current));
      const [row] = await tx
        .update(diagram)
        .set({ thumbnail })
        .where(eq(diagram.id, id))
        .returning();
      return row === undefined ? notFound<DiagramSummary>() : ok(toSummary(row));
    }
    const { diagram: parsed } = parseDiagram(current.files, "");
    const files =
      parsed.files.length === 0
        ? current.files
        : setSetting(current.files, parsed, { key: "name", value: input.name }).files;
    const [row] = await tx
      .update(diagram)
      .set({
        name: input.name,
        files,
        version: current.version + 1,
        updatedAt: new Date(),
        ...(thumbnail !== undefined ? { thumbnail } : {}),
      })
      .where(eq(diagram.id, id))
      .returning();
    if (row === undefined) return notFound<DiagramSummary>();
    await tx.insert(revision).values({
      diagramId: id,
      authorId: ownerId,
      files: row.files,
      version: row.version,
      changes: versionChanges(current.files, row.files),
    });
    return ok(toSummary(row));
  });
}

export async function deleteDiagram(ownerId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const db = await getDb();
  const rows = await db
    .delete(diagram)
    .where(and(eq(diagram.id, id), eq(diagram.ownerId, ownerId)))
    .returning({ id: diagram.id });
  return rows.length > 0;
}

/** A copy of the diagram as it is now, or as it was at `revisionId`. */
export async function duplicateDiagram(
  ownerId: string,
  id: string,
  revisionId?: string | undefined,
): Promise<ServiceResult<DiagramDetail>> {
  const row = await ownedRow(ownerId, id);
  if (row === null) return notFound();
  const source =
    revisionId === undefined ? row.files : await getRevisionFiles(ownerId, id, revisionId);
  if (source === null) return notFound();
  const name = `${row.name} copy`.slice(0, 120);
  const { diagram: parsed } = parseDiagram(source, "");
  const files =
    parsed.files.length === 0
      ? source
      : setSetting(source, parsed, { key: "name", value: name }).files;
  return createDiagram(ownerId, {
    name,
    files,
    thumbnail: revisionId === undefined ? row.thumbnail : null,
  });
}

export async function updateShareSettings(
  ownerId: string,
  id: string,
  input: {
    visibility: Visibility;
    allowViewerState: boolean;
    regenerateLink?: boolean | undefined;
  },
): Promise<ServiceResult<DiagramDetail>> {
  const row = await ownedRow(ownerId, id);
  if (row === null) return notFound();
  const needsId =
    input.visibility === "link" && (row.shareId === null || input.regenerateLink === true);
  const db = await getDb();
  const [updated] = await db
    .update(diagram)
    .set({
      visibility: input.visibility,
      allowViewerState: input.allowViewerState,
      ...(needsId ? { shareId: newShareId() } : {}),
    })
    .where(eq(diagram.id, id))
    .returning();
  return updated === undefined ? notFound() : ok(toDetail(updated));
}

/** The latest saved version behind a share link (SH-5); private diagrams are not found. */
export async function getSharedDiagram(shareId: string): Promise<SharedDiagram | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(shareId)) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(diagram)
    .where(and(eq(diagram.shareId, shareId), eq(diagram.visibility, "link")))
    .limit(1);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    name: row.name,
    files: row.files,
    allowViewerState: row.allowViewerState,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRevisions(
  ownerId: string,
  id: string,
): Promise<RevisionSummary[] | null> {
  if ((await ownedRow(ownerId, id)) === null) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: revision.id,
      version: revision.version,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
      authorName: user.name,
      authorEmail: user.email,
      name: revision.name,
      source: revision.source,
      label: revision.label,
      changes: revision.changes,
      restoredFromAt: revision.restoredFromAt,
    })
    .from(revision)
    .leftJoin(user, eq(user.id, revision.authorId))
    .where(eq(revision.diagramId, id))
    .orderBy(desc(revision.createdAt))
    .limit(500);
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Accounts made by email alone have an empty name.
    author: row.authorName?.trim() || row.authorEmail,
    name: row.name,
    source: row.source as VersionSource,
    label: row.label,
    changes: row.changes,
    restoredFromAt: row.restoredFromAt?.toISOString() ?? null,
  }));
}

/** Names a version (or clears its name); named versions are never cleaned up. */
export async function renameRevision(
  ownerId: string,
  id: string,
  revisionId: string,
  name: string | null,
): Promise<boolean> {
  if ((await ownedRow(ownerId, id)) === null || !isUuid(revisionId)) return false;
  const db = await getDb();
  const rows = await db
    .update(revision)
    .set({ name: name === null || name.trim() === "" ? null : name.trim().slice(0, 120) })
    .where(and(eq(revision.id, revisionId), eq(revision.diagramId, id)))
    .returning({ id: revision.id });
  return rows.length > 0;
}

/**
 * Names the diagram as it is now: the latest version gets the name if it already holds these
 * files, otherwise a new named version is made.
 */
export async function checkpointDiagram(
  ownerId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const current = await ownedRow(ownerId, id);
  if (current === null) return false;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [latest] = await tx
      .select()
      .from(revision)
      .where(eq(revision.diagramId, id))
      .orderBy(desc(revision.createdAt))
      .limit(1);
    const clean = name.trim().slice(0, 120);
    if (latest !== undefined && sameFiles(latest.files, current.files)) {
      await tx.update(revision).set({ name: clean }).where(eq(revision.id, latest.id));
      return;
    }
    const now = new Date();
    await tx.insert(revision).values({
      diagramId: id,
      authorId: ownerId,
      files: current.files,
      version: current.version,
      source: "named",
      name: clean,
      changes: versionChanges(latest?.files, current.files),
      createdAt: now,
      updatedAt: now,
    });
  });
  return true;
}

export async function getRevisionFiles(
  ownerId: string,
  id: string,
  revisionId: string,
): Promise<StoredFiles | null> {
  if ((await ownedRow(ownerId, id)) === null || !isUuid(revisionId)) return null;
  const db = await getDb();
  const rows = await db
    .select({ files: revision.files })
    .from(revision)
    .where(and(eq(revision.id, revisionId), eq(revision.diagramId, id)))
    .limit(1);
  return rows[0]?.files ?? null;
}

/** Restoring never deletes history: it saves the old files as a new version. */
export async function restoreRevision(
  ownerId: string,
  id: string,
  revisionId: string,
): Promise<ServiceResult<{ version: number; updatedAt: string }>> {
  const current = await ownedRow(ownerId, id);
  const files = await getRevisionFiles(ownerId, id, revisionId);
  if (current === null || files === null) return notFound();
  const db = await getDb();
  const now = new Date();
  // The name lives in the YAML too (renames write it there), so it comes back with the files.
  const { diagram: parsed } = parseDiagram(files, "");
  const name = parsed.files.length === 0 ? current.name : parsed.settings.name.slice(0, 120);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(diagram)
      .set({ files, name, version: sql`${diagram.version} + 1`, updatedAt: now })
      .where(and(eq(diagram.id, id), eq(diagram.ownerId, ownerId)))
      .returning();
    if (row === undefined) return null;
    const [source] = await tx
      .select({ createdAt: revision.createdAt })
      .from(revision)
      .where(eq(revision.id, revisionId))
      .limit(1);
    await tx.insert(revision).values({
      diagramId: id,
      authorId: ownerId,
      files,
      version: row.version,
      source: "restore",
      restoredFromAt: source?.createdAt ?? null,
      changes: versionChanges(current.files, files),
      createdAt: now,
      updatedAt: now,
    });
    await pruneRevisions(tx, id, now);
    return row;
  });
  if (updated === null) return notFound();
  return ok({ version: updated.version, updatedAt: updated.updatedAt.toISOString() });
}

/**
 * A draft's earlier versions, uploaded with it (oldest first): kept as they were made, older
 * than the version the upload created, and cleaned up by the usual rules.
 */
export async function importRevisions(
  ownerId: string,
  id: string,
  versions: readonly {
    readonly files: StoredFiles;
    readonly createdAt: string;
    readonly name: string | null;
    readonly source: VersionSource;
    readonly label: string | null;
    readonly restoredFromAt: string | null;
  }[],
): Promise<ServiceResult<{ imported: number }>> {
  const current = await ownedRow(ownerId, id);
  if (current === null) return notFound();
  const now = new Date();
  const rows: (typeof revision.$inferInsert)[] = [];
  let previous: StoredFiles | undefined;
  for (const version of versions) {
    const cleaned = sanitizeProjectFiles(
      version.files,
      await ownedAssetMetadata(ownerId, version.files),
    );
    if ("error" in cleaned) return { ok: false, code: "invalid", message: cleaned.error };
    const createdAt = new Date(version.createdAt);
    // Only the past: an upload can't put versions after the ones made since.
    if (createdAt.getTime() > now.getTime()) continue;
    rows.push({
      diagramId: id,
      authorId: ownerId,
      files: cleaned.files,
      version: 0,
      createdAt,
      updatedAt: createdAt,
      name: version.name,
      source: version.source,
      label: version.label,
      restoredFromAt: version.restoredFromAt === null ? null : new Date(version.restoredFromAt),
      changes: versionChanges(previous, cleaned.files),
    });
    previous = cleaned.files;
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (rows.length > 0) await tx.insert(revision).values(rows);
    for (const row of rows) await recordAssetUses(tx, ownerId, id, row.files);
    await pruneRevisions(tx, id, now);
  });
  return ok({ imported: rows.length });
}
