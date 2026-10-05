import { diffProjects, diffStats, summarizeDiff } from "@mogram/core/diff";
import type { ProjectFiles } from "@mogram/core/model";

/**
 * Version history rules shared by cloud diagrams (server) and drafts (this browser): when a save
 * joins the version being edited, what each version's change line says, and which old versions
 * are cleaned up.
 */

export type VersionSource = "create" | "save" | "restore" | "ai" | "named" | "import";

/**
 * A save that becomes its own version: an assistant turn (with its prompt), a version given a
 * name, or a restore (with when the version it brought back was made).
 */
export interface Checkpoint {
  readonly source: "ai" | "named" | "restore";
  readonly label?: string;
  readonly name?: string;
  readonly restoredFromAt?: string;
}

export interface VersionChanges {
  readonly line: string;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly moved: number;
}

/** A save joins the version being edited after this long without saving… */
export const SESSION_IDLE_MS = 5 * 60 * 1000;
/** …and no version spans more than this. */
export const SESSION_MAX_MS = 30 * 60 * 1000;

export interface VersionFacts {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string | null;
  readonly source: VersionSource;
  readonly authorId: string | null;
}

/**
 * Whether a save by `authorId` at `now` continues `latest` rather than starting a new version.
 * Only plain saves join: a named version, an assistant turn, a restore, the first version and
 * anything someone else saved each stay as they were, so they can always be gone back to.
 */
export function continuesSession(
  latest: VersionFacts | undefined,
  authorId: string | null,
  now: Date,
): boolean {
  if (latest === undefined) return false;
  if (latest.source !== "save" || latest.name !== null || latest.authorId !== authorId)
    return false;
  return (
    now.getTime() - latest.updatedAt.getTime() < SESSION_IDLE_MS &&
    now.getTime() - latest.createdAt.getTime() < SESSION_MAX_MS
  );
}

/** What changed from `before` to `after`, as stored on a version. */
export function versionChanges(
  before: ProjectFiles | undefined,
  after: ProjectFiles,
): VersionChanges {
  const diff = diffProjects(before ?? {}, after);
  return { line: before === undefined ? "Created" : summarizeDiff(diff), ...diffStats(diff) };
}

export interface RetainedFacts {
  readonly id: string;
  readonly createdAt: Date;
  readonly name: string | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The versions to clean up (ids), newest first in → which go. Kept: every named version, the
 * newest and the oldest, everything from the last 24 hours, the newest of each hour for 30 days,
 * and the newest of each day after that.
 */
export function versionsToPrune(versions: readonly RetainedFacts[], now: Date): string[] {
  const sorted = [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const oldest = sorted.at(-1)?.id;
  const seen = new Set<string>();
  const prune: string[] = [];
  sorted.forEach((version, index) => {
    if (index === 0 || version.id === oldest || version.name !== null) return;
    const age = now.getTime() - version.createdAt.getTime();
    if (age < DAY) return;
    const bucket =
      age < 30 * DAY
        ? `h${Math.floor(version.createdAt.getTime() / HOUR)}`
        : `d${Math.floor(version.createdAt.getTime() / DAY)}`;
    if (seen.has(bucket)) prune.push(version.id);
    else seen.add(bucket);
  });
  return prune;
}

/** Two snapshots hold the same files. */
export function sameFiles(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
