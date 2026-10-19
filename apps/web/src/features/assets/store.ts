"use client";

import { createStore, get, set, type UseStore } from "idb-keyval";
import { formatPointer, type AssetMediaType, type AssetPointer } from "@mogram/core/assets";
import { LIMITS } from "@/lib/api/contracts";

/**
 * Pictures and recordings in this browser (D-101), held by the hash of their bytes. One store
 * for every draft: the same picture in two drafts is kept once.
 */

let database: UseStore | null = null;
const store = (): UseStore => (database ??= createStore("mogram-assets", "assets"));
const listeners = new Set<() => void>();

/** Called whenever a new asset is kept, so anything waiting for one can look again. */
export function subscribeAssetStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SHA-256 of some bytes, as 64 lower-case hex digits: the same as the server works out. */
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The limits every asset is held to, wherever it comes from. */
export function checkAsset(bytes: number, seconds?: number): void {
  if (bytes === 0) throw new Error("That file is empty.");
  if (bytes > LIMITS.assetBytes) throw new Error("A picture or recording can be at most 8 MB.");
  if (seconds !== undefined && seconds > LIMITS.assetSeconds)
    throw new Error("A recording can be at most 120 seconds.");
}

/** Keeps an asset, and gives the pointer that stands for it in a project's files. */
export async function keepAsset(
  blob: Blob,
  type: AssetMediaType,
  about: Pick<AssetPointer, "width" | "height" | "seconds" | "skip"> = {},
): Promise<AssetPointer> {
  checkAsset(blob.size, about.seconds);
  const bytes = await blob.arrayBuffer();
  const pointer: AssetPointer = { hash: await sha256(bytes), type, bytes: blob.size, ...about };
  // Throws for a pointer that couldn't be read back, before anything is kept.
  formatPointer(pointer);
  await set(`sha256:${pointer.hash}`, new Blob([bytes], { type }), store());
  for (const listener of listeners) listener();
  return pointer;
}

/** An asset's bytes, if this browser has them and they're the length its pointer says. */
export async function assetBlob(pointer: AssetPointer): Promise<Blob | null> {
  const kept = await get<Blob>(`sha256:${pointer.hash}`, store());
  if (kept === undefined || kept.size !== pointer.bytes) return null;
  return kept.type === pointer.type
    ? kept
    : new Blob([await kept.arrayBuffer()], { type: pointer.type });
}
