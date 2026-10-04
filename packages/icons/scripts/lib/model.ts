import type { LibraryId } from "../../src/libraries";
import type { IconKind } from "../../src/types";

/** A catalog entry while the build is still filling it in (aliases arrive last). */
export interface DraftEntry {
  readonly library: LibraryId;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly otherCategories: string[];
  readonly aliases: string[];
  readonly kind: IconKind;
  readonly color: string | null;
}

/** One icon produced by a library builder: its catalog entry and its finished SVG text. */
export interface BuiltIcon {
  readonly entry: DraftEntry;
  readonly svg: string;
}

/** `Web App + Database` → `web-app-database`. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
