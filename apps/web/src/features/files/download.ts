"use client";

import { strToU8, zipSync, type Zippable } from "fflate";
import type { ProjectFiles } from "@mogram/core/model";
import { isMogramFile, toName } from "@mogram/core/model";
import { assetBytes } from "@/features/assets/remote";

export async function projectArchive(files: ProjectFiles, folder: string): Promise<Uint8Array> {
  const entries: Zippable = {};
  for (const [path, content] of Object.entries(files)) {
    entries[`${folder}/${path}`] =
      (await assetBytes(content)) ??
      (content.startsWith("data:") ? dataUrlBytes(content) : strToU8(content));
  }
  return zipSync(entries, { level: 6 });
}

/** Saves a Blob through a temporary link (works in every browser, no popups). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Downloads the diagram as files (AC-2, FI-6): one `.mogram.yaml` when it is a single file,
 * otherwise a zip of the folder — ready to commit to a repository.
 */
export async function downloadProject(files: ProjectFiles, name: string): Promise<void> {
  const slug = toName(name, "diagram").replace(/_/g, "-");
  const paths = Object.keys(files);
  const only = paths[0];
  if (paths.length === 1 && only !== undefined && isMogramFile(only)) {
    const filename =
      only === "mogram.yaml" ? `${slug}.mogram.yaml` : (only.split("/").pop() ?? only);
    saveBlob(new Blob([files[only] ?? ""], { type: "text/yaml;charset=utf-8" }), filename);
    return;
  }
  const zipped = await projectArchive(files, slug);
  saveBlob(new Blob([zipped.slice().buffer], { type: "application/zip" }), `${slug}.zip`);
}
