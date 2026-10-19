import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, openDraft, openProject, shot, viewerSettled, yaml } from "./support";

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

/** A project whose own diagram tells no story, with one in a folder that does (D-97). */
const COURSE = {
  "mogram.yaml": `mogram: 1
name: Course
shapes:
  cover: { label: A course }
layout:
  cover: [0, 0]
`,
  "slides/flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
  apply: { label: Apply, show: hidden }
stories:
  main:
    - say: You write what you want.
    - say: Terraform plans it.
      set: { plan: shown }
    - say: Then it applies it.
      set: { apply: shown }
layout:
  write: [0, 0]
  plan: [30, 0]
  apply: [60, 0]
`,
};

test.describe("a folder by itself (D-97)", () => {
  test("a diagram in a folder plays its own story in the viewer, by link", async ({ page }) => {
    const id = await openProject(page, COURSE);
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });

    // The project's own diagram has no story to play.
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await expect(page.getByTestId("story-caption")).toHaveCount(0);

    // The folder, by itself, plays its own.
    await page.goto(`/draft/${id}/view?root=slides/flow`);
    await viewerSettled(page);
    await expect(element(page, "write")).toBeVisible();
    await expect(element(page, "plan")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("story-caption")).toHaveText("You write what you want.");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("story-caption")).toHaveText("Terraform plans it.");
    await expect(element(page, "plan")).toBeVisible();
    // The link says which folder and how far, and opens there again.
    await expect(page).toHaveURL(/\?root=slides\/flow&story=main&beat=2$/);
    await page.reload();
    await viewerSettled(page);
    await expect(page.getByTestId("story-caption")).toHaveText("Terraform plans it.");
    // A folder that isn't there is the project's own diagram.
    await page.goto(`/draft/${id}/view?root=slides/nowhere`);
    await viewerSettled(page);
    await expect(element(page, "cover")).toBeVisible();
  });

  test("the editor opens a folder by itself: its story in the dock, in exports and in the preview link", async ({
    page,
  }) => {
    const id = await openProject(page, COURSE);
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
    await page.goto(`/draft/${id}?root=slides/flow`);
    await expect(element(page, "write")).toBeVisible();
    await page.getByRole("radio", { name: "Story" }).click();
    const dock = page.getByRole("region", { name: "Story" });
    await dock.getByRole("button", { name: /^Beat 2: Terraform plans it/ }).click();
    await expect(element(page, "plan")).toBeVisible();

    await page.getByRole("button", { name: "Export" }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export" });
    await expect(exportDialog).toContainText("The story, at the step showing");
    await page.keyboard.press("Escape");

    // The preview is of this folder, and comes back to it.
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page).toHaveURL(/\/view\?root=slides\/flow/);
    // It opens at the beat showing in the editor, as Present does.
    await expect(page).toHaveURL(/[?&]story=main&beat=2/);
    await viewerSettled(page);
    await expect(page.getByTestId("story-caption")).toHaveText(/^Terraform plans it/);
    await page.getByRole("link", { name: "Back to editor" }).first().click();
    await expect(page).toHaveURL(/\/draft\/[^/?]+\?root=slides\/flow$/);
    await expect(element(page, "write")).toBeVisible();
  });
});
