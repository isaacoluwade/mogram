/**
 * The icon libraries Mogram ships, in display order (IC-1, IC-2, IC-3, IC-7).
 *
 * This table is the only place a library is declared: `LibraryId`, search tie-breaking, the
 * library panel's filters and icon URLs all derive from it, so a new library is a new row plus
 * its builder in `scripts/build-catalog.ts`.
 */
export const LIBRARIES = [
  {
    id: "azure",
    name: "Azure",
    shortName: "Azure",
    cloud: true,
    description: "Official Microsoft Azure architecture icons.",
  },
  {
    id: "aws",
    name: "AWS",
    shortName: "AWS",
    cloud: true,
    description: "Official AWS architecture icons: services, resources and groups.",
  },
  {
    id: "gcp",
    name: "Google Cloud",
    shortName: "Google Cloud",
    cloud: true,
    description: "Official Google Cloud product icons, with each product filed as Google directs.",
  },
  {
    id: "k8s",
    name: "Kubernetes",
    shortName: "Kubernetes",
    cloud: true,
    description: "The Kubernetes community icon set: control plane, nodes and resource kinds.",
  },
  {
    id: "generic",
    name: "Generic",
    shortName: "Generic",
    cloud: false,
    description: "Users, devices and common building blocks that belong to no vendor.",
  },
  {
    id: "tool",
    name: "Tool logos",
    shortName: "Tools",
    cloud: false,
    description: "Widely used tools. Logos identify the tools only and imply no endorsement.",
  },
] as const satisfies readonly LibraryInfo[];

export interface LibraryInfo {
  readonly id: string;
  readonly name: string;
  /** The label on the library panel's filter chip. */
  readonly shortName: string;
  /** A cloud platform's own icons, as opposed to generic shapes and tool logos. */
  readonly cloud: boolean;
  readonly description: string;
}

/** The first segment of a catalog icon id, e.g. `azure` in `azure/virtual-machine`. */
export type LibraryId = (typeof LIBRARIES)[number]["id"];

const LIBRARY_IDS: ReadonlySet<string> = new Set(LIBRARIES.map((library) => library.id));

export function isLibraryId(value: string): value is LibraryId {
  return LIBRARY_IDS.has(value);
}

/** Position of a library in display order; search uses it to break ties. */
export function libraryRank(id: LibraryId): number {
  return LIBRARIES.findIndex((library) => library.id === id);
}

const asKey = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * The library a diagram's `libraries:` setting names, by id (`gcp`), name (`Google Cloud`) or
 * chip label (`tools`, as the file format's example writes it), ignoring case and spacing.
 */
export function libraryNamed(value: string): LibraryId | null {
  const key = asKey(value);
  const found = LIBRARIES.find(
    (library) =>
      library.id === key || asKey(library.name) === key || asKey(library.shortName) === key,
  );
  return found?.id ?? null;
}
