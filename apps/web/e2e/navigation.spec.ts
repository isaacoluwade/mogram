import { expect, test, type Locator } from "@playwright/test";
import { element, openDraft, shot, viewerSettled } from "./support";

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("Not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("getting around the app", () => {
  test("Preview opens the viewer where you are editing, and leads back to the editor", async ({
    page,
  }) => {
    await openDraft(page, "aks");
    const editor = page.url();
    await page
      .getByRole("region", { name: "Scenes" })
      .getByRole("button", { name: "Scene: Bad deploy" })
      .click();
    const aks = await centre(element(page, "aks").locator("rect").first());
    await page.mouse.dblclick(aks.x, aks.y);
    await expect(page.getByTestId("level-transition")).toHaveCount(0);
    await expect(element(page, "ingress")).toBeVisible();

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page).toHaveURL(/\/view\?level=aks&scene=bad_deploy$/);
    await viewerSettled(page);
    await expect(page.getByText("Preview", { exact: true })).toBeVisible();
    // The preview opened inside AKS, in Bad deploy: Checkout is down there.
    await expect(element(page, "checkout")).toHaveAttribute("data-state", "down");
    const scenes = page.getByRole("group", { name: "Scenes" });
    await expect(scenes.getByRole("button", { name: "Bad deploy" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(scenes.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.waitForTimeout(700);
    await shot(page, "viewer/preview-nested-scene");

    await page.getByRole("link", { name: "Back to editor" }).last().click();
    await expect(page).toHaveURL(editor);
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
  });

  test("Shift+P previews from the keyboard", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 120 } });
    await page.keyboard.press("Shift+P");
    await expect(page).toHaveURL(/\/view$/);
    await viewerSettled(page);
  });

  test("tours are written at the top level; inside a nested diagram the panel says so", async ({
    page,
  }) => {
    await openDraft(page, "aks");
    const aks = await centre(element(page, "aks").locator("rect").first());
    await page.mouse.dblclick(aks.x, aks.y);
    await expect(page.getByTestId("level-transition")).toHaveCount(0);
    await page.getByRole("button", { name: "Tours", exact: true }).click();
    const panel = page.getByRole("region", { name: "Tours" });
    await expect(panel).toContainText("Tours belong to Storefront on AKS");
    await panel.getByRole("button", { name: "Back to Storefront on AKS" }).click();
    await expect(element(page, "front_door")).toBeVisible();
    await expect(panel.getByRole("tab", { name: "How an order flows" })).toBeVisible();
  });

  test("sign-in offers a way on without an account", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Continue without an account" }).click();
    await expect(page).toHaveURL(/\/diagrams$/);
  });
});
