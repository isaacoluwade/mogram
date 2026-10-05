import { expect, test, type Page } from "@playwright/test";
import { inspectorTab, openDraft, shot, yaml } from "./support";

function inspector(page: Page) {
  return page.getByRole("region", { name: "Inspector" });
}

async function diagramSettings(page: Page): Promise<void> {
  await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
  await inspectorTab(page, "Canvas");
}

test.describe("colours (ED-27)", () => {
  test("the background takes preset gradients, gradient styles and colours found by name", async ({
    page,
  }) => {
    await openDraft(page, "web-app");
    await diagramSettings(page);
    await inspector(page)
      .getByRole("button", { name: /Midnight theme/ })
      .click();
    const picker = page.getByRole("dialog", { name: "Background" });
    // Beside the inspector, not over it: the panel's own controls stay in view.
    const [pickerBox, panelBox] = [await picker.boundingBox(), await inspector(page).boundingBox()];
    expect((pickerBox?.x ?? 0) + (pickerBox?.width ?? 0)).toBeLessThanOrEqual(panelBox?.x ?? 0);
    await shot(page, "editor/colour-picker");

    // A preset gradient, then another style for the same colours.
    await picker.getByRole("button", { name: "Ocean" }).click();
    await expect(page.getByTestId("editor-canvas")).toHaveAttribute(
      "style",
      /linear-gradient\(135deg/,
    );
    await picker.getByRole("radio", { name: "Radial from the centre" }).click();
    await expect(page.getByTestId("editor-canvas")).toHaveAttribute("style", /radial-gradient/);
    await shot(page, "editor/colour-picker-gradient");

    // Every gradient group is one click away.
    await picker.getByRole("button", { name: "See all" }).last().click();
    for (const group of ["Cool tones", "Warm tones", "Monochromatic", "Vivid"])
      await expect(picker.getByRole("region", { name: group })).toBeVisible();
    await picker
      .getByRole("region", { name: "Vivid" })
      .getByRole("button", { name: "Halo" })
      .click();
    await shot(page, "editor/colour-picker-all-gradients");
    await page.keyboard.press("Escape");
    await expect
      .poll(() => yaml(page))
      .toContain('background: "radial-gradient(at 50% 50%, #4f46e5, #0f0a2e)"');

    // The background says which preset it is, and that it replaces the theme.
    const background = inspector(page).getByRole("button", { name: "Halo · custom" });
    await expect(background).toBeVisible();

    // Search by name; Enter takes the first match.
    await background.click();
    const search = page.getByLabel("Search colours for background");
    await search.fill("navy");
    await expect(picker.getByRole("button", { name: "Navy" })).toBeVisible();
    await search.press("Enter");
    await page.keyboard.press("Escape");
    await expect.poll(() => yaml(page)).toContain('background: "#1e3a8a"');
  });

  test("the grid takes its own colour and opacity", async ({ page }) => {
    await openDraft(page, "web-app");
    await diagramSettings(page);
    // On by default: everything snaps to it either way.
    await expect(inspector(page).getByLabel("Show grid")).toBeChecked();
    await inspector(page).getByRole("button", { name: "Automatic" }).click();
    const picker = page.getByRole("dialog", { name: "Grid colour" });
    await picker.getByRole("button", { name: "Pink" }).first().click();
    await page.keyboard.press("Escape");
    const dot = page.locator('[data-testid="editor-canvas"] pattern circle').first();
    await expect(dot).toHaveAttribute("fill", /^#ec4899/);

    const opacity = inspector(page).getByRole("slider", { name: "Grid opacity" });
    await opacity.focus();
    for (let i = 0; i < 5; i++) await opacity.press("ArrowLeft");
    await expect(opacity).toHaveAttribute("aria-valuetext", /^\d+%$/);
    await shot(page, "editor/grid-colour-opacity");
    await expect.poll(() => yaml(page)).toMatch(/grid: "#ec4899[0-9a-f]{2}"/);
  });
});
