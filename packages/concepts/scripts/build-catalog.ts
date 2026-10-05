/**
 * Builds the concept catalog from `content/<topic>/<id>.mogram.yaml` into `src/` (D-85). Run with
 * `pnpm build:catalog`; the output is committed, and a test checks it's current. Every check runs
 * before anything is written, so a failed build leaves the last good catalog.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog, type ConceptSource } from "./catalog";

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function readSources(contentDir: string): Promise<ConceptSource[]> {
  const sources: ConceptSource[] = [];
  for (const topic of await readdir(contentDir, { withFileTypes: true })) {
    if (!topic.isDirectory()) continue;
    for (const file of await readdir(join(contentDir, topic.name)))
      if (file.endsWith(".mogram.yaml")) {
        const path = join(contentDir, topic.name, file);
        sources.push({ path: relative(contentDir, path), text: await readFile(path, "utf8") });
      }
  }
  return sources;
}

async function main(): Promise<void> {
  const { cards, files } = buildCatalog(await readSources(join(PACKAGE_DIR, "content")));
  await rm(join(PACKAGE_DIR, "src", "bodies"), { recursive: true, force: true });
  for (const [path, text] of Object.entries(files)) {
    const target = join(PACKAGE_DIR, "src", path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  console.log(`Concept catalog: ${cards.length} concepts.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
