// Plays a concept's YAML file in the viewer and saves a screenshot of the opening and of each beat.
// Usage: node shots-yaml.mjs <file.mogram.yaml> <output folder> [beats=12]
import { readFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { chromium } from "../../../../apps/web/node_modules/@playwright/test/index.mjs";
const [file, out, beats = "12"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const name = basename(file).replace(".mogram.yaml", "");
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:3100/draft/new?template=blank");
await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/, { timeout: 90000 });
await page.getByTestId("editor-canvas").waitFor({ timeout: 90000 });
await page.getByRole("button", { name: "Diagram menu" }).click();
await page.getByRole("menuitem", { name: /Open files/ }).click();
await page
  .getByRole("dialog", { name: "Open files" })
  .locator('input[type="file"][multiple]')
  .setInputFiles({
    name: "diagram.mogram.yaml",
    mimeType: "text/yaml",
    buffer: readFileSync(file),
  });
await page
  .getByRole("dialog", { name: "Open files" })
  .waitFor({ state: "detached", timeout: 30000 });
await page.getByText("Draft saved in this browser").waitFor({ timeout: 20000 });
const problems = await page
  .getByRole("region", { name: "Inspector" })
  .textContent()
  .catch(() => "");
const id = page.url().split("/").pop();
await page.goto(`http://localhost:3100/draft/${id}/view`);
await page.getByTestId("viewer-canvas").waitFor({ timeout: 60000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/${name}-0.png` });
let last = null;
for (let beat = 1; beat <= Number(beats); beat++) {
  const more = await page
    .getByRole("button", { name: /^(Next|Start)$/ })
    .isEnabled()
    .catch(() => false);
  if (!more) break;
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2400);
  const caption = await page
    .getByTestId("story-caption")
    .textContent()
    .catch(() => null);
  await page.screenshot({ path: `${out}/${name}-${beat}.png` });
  console.log(beat, caption);
  last = beat;
}
console.log(
  "beats:",
  last,
  "errors:",
  errors.slice(0, 5),
  /Problems\s*[1-9]/.test(problems ?? "") ? "the editor reports problems" : "",
);
await browser.close();
