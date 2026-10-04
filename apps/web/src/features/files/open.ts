"use client";

import DOMPurify from "dompurify";
import { strFromU8, unzipSync } from "fflate";
import type { ProjectFiles } from "@mogram/core/model";
import { isMogramFile } from "@mogram/core/model";
import { LIMITS, isTextFile, projectPath } from "@/lib/api/contracts";

export class OpenError extends Error {
  override readonly name = "OpenError";
}

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

/** Uploaded SVG icons are sanitised before they ever reach the project (IC-4, AC-7). */
export function cleanSvg(svg: string): string | null {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "script"],
    ALLOW_DATA_ATTR: false,
  });
  if (!/^\s*<svg[\s>]/i.test(clean)) return null;
  if (
    /\b(?:href|src)\s*=\s*["']\s*(?!#)/i.test(clean) ||
    /@import|url\(\s*["']?\s*(?!#)/i.test(clean)
  )
    return null;
  return clean;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function mime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext ?? "png"}`;
}

/** Strips a shared top folder ("checkout/mogram.yaml" → "mogram.yaml"). */
function stripCommonRoot(paths: readonly string[]): string {
  const first = paths[0]?.split("/") ?? [];
  if (first.length < 2) return "";
  const root = first[0] ?? "";
  if (paths.some((path) => !path.startsWith(`${root}/`))) return "";
  // Keep the root if a Mogram file sits directly in it: that folder *is* the diagram.
  return root;
}

/** Hidden files, `..` segments and macOS zip metadata are never part of a diagram. */
function ignored(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith(".") || segment === "__MACOSX");
}

async function addEntry(
  out: Record<string, string>,
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  if (ignored(path)) return;
  if (!projectPath.safeParse(path).success)
    throw new OpenError(`"${path}" isn't a path Mogram can open.`);
  if (bytes.length > LIMITS.fileBytes) throw new OpenError(`${path} is larger than 2 MB.`);
  if (isTextFile(path) && bytes.length > LIMITS.textFileBytes)
    throw new OpenError(`${path} is larger than 1 MB.`);
  if (path.toLowerCase().endsWith(".svg")) {
    const clean = cleanSvg(strFromU8(bytes));
    if (clean === null) throw new OpenError(`${path} isn't an SVG Mogram can use.`);
    out[path] = clean;
  } else if (isTextFile(path)) {
    out[path] = strFromU8(bytes);
  } else if (IMAGE.test(path)) {
    out[path] = `data:${mime(path)};base64,${toBase64(bytes)}`;
  }
}

/**
 * Reads files chosen on the computer (AC-2): one Mogram file, several files, a folder, or a zip.
 * Returns project files with paths relative to the diagram folder.
 */
export async function readProject(input: readonly File[]): Promise<ProjectFiles> {
  const raw: { path: string; bytes: Uint8Array }[] = [];
  for (const file of input) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const relative =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(bytes);
      for (const [path, content] of Object.entries(entries))
        if (!path.endsWith("/")) raw.push({ path, bytes: content });
    } else {
      raw.push({ path: relative, bytes });
    }
  }
  // Drop ignored entries first: a zip made on macOS has a __MACOSX folder beside the real one.
  const kept = raw.filter((entry) => !ignored(entry.path));
  const root = stripCommonRoot(kept.map((entry) => entry.path));
  const out: Record<string, string> = {};
  for (const entry of kept) {
    const path = root.length > 0 ? entry.path.slice(root.length + 1) : entry.path;
    await addEntry(out, path, entry.bytes);
  }
  const total = Object.values(out).reduce((sum, text) => sum + text.length, 0);
  if (total > LIMITS.projectBytes) throw new OpenError("That diagram is larger than 5 MB.");
  if (Object.keys(out).length > LIMITS.fileCount)
    throw new OpenError(`A diagram can have at most ${LIMITS.fileCount} files.`);
  // A lone YAML file without the .mogram extension is accepted as the diagram itself.
  const mogram = Object.keys(out).filter(isMogramFile);
  if (mogram.length === 0) {
    const yaml = Object.keys(out).filter((path) => /\.ya?ml$/i.test(path) && !path.includes("/"));
    const only = yaml[0];
    if (yaml.length === 1 && only !== undefined) {
      out["mogram.yaml"] = out[only] ?? "";
      delete out[only];
    } else {
      throw new OpenError(
        "There's no Mogram file here. Choose a .mogram.yaml file, a folder with mogram.yaml, or a zip of one.",
      );
    }
  }
  return out;
}
