// Copies generated static assets into public/ before dev and build:
//  - icon artwork from @mogram/icons (served at /icons/<library>/<slug>.svg)
//  - the font files export embeds into SVG/PNG/GIF output (D-10, ED-25)
//  - docs/file-format.md as a module, so /docs/format renders the one canonical spec
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
execFileSync(
  process.execPath,
  [join(app, "../../packages/icons/scripts/sync-assets.mjs"), join(app, "public/icons")],
  { stdio: "inherit" },
);

const fonts = [
  [
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    "inter-latin-wght-normal.woff2",
  ],
  [
    "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
    "geist-latin-wght-normal.woff2",
  ],
  [
    "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
    "instrument-sans-latin-wght-normal.woff2",
  ],
  [
    "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
    "geist-mono-latin-wght-normal.woff2",
  ],
];
const target = join(app, "public/fonts");
mkdirSync(target, { recursive: true });
for (const [from, to] of fonts) {
  const source = join(app, "node_modules", from);
  const destination = join(target, to);
  if (!existsSync(destination) || statSync(destination).size !== statSync(source).size)
    copyFileSync(source, destination);
}
const spec = readFileSync(join(app, "../../docs/file-format.md"), "utf8");
const source = `// Generated from docs/file-format.md by scripts/sync-assets.mjs. Do not edit.\nexport const FILE_FORMAT_MARKDOWN = ${JSON.stringify(spec)};\n`;
const generated = join(app, "src/generated/file-format.ts");
mkdirSync(dirname(generated), { recursive: true });
if (!existsSync(generated) || readFileSync(generated, "utf8") !== source)
  writeFileSync(generated, source);

console.log("Assets synced: public/icons, public/fonts, src/generated/file-format.ts");
