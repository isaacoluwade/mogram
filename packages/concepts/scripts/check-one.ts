import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { buildCatalog } from "./catalog";

/**
 * Checks one concept file on its own, the way the catalog build would, without writing
 * anything: `pnpm tsx scripts/check-one.ts content/<topic>/<id>.mogram.yaml`.
 */
async function main(): Promise<void> {
  const file = process.argv[2];
  if (file === undefined) throw new Error("Give the concept's file.");
  const path = `${basename(dirname(file))}/${basename(file)}`;
  try {
    const { cards } = buildCatalog([{ path, text: await readFile(file, "utf8") }]);
    const card = cards[0];
    console.log(`OK: ${card?.title ?? path} (${card?.kind ?? "?"}, ${card?.topic ?? "?"})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
