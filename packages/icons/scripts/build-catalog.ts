/**
 * Builds the icon catalog: `assets/<library>/<slug>.svg`, the licence notices beside them, and
 * `src/catalog.generated.ts`. Run with `pnpm build:catalog`; the output is committed so the app
 * and tests never need the network.
 *
 * Every check runs before anything is written, so a failed build leaves the last good catalog.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ICON_ALIASES } from "../src/aliases";
import { LIBRARIES, libraryRank } from "../src/libraries";
import type { IconEntry } from "../src/types";
import { buildAwsIcons, loadAwsZip } from "./lib/aws";
import { buildAzureIcons, loadAzureZip } from "./lib/azure";
import { buildGcpIcons, loadGcpZips } from "./lib/gcp";
import { buildGenericIcons } from "./lib/generic";
import { buildKubernetesIcons, loadKubernetesIcons } from "./lib/kubernetes";
import type { BuiltIcon } from "./lib/model";
import { awsNotice, azureNotice, gcpNotice, kubernetesNotice, toolNotice } from "./lib/notices";
import { renderCatalog } from "./lib/render-catalog";
import { renderIds } from "./lib/render-ids";
import { buildToolIcons } from "./lib/tools";

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = join(PACKAGE_DIR, "assets");
const CATALOG_FILE = join(PACKAGE_DIR, "src", "catalog.generated.ts");
const IDS_FILE = join(PACKAGE_DIR, "src", "ids.generated.ts");
const VENDOR_DIR = join(PACKAGE_DIR, "vendor");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function main(): Promise<void> {
  const lucideDir = dependencyDir("lucide-static");
  const simpleIconsDir = dependencyDir("simple-icons");

  const azure = buildAzureIcons(await loadAzureZip(VENDOR_DIR));
  const aws = buildAwsIcons(await loadAwsZip(VENDOR_DIR));
  const gcp = buildGcpIcons(await loadGcpZips(VENDOR_DIR));
  const kubernetes = buildKubernetesIcons(await loadKubernetesIcons(VENDOR_DIR));
  const generic = await buildGenericIcons(lucideDir);
  const tools = await buildToolIcons(simpleIconsDir);
  const icons = [...azure, ...aws, ...gcp, ...kubernetes, ...generic, ...tools.icons];

  checkSlugs(icons);
  applyAliases(icons, ICON_ALIASES);
  const entries = icons.map(({ entry }) => toEntry(entry)).sort(compareEntries);

  await writeAssets(icons);
  await writeFile(join(ASSETS_DIR, "azure", "LICENSE-NOTICE.md"), azureNotice());
  await writeFile(join(ASSETS_DIR, "aws", "LICENSE-NOTICE.md"), awsNotice());
  await writeFile(join(ASSETS_DIR, "gcp", "LICENSE-NOTICE.md"), gcpNotice());
  await writeFile(join(ASSETS_DIR, "k8s", "LICENSE-NOTICE.md"), kubernetesNotice());
  await writeFile(
    join(ASSETS_DIR, "generic", "LICENSE"),
    await readFile(join(lucideDir, "LICENSE"), "utf8"),
  );
  await writeFile(
    join(ASSETS_DIR, "tool", "NOTICE.md"),
    toolNotice(tools.credits, tools.skipped, await packageVersion(simpleIconsDir)),
  );
  await writeFile(CATALOG_FILE, renderCatalog(entries));
  await writeFile(IDS_FILE, renderIds(entries));

  for (const library of LIBRARIES) {
    const count = entries.filter((entry) => entry.library === library.id).length;
    console.log(`${library.name}: ${count} icons`);
  }
  if (tools.skipped.length > 0) {
    console.log(`Skipped tool logos missing from Simple Icons: ${tools.skipped.join(", ")}`);
  }
}

/** pnpm links each devDependency into this package's own node_modules. */
function dependencyDir(name: string): string {
  const dir = join(PACKAGE_DIR, "node_modules", name);
  if (!existsSync(dir)) throw new Error(`${name} is not installed; run pnpm install.`);
  return dir;
}

async function packageVersion(dir: string): Promise<string> {
  const parsed: unknown = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  const version =
    typeof parsed === "object" && parsed !== null && "version" in parsed ? parsed.version : null;
  if (typeof version !== "string") throw new Error(`${dir}/package.json has no version.`);
  return version;
}

function checkSlugs(icons: readonly BuiltIcon[]): void {
  const seen = new Set<string>();
  for (const { entry } of icons) {
    const id = `${entry.library}/${entry.slug}`;
    if (!SLUG.test(entry.slug)) throw new Error(`Icon ${id} has an invalid slug.`);
    if (seen.has(id)) throw new Error(`Icon id ${id} is used twice.`);
    seen.add(id);
  }
}

/**
 * Merges the hand-curated alias table into the catalog. An alias for an id the catalog does not
 * contain fails the build, so the table cannot quietly rot when a vendor renames an icon.
 */
function applyAliases(
  icons: readonly BuiltIcon[],
  aliases: Readonly<Record<string, readonly string[]>>,
): void {
  const byId = new Map(icons.map((icon) => [`${icon.entry.library}/${icon.entry.slug}`, icon]));
  const problems: string[] = [];
  for (const [id, terms] of Object.entries(aliases)) {
    const icon = byId.get(id);
    if (icon === undefined) {
      problems.push(`alias table names ${id}, which is not in the catalog`);
      continue;
    }
    for (const term of terms) {
      if (term !== term.trim().toLowerCase() || term === "") {
        problems.push(`alias "${term}" for ${id} must be lowercase and trimmed`);
      } else if (!icon.entry.aliases.includes(term)) {
        icon.entry.aliases.push(term);
      }
    }
  }
  if (problems.length > 0) throw new Error(`Alias table problems:\n- ${problems.join("\n- ")}`);
}

function toEntry(draft: BuiltIcon["entry"]): IconEntry {
  return { id: `${draft.library}/${draft.slug}`, ...draft };
}

function compareEntries(a: IconEntry, b: IconEntry): number {
  return (
    libraryRank(a.library) - libraryRank(b.library) ||
    compareText(a.category, b.category) ||
    compareText(a.name, b.name) ||
    compareText(a.id, b.id)
  );
}

function compareText(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Replaces each library's SVGs wholesale so icons a vendor drops do not linger. */
async function writeAssets(icons: readonly BuiltIcon[]): Promise<void> {
  for (const library of LIBRARIES) {
    const dir = join(ASSETS_DIR, library.id);
    await mkdir(dir, { recursive: true });
    for (const file of await readdir(dir)) {
      if (file.endsWith(".svg")) await rm(join(dir, file));
    }
  }
  for (const { entry, svg } of icons) {
    await writeFile(join(ASSETS_DIR, entry.library, `${entry.slug}.svg`), `${svg}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
