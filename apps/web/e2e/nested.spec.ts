import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, openDraft, shot, viewerSettled, yaml } from "./support";

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("Not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function goInside(page: Page, name: string): Promise<void> {
  const tile = await centre(element(page, name).locator("rect").first());
  await page.mouse.dblclick(tile.x, tile.y);
}

test.describe("nested diagrams (NE-6, NE-8, NE-14)", () => {
  test("the editor zooms in through the tile, keeps the scene, and writes nested states to the top diagram's scene", async ({
    page,
  }) => {
    await openDraft(page, "aks");
    const scenes = page.getByRole("region", { name: "Scenes" });
    await scenes.getByRole("button", { name: "Scene: Black friday" }).click();

    await goInside(page, "aks");
    // A real transition draws both levels while the camera moves…
    await expect(page.getByTestId("level-transition")).toHaveAttribute("data-direction", "in");
    // …and hands over to the nested level when it lands.
    await expect(page.getByTestId("level-transition")).toHaveCount(0);
    await expect(element(page, "ingress")).toBeVisible();

    // The scene carries on inside: Checkout is scaling on Black Friday, as the viewer shows it.
    await expect(scenes).toContainText("Scenes of");
    await expect(scenes.getByRole("button", { name: "Scene: Black friday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(element(page, "checkout")).toHaveAttribute("data-state", "scaling");
    await page.waitForTimeout(400);
    await shot(page, "editor/nested-scene-black-friday");

    // Changing a state here is part of the story: it goes into the top diagram's scene.
    const tile = await centre(element(page, "checkout").locator("rect").first());
    await page.mouse.click(tile.x, tile.y);
    const bar = page.getByRole("toolbar", { name: "Quick edit" });
    await bar.getByRole("button", { name: "State in this scene" }).click();
    await page.getByRole("menuitemradio", { name: /Degraded/ }).click();
    await expect(element(page, "checkout")).toHaveAttribute("data-state", "degraded");
    await scenes.getByRole("button", { name: "Scene: Normal" }).click();
    await expect(element(page, "checkout")).toHaveAttribute("data-state", "healthy");

    // The way back is in plain sight.
    await page.getByRole("button", { name: "Back to Storefront on AKS" }).click();
    await expect(page.getByTestId("level-transition")).toHaveAttribute("data-direction", "out");
    await expect(page.getByTestId("level-transition")).toHaveCount(0);
    await expect(element(page, "front_door")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Storefront on AKS" })).toHaveCount(0);

    const text = await yaml(page);
    expect(text).toMatch(/black_friday:\n(?:    .*\n)*?    aks\.checkout: degraded/);
    // The nested diagram's own file is untouched by the scene choice.
    expect(text).not.toMatch(/aks\/mogram\.yaml[\s\S]*scenes:/);
  });

  test("the viewer zooms through the tile both ways, with a back button", async ({ page }) => {
    const id = await openDraft(page, "aks");
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await element(page, "aks").dblclick();
    await expect(page.getByTestId("level-transition")).toHaveAttribute("data-direction", "in");
    await viewerSettled(page);
    await expect(page).toHaveURL(/level=aks/);
    const back = page.getByRole("button", { name: "Back to Storefront on AKS" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByTestId("level-transition")).toHaveAttribute("data-direction", "out");
    await viewerSettled(page);
    await expect(page).not.toHaveURL(/level=aks/);
    await expect(back).toHaveCount(0);
  });
});

test("a scaling component inside a nested level draws as a clean stack (Black Friday)", async ({
  page,
}) => {
  const id = await openDraft(page, "aks");
  await page.goto(`/draft/${id}/view?level=aks&scene=black_friday`);
  await viewerSettled(page);
  const checkout = element(page, "checkout");
  await expect(checkout).toHaveAttribute("data-state", "scaling");
  // Zoom in on it, as someone looking closely would.
  const box = await checkout.locator("rect").first().boundingBox();
  if (box === null) throw new Error("Checkout is not on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
  }
  await page.waitForTimeout(1200);
  await shot(page, "viewer/nested-scaling-checkout");
});
