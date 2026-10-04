import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * A vendor download pinned by its SHA-256 (IC-1). The hash makes a rebuild produce the same
 * catalog; a new release is adopted by changing the URL and hash and re-running the build.
 */
export interface PinnedFile {
  readonly url: string;
  readonly sha256: string;
}

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Returns the file's bytes, downloading it into the gitignored `vendor/` folder the first time.
 * A file whose hash differs (a corrupt download, or the vendor replaced it under the same URL)
 * fails the build rather than quietly changing the catalog.
 */
export async function loadPinned(
  vendorDir: string,
  name: string,
  file: PinnedFile,
): Promise<Uint8Array> {
  const path = join(vendorDir, name);
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await download(file.url));
  }
  const data = new Uint8Array(await readFile(path));
  const hash = sha256(data);
  if (hash !== file.sha256) {
    throw new Error(`${path} has SHA-256 ${hash}, expected ${file.sha256}.`);
  }
  return data;
}

/**
 * Several files from one pinned source tree (a Git commit), checked together: `sha256` is the
 * hash of the lines `<path> <sha256 of file>\n` in the order given. One hash pins the whole set
 * without a hash per file, and a changed, missing or extra file all fail the check.
 */
export async function loadPinnedSet(
  vendorDir: string,
  folder: string,
  source: { readonly baseUrl: string; readonly paths: readonly string[]; readonly sha256: string },
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const path of source.paths) {
    const local = join(vendorDir, folder, path);
    if (!existsSync(local)) {
      await mkdir(dirname(local), { recursive: true });
      await writeFile(local, await download(`${source.baseUrl}/${path}`));
    }
    files.set(path, new Uint8Array(await readFile(local)));
  }
  const manifest = [...files].map(([path, data]) => `${path} ${sha256(data)}\n`).join("");
  const hash = sha256(manifest);
  if (hash !== source.sha256) {
    throw new Error(`${join(vendorDir, folder)} has SHA-256 ${hash}, expected ${source.sha256}.`);
  }
  return files;
}

async function download(url: string): Promise<Uint8Array> {
  console.log(`Downloading ${url}`);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    // fetch only says "fetch failed"; the cause names the real problem.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const code = cause instanceof Error && "code" in cause ? String(cause.code) : String(cause);
    const hint = code.includes("CERT")
      ? " Behind a TLS-inspecting proxy, point NODE_EXTRA_CA_CERTS at its root certificate."
      : "";
    throw new Error(`Download of ${url} failed: ${code}.${hint}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Download of ${url} failed with HTTP ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}
