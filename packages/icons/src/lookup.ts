import { GLYPH_SLUGS, ICON_SLUGS } from "./ids.generated";
import { isLibraryId, type LibraryId } from "./libraries";
import { canonicalIconId } from "./short-ids";
import type { IconEntry, IconKind } from "./types";

/** Lowercase words joined by single dashes, the only shape a catalog slug takes. */
export const ICON_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CatalogIconId {
  readonly library: LibraryId;
  readonly slug: string;
}

/**
 * Splits a catalog id such as `azure/virtual-machine`. Anything else, including a project path
 * like `icons/my.svg` (IC-4), returns null.
 */
export function parseIconId(id: string): CatalogIconId | null {
  const [library, slug, ...rest] = id.split("/");
  if (library === undefined || slug === undefined || rest.length > 0) return null;
  if (!isLibraryId(library) || !ICON_SLUG_PATTERN.test(slug)) return null;
  return { library, slug };
}

type SlugSets = ReadonlyMap<LibraryId, ReadonlySet<string>>;

let known: SlugSets | null = null;
let glyphs: SlugSets | null = null;

function slugSets(table: Readonly<Record<LibraryId, string>>): SlugSets {
  return new Map(
    Object.entries(table).map(([library, slugs]) => [
      library as LibraryId,
      new Set(slugs.split(" ").filter(Boolean)),
    ]),
  );
}

/** Whether the catalog has this icon (after short-id resolution), without loading the catalog. */
export function isCatalogIcon(id: string): boolean {
  const parsed = parseIconId(canonicalIconId(id));
  if (parsed === null) return false;
  known ??= slugSets(ICON_SLUGS);
  return known.get(parsed.library)?.has(parsed.slug) === true;
}

/**
 * How a catalog icon is drawn (after short-id resolution), without loading the catalog: a glyph
 * takes the canvas text colour, artwork keeps its own. Null for anything not in the catalog.
 */
export function iconKind(id: string): IconKind | null {
  const canonical = canonicalIconId(id);
  const parsed = parseIconId(canonical);
  if (parsed === null || !isCatalogIcon(canonical)) return null;
  glyphs ??= slugSets(GLYPH_SLUGS);
  return glyphs.get(parsed.library)?.has(parsed.slug) === true ? "glyph" : "artwork";
}

/**
 * Where the app serves a catalog icon: `/icons/<library>/<slug>.svg`, the folder
 * `scripts/sync-assets.mjs` copies the assets into. Null for anything the catalog doesn't have
 * (project icons are resolved by the app), so a half-typed id never becomes a request.
 */
export function iconUrl(id: string): string | null {
  const canonical = canonicalIconId(id);
  if (!isCatalogIcon(canonical)) return null;
  const parsed = parseIconId(canonical);
  return parsed === null ? null : `/icons/${parsed.library}/${parsed.slug}.svg`;
}

const byIdCache = new WeakMap<readonly IconEntry[], ReadonlyMap<string, IconEntry>>();

/** Finds an icon by id. The lookup map is built once per catalog array and reused. */
export function iconById(icons: readonly IconEntry[], id: string): IconEntry | undefined {
  let byId = byIdCache.get(icons);
  if (byId === undefined) {
    byId = new Map(icons.map((icon) => [icon.id, icon]));
    byIdCache.set(icons, byId);
  }
  return byId.get(canonicalIconId(id));
}
