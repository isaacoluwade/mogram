import { expect, test, type Page } from "@playwright/test";
import { openYaml, shot, yaml } from "./support";

/** Version history (H4): versions with what changed, an earlier one read-only, and getting it back. */

const DIAGRAM = `mogram: 1
name: Shop
components:
  web: { type: generic/web-app, label: Web }
  api: { type: generic/service, label: Orders API }
  db: { type: generic/database, label: Orders DB }
connections:
  web_to_api: { from: web, to: api }
  api_to_db: { from: api, to: db }
layout:
  web: [0, 0]
  api: [20, 0]
  db: [40, 0]
`;

/** On the canvas (the panel's thumbnails draw elements too). */
function element(page: Page, name: string) {
  return page.getByTestId("editor-canvas").locator(`[data-element="${name}"]`).first();
}

async function select(page: Page, name: string) {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function saved(page: Page) {
  await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
}

async function openHistory(page: Page) {
  await page.getByRole("button", { name: "Diagram menu" }).click();
  await page.getByRole("menuitem", { name: /Version history/ }).click();
  return page.getByRole("region", { name: "Version history" });
}

/** Names the diagram as it is now, from the panel. */
async function nameCurrent(page: Page, name: string) {
  const panel = page.getByRole("region", { name: "Version history" });
  await panel.getByRole("button", { name: "Name the current version" }).click();
  await panel.getByRole("textbox", { name: "Name for the current version" }).fill(name);
  await panel.getByRole("button", { name: "Name it" }).click();
  await expect(panel.getByTestId("version").first()).toContainText(name);
}

test.describe("version history", () => {
  test("lists versions with what changed and shows an earlier one read-only", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await saved(page);
    // The save status under the name opens it (the diagram menu does too).
    await page.getByRole("button", { name: /· Version history$/ }).click();
    const panel = page.getByRole("region", { name: "Version history" });
    await expect(panel).toBeVisible();
    // The history panel takes the inspector's place.
    await expect(page.getByRole("region", { name: "Inspector" })).toHaveCount(0);
    const versions = panel.getByTestId("version");
    await expect(versions).toHaveCount(2);
    await expect(versions.first()).toContainText("Current version");
    await expect(versions.first()).toContainText(/Added Web, Orders API and \d more/);
    await expect(versions.last()).toContainText("Created");

    await nameCurrent(page, "Before cleanup");
    await expect(versions).toHaveCount(2);

    await select(page, "db");
    await page.keyboard.press("Delete");
    await expect(element(page, "db")).toHaveCount(0);
    await saved(page);
    await expect(versions).toHaveCount(3);
    await expect(versions.first()).toContainText("Removed Orders DB");

    // The named version, on the canvas: read-only, with what it changed.
    await versions.filter({ hasText: "Before cleanup" }).getByRole("button").first().click();
    const banner = page.getByTestId("version-banner");
    await expect(banner).toContainText("Before cleanup");
    await expect(banner).toContainText("Read-only");
    await expect(element(page, "db")).toBeVisible();
    const marks = page.locator('[data-overlay="version-changes"]');
    await expect(marks.locator('[data-change="added"][data-name="db"]')).toBeAttached();
    const changes = panel.getByRole("list", { name: "Changes in this version" });
    await expect(changes.getByTestId("version-change").first()).toBeVisible();
    await expect(changes).toContainText("Orders DB");

    await select(page, "db");
    await page.keyboard.press("Delete");
    await expect(page.getByText(/looking at an earlier version/)).toBeVisible();
    await expect(element(page, "db")).toBeVisible();

    // Compared with now: what has gone since is marked on this version.
    await banner.getByRole("combobox", { name: "Show changes" }).click();
    await page.getByRole("option", { name: "Changes since then" }).click();
    await expect(marks.locator('[data-change="removed"][data-name="db"]')).toBeAttached();
    await expect(banner.getByRole("list", { name: "Colours" })).toContainText("Removed");
    await page.waitForTimeout(400);
    await shot(page, "editor/version-history");

    // Bring back what's selected: the current version gets it (and its connection) back.
    await banner.getByRole("button", { name: "Bring back selected" }).click();
    await expect(banner).toBeHidden();
    await expect(page.getByText("Brought back Orders DB.")).toBeVisible();
    await expect(element(page, "db")).toBeVisible();
    await expect(versions.first()).toHaveAttribute("aria-current", "true");
    await expect.poll(() => yaml(page)).toContain("api_to_db: { from: api, to: db }");
    // One step to undo.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(element(page, "db")).toHaveCount(0);
  });

  test("restoring adds a version on top, and a copy opens on its own", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await saved(page);
    const panel = await openHistory(page);
    const versions = panel.getByTestId("version");
    await nameCurrent(page, "Three services");
    await select(page, "db");
    await page.keyboard.press("Delete");
    await saved(page);
    await expect(versions).toHaveCount(3);

    // Esc goes back to the current version.
    await versions.filter({ hasText: "Three services" }).getByRole("button").first().click();
    const banner = page.getByTestId("version-banner");
    await expect(banner).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(banner).toBeHidden();
    await expect(element(page, "db")).toHaveCount(0);

    await versions.filter({ hasText: "Three services" }).getByRole("button").first().click();
    await banner.getByRole("button", { name: "Restore" }).click();
    await expect(banner).toBeHidden();
    await expect(element(page, "db")).toBeVisible();
    await expect(page.getByText(/Restored the version from/).first()).toBeVisible();
    await expect(versions).toHaveCount(4);
    await expect(versions.first()).toContainText(/Restored the version from/);
    await expect(versions.filter({ hasText: "Removed Orders DB" })).toHaveCount(1);

    // Renaming a version, then copying it.
    const named = versions.filter({ hasText: "Three services" });
    await named.hover();
    await named.getByRole("button", { name: "Version actions" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await panel.getByRole("textbox", { name: "Version name" }).fill("All three");
    await panel.getByRole("button", { name: "Save" }).click();
    await expect(versions.filter({ hasText: "All three" })).toHaveCount(1);

    const draft = page.url();
    const renamed = versions.filter({ hasText: "All three" });
    await renamed.hover();
    await renamed.getByRole("button", { name: "Version actions" }).click();
    await page.getByRole("menuitem", { name: "Make a copy" }).click();
    await page.waitForURL((url) => url.href !== draft && /\/draft\/[A-Za-z0-9_-]+$/.test(url.href));
    await expect(page.getByTitle("Rename diagram")).toHaveText("Shop copy");
    await expect(element(page, "db")).toBeVisible();
  });
});
