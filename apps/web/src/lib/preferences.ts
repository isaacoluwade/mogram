"use client";

import { useSyncExternalStore } from "react";

/**
 * Personal UI preferences (07-document-workflow §18 P2-21): one versioned, typed object in this
 * browser's storage, shared live between tabs. Never part of a diagram's files. Storage can be
 * unavailable (private windows, blocked site data): reads then return the defaults and writes
 * quietly do nothing, since none of this is needed for the app to work.
 */
export interface Preferences {
  readonly version: 1;
  /** Inspector sections open or folded, by `kind:section`. */
  readonly inspectorSections: Readonly<Record<string, boolean>>;
  /** The last inspector tab, by mode ("element", "diagram"). */
  readonly inspectorTabs: Readonly<Record<string, string>>;
  /** The inspector's width in px, when it's been resized. */
  readonly rightPanelWidth: number | null;
  /** Library sections open; null until one is toggled (the defaults apply). */
  readonly libraryOpen: readonly string[] | null;
  /** Icons added most recently, newest first. */
  readonly libraryRecent: readonly string[];
  /** The library's Basics tab last shown. */
  readonly libraryTab: LibraryTab;
  /** Commands run from the palette most recently, newest first. */
  readonly paletteRecent: readonly string[];
  /** Concepts used most recently (applied, inserted or opened), newest first. */
  readonly conceptRecent: readonly string[];
  /** The editor's grid is shown (it is by default: everything snaps to it either way). */
  readonly showGrid: boolean;
  /** How the grid is drawn. */
  readonly gridStyle: GridStyle;
  /** What an earlier version shows changes against (version history, Show changes). */
  readonly historyChanges: HistoryChanges;
  /** Diagrams pinned to the top of the home page, as `draft:<id>` or `cloud:<id>`. */
  readonly homePinned: readonly string[];
  /** The home page's list of everything: as cards or rows, and in what order. */
  readonly homeView: HomeView;
  readonly homeSort: HomeSort;
}

export type HomeView = "grid" | "list";
export type HomeSort = "recent" | "name";

/** The library's Basics tabs. */
export type LibraryTab = "shapes" | "containers" | "notes" | "generic";
const LIBRARY_TABS: readonly LibraryTab[] = ["shapes", "containers", "notes", "generic"];

/** How the editor grid is drawn (features/canvas/grid). */
export type GridStyle = "dots" | "lines";

/** Show changes in version history: off, against the version before, or against now. */
export type HistoryChanges = "off" | "previous" | "current";
const HISTORY_CHANGES: readonly HistoryChanges[] = ["off", "previous", "current"];

const KEY = "mogram.preferences";

const DEFAULTS: Preferences = {
  version: 1,
  inspectorSections: {},
  inspectorTabs: {},
  rightPanelWidth: null,
  libraryOpen: null,
  libraryRecent: [],
  libraryTab: "shapes",
  paletteRecent: [],
  conceptRecent: [],
  showGrid: true,
  gridStyle: "dots",
  historyChanges: "previous",
  homePinned: [],
  homeView: "grid",
  homeSort: "recent",
};

const strings = (value: unknown): string[] | null =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : null;

const record = <T>(value: unknown, keep: (v: unknown) => v is T): Record<string, T> =>
  typeof value === "object" && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, T] => keep(entry[1])),
      )
    : {};

/** Whatever is stored, made safe: unknown keys dropped, wrong types replaced by defaults. */
function sanitise(value: unknown): Preferences {
  if (typeof value !== "object" || value === null) return DEFAULTS;
  const v = value as Record<string, unknown>;
  const width = v.rightPanelWidth;
  return {
    version: 1,
    inspectorSections: record(v.inspectorSections, (x): x is boolean => typeof x === "boolean"),
    inspectorTabs: record(v.inspectorTabs, (x): x is string => typeof x === "string"),
    rightPanelWidth: typeof width === "number" && Number.isFinite(width) ? width : null,
    libraryOpen: strings(v.libraryOpen),
    libraryRecent: strings(v.libraryRecent) ?? [],
    libraryTab: LIBRARY_TABS.find((tab) => tab === v.libraryTab) ?? "shapes",
    paletteRecent: strings(v.paletteRecent) ?? [],
    conceptRecent: strings(v.conceptRecent) ?? [],
    showGrid: typeof v.showGrid === "boolean" ? v.showGrid : DEFAULTS.showGrid,
    gridStyle: v.gridStyle === "lines" ? "lines" : "dots",
    historyChanges:
      HISTORY_CHANGES.find((mode) => mode === v.historyChanges) ?? DEFAULTS.historyChanges,
    homePinned: (strings(v.homePinned) ?? []).slice(0, 200),
    homeView: v.homeView === "list" ? "list" : "grid",
    homeSort: v.homeSort === "name" ? "name" : "recent",
  };
}

/** The keys used before there was one preferences object, read once and folded in. */
function migrate(storage: Storage): Preferences {
  const json = (key: string): unknown => {
    try {
      return JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  };
  const tabs: Record<string, string> = {};
  for (const mode of ["element", "diagram"]) {
    const tab = storage.getItem(`mogram.inspector.tab.${mode}`);
    if (tab !== null) tabs[mode] = tab;
  }
  const width = Number(storage.getItem("mogram.panel.right"));
  return sanitise({
    inspectorSections: json("mogram.inspector.sections"),
    inspectorTabs: tabs,
    rightPanelWidth: Number.isFinite(width) && width > 0 ? width : null,
    libraryOpen: json("mogram.library.open"),
    libraryRecent: json("mogram.library.recent"),
    paletteRecent: json("mogram.palette.recent"),
  });
}

let cache: Preferences | null = null;
const listeners = new Set<() => void>();

export function readPreferences(): Preferences {
  if (cache !== null) return cache;
  try {
    const stored = window.localStorage.getItem(KEY);
    cache = stored === null ? migrate(window.localStorage) : sanitise(JSON.parse(stored));
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function preference<K extends keyof Preferences>(key: K): Preferences[K] {
  return typeof window === "undefined" ? DEFAULTS[key] : readPreferences()[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  cache = { ...readPreferences(), [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Unavailable storage: the preference holds for this tab only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed them: read again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** A preference that re-renders when it changes, here or in another tab. */
export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return useSyncExternalStore(
    subscribe,
    () => readPreferences()[key],
    () => DEFAULTS[key],
  );
}

/** For tests: forget what was read. */
export function resetPreferencesCache(): void {
  cache = null;
}
