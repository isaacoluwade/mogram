import { expect, test } from "@playwright/test";
import { openSection, openYaml, shot, signIn, uniqueEmail, watchErrors } from "./support";

/** Accounts, cloud diagrams and share links (AC-3 … AC-6, SH-1 … SH-5). */
test.describe("cloud", () => {
  test("sign in, create from a template, share, view signed out, then make it private", async ({
    page,
    browser,
  }) => {
    const errors = watchErrors(page);
    await signIn(page, uniqueEmail("share"));
    await shot(page, "dashboard/signed-in-empty");
    await page.getByRole("button", { name: "Use the Region failover template" }).click();
    await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share" });
    await expect(dialog).toContainText("Only you");
    await dialog.getByLabel("General access").click();
    await page.getByRole("option", { name: /Anyone with the link/ }).click();
    const link = await dialog.getByLabel("Link", { exact: true }).inputValue();
    expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/);
    await shot(page, "share/dialog-link-on");
    await page.keyboard.press("Escape");

    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewer = await visitor.newPage();
    const viewerErrors = watchErrors(viewer);
    await viewer.goto(`${link}?scene=east_outage`);
    await expect(viewer.getByTestId("viewer-canvas")).toBeVisible();
    await expect(viewer.getByRole("button", { name: "East outage" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await viewer.waitForTimeout(900);
    await shot(viewer, "share/viewer-390-east-outage");

    await page.getByRole("button", { name: "Share", exact: true }).click();
    await dialog.getByLabel("General access").click();
    await page.getByRole("option", { name: /Only you/ }).click();
    await expect(dialog).toContainText("Private");
    const gone = await viewer.goto(link);
    expect(gone?.status()).toBe(404);
    await expect(viewer.getByText("This link doesn't open a diagram")).toBeVisible();
    expect([...errors, ...viewerErrors]).toEqual([]);
    await visitor.close();
  });

  test("a second tab saving first raises a conflict that can load the newer version (AC-4)", async ({
    page,
    context,
  }) => {
    await signIn(page, uniqueEmail("conflict"));
    await page.getByRole("button", { name: "Use the Three-tier web app template" }).click();
    await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const url = page.url();

    const other = await context.newPage();
    await other.goto(url);
    await expect(other.getByTestId("editor-canvas")).toBeVisible();
    // Edit in the second tab: select an element and nudge it, which autosaves.
    // The editor's hover overlay sits on top of the element with the same name; click through it.
    await other.locator('[data-element="shopper"]').first().click({ force: true });
    await other.keyboard.press("ArrowRight");
    await expect(other.getByText("Saved", { exact: true })).toBeVisible();

    // Now edit the first tab, which still has the older version.
    await page.locator('[data-element="shopper"]').first().click({ force: true });
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("alert").filter({ hasText: "changed somewhere else" }),
    ).toBeVisible();
    await shot(page, "editor/conflict-banner");
    await page.getByRole("button", { name: "Load newer" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  });

  test("version history restores the first version, name and all", async ({ page }) => {
    await signIn(page, uniqueEmail("history"));
    await page.getByRole("button", { name: "Use the Microservices on AKS template" }).click();
    await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const title = page.getByTitle("Rename diagram");
    const original = (await title.textContent()) ?? "";

    // An edit straight away: the first version must still be there to go back to.
    await title.click(); // the name field opens focused
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Renamed shop");
    await page.keyboard.press("Enter");
    await expect(title).toHaveText("Renamed shop");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Version history/ }).click();
    const panel = page.getByRole("region", { name: "Version history" });
    const versions = panel.getByTestId("version");
    await expect(versions).toHaveCount(2);
    await expect(versions.first()).toContainText("Current version");
    await expect(versions.first()).toContainText("Renamed the diagram");
    await expect(versions.last()).toContainText("Created");

    // The first version, on the canvas, then restored as a new version on top.
    await versions.last().getByRole("button").first().click();
    const banner = page.getByTestId("version-banner");
    await expect(banner).toBeVisible();
    await expect(title).toHaveText(original);
    await page.waitForTimeout(800);
    await shot(page, "editor/version-history-cloud");
    await banner.getByRole("button", { name: "Restore" }).click();
    await expect(banner).toBeHidden();
    await expect(title).toHaveText(original);
    await expect(page.getByText(/Restored the version from/).first()).toBeVisible();
    await expect(versions).toHaveCount(3);
    await expect(versions.first()).toContainText(/Restored the version from/);

    // Named versions are kept: name this one, and it shows by its name.
    await panel.getByRole("button", { name: "Name the current version" }).click();
    await panel.getByRole("textbox", { name: "Name for the current version" }).fill("Launch");
    await panel.getByRole("button", { name: "Name it" }).click();
    await expect(versions.first()).toContainText("Launch");
    await expect(versions).toHaveCount(3);
  });

  test("a draft's history goes with it to the account", async ({ page }) => {
    await signIn(page, uniqueEmail("draft-history"));
    await openYaml(
      page,
      `mogram: 1
name: Shop
components:
  api: { type: generic/service, label: Orders API }
  db: { type: generic/database, label: Orders DB }
layout:
  api: [0, 0]
  db: [20, 0]
`,
    );
    await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Version history/ }).click();
    const panel = page.getByRole("region", { name: "Version history" });
    await panel.getByRole("button", { name: "Name the current version" }).click();
    await panel.getByRole("textbox", { name: "Name for the current version" }).fill("Two parts");
    await panel.getByRole("button", { name: "Name it" }).click();
    await expect(panel.getByTestId("version").first()).toContainText("Two parts");
    const canvas = page.getByTestId("editor-canvas");
    const db = canvas.locator('[data-element="db"]').first();
    const box = await db.locator("rect").first().boundingBox();
    if (box === null) throw new Error("db not on screen");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press("Delete");
    await expect(db).toHaveCount(0);

    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Save to cloud/ }).click();
    await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Version history/ }).click();
    const versions = page.getByRole("region", { name: "Version history" }).getByTestId("version");
    await expect(versions).toHaveCount(3);
    await expect(versions.first()).toContainText("Saved to your account");
    await expect(versions.nth(1)).toContainText("Two parts");
    await expect(versions.last()).toContainText("Created");
    await versions.nth(1).getByRole("button").first().click();
    await expect(page.getByTestId("version-banner")).toContainText("Two parts");
    await expect(db).toBeVisible();
  });

  test("the dashboard lists cloud diagrams and renames into the YAML; a concept in the account is offered (D-83)", async ({
    page,
  }) => {
    // One sign-in for both: codes are limited per address and per client.
    await signIn(page, uniqueEmail("dashboard"));
    await page.getByRole("button", { name: "Use the Region failover template" }).click();
    await page.waitForURL(/\/edit\//);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await openSection(page, "Concept");
    await page.getByRole("button", { name: "Make it a concept" }).click();
    await expect(page.getByRole("textbox", { name: "Concept summary" })).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.goto("/diagrams");
    const card = page.getByRole("article").filter({ hasText: "Region failover" }).first();
    await expect(card).toContainText("Private");
    await card.hover();
    await card.getByRole("button", { name: /options/ }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Failover drill");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Failover drill" })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "dashboard/signed-in-with-diagram");

    // Another diagram in the account offers it under Yours.
    await page.getByRole("button", { name: /^Use the Three-tier web app template/ }).click();
    await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
    await page
      .getByRole("tablist", { name: "Left panel" })
      .getByRole("tab", { name: "Concepts" })
      .first()
      .click();
    const mine = page
      .getByRole("region", { name: "Yours" })
      .getByRole("button", { name: "Concept: Failover drill" });
    await expect(mine).toBeVisible();
    await mine.click();
    const dialog = page.getByRole("dialog", { name: "Failover drill" });
    await expect(dialog).toContainText("Yours, in your account");
    await expect(
      dialog.getByTestId("concept-preview").locator("[data-element]").first(),
    ).toBeVisible();
  });
});
