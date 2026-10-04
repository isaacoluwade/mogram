import { expect, test } from "@playwright/test";
import { element, openDraft, shot, uniqueEmail } from "./support";

/** Screenshots of states the journeys don't otherwise capture (UX-6). */

test("sign-in: the code step", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(uniqueEmail("gallery"));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  await shot(page, "sign-in/code-step");
});

test("dashboard: drafts in this browser", async ({ page }) => {
  await openDraft(page, "aks");
  await openDraft(page, "failover");
  await page.goto("/diagrams");
  await expect(
    page.getByRole("article").filter({ hasText: "Region failover" }).first(),
  ).toBeVisible();
  // Drafts left before their thumbnail was made get one here, swapped in when it's ready.
  await expect(page.getByRole("article").locator('img[src^="data:image"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await shot(page, "dashboard/drafts");
});

test("editor: code panel, card editor and the share dialog for a draft", async ({ page }) => {
  await openDraft(page, "web-app");
  await page.getByRole("button", { name: "YAML code" }).click();
  await expect(page.getByRole("region", { name: "YAML code" })).toBeVisible();
  // The code editor loads on first use; wait for it rather than its loading line.
  await expect(page.getByRole("textbox", { name: "Contents of mogram.yaml" })).toBeVisible();
  await shot(page, "editor/code-panel");

  await page.getByRole("button", { name: "Hide code" }).click();
  // Closing the code panel uncovers the inspector it replaced.
  await expect(page.getByRole("region", { name: "Inspector" })).toBeVisible();
  const vm = await element(page, "web_vm").locator("rect").first().boundingBox();
  if (vm === null) throw new Error("web_vm not on screen");
  await page.mouse.click(vm.x + vm.width / 2, vm.y + vm.height / 2);
  await page
    .getByRole("region", { name: "Inspector" })
    .getByText("Card", { exact: true })
    .scrollIntoViewIfNeeded();
  await shot(page, "editor/inspector-card");

  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Share" })).toContainText(
    "This draft lives only in this browser",
  );
  await shot(page, "share/dialog-draft");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("editor panels open as bottom sheets", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.getByRole("region", { name: "Icon library" })).toBeVisible();
    await shot(page, "editor/phone-library-sheet");
    await page.getByRole("button", { name: "Hide library" }).click();
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await expect(page.getByRole("region", { name: "Inspector" })).toBeVisible();
    await shot(page, "editor/phone-inspector-sheet");
  });

  test("viewer card as a bottom sheet", async ({ page }) => {
    const id = await openDraft(page, "web-app");
    await page.goto(`/draft/${id}/view?card=db_primary`);
    await expect(page.getByRole("dialog", { name: "Orders database" })).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, "viewer/phone-card");
  });
});

test("landing page, full length", async ({ page }) => {
  await page.goto("/");
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await shot(page, "pages/landing-full-1440", { fullPage: true });
});
