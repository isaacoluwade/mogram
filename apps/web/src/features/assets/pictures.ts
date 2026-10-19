"use client";

import { parsePointer } from "@mogram/core/assets";
import type { ProjectFiles } from "@mogram/core/model";
import { findAsset } from "./remote";
import { subscribeAssetStore } from "./store";

/**
 * What an image element draws (D-102), as a source an SVG `<image>` can use. Sources are
 * `data:` URLs rather than blob URLs: an export draws the diagram as an SVG string, decoded by
 * an `Image`, which can't reach a blob URL.
 */

const sources = new Map<string, string>();
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<void>>();

/** Called when a picture becomes ready (or a new asset is kept that one might be waiting for). */
export function subscribePictures(listener: () => void): () => void {
  listeners.add(listener);
  const stop = subscribeAssetStore(listener);
  return () => {
    listeners.delete(listener);
    stop();
  };
}

/**
 * A picture file's text as a source, when it's ready: a `data:` picture as it is, an SVG's text
 * as a `data:` URL, a pointer once its bytes are here. Null until then.
 */
export function pictureSource(content: string): string | null {
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(content)) return content;
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(content))
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
  return sources.get(content) ?? null;
}

/** Gets a pointer's picture ready, from this browser or the server. Once per picture. */
export function preparePicture(content: string): Promise<void> {
  if (pictureSource(content) !== null) return Promise.resolve();
  const pointer = parsePointer(content);
  if (pointer === null || !pointer.type.startsWith("image/")) return Promise.resolve();
  let task = pending.get(content);
  if (task === undefined) {
    task = (async () => {
      const blob = await findAsset(pointer);
      if (blob === null) return;
      sources.set(content, await dataUrl(blob));
      for (const listener of listeners) listener();
    })().finally(() => pending.delete(content));
    pending.set(content, task);
  }
  return task;
}

/** Every picture a project points at, ready: what an export waits for before it draws. */
export async function preparePictures(files: ProjectFiles): Promise<void> {
  await Promise.all(Object.values(files).map(preparePicture));
}

async function dataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // In pieces: spreading eight megabytes into one call would overflow the stack.
  for (let at = 0; at < bytes.length; at += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
