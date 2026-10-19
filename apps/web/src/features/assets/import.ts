"use client";

import { formatPointer } from "@mogram/core/assets";
import { mediaTypeForPath } from "@mogram/core/presets";
import { checkAsset, keepAsset } from "./store";

/**
 * A picture or recording brought into a project (D-101): kept in this browser, and written into
 * the project as its pointer. A picture's size and a recording's length are read once, here,
 * so nothing else needs the bytes to know them.
 */
export async function importMedia(path: string, bytes: Uint8Array): Promise<string> {
  const type = mediaTypeForPath(path);
  if (type === undefined) throw new Error(`${path} isn't a picture or a recording.`);
  checkAsset(bytes.length);
  const blob = new Blob([bytes.slice().buffer], { type });
  if (type.startsWith("image/")) {
    const picture = await createImageBitmap(blob).catch(() => null);
    if (picture === null) throw new Error(`${path} isn't a picture this browser can read.`);
    try {
      return formatPointer(
        await keepAsset(blob, type, { width: picture.width, height: picture.height }),
      );
    } finally {
      picture.close();
    }
  }
  const context = new AudioContext();
  try {
    const sound = await context.decodeAudioData(await blob.arrayBuffer()).catch(() => null);
    if (sound === null) throw new Error(`${path} isn't a recording this browser can play.`);
    return formatPointer(await keepAsset(blob, type, { seconds: sound.duration }));
  } finally {
    await context.close();
  }
}
