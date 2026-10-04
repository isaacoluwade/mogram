import { expect, test } from "@playwright/test";
import { openDraft } from "./support";

/** Reduced motion (PR-9): motion starts paused, and stays the person's choice. */

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the editor starts paused and can still play", async ({ page }) => {
    await openDraft(page, "web-app");
    const play = page.getByRole("button", { name: "Play motion" });
    await expect(play).toBeVisible();
    await play.click();
    await expect(page.getByRole("button", { name: "Pause motion" })).toBeVisible();
  });

  test("the viewer starts paused too, and M toggles it", async ({ page }) => {
    const id = await openDraft(page, "web-app");
    await page.goto(`/draft/${id}/view`);
    await expect(page.getByRole("button", { name: "Play motion" })).toBeVisible();
    await page.keyboard.press("m");
    await expect(page.getByRole("button", { name: "Pause motion" })).toBeVisible();
  });
});

test("without reduced motion, diagrams move from the start", async ({ page }) => {
  await openDraft(page, "web-app");
  await expect(page.getByRole("button", { name: "Pause motion" })).toBeVisible();
});
