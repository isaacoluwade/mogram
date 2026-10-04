// UI discipline check (D-8, engineering standards §2): raw colours and arbitrary colour utilities
// may only appear in the design system (components/ui, styles) — everything else uses tokens.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SRC = join(root, "src");
const ALLOWED = [
  "src/components/ui/",
  "src/styles/",
  "src/app/icon.svg",
  // Email HTML must inline literal colours: mail clients don't support CSS variables.
  "src/server/email/",
  // Generated from docs/file-format.md (the spec shows `background: "#101418"` as an example).
  "src/generated/",
];
const PATTERNS = [
  { re: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b(?![\w-])/g, what: "raw hex colour" },
  { re: /\brgba?\(/g, what: "raw rgb() colour" },
  { re: /\bhsla?\(/g, what: "raw hsl() colour" },
  {
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|shadow)-\[(?:#|rgb|hsl)/g,
    what: "arbitrary colour utility",
  },
];

const problems = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|css)$/.test(entry)) check(path);
  }
}
function check(path) {
  const rel = relative(root, path);
  if (ALLOWED.some((prefix) => rel.startsWith(prefix))) return;
  // Tests use colour strings as data (e.g. parsing "#fff"); they render no UI.
  if (/\.test\.tsx?$/.test(rel)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, index) => {
    const text = line.trimStart();
    if (text.startsWith("//") || text.startsWith("/*") || text.startsWith("*")) return;
    for (const { re, what } of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line))
        problems.push(`${rel}:${index + 1}  ${what}: ${line.trim().slice(0, 120)}`);
    }
  });
}
walk(SRC);
if (problems.length > 0) {
  console.error(
    `UI discipline check failed — use tokens from src/styles/tokens.css:\n${problems.join("\n")}`,
  );
  process.exit(1);
}
console.log("UI discipline check passed.");
