"use client";

import { parsePointer, type AssetPointer } from "@mogram/core/assets";
import type { ProjectFiles } from "@mogram/core/model";
import { assetBlob, keepAsset, sha256 } from "./store";

/**
 * Assets and the server (D-101). A saved diagram's assets are fetched when something needs
 * them, from wherever the page opened it (the owner's route, or a share link's); a draft's are
 * uploaded when it's saved to an account, each once.
 */

const sources = new Set<string>();

/**
 * Where this page can fetch the assets of what it shows: `/api/diagrams/<id>` or
 * `/api/share/<shareId>`. Returns how to stop.
 */
export function addAssetSource(base: string): () => void {
  sources.add(base);
  return () => {
    sources.delete(base);
  };
}

const fetching = new Map<string, Promise<Blob | null>>();

/** An asset's bytes: from this browser, or fetched once from where the page opened it. */
export async function findAsset(pointer: AssetPointer): Promise<Blob | null> {
  const kept = await assetBlob(pointer);
  if (kept !== null) return kept;
  let pending = fetching.get(pointer.hash);
  if (pending === undefined) {
    pending = fetchAsset(pointer).finally(() => fetching.delete(pointer.hash));
    fetching.set(pointer.hash, pending);
  }
  return pending;
}

async function fetchAsset(pointer: AssetPointer): Promise<Blob | null> {
  for (const base of sources) {
    const response = await fetch(`${base}/assets/${pointer.hash}`, {
      credentials: "same-origin",
    }).catch(() => null);
    if (response === null || !response.ok) continue;
    const blob = await response.blob();
    // What came back is kept only when it's what the pointer says, byte for byte.
    if (blob.size !== pointer.bytes || (await sha256(await blob.arrayBuffer())) !== pointer.hash)
      continue;
    await keepAsset(blob, pointer.type, pointer);
    return blob;
  }
  return null;
}

/** The pointers in a project's files, each hash once. */
export function pointersIn(files: ProjectFiles): AssetPointer[] {
  const seen = new Map<string, AssetPointer>();
  for (const text of Object.values(files)) {
    const pointer = parsePointer(text);
    if (pointer !== null && !seen.has(pointer.hash)) seen.set(pointer.hash, pointer);
  }
  return [...seen.values()];
}

/** Hashes the account is known to have, this visit: they aren't asked about again. */
const uploaded = new Set<string>();

/**
 * Makes sure the account has every asset a project points at, before it's saved: asks which
 * it's missing, and uploads just those.
 */
export async function uploadMissingAssets(files: ProjectFiles): Promise<void> {
  const pointers = pointersIn(files).filter((pointer) => !uploaded.has(pointer.hash));
  if (pointers.length === 0) return;
  const response = await fetch("/api/assets/missing", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: pointers.map((pointer) => pointer.hash) }),
  });
  if (!response.ok) throw new Error(await problem(response, "Your pictures couldn't be checked."));
  const { missing } = (await response.json()) as { missing: string[] };
  const needed = new Set(missing);
  for (const pointer of pointers) {
    if (needed.has(pointer.hash)) {
      const blob = await findAsset(pointer);
      if (blob === null)
        throw new Error(
          "A picture or recording in this diagram isn't in this browser. Open the original files again.",
        );
      const put = await fetch(`/api/assets/${pointer.hash}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": pointer.type },
        body: blob,
      });
      if (!put.ok) throw new Error(await problem(put, "A picture couldn't be uploaded."));
    }
    uploaded.add(pointer.hash);
  }
}

async function problem(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

/** An asset's bytes for a download (a zip of the project); null for a file that isn't a pointer. */
export async function assetBytes(text: string): Promise<Uint8Array | null> {
  const pointer = parsePointer(text);
  if (pointer === null) return null;
  const blob = await findAsset(pointer);
  if (blob === null)
    throw new Error(
      "A picture or recording in this diagram isn't in this browser. Open the original files again.",
    );
  return new Uint8Array(await blob.arrayBuffer());
}
