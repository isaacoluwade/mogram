import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, watchErrors, yaml } from "./support";

const mod = process.platform === "darwin" ? "Meta" : "Control";

function canvas(page: Page) {
  return page.getByTestId("editor-canvas");
}

function quickBar(page: Page) {
  return page.getByRole("toolbar", { name: "Quick edit" });
}

test.describe("sticky notes (ED-25)", () => {
  test("places a note, types rich text in place, and styles it from the quick bar", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDraft(page, "web-app");
    await page.getByRole("button", { name: "Sticky note" }).click();
    await canvas(page).click({ position: { x: 1040, y: 640 } });

    const field = page.getByLabel("Sticky note text");
    await expect(field).toBeFocused();
    await field.pressSequentially("Follow-ups", { delay: 15 });
    await field.press("Enter");
    await field.pressSequentially("- Rate limit the API", { delay: 10 });
    await field.press("Enter");
    await field.pressSequentially("- Move sessions to Redis", { delay: 10 });
    // Bold the first line with the keyboard while typing.
    await field.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(0, 10));
    await field.press(`${mod}+b`);
    await expect(field).toHaveValue(
      "**Follow-ups**\n- Rate limit the API\n- Move sessions to Redis",
    );
    await expect(quickBar(page)).toBeVisible();
    await shot(page, "editor/note-typing");

    await field.press("Escape");
    await expect(field).toHaveCount(0);
    const note = element(page, "note");
    await expect(note.locator("tspan", { hasText: "Follow-ups" })).toHaveAttribute(
      "font-weight",
      "700",
    );
    await expect(note.locator("tspan", { hasText: "•" })).toHaveCount(2);

    // Note colour from the quick bar: one of the note colours.
    await expect(quickBar(page)).toBeVisible();
    await quickBar(page).getByRole("button", { name: "Note colour" }).click();
    await page.getByRole("dialog", { name: "Note colour" }).getByLabel("Blue").first().click();
    await page.keyboard.press("Escape");
    await expect(note.locator('[data-part="fill"]')).toHaveAttribute("fill", "#bfdbfe");

    // Font, size and alignment.
    await quickBar(page).getByRole("button", { name: "Font", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Geist Mono" }).click();
    await quickBar(page).getByRole("button", { name: "Font size" }).click();
    await page.getByRole("menuitemradio", { name: "16", exact: true }).click();
    await quickBar(page).getByRole("button", { name: "Alignment" }).click();
    await page.getByRole("menuitemradio", { name: "Align centre" }).click();
    await shot(page, "editor/note-quick-bar");

    const text = await yaml(page);
    expect(text).toContain("note: |-\n        **Follow-ups**\n        - Rate limit the API");
    expect(text).toContain('fill: "#bfdbfe"');
    expect(text).toContain("font: mono");
    expect(text).toContain("font_size: 16");
    expect(text).toContain("align: center");

    // The export carries the note, its rich text and the font it uses.
    await page.getByRole("button", { name: "Export" }).click();
    const dialog = page.getByRole("dialog", { name: "Export" });
    await dialog.getByRole("radio", { name: /SVG/ }).click();
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await dialog.getByRole("button", { name: /^Download/ }).click();
    const svg = readFileSync(await (await download).path()).toString("utf8");
    expect(svg).toContain('font-family:"geistMono"');
    expect(svg).toContain("Follow-ups");
    expect(svg).toContain('fill="#bfdbfe"');
    expect(errors).toEqual([]);
  });
});

test.describe("quick-edit bar (ED-26)", () => {
  async function select(page: Page, name: string): Promise<void> {
    const box = await element(page, name).locator("rect").first().boundingBox();
    if (box === null) throw new Error(`${name} is not on screen`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  test("offers state and motion for a component, and flow for a connection", async ({ page }) => {
    await openDraft(page, "web-app");
    await select(page, "web_vm");
    const bar = quickBar(page);
    await expect(bar.getByRole("button", { name: "State" })).toHaveText(/Healthy/);
    await shot(page, "editor/quick-bar-component");
    await bar.getByRole("button", { name: "State" }).click();
    await page.getByRole("menuitemradio", { name: /Overloaded/ }).click();
    await expect(bar.getByRole("button", { name: "State" })).toHaveText(/Overloaded/);
    await bar.getByRole("button", { name: "Motion" }).click();
    await page.getByRole("menuitemradio", { name: /Pulse/ }).click();

    await element(page, "door_to_gateway").getByText("HTTPS").click();
    await expect(bar.getByRole("button", { name: "Flow" })).toBeVisible();
    await bar.getByRole("button", { name: "Flow" }).click();
    await page.getByRole("menuitemradio", { name: /Blocked/ }).click();
    await shot(page, "editor/quick-bar-connection");

    const text = await yaml(page);
    expect(text).toMatch(/web_vm:[\s\S]*?state: overloaded/);
    expect(text).toMatch(/web_vm:[\s\S]*?motion: pulse/);
    expect(text).toMatch(
      /door_to_gateway:[^\n]*flow: blocked|door_to_gateway:[\s\S]*?flow: blocked/,
    );
  });

  test("free text takes rich text and typography too", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.keyboard.press("t");
    await canvas(page).click({ position: { x: 760, y: 700 } });
    const field = page.getByLabel("Text on canvas");
    await expect(field).toBeFocused();
    await field.pressSequentially("Checkout is **live**", { delay: 10 });
    await field.press("Escape");
    const text = element(page, "text");
    await expect(text.locator("tspan", { hasText: "live" })).toHaveAttribute("font-weight", "700");
    await quickBar(page).getByRole("button", { name: "Text style" }).click();
    await page.getByRole("menuitemradio", { name: "Title" }).click();
    await quickBar(page).getByRole("button", { name: "Font", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Instrument Sans" }).click();
    await expect(text.locator("text").first()).toHaveAttribute("font-size", "28");
    await shot(page, "editor/text-typography");
  });
});
