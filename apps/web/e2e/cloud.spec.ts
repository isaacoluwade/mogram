import { expect, test } from "@playwright/test";
import { shot, signIn, uniqueEmail, watchErrors } from "./support";

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
    const dialog = page.getByRole("dialog", { name: "Version history" });
    await expect(dialog.getByText("Current")).toBeVisible();
    await dialog.getByRole("button", { name: /Version 1\b/ }).click();
    await page.waitForTimeout(800);
    await shot(page, "editor/version-history");
    await dialog.getByRole("button", { name: "Restore this version" }).click();
    await expect(dialog).toBeHidden();
    await expect(title).toHaveText(original);
    await expect(page.getByText(/Version restored/)).toBeVisible();
  });

  test("the dashboard lists cloud diagrams and renames into the YAML", async ({ page }) => {
    await signIn(page, uniqueEmail("dashboard"));
    await page.getByRole("button", { name: "Use the Region failover template" }).click();
    await page.waitForURL(/\/edit\//);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
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
  });
});
