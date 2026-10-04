#!/usr/bin/env node
/**
 * Copies the icon assets into a folder an app serves, for example:
 *
 *   node ../../packages/icons/scripts/sync-assets.mjs public/icons
 *
 * Plain Node with no dependencies so it can run before anything is built. Files whose size and
 * modification time already match are skipped, so repeated runs (every `dev` start) are cheap.
 */
import { copyFile, mkdir, readdir, rm, stat, utimes } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ASSETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets");

async function main() {
  const target = process.argv[2];
  if (target === undefined || target === "") {
    console.error("Usage: node sync-assets.mjs <targetDir>");
    process.exitCode = 1;
    return;
  }
  const targetDir = resolve(process.cwd(), target);
  const sources = await listFiles(ASSETS_DIR);
  if (sources.length === 0) throw new Error(`No assets found in ${ASSETS_DIR}.`);

  let copied = 0;
  for (const source of sources) {
    const destination = join(targetDir, relative(ASSETS_DIR, source));
    if (await isUnchanged(source, destination)) continue;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    // Carry the source mtime over so the next run recognises the copy as unchanged.
    const { atimeMs, mtimeMs } = await stat(source);
    await utimes(destination, atimeMs / 1000, mtimeMs / 1000);
    copied += 1;
  }
  const removed = await removeRetiredIcons(sources, targetDir);
  console.log(
    `Icons synced to ${relative(process.cwd(), targetDir) || "."}: ` +
      `${copied} copied, ${sources.length - copied} unchanged, ${removed} retired.`,
  );
}

/**
 * Lists files below `dir`, skipping dotfiles such as `.DS_Store`.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
      }),
  );
  return nested.flat();
}

/**
 * File systems store timestamps at different precisions, so mtimes within a millisecond count
 * as equal.
 *
 * @param {string} source
 * @param {string} destination
 */
async function isUnchanged(source, destination) {
  const [from, to] = await Promise.all([stat(source), stat(destination).catch(() => null)]);
  return to !== null && from.size === to.size && Math.abs(from.mtimeMs - to.mtimeMs) < 1;
}

/**
 * Deletes SVGs the catalog no longer has, so retired icons stop being served. Only `.svg` files
 * inside the library folders this package owns are touched, so pointing the script at the wrong
 * folder cannot delete anything else.
 *
 * @param {string[]} sources
 * @param {string} targetDir
 */
async function removeRetiredIcons(sources, targetDir) {
  const keep = new Set(sources.map((file) => relative(ASSETS_DIR, file)));
  const libraries = (await readdir(ASSETS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  let removed = 0;
  for (const library of libraries) {
    const files = await readdir(join(targetDir, library)).catch(() => []);
    for (const file of files) {
      const path = join(library, file);
      if (!file.endsWith(".svg") || keep.has(path)) continue;
      await rm(join(targetDir, path));
      removed += 1;
    }
  }
  return removed;
}

main().catch((/** @type {unknown} */ error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
