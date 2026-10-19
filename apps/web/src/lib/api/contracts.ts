import type { ProjectAbout } from "@mogram/core/deck";
import type { ConceptPlatform, ConceptTopic } from "@mogram/core/presets";
import { z } from "zod";
import type { VersionChanges, VersionSource } from "@/lib/history/rules";
import { MAX_FILE_BYTES } from "@mogram/core/format";
import { parsePointer } from "@mogram/core/assets";

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
  assetBytes: 8_000_000,
  assetSeconds: 120,
  assetCount: 2_000,
  assetProjectBytes: 500_000_000,
  codeFileBytes: 200_000,
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
/** Files a code listing can show (D-103): source, config, Terraform, diffs and logs. */
export const isCodeFile = (path: string): boolean =>
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cpp|h|hpp|cs|rb|sh|bash|zsh|json|html|css|scss|sql|tf|tfvars|hcl|toml|ini|diff|patch|log)$/i.test(
    path,
  ) || /(?:^|\/)Dockerfile$/i.test(path);
export const PROJECT_ACCEPT =
  ".yaml,.yml,.mogram,.zip,.md,.txt,.svg,.png,.jpg,.jpeg,.gif,.webp,.webm,.mp4,.m4a,.mp3,.wav,.ogg,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.rb,.sh,.bash,.zsh,.json,.html,.css,.scss,.sql,.tf,.tfvars,.hcl,.toml,.ini,.diff,.patch,.log";

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
    (files) =>
      Object.values(files).filter((text) => parsePointer(text) === null).length <= LIMITS.fileCount,
    `A diagram can have at most ${LIMITS.fileCount} files.`,
  )
  .refine((files) => {
    const assets = Object.values(files).flatMap((text) => {
      const pointer = parsePointer(text);
      return pointer === null ? [] : [pointer];
    });
    return (
      assets.length <= LIMITS.assetCount &&
      assets.reduce((sum, pointer) => sum + pointer.bytes, 0) <= LIMITS.assetProjectBytes
    );
  }, "Assets can total at most 500 MB and 2000 files.")
  .refine(
    (files) =>
      Object.entries(files).every(
        ([path, text]) =>
          !isCodeFile(path) || new TextEncoder().encode(text).length <= LIMITS.codeFileBytes,
      ),
    "Code files can be at most 200 KB.",
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
  /** "import" when a draft (or a file) is brought in with its own history. */
  source: z.enum(["create", "import"]).optional(),
});

/** A draft's earlier versions, uploaded with it (oldest first, in batches). */
export const importVersionsBody = z.strictObject({
  versions: z
    .array(
      z.strictObject({
        files: projectFiles,
        createdAt: z.iso.datetime(),
        name: z.string().max(120).nullable(),
        source: z.enum(["create", "save", "restore", "ai", "named", "import"]),
        label: z.string().max(500).nullable(),
        restoredFromAt: z.iso.datetime().nullable(),
      }),
    )
    .max(100),
});

export const saveDiagramBody = z.strictObject({
  files: projectFiles,
  baseVersion: z.number().int().positive(),
  name: diagramName.optional(),
  thumbnail: z.string().max(LIMITS.thumbnailBytes).nullable().optional(),
  /** Make this save its own version (an assistant turn, or a named one). */
  checkpoint: z
    .strictObject({
      source: z.enum(["ai", "named"]),
      label: z.string().max(500).optional(),
      name: z.string().max(120).optional(),
    })
    .optional(),
});

export const versionNameBody = z.strictObject({ name: z.string().max(120).nullable() });

export const checkpointBody = z.strictObject({ name: z.string().trim().min(1).max(120) });

export const duplicateBody = z.strictObject({ revisionId: z.uuid().optional() });

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

/** What a concept's diagram says about itself, for the library's lists (D-85). */
export interface ConceptSummary {
  readonly summary: string | null;
  readonly topic: ConceptTopic | null;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  readonly kind: "pattern" | "explainer";
}

export interface DeckSummary {
  readonly slides: number;
}

export interface DiagramSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly visibility: Visibility;
  readonly thumbnail: string | null;
  /** Set when the diagram is a concept (D-83, D-85), so the library can offer it. */
  readonly concept: ConceptSummary | null;
  /** Set when this diagram is a deck, so the dashboard can show its slide count. */
  readonly deck: DeckSummary | null;
  /** What it is and how far along: slides, scenes, beats written and recorded. */
  readonly about: ProjectAbout;
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
  /** Who made it: their name, else their email. */
  readonly author: string | null;
  readonly name: string | null;
  readonly source: VersionSource;
  /** For an assistant turn: the prompt. */
  readonly label: string | null;
  readonly changes: VersionChanges | null;
  readonly restoredFromAt: string | null;
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
