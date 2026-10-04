/**
 * @mogram/icons — library metadata, aliases and search. The full list of icons is a separate
 * entry point (`@mogram/icons/catalog`) so the app can load it lazily; pass it to the helpers
 * here. SVG files are at `@mogram/icons/assets/<library>/<slug>.svg`.
 */
export type { IconEntry, IconKind } from "./types";
export { LIBRARIES, isLibraryId, libraryNamed, libraryRank } from "./libraries";
export type { LibraryId, LibraryInfo } from "./libraries";
export { ICON_ALIASES } from "./aliases";
export { normalise, searchIcons } from "./search";
export type { SearchOptions } from "./search";
export {
  ICON_SLUG_PATTERN,
  iconById,
  iconKind,
  iconUrl,
  isCatalogIcon,
  parseIconId,
} from "./lookup";
export type { CatalogIconId } from "./lookup";
export { SHORT_ICON_IDS, canonicalIconId } from "./short-ids";
