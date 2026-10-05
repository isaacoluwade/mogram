import { LIBRARIES, type LibraryId } from "./libraries";
import type { IconEntry } from "./types";

export interface SearchOptions {
  /** Only return icons from this library. */
  readonly library?: LibraryId;
  /** Return at most this many results. */
  readonly limit?: number;
  /**
   * Libraries to rank first among equally good matches, most preferred first: the providers a
   * diagram already uses, so `lb` in an AWS diagram offers AWS's load balancers before Azure's.
   */
  readonly prefer?: readonly LibraryId[];
}

/**
 * How well an icon matches, best first (IC-5). Each query word must match something for the
 * looser tiers, so `sql db` finds SQL Database (alias `db`) but not Azure SQL.
 */
const Tier = {
  /** The whole query equals the name or an alias. */
  Exact: 0,
  /** The name or an alias starts with the whole query. */
  Prefix: 1,
  /** Every query word starts a word of the name or an alias. */
  WordPrefix: 2,
  /** Every query word appears somewhere in the name or an alias. */
  Substring: 3,
  /** The query's letters appear in order in the name (`vmss` → VM Scale Sets). */
  Subsequence: 4,
} as const;

type Tier = (typeof Tier)[keyof typeof Tier];

/** Subsequence matching on one or two letters would match almost everything. */
const MIN_SUBSEQUENCE_LENGTH = 3;

/** An icon's search text, normalised once per catalog. */
interface IndexedIcon {
  readonly entry: IconEntry;
  readonly libraryRank: number;
  /** Normalised name followed by normalised aliases. */
  readonly terms: readonly string[];
  /** The same terms with spaces removed, so `keyvault` matches `Key Vaults`. */
  readonly compactTerms: readonly string[];
  readonly words: readonly string[];
  readonly compactName: string;
}

const indexes = new WeakMap<readonly IconEntry[], readonly IndexedIcon[]>();

/**
 * Searches every library at once (IC-5). Case and punctuation are ignored. Results are ordered
 * by match tier, then preferred libraries, then library order (LIBRARIES), then name. An empty
 * query returns nothing rather than the whole catalog.
 */
export function searchIcons(
  icons: readonly IconEntry[],
  query: string,
  options: SearchOptions = {},
): IconEntry[] {
  const words = normalise(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  if (limit <= 0) return [];

  const prefer = options.prefer ?? [];
  const rankOf = (icon: IndexedIcon): number => {
    const preferred = prefer.indexOf(icon.entry.library);
    return preferred === -1 ? prefer.length + icon.libraryRank : preferred;
  };
  const matches: { readonly icon: IndexedIcon; readonly tier: Tier; readonly rank: number }[] = [];
  for (const icon of indexFor(icons)) {
    if (options.library !== undefined && icon.entry.library !== options.library) continue;
    const tier = matchTier(icon, words);
    if (tier !== null) matches.push({ icon, tier, rank: rankOf(icon) });
  }
  // Nothing has every word: fall back to icons matching some of them, most words first
  // (draw.io's AND → OR), so "postgres cache" still offers both.
  if (matches.length === 0 && words.length > 1) {
    for (const icon of indexFor(icons)) {
      if (options.library !== undefined && icon.entry.library !== options.library) continue;
      const hits = words.filter((word) => matchTier(icon, [word]) !== null).length;
      if (hits > 0)
        matches.push({
          icon,
          tier: (Tier.Subsequence + words.length - hits) as Tier,
          rank: rankOf(icon),
        });
    }
  }
  matches.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.rank - b.rank ||
      compareNames(a.icon.entry.name, b.icon.entry.name) ||
      compareNames(a.icon.entry.id, b.icon.entry.id),
  );
  return matches.slice(0, limit).map((match) => match.icon.entry);
}

/** Lowercase, accents removed, every run of punctuation or spaces turned into one space. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchTier(icon: IndexedIcon, words: readonly string[]): Tier | null {
  const query = words.join(" ");
  const compactQuery = words.join("");
  if (icon.terms.includes(query) || icon.compactTerms.includes(compactQuery)) return Tier.Exact;
  if (
    icon.terms.some((term) => term.startsWith(query)) ||
    icon.compactTerms.some((term) => term.startsWith(compactQuery))
  ) {
    return Tier.Prefix;
  }
  if (words.every((word) => icon.words.some((candidate) => candidate.startsWith(word)))) {
    return Tier.WordPrefix;
  }
  if (words.every((word) => icon.compactTerms.some((term) => term.includes(word)))) {
    return Tier.Substring;
  }
  if (
    compactQuery.length >= MIN_SUBSEQUENCE_LENGTH &&
    isSubsequence(compactQuery, icon.compactName)
  ) {
    return Tier.Subsequence;
  }
  return null;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let found = 0;
  for (const letter of haystack) {
    if (letter === needle[found]) found += 1;
    if (found === needle.length) return true;
  }
  return false;
}

function indexFor(icons: readonly IconEntry[]): readonly IndexedIcon[] {
  const cached = indexes.get(icons);
  if (cached !== undefined) return cached;
  const ranks = new Map<string, number>(LIBRARIES.map((library, rank) => [library.id, rank]));
  const index = icons.map((entry): IndexedIcon => {
    const terms = [entry.name, ...entry.aliases].map(normalise).filter(Boolean);
    return {
      entry,
      libraryRank: ranks.get(entry.library) ?? LIBRARIES.length,
      terms,
      compactTerms: terms.map((term) => term.replace(/ /g, "")),
      words: terms.flatMap((term) => term.split(" ")),
      compactName: normalise(entry.name).replace(/ /g, ""),
    };
  });
  indexes.set(icons, index);
  return index;
}

function compareNames(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
