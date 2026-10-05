import type { ProjectFiles } from "@mogram/core/model";
import type { VersionChanges, VersionSource } from "@/lib/history/rules";

/** One version in the history panel, from the cloud or from this browser. */
export interface VersionItem {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Who made it (their name, or "You" for a draft). */
  readonly author: string | null;
  readonly name: string | null;
  readonly source: VersionSource;
  /** For an assistant turn: the prompt. */
  readonly label: string | null;
  readonly changes: VersionChanges | null;
  readonly restoredFromAt: string | null;
}

/**
 * Where a diagram's versions live: the server for cloud diagrams, IndexedDB for drafts. The
 * history panel works the same with either.
 */
export interface HistorySource {
  /** Identifies the list for caching (changes when the diagram does). */
  readonly key: readonly unknown[];
  list(): Promise<VersionItem[]>;
  files(id: string): Promise<ProjectFiles>;
  /** Names a version, or clears its name (`null`). */
  rename(id: string, name: string | null): Promise<void>;
  /** Names the diagram as it is now. */
  nameCurrent(name: string): Promise<void>;
  /** Makes this version the current one, as a new version on top. */
  restore(id: string): Promise<void>;
  /** Opens a copy of the diagram as it was in this version. */
  copy(id: string): Promise<void>;
}
