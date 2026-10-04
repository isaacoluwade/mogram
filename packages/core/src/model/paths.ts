/**
 * Project paths: `/`-separated, relative to the project root, no leading `./`.
 */

export const MOGRAM_FILE_PATTERN = /(^|\/)(mogram\.yaml|[^/]+\.mogram\.yaml|[^/]+\.mogram)$/;
export const SETTINGS_FILE = "mogram.yaml";
export const LAYOUT_FILE = "layout.mogram.yaml";

export function isMogramFile(path: string): boolean {
  return MOGRAM_FILE_PATTERN.test(path);
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function basename(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function joinPath(...parts: readonly string[]): string {
  return normalizePath(parts.filter((part) => part.length > 0).join("/"));
}

/** Resolves `.` and `..` and collapses slashes. Use `staysInsideRoot` first for untrusted input. */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join("/");
}

/** True when `path` stays inside the project root after resolving `..`. */
export function staysInsideRoot(path: string): boolean {
  let depth = 0;
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      depth--;
      if (depth < 0) return false;
    } else {
      depth++;
    }
  }
  return true;
}

/** Resolves a path written inside a diagram (`./aks`, `docs/x.md`) against that diagram's folder. */
export function resolveFromFolder(folder: string, relative: string): string | null {
  const combined = folder.length > 0 ? `${folder}/${relative}` : relative;
  return staysInsideRoot(combined) ? normalizePath(combined) : null;
}

/** Files directly inside `folder` (not in subfolders). */
export function filesInFolder(paths: Iterable<string>, folder: string): string[] {
  const result: string[] = [];
  for (const path of paths) {
    if (dirname(path) === folder) result.push(path);
  }
  return result;
}

/** Display name for a folder or file used as a default diagram name. */
export function displayNameForPath(path: string): string {
  const base = basename(path)
    .replace(/\.mogram(\.yaml)?$/, "")
    .replace(/\.yaml$/, "");
  return base;
}
