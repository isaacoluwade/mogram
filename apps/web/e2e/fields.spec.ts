import { expect, test, type Page } from "@playwright/test";
import { element, inspectorTab, openDraft, openSection, shot, yaml } from "./support";

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
    await openSection(page, "Details");
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
    await openSection(page, "Details");
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
    await inspectorTab(page, "Canvas");
    await expect(inspector(page).getByLabel("Show grid")).toBeChecked();
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

  test("lines or dots, every mark on a snap point, remembered after a reload", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
    await inspectorTab(page, "Canvas");
    await expect(page.locator('[data-grid="dots"]')).toHaveCount(1);
    await inspector(page).getByRole("radio", { name: "Lines", exact: true }).click();
    // Close enough to place things cell by cell: single-cell lines and the 10-cell ones.
    await page.getByRole("button", { name: "Reset zoom to 100%" }).click();
    const level = (name: string) => page.locator(`[data-grid="lines"] [data-level="${name}"]`);
    await expect(level("fine")).toHaveCount(1);
    // Every line sits on the snap grid: multiples of 8px, the stronger ones of 80px (10 cells).
    const positions = async (name: string) =>
      ((await level(name).getAttribute("d")) ?? "")
        .split("M")
        .filter(Boolean)
        .map((segment) => segment.split(/[ VH]/).map(Number));
    for (const [x, y] of await positions("fine"))
      expect(Number.isInteger((x ?? 0) / 8) || Number.isInteger((y ?? 0) / 8)).toBe(true);
    for (const [x, y] of await positions("coarse"))
      expect(Number.isInteger((x ?? 0) / 80) || Number.isInteger((y ?? 0) / 80)).toBe(true);
    await shot(page, "editor/grid-lines");

    // Zoomed well out, only the 10-cell lines remain.
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(level("fine")).toHaveCount(0);
    await expect(level("coarse")).toHaveCount(1);

    // A personal setting: still lines after a reload; and off stays off.
    await page.reload();
    await expect(page.locator('[data-grid="lines"]')).toHaveCount(1);
    await page
      .getByRole("toolbar", { name: "Tools" })
      .getByRole("button", { name: "Hide grid" })
      .click();
    await expect(page.locator("[data-grid]")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await expect(page.locator("[data-grid]")).toHaveCount(0);
  });

  test("See all shows every theme by family; one picked there joins the first row", async ({
    page,
  }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
    await inspectorTab(page, "Canvas");
    const featured = page.getByRole("radiogroup", { name: "Canvas theme" });
    await expect(featured.getByRole("radio")).toHaveCount(10);
    await shot(page, "editor/canvas-themes");

    await inspector(page).getByRole("button", { name: "See all" }).click();
    const all = inspector(page).getByRole("region", { name: "All canvas themes" });
    for (const family of ["Dark", "Deep colours", "Vivid gradients", "Drafting", "Light", "Pastel"])
      await expect(all.getByRole("group", { name: family })).toBeVisible();
    await expect(all.getByRole("radio")).toHaveCount(30);
    await all.getByRole("radio", { name: "Chalkboard" }).click();
    await expect.poll(() => yaml(page)).toContain("theme: chalkboard");
    await expect(all.getByRole("radio", { name: "Chalkboard" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await shot(page, "editor/canvas-themes-all");

    await inspector(page).getByRole("button", { name: "Back" }).click();
    const first = featured.getByRole("radio").first();
    await expect(first).toHaveAccessibleName("Chalkboard");
    await expect(first).toHaveAttribute("aria-checked", "true");
    await expect(featured.getByRole("radio")).toHaveCount(10);
  });
});
