import type { ProjectFiles } from "../model/types";
import { formatPointer, parsePointer, type AssetMediaType, type AssetPointer } from "./pointer";

/**
 * Recordings of a script (D-105). A beat's voice isn't written in the YAML: it's the file
 * `voice/<key>.<ext>` in the deck's folder (or the diagram's), where the key comes from the
 * script's words. Moving a beat, reordering slides or renaming anything never loses it; changing
 * a word makes it out of date; undoing the change brings it back; fixing a comma keeps it.
 *
 * Beside each clip, `voice/<key>.txt` holds the words it was recorded saying, so a clip whose
 * script has since changed can still be found, offered, and kept.
 */

/** Where a deck's recordings are kept, inside its folder. */
export const VOICE_FOLDER = "voice";

/** The quiet after a clip's last word before the next beat begins, in seconds. */
export const VOICE_TAIL = 0.4;

/** A clip's file name for each kind of recording a browser makes. */
const EXTENSIONS: Readonly<Partial<Record<AssetMediaType, string>>> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** The words a recording is found by: lower-cased, with punctuation and accents dropped. */
export function voiceWords(script: string): string[] {
  return script
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "");
}

/** FNV-1a over the text's UTF-16 units, 32 bits, as 8 hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * A script's key: its first few words, so a person can tell the files apart, and a hash of all
 * of them, so two scripts that start alike don't share a clip. Null for words there aren't.
 */
export function voiceKey(script: string): string | null {
  const words = voiceWords(script);
  if (words.length === 0) return null;
  const slug = words
    .slice(0, 5)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
  return `${slug === "" ? "beat" : slug}-${fnv1a(words.join(" "))}`;
}

const join = (folder: string, path: string) => (folder === "" ? path : `${folder}/${path}`);

/** A recording, as the files hold it. */
export interface Voice {
  readonly path: string;
  readonly pointer: AssetPointer;
  /** How long it plays, from its first word: its length less the silence skipped. */
  readonly seconds: number;
  readonly skip: number;
}

function voiceAt(files: ProjectFiles, path: string): Voice | null {
  const text = files[path];
  const pointer = text === undefined ? null : parsePointer(text);
  if (pointer === null || !pointer.type.startsWith("audio/") || pointer.seconds === undefined)
    return null;
  const skip = pointer.skip ?? 0;
  return { path, pointer, seconds: pointer.seconds - skip, skip };
}

/** The recording of these words in `folder`'s voice folder, when there is one. */
export function voiceFor(files: ProjectFiles, folder: string, script: string): Voice | null {
  const key = voiceKey(script);
  if (key === null) return null;
  for (const extension of Object.values(EXTENSIONS)) {
    const found = voiceAt(files, join(folder, `${VOICE_FOLDER}/${key}.${extension}`));
    if (found !== null) return found;
  }
  return null;
}

/** Where the words a clip was recorded saying are kept. */
export const transcriptPath = (clip: string): string => clip.replace(/\.[a-z0-9]+$/i, ".txt");

/** The files that hold a new recording of `script`: its pointer, and the words it says. */
export function voiceFiles(
  folder: string,
  script: string,
  pointer: AssetPointer,
): Record<string, string> {
  const key = voiceKey(script);
  const extension = EXTENSIONS[pointer.type];
  if (key === null) throw new Error("A recording needs words to be found by.");
  if (extension === undefined) throw new Error(`"${pointer.type}" isn't a recording.`);
  const clip = join(folder, `${VOICE_FOLDER}/${key}.${extension}`);
  return { [clip]: formatPointer(pointer), [transcriptPath(clip)]: `${script.trim()}\n` };
}

/** Every recording in `folder`'s voice folder, with the words it was made for (when known). */
export function voicesIn(
  files: ProjectFiles,
  folder: string,
): readonly (Voice & { readonly words: string | null })[] {
  const prefix = join(folder, `${VOICE_FOLDER}/`);
  return Object.keys(files)
    .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .flatMap((path) => {
      const voice = voiceAt(files, path);
      if (voice === null) return [];
      const words = files[transcriptPath(path)];
      return [{ ...voice, words: words === undefined ? null : words.trim() }];
    });
}

/** How alike two scripts' words are, from 0 to 1: shared words over all the words in either. */
function likeness(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  const all = left.size + right.size - shared;
  return all === 0 ? 0 : shared / all;
}

/**
 * A recording made for words that have since changed: a clip that none of `scripts` (every
 * script there is now) finds any more, made for words most like these. Null when there's
 * nothing close enough to be the same beat.
 */
export function staleVoice(
  files: ProjectFiles,
  folder: string,
  script: string,
  scripts: readonly string[],
): (Voice & { readonly words: string }) | null {
  if (voiceFor(files, folder, script) !== null) return null;
  const wanted = voiceWords(script);
  if (wanted.length === 0) return null;
  const used = new Set(scripts.map(voiceKey));
  let best: (Voice & { readonly words: string }) | null = null;
  let score = 0.5;
  for (const voice of voicesIn(files, folder)) {
    if (voice.words === null) continue;
    if (used.has(voiceKey(voice.words))) continue;
    const alike = likeness(wanted, voiceWords(voice.words));
    if (alike >= score) {
      score = alike;
      best = { ...voice, words: voice.words };
    }
  }
  return best;
}

/**
 * "Keep this recording": a clip made for other words is found by these from now on. Its
 * pointer and words move to the key these words make.
 */
export function keepVoice(
  files: ProjectFiles,
  folder: string,
  clip: string,
  script: string,
): ProjectFiles {
  const voice = voiceAt(files, clip);
  if (voice === null) throw new Error("That recording isn't there any more.");
  return { ...removeVoice(files, clip), ...voiceFiles(folder, script, voice.pointer) };
}

/** Removes a recording and the words kept beside it. */
export function removeVoice(files: ProjectFiles, clip: string): ProjectFiles {
  const gone = new Set([clip, transcriptPath(clip)]);
  return Object.fromEntries(Object.entries(files).filter(([path]) => !gone.has(path)));
}
