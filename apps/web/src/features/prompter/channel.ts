import type { ProjectFiles } from "@mogram/core/model";

/**
 * What the Script window, the viewers and the editor of the same diagram tell each other, on
 * this machine only (D-96, D-105).
 */
export type PrompterMessage =
  /** A diagram's beat being read: the viewer shows that many of its story's beats. */
  | { readonly kind: "beat"; readonly beats: number }
  /** A deck's: which slide, and how many of its beats have been started. */
  | { readonly kind: "deck"; readonly slide: number; readonly beats: number }
  /** A Script window has opened: the editor sends it the files as they are. */
  | { readonly kind: "hello" }
  /** The files as the editor has them now, for the Script window to read. */
  | { readonly kind: "files"; readonly files: ProjectFiles }
  /** A recording for the editor to keep: files to write, or (null) to remove. */
  | {
      readonly kind: "voice";
      readonly id: string;
      readonly files: Readonly<Record<string, string | null>>;
    }
  /** The editor's answer: kept, or why not. */
  | { readonly kind: "voice-saved"; readonly id: string; readonly reason: string | null };

/** The channel a diagram's Script window, viewers and editor share: a draft's id, or a diagram's. */
export const prompterChannel = (id: string): string => `mogram-prompter-${id}`;

/** A diagram's Script window, as its viewer knows it: where it opens, and where it's heard. */
export interface PrompterLink {
  readonly href: string;
  readonly channel: string;
}

/** Files with some written and some (null) taken away. */
export function withChanges(
  files: ProjectFiles,
  changes: Readonly<Record<string, string | null>>,
): ProjectFiles {
  const next: Record<string, string> = { ...files };
  for (const [path, text] of Object.entries(changes)) {
    if (text === null) delete next[path];
    else next[path] = text;
  }
  return next;
}
