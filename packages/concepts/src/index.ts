import { CONCEPT_CATALOG } from "./catalog.generated";
import { TOPIC_LOADERS } from "./loaders.generated";
import type { ConceptCard } from "./types";

export { CONCEPT_CATALOG };
export type { ConceptCard, ConceptPart } from "./types";

/**
 * A concept's file (its `mogram.yaml`), loaded with the others in its topic the first time one
 * is opened; null for an id the catalog doesn't have.
 */
export async function loadConcept(id: string): Promise<string | null> {
  const card = CONCEPT_CATALOG.find((c) => c.id === id);
  const load = card === undefined ? undefined : TOPIC_LOADERS[card.topic];
  if (load === undefined) return null;
  return (await load()).BODIES[id] ?? null;
}

/** What search looks at: a built-in concept's card, or anything shaped like one (yours). */
export interface Searchable {
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly topic: string | null;
  readonly platform: string;
  readonly kind: ConceptCard["kind"];
}

export interface ConceptQuery {
  /** Words to find, in the title, summary, tags or topic. */
  readonly text?: string;
  readonly topic?: ConceptCard["topic"];
  /** A platform's concepts, and the ones for any platform. */
  readonly platform?: ConceptCard["platform"];
  readonly kind?: ConceptCard["kind"];
}

/** Whether a concept is for a platform: its own, or any. */
export const forPlatform = (card: { readonly platform: string }, platform: string): boolean =>
  card.platform === "any" || card.platform === platform;

/**
 * Concepts matching a query, best first: every word must appear somewhere; a match in the title
 * counts most, then tags, then the summary.
 */
export function findConcepts<T extends Searchable>(cards: readonly T[], query: ConceptQuery): T[] {
  const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { card: T; score: number }[] = [];
  for (const card of cards) {
    if (query.topic !== undefined && card.topic !== query.topic) continue;
    if (query.platform !== undefined && !forPlatform(card, query.platform)) continue;
    if (query.kind !== undefined && card.kind !== query.kind) continue;
    const title = card.title.toLowerCase();
    const tags = card.tags.join(" ");
    const rest = `${card.summary} ${card.topic ?? ""} ${card.platform}`.toLowerCase();
    let score = 0;
    let all = true;
    for (const word of words) {
      if (title.includes(word)) score += title.startsWith(word) ? 6 : 4;
      else if (tags.includes(word)) score += 3;
      else if (rest.includes(word)) score += 1;
      else all = false;
    }
    if (all) scored.push({ card, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.card.title.localeCompare(b.card.title))
    .map((s) => s.card);
}
