/**
 * Code listings (D-103): the languages Mogram colours, and how a file's name says which one it
 * is. The tokenisers that do the colouring are in `@mogram/core/code`.
 */
export const CODE_LANGUAGES = [
  "hcl",
  "console",
  "plan",
  "yaml",
  "json",
  "shell",
  "diff",
  "plain",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export function isCodeLanguage(value: unknown): value is CodeLanguage {
  return typeof value === "string" && (CODE_LANGUAGES as readonly string[]).includes(value);
}

/** What other names for a language people write, so a message can suggest the right one. */
export const CODE_LANGUAGE_ALIASES: Readonly<Record<string, CodeLanguage>> = {
  terraform: "hcl",
  tf: "hcl",
  tfvars: "hcl",
  bash: "shell",
  sh: "shell",
  zsh: "shell",
  terminal: "console",
  output: "console",
  yml: "yaml",
  patch: "diff",
  text: "plain",
  txt: "plain",
};

const BY_EXTENSION: Readonly<Record<string, CodeLanguage>> = {
  tf: "hcl",
  tfvars: "hcl",
  hcl: "hcl",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  sh: "shell",
  bash: "shell",
  diff: "diff",
  patch: "diff",
};

/** The language a file is in, by its extension; `plain` for anything else. */
export function languageForFile(file: string | null): CodeLanguage {
  const extension = file?.split("/").at(-1)?.split(".").at(-1)?.toLowerCase();
  if (extension === undefined || file === null || !file.includes(".")) return "plain";
  return BY_EXTENSION[extension] ?? "plain";
}

/** A code element's text size when it doesn't say: larger than a label's, as a slide needs. */
export const CODE_FONT_SIZE = 20;
/** The text sizes a code element can have, in px. */
export const CODE_FONT_SIZES = { min: 10, max: 64 } as const;

/** Mono metrics, used to size a listing and to find its lines (D-103). */
export const CODE_METRICS = {
  /** A character's width, as a share of the text size. */
  advance: 0.6,
  /** A line's height, as a share of the text size. */
  lineHeight: 1.5,
  /** Room inside the element's edge, in px. */
  padding: 16,
  /** The header that names the file, in px. */
  header: 36,
} as const;
