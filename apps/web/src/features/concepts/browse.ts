import { findConcepts } from "@mogram/concepts";
import {
  CONCEPT_TOPICS,
  type Cloud,
  type ConceptPlatform,
  type ConceptTopic,
} from "@mogram/core/presets";
import type { ConceptEntry } from "./catalog";

/**
 * Finding concepts among hundreds (D-85): by words, by platform (a platform's own and the general
 * ones), by topic, and by kind. Pure, so the Concepts tab and the gallery agree, and tests can
 * check it.
 */

/** "all" shows every platform's concepts; a platform shows its own and the general ones. */
export type PlatformFilter = "all" | Exclude<ConceptPlatform, "any">;

export const PLATFORM_FILTERS: readonly {
  readonly value: PlatformFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "All platforms" },
  { value: "azure", label: "Azure" },
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "Google Cloud" },
  { value: "kubernetes", label: "Kubernetes" },
];

/** Opens on the diagram's cloud, like the icons do. */
export function defaultPlatform(cloud: Cloud | null): PlatformFilter {
  return cloud === "azure" || cloud === "aws" || cloud === "gcp" ? cloud : "all";
}

/**
 * The platforms worth filtering by: the ones with concepts of their own, with how many. Empty
 * when every concept is general — then a platform filter would change nothing, so none is shown.
 */
export function platformChoices(
  entries: readonly ConceptEntry[],
): { readonly value: PlatformFilter; readonly label: string }[] {
  const own = PLATFORM_FILTERS.filter((p) => p.value !== "all")
    .map((p) => ({ ...p, count: entries.filter((e) => e.platform === p.value).length }))
    .filter((p) => p.count > 0);
  if (own.length === 0) return [];
  return [
    { value: "all", label: "All platforms" },
    ...own.map((p) => ({ value: p.value, label: `${p.label} (${p.count})` })),
  ];
}

/** The platform asked for, if it's one of the choices; otherwise all of them. */
export function choosePlatform(
  choices: readonly { readonly value: PlatformFilter }[],
  wanted: PlatformFilter,
): PlatformFilter {
  return choices.some((c) => c.value === wanted) ? wanted : "all";
}

/** Whether there's more than one kind to choose between (patterns and explainers). */
export function bothKinds(entries: readonly ConceptEntry[]): boolean {
  return entries.some((e) => e.kind === "pattern") && entries.some((e) => e.kind === "explainer");
}

/** A topic, or one of the lists of your own and the ones you've used lately. */
export type Shelf = ConceptTopic | "yours" | "recent" | "other";

export interface ConceptFilter {
  readonly text: string;
  readonly platform: PlatformFilter;
  readonly shelf: Shelf | null;
  readonly kind: "all" | "pattern" | "explainer";
}

export function filterConcepts(
  entries: readonly ConceptEntry[],
  filter: ConceptFilter,
  recent: readonly string[] = [],
): ConceptEntry[] {
  let pool = entries.filter((e) => (filter.kind === "all" ? true : e.kind === filter.kind));
  if (filter.platform !== "all")
    pool = pool.filter((e) => e.platform === "any" || e.platform === filter.platform);
  const shelf = filter.shelf;
  if (shelf === "yours") pool = pool.filter((e) => e.source !== "builtin");
  else if (shelf === "recent") pool = recent.flatMap((key) => pool.filter((e) => e.key === key));
  else if (shelf === "other") pool = pool.filter((e) => e.topic === null);
  else if (shelf !== null) pool = pool.filter((e) => e.topic === shelf);
  if (filter.text.trim() !== "") return findConcepts(pool, { text: filter.text });
  if (shelf === "recent") return pool;
  // A platform's own concepts first, then the general ones.
  const own = (e: ConceptEntry) => (e.platform === filter.platform ? 0 : 1);
  return [...pool].sort((a, b) => own(a) - own(b) || a.title.localeCompare(b.title));
}

/** Topics that have concepts (with how many), in their usual order, then "other". */
export function topicShelves(
  entries: readonly ConceptEntry[],
  platform: PlatformFilter,
): { readonly shelf: ConceptTopic | "other"; readonly label: string; readonly count: number }[] {
  const shown = filterConcepts(entries, { text: "", platform, shelf: null, kind: "all" });
  const out: { shelf: ConceptTopic | "other"; label: string; count: number }[] = [];
  for (const topic of CONCEPT_TOPICS) {
    const count = shown.filter((e) => e.topic === topic.id).length;
    if (count > 0) out.push({ shelf: topic.id, label: topic.label, count });
  }
  const other = shown.filter((e) => e.topic === null).length;
  if (other > 0) out.push({ shelf: "other", label: "Other", count: other });
  return out;
}

export function shelfLabel(shelf: Shelf): string {
  if (shelf === "yours") return "Yours";
  if (shelf === "recent") return "Recently used";
  if (shelf === "other") return "Other";
  return CONCEPT_TOPICS.find((t) => t.id === shelf)?.label ?? shelf;
}

/** Concepts' files, loaded once whether a preview or the concept window asks first. */
const loaded = new Map<string, Promise<Readonly<Record<string, string>>>>();

export function loadEntry(entry: ConceptEntry): Promise<Readonly<Record<string, string>>> {
  let files = loaded.get(entry.key);
  if (files === undefined) {
    files = entry.load();
    loaded.set(entry.key, files);
    // A failed load (offline) can be tried again.
    files.catch(() => loaded.delete(entry.key));
  }
  return files;
}

/** Tags as typed, comma separated: "DNS, failover , dns" → ["dns", "failover"]. */
export const parseTags = (text: string): string[] => [
  ...new Set(
    text
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  ),
];
