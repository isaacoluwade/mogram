// Developer helper: screenshot a page at one or more viewport widths.
// Usage: node scripts/shot.mjs <url> <outPrefix> [width,width,...] [--full]
import { chromium } from "@playwright/test";

const [url, outPrefix, widthsArg = "1440", ...flags] = process.argv.slice(2);
if (!url || !outPrefix) {
  console.error("Usage: node scripts/shot.mjs <url> <outPrefix> [widths] [--full]");
  process.exit(1);
}
const fullPage = flags.includes("--full");
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
for (const width of widthsArg.split(",").map(Number)) {
  const page = await browser.newPage({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: 1,
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${width}] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${width}] pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const path = `${outPrefix}-${width}.png`;
  await page.screenshot({ path, fullPage });
  console.log(path);
  await page.close();
}
await browser.close();
if (errors.length > 0) console.log(`Console errors:\n${errors.join("\n")}`);
