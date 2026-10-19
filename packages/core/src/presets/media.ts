import type { AssetMediaType } from "../assets/pointer";

/**
 * What a binary file in a project is, by its extension (D-101): a picture or a recording that's
 * held by its hash. SVG isn't here: it's text, kept (and cleaned) in the project's files.
 */
const MEDIA_BY_EXTENSION: Readonly<Record<string, AssetMediaType>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  webm: "audio/webm",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

/** The media type of a binary file by its name; undefined for anything else. */
export function mediaTypeForPath(path: string): AssetMediaType | undefined {
  const extension = path.split("/").at(-1)?.split(".").at(-1)?.toLowerCase() ?? "";
  return path.includes(".") ? MEDIA_BY_EXTENSION[extension] : undefined;
}
