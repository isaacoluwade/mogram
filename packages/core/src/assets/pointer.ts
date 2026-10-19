/**
 * Binary files held by their hash (D-101): a picture or a recording is a one-line pointer in the
 * project's files, and its bytes are kept elsewhere (the browser's store, the server, a zip).
 * Core reads a picture's size and a clip's length from the pointer, never from the bytes.
 *
 *   mogram-asset 1 sha256:9f2c…e1 image/png 482113 1920x1080
 *   mogram-asset 1 sha256:77aa…0b audio/webm 81234 6.19s skip=0.21
 */

const HASH = /^[a-f0-9]{64}$/;

/** What an asset can be: pictures and recordings. Never SVG or HTML, which can carry script. */
export const ASSET_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
] as const;

export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number];

export function isAssetMediaType(value: unknown): value is AssetMediaType {
  return typeof value === "string" && (ASSET_MEDIA_TYPES as readonly string[]).includes(value);
}

export interface AssetPointer {
  /** SHA-256 of the bytes, as 64 lower-case hex digits. */
  readonly hash: string;
  readonly type: AssetMediaType;
  /** The file's length in bytes. */
  readonly bytes: number;
  /** A picture's own size, in px. */
  readonly width?: number;
  readonly height?: number;
  /** A recording's length, and the silence at its start that playing skips (D-105). */
  readonly seconds?: number;
  readonly skip?: number;
}

const positiveInteger = (value: number | undefined): boolean =>
  value !== undefined && Number.isSafeInteger(value) && value > 0;

/** Whether a pointer says something possible: a picture has a size and no length, and so on. */
function valid(pointer: AssetPointer): boolean {
  if (!HASH.test(pointer.hash) || !isAssetMediaType(pointer.type)) return false;
  if (!positiveInteger(pointer.bytes)) return false;
  const sized = pointer.width !== undefined || pointer.height !== undefined;
  const timed = pointer.seconds !== undefined || pointer.skip !== undefined;
  if (pointer.type.startsWith("image/"))
    return (
      !timed && (!sized || (positiveInteger(pointer.width) && positiveInteger(pointer.height)))
    );
  if (sized) return false;
  if (pointer.seconds === undefined) return pointer.skip === undefined;
  if (!Number.isFinite(pointer.seconds) || pointer.seconds <= 0) return false;
  return (
    pointer.skip === undefined ||
    (Number.isFinite(pointer.skip) && pointer.skip >= 0 && pointer.skip < pointer.seconds)
  );
}

/** The pointer line, piece by piece: version, hash, type, length, then a size or a length in time. */
const POINTER = new RegExp(
  [
    "^mogram-asset 1",
    " sha256:([a-f0-9]{64})",
    " ([a-z]+/[a-z0-9.+-]+)",
    " ([1-9]\\d*)",
    "(?: (\\d+)x(\\d+))?",
    "(?: (\\d+(?:\\.\\d+)?)s(?: skip=(\\d+(?:\\.\\d+)?))?)?$",
  ].join(""),
);

/** Reads a pointer line. Anything that isn't one, exactly, is not a pointer. */
export function parsePointer(text: string): AssetPointer | null {
  const match = POINTER.exec(text.trim());
  if (match === null) return null;
  const [, hash, type, bytes, width, height, seconds, skip] = match;
  if (hash === undefined || bytes === undefined || !isAssetMediaType(type)) return null;
  const pointer: AssetPointer = {
    hash,
    type,
    bytes: Number(bytes),
    ...(width === undefined || height === undefined
      ? {}
      : { width: Number(width), height: Number(height) }),
    ...(seconds === undefined ? {} : { seconds: Number(seconds) }),
    ...(skip === undefined ? {} : { skip: Number(skip) }),
  };
  return valid(pointer) ? pointer : null;
}

/** Seconds to the millisecond, written without an exponent or trailing zeros. */
function secondsText(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "");
}

/** Writes a pointer as its one line. Throws for a pointer that isn't valid. */
export function formatPointer(pointer: AssetPointer): string {
  const seconds = pointer.seconds === undefined ? undefined : Number(secondsText(pointer.seconds));
  const skip = pointer.skip === undefined ? undefined : Number(secondsText(pointer.skip));
  const rounded: AssetPointer = {
    hash: pointer.hash,
    type: pointer.type,
    bytes: pointer.bytes,
    ...(pointer.width === undefined ? {} : { width: pointer.width }),
    ...(pointer.height === undefined ? {} : { height: pointer.height }),
    ...(seconds === undefined ? {} : { seconds }),
    ...(skip === undefined ? {} : { skip }),
  };
  if (!valid(rounded)) throw new Error("That isn't a valid asset pointer.");
  return [
    "mogram-asset 1",
    `sha256:${pointer.hash}`,
    pointer.type,
    String(pointer.bytes),
    ...(rounded.width === undefined ? [] : [`${rounded.width}x${rounded.height}`]),
    ...(seconds === undefined ? [] : [`${secondsText(seconds)}s`]),
    ...(skip === undefined ? [] : [`skip=${secondsText(skip)}`]),
  ].join(" ");
}

/** Whether a project file's text is a pointer. */
export function isPointer(text: string): boolean {
  return parsePointer(text) !== null;
}
