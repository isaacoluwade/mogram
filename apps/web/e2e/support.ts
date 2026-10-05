import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

const SHOTS = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));

/** Saves a screenshot into docs/screenshots/<name>.png (the visual record of every state). */
export async function shot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  const path = `${SHOTS}${name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: options.fullPage ?? false, animations: "allow" });
}

/** Console errors and uncaught exceptions; tests assert there are none. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A 404 page's own document request is logged by the browser; that's expected.
    if (text.startsWith("Failed to load resource") && text.includes("404")) return;
    errors.push(text);
  });
  return errors;
}

/** Makes a browser draft from a template and waits for the editor. Returns the draft id. */
export async function openDraft(page: Page, template: string): Promise<string> {
  await page.goto(`/draft/new?template=${template}`);
  await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
  await expect(page.getByTestId("editor-canvas")).toBeVisible();
  // Drawn and framed: every component's icon is in, then two frames for the fit to apply.
  await page.waitForFunction(() => {
    const diagram = document.querySelector('[data-layer="diagram"]');
    if (diagram === null) return false;
    const components = diagram.querySelectorAll('[data-kind="component"]').length;
    return diagram.querySelectorAll("image").length >= components;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  return page.url().split("/").pop() ?? "";
}

/** Signs in with the code from the development mailbox. */
export async function signIn(page: Page, email: string, next = "/diagrams"): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  const mail = (await (
    await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(email)}`)
  ).json()) as { messages: { text: string }[] };
  const code = /\b(\d{6})\b/.exec(mail.messages[0]?.text ?? "")?.[1] ?? "";
  await page.getByLabel("Sign-in code").fill(code);
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;

/**
 * The diagram's main YAML file, exactly as "Download files" saves it. (The code panel only renders
 * the lines on screen, so it can't be read whole.)
 */
export async function yaml(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Diagram menu" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Download files/ }).click();
  const saved = await download;
  const bytes = readFileSync(await saved.path());
  if (!saved.suggestedFilename().endsWith(".zip")) return bytes.toString("utf8");
  // Folder diagrams download as a zip of the folder: read its top-level mogram.yaml.
  const entries = unzipSync(new Uint8Array(bytes));
  const main = Object.keys(entries).find((path) => /^[^/]+\/mogram\.yaml$/.test(path));
  return main === undefined ? "" : strFromU8(entries[main] ?? new Uint8Array());
}

export function element(page: Page, name: string): Locator {
  return page.locator(`[data-element="${name}"]`).first();
}

/** The page never scrolls sideways at this width. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export const WIDTHS = [390, 834, 1280, 1440] as const;

/** Waits until the viewer has framed the diagram and no camera move is running. */
export async function viewerSettled(page: Page): Promise<void> {
  await expect(
    page.locator('[data-testid="viewer-canvas"][data-ready="true"]:not([data-animating])'),
  ).toBeVisible();
}

/** A new draft holding exactly `yaml` (opened through "Open files…", as a person would). */
export async function openYaml(page: Page, yaml: string): Promise<string> {
  const id = await openDraft(page, "blank");
  await page.getByRole("button", { name: "Diagram menu" }).click();
  await page.getByRole("menuitem", { name: /Open files/ }).click();
  await page
    .getByRole("dialog", { name: "Open files" })
    .locator('input[type="file"][multiple]')
    .setInputFiles({
      name: "diagram.mogram.yaml",
      mimeType: "text/yaml",
      buffer: Buffer.from(yaml),
    });
  await expect(page.getByRole("dialog", { name: "Open files" })).toHaveCount(0);
  await page.waitForFunction(() => {
    const diagram = document.querySelector('[data-layer="diagram"]');
    if (diagram === null) return false;
    // Icon components wait for their icons; shapes have none.
    const icons = diagram.querySelectorAll('[data-kind="component"]:not([data-shape])').length;
    const shapes = diagram.querySelectorAll("[data-shape]").length;
    return icons + shapes > 0 && diagram.querySelectorAll("image").length >= icons;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  return id;
}

/** Opens one of the inspector's tabs: Element, Style or Arrange; Diagram or Canvas. */
export async function inspectorTab(page: Page, name: string): Promise<void> {
  await page
    .getByRole("region", { name: "Inspector" })
    .getByRole("tab", { name, exact: true })
    .click();
}

/** Opens a folded inspector section by its title (sections remember being open or closed). */
export async function openSection(page: Page, title: string): Promise<void> {
  const header = page
    .getByRole("region", { name: "Inspector" })
    .getByRole("button", { name: title, exact: true });
  if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
}
