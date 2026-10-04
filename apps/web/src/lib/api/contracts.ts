import { z } from "zod";
import { MAX_FILE_BYTES } from "@mogram/core/format";

/**
 * API contracts shared by the browser and the server (D-7). Limits are part of the contract
 * (engineering standards §5): everything a user controls has a ceiling.
 */

export const LIMITS = {
  nameLength: 120,
  fileCount: 500,
  pathLength: 200,
  fileBytes: 2_000_000,
  /** YAML and markdown: the most the parser reads (larger text files couldn't be opened). */
  textFileBytes: MAX_FILE_BYTES,
  projectBytes: 5_000_000,
  thumbnailBytes: 250_000,
} as const;

/** Project-relative paths: no leading slash, no `.`/`..` segments, conservative characters. */
export const projectPath = z
  .string()
  .min(1)
  .max(LIMITS.pathLength)
  .regex(
    /^[A-Za-z0-9_.\- ]+(?:\/[A-Za-z0-9_.\- ]+)*$/,
    "Paths may use letters, numbers, spaces, '.', '-', '_' and '/'.",
  )
  .refine(
    (path) => !path.split("/").some((segment) => segment === "." || segment === ".."),
    "Paths can't contain . or .. segments.",
  );

/** Text files Mogram reads (diagram YAML, card markdown). */
export const isTextFile = (path: string): boolean => /\.(ya?ml|mogram|md|txt)$/i.test(path);

export const projectFiles = z
  .record(projectPath, z.string().max(LIMITS.fileBytes))
  .refine(
    (files) =>
      Object.entries(files).every(
        ([path, text]) => !isTextFile(path) || text.length <= LIMITS.textFileBytes,
      ),
    "YAML and markdown files can be at most 1 MB.",
  )
  .refine(
    (files) => Object.keys(files).length <= LIMITS.fileCount,
    `A diagram can have at most ${LIMITS.fileCount} files.`,
  )
  .refine(
    (files) =>
      Object.values(files).reduce((total, text) => total + text.length, 0) <= LIMITS.projectBytes,
    "A diagram can be at most 5 MB.",
  );

export const diagramName = z
  .string()
  .trim()
  .min(1, "Give the diagram a name.")
  .max(LIMITS.nameLength);

export const createDiagramBody = z.strictObject({
  name: diagramName,
  files: projectFiles,
  thumbnail: z.string().max(LIMITS.thumbnailBytes).nullable().optional(),
});

export const saveDiagramBody = z.strictObject({
  files: projectFiles,
  baseVersion: z.number().int().positive(),
  name: diagramName.optional(),
  thumbnail: z.string().max(LIMITS.thumbnailBytes).nullable().optional(),
});

/** Metadata changes: a rename (also written into the YAML, so it's a new version) or a new thumbnail. */
export const updateDiagramBody = z
  .strictObject({
    name: diagramName.optional(),
    thumbnail: z.string().max(LIMITS.thumbnailBytes).nullable().optional(),
  })
  .refine((body) => body.name !== undefined || body.thumbnail !== undefined, "Nothing to change.");

export const shareSettingsBody = z.strictObject({
  visibility: z.enum(["private", "link"]),
  allowViewerState: z.boolean(),
  regenerateLink: z.boolean().optional(),
});

export type Visibility = "private" | "link";

export interface DiagramSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly visibility: Visibility;
  readonly thumbnail: string | null;
}

export interface DiagramDetail extends DiagramSummary {
  readonly files: Record<string, string>;
  readonly version: number;
  readonly shareId: string | null;
  readonly allowViewerState: boolean;
}

export interface RevisionSummary {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: string | null;
}

export interface SharedDiagram {
  readonly name: string;
  readonly files: Record<string, string>;
  readonly allowViewerState: boolean;
  readonly updatedAt: string;
}

export interface ApiErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export interface SaveConflict {
  readonly error: { readonly code: "conflict"; readonly message: string };
  readonly currentVersion: number;
}
