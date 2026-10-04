import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, yaml } from "./support";

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function select(page: Page, name: string): Promise<void> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

function inspector(page: Page) {
  return page.getByRole("region", { name: "Inspector" });
}

test.describe("inspector fields save as you type", () => {
  test("renames a component without Enter, as one undo step", async ({ page }) => {
    await openDraft(page, "web-app");
    await select(page, "web_vm");
    const name = inspector(page).getByLabel("Name", { exact: true });
    await name.click();
    await name.press(`${mod}+a`);
    await name.pressSequentially("web_server", { delay: 60 });
    // Saved while still typing in the field: nothing was pressed and focus never left.
    await expect(element(page, "web_server")).toHaveCount(1);
    await expect(name).toBeFocused();
    await expect(inspector(page).getByText(/already used|Names start/)).toHaveCount(0);
    await shot(page, "editor/rename-as-you-type");

    // The whole visit to the field is one undo step.
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 120 } });
    await page.keyboard.press(`${mod}+z`);
    await expect(element(page, "web_vm")).toHaveCount(1);
    await expect(element(page, "web_server")).toHaveCount(0);
  });

  test("says why a half-typed name can't be used, and Escape puts the name back", async ({
    page,
  }) => {
    await openDraft(page, "web-app");
    await select(page, "web_vm");
    const name = inspector(page).getByLabel("Name", { exact: true });
    await name.click();
    await name.press(`${mod}+a`);
    await name.pressSequentially("cache", { delay: 40 });
    await expect(
      inspector(page).getByText('"cache" is already used by another element.'),
    ).toBeVisible();
    await shot(page, "editor/name-already-used");
    await name.pressSequentially("_2", { delay: 40 });
    await expect(element(page, "cache_2")).toHaveCount(1);
    await name.press("Escape");
    await expect(element(page, "web_vm")).toHaveCount(1);
    await expect(element(page, "cache_2")).toHaveCount(0);
  });

  test("keeps a label typed just before clicking another element", async ({ page }) => {
    await openDraft(page, "web-app");
    await select(page, "web_vm");
    const label = inspector(page).getByLabel("Label", { exact: true });
    await label.click();
    await label.press(`${mod}+a`);
    await label.pressSequentially("Web server", { delay: 20 });
    // Straight to another element, before typing has paused long enough to save.
    await select(page, "cache");
    await expect(inspector(page).getByLabel("Label", { exact: true })).toHaveValue("Session cache");
    const text = await yaml(page);
    expect(text).toMatch(/web_vm:[\s\S]*?label: Web server/);
  });

  test("spaces a connection's From and To fields apart", async ({ page }) => {
    await openDraft(page, "web-app");
    await element(page, "door_to_gateway").getByText("HTTPS").click();
    const from = await inspector(page).getByRole("combobox", { name: "From" }).boundingBox();
    const to = await inspector(page).getByRole("combobox", { name: "To" }).boundingBox();
    if (from === null || to === null) throw new Error("Ends fields are not on screen");
    expect(to.y - (from.y + from.height)).toBeGreaterThanOrEqual(8);
    await shot(page, "editor/connection-ends");
  });
});

test.describe("canvas grid (ED-9)", () => {
  async function gridColour(page: Page): Promise<string | null> {
    return page
      .locator('[data-testid="editor-canvas"] pattern circle')
      .first()
      .getAttribute("fill");
  }

  test("shows on every canvas theme and on a custom background", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
    await inspector(page).getByLabel("Show grid").click();
    await expect.poll(() => gridColour(page)).toMatch(/^rgba\(255,255,255,0\.1\d\)$/);
    await shot(page, "editor/grid-midnight");

    await page.getByRole("radiogroup", { name: "Canvas theme" }).getByLabel("Sand").click();
    await expect.poll(() => gridColour(page)).toMatch(/^rgba\(0,0,0,0\.1\d\)$/);
    await shot(page, "editor/grid-sand");

    // A light custom colour on the dark theme: grid and labels switch to dark.
    await page.getByRole("radiogroup", { name: "Canvas theme" }).getByLabel("Midnight").click();
    await inspector(page)
      .getByRole("button", { name: /Midnight theme/ })
      .click();
    const search = page.getByLabel("Search colours for background");
    await search.pressSequentially("#f0e6d2", { delay: 30 });
    await search.press("Enter");
    await page.keyboard.press("Escape");
    await expect.poll(() => gridColour(page)).toMatch(/^rgba\(0,0,0,/);
    await expect(element(page, "web_vm").locator("text").last()).toHaveAttribute("fill", "#171717");
    await shot(page, "editor/grid-custom-light");
  });
});
