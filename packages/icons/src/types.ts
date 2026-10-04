import type { LibraryId } from "./libraries";

/**
 * How an icon is drawn. Artwork keeps its own colours (Azure icons, tool logos); a glyph is a
 * monochrome line drawing that takes the theme colour through `currentColor` (generic icons).
 */
export type IconKind = "artwork" | "glyph";

/** One icon in the catalog. The file lives at `assets/<library>/<slug>.svg`. */
export interface IconEntry {
  /** `<library>/<slug>`, e.g. `azure/virtual-machine`. This is what diagram files store. */
  readonly id: string;
  readonly library: LibraryId;
  /** Lowercase words joined by dashes, e.g. `virtual-machine`. */
  readonly slug: string;
  /** Display name, e.g. `Virtual Machine`. */
  readonly name: string;
  /** Where the library panel files the icon, e.g. `Compute`. */
  readonly category: string;
  /**
   * Other categories the vendor also files this icon under (Azure lists Kubernetes Services in
   * both Compute and Containers), so a library panel can show it in each place.
   */
  readonly otherCategories: readonly string[];
  /** Extra lowercase search terms, e.g. `vm` for Virtual Machine (IC-5). */
  readonly aliases: readonly string[];
  readonly kind: IconKind;
  /** Brand colour as `#rrggbb` for tool logos, otherwise null. */
  readonly color: string | null;
}
