import {
  LIBRARIES,
  canonicalIconId,
  libraryNamed,
  libraryRank,
  parseIconId,
  type LibraryId,
} from "@mogram/icons";
import type { Diagram } from "@mogram/core/model";

const CLOUD_LIBRARIES: ReadonlySet<LibraryId> = new Set(
  LIBRARIES.filter((library) => library.cloud).map((library) => library.id),
);

/**
 * The libraries the editor offers for a diagram, in display order. A diagram's `libraries:`
 * setting narrows the list; names it doesn't recognise are ignored, and a setting that names
 * nothing Mogram knows offers everything rather than an empty library.
 */
export function offeredLibraries(setting: readonly string[] | null): LibraryId[] {
  const all = LIBRARIES.map((library) => library.id);
  if (setting === null) return all;
  const named = new Set(setting.map(libraryNamed).filter((id): id is LibraryId => id !== null));
  const offered = all.filter((id) => named.has(id));
  return offered.length > 0 ? offered : all;
}

/** The catalog libraries a diagram's components draw from, most used first. */
export function librariesInUse(diagram: Diagram): LibraryId[] {
  const counts = new Map<LibraryId, number>();
  for (const component of diagram.components.values()) {
    const library = parseIconId(canonicalIconId(component.type))?.library;
    if (library !== undefined) counts.set(library, (counts.get(library) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || libraryRank(a) - libraryRank(b))
    .map(([library]) => library);
}

/**
 * The library the panel opens on: the cloud the diagram is mostly drawn in, so an AWS diagram
 * opens on AWS icons; otherwise the first library offered.
 */
export function defaultLibrary(
  offered: readonly LibraryId[],
  inUse: readonly LibraryId[],
): LibraryId {
  const cloud = inUse.find((id) => CLOUD_LIBRARIES.has(id) && offered.includes(id));
  return cloud ?? offered[0] ?? LIBRARIES[0].id;
}
