import { expect, test, type Page } from "@playwright/test";
import { element, openYaml, shot, yaml } from "./support";

/** Canvas interactions (M5, 06-canvas-interactions): guides, cloning, quick add. */

const DIAGRAM = `mogram: 1
name: Canvas
components:
  a: generic/service
  b: generic/service
  c: generic/database
layout:
  a: [0, 0]
  b: [40, 0]
  c: [20, 24]
`;

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function centreOf(page: Page, name: string) {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const layoutOf = async (page: Page, name: string): Promise<string> =>
  new RegExp(`^\\s+${name}: (.+)$`, "m").exec((await yaml(page)).split("layout:")[1] ?? "")?.[1] ??
  "";

test.describe("canvas interactions (M5)", () => {
  test("a moved element snaps to line up with its neighbours, with guides", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const from = await centreOf(page, "c");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // Up towards a's row, a cell short: the guide pulls it level with a and b.
    await page.mouse.move(from.x + 20, from.y - 24 * 8 + 8, { steps: 10 });
    // A guide is a line: attached and drawn, though a flat line has no height to be "visible".
    await expect(page.locator('[data-guide="align-y"]').first()).toBeAttached();
    await expect(page.locator('[data-overlay="move-hint"]')).toBeVisible();
    await shot(page, "editor/smart-guides");
    await page.mouse.up();
    await expect.poll(() => layoutOf(page, "c")).toMatch(/^\[\d+, 0\]$/);
  });

  test("holding Ctrl/Cmd at the drop leaves the original and drops a copy", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const from = await centreOf(page, "c");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 160, from.y + 40, { steps: 8 });
    await page.keyboard.down(mod);
    await page.mouse.up();
    await page.keyboard.up(mod);
    await expect.poll(() => yaml(page)).toMatch(/c_2:\s+(type: )?generic\/database/);
    expect(await layoutOf(page, "c")).toBe("[20, 24]");
  });

  test("a hover arrow adds a connected copy; Alt-click chooses what to add", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const a = await centreOf(page, "a");
    await page.mouse.move(a.x, a.y);
    const right = page.locator('[data-handle="connect"][data-direction="down"]');
    await expect(right).toHaveCount(1);
    await shot(page, "editor/hover-arrows");
    await right.click();
    // The copy is connected from a, selected, and its label is open for typing.
    await expect(
      page.getByTestId("editor-canvas").getByRole("textbox", { name: "Label" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect.poll(() => yaml(page)).toMatch(/a_to_a_2: \{ from: a, to: a_2, flow: traffic \}/);

    await page.mouse.move(a.x, a.y);
    await page.keyboard.down("Alt");
    await page.locator('[data-handle="connect"][data-direction="up"]').click();
    await page.keyboard.up("Alt");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette.getByRole("combobox")).toHaveAttribute("placeholder", /Add here/);
    await page.keyboard.type("cylinder");
    await page.keyboard.press("Enter");
    await expect.poll(() => yaml(page)).toMatch(/a_to_cylinder: \{ from: a, to: cylinder/);
  });

  test("double-clicking empty canvas adds something right there", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await page.getByTestId("editor-canvas").dblclick({ position: { x: 760, y: 620 } });
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("diamond");
    await page.keyboard.press("Enter");
    await expect.poll(() => yaml(page)).toMatch(/\n  diamond: diamond\n/);
  });

  test("⌥⇧ + arrow adds a connected copy from the keyboard", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const b = await centreOf(page, "b");
    await page.mouse.click(b.x, b.y);
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect.poll(() => yaml(page)).toMatch(/b_to_b_2: \{ from: b, to: b_2/);
  });

  test("the minimap shows the view and moves it", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await page.getByRole("button", { name: "Show minimap" }).click();
    const minimap = page.getByRole("img", { name: /Minimap/ });
    await expect(minimap).toBeVisible();
    const view = page.locator('[data-minimap="view"]');
    const before = await view.getAttribute("x");
    const box = await minimap.boundingBox();
    if (box === null) throw new Error("no minimap");
    await page.mouse.click(box.x + 12, box.y + 12);
    await expect.poll(() => view.getAttribute("x")).not.toBe(before);
    await shot(page, "editor/minimap");
  });

  test("Escape keeps a typed label; Shift+Escape puts it back", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const a = await centreOf(page, "a");
    await page.mouse.dblclick(a.x, a.y);
    const label = page.getByTestId("editor-canvas").getByRole("textbox", { name: "Label" });
    await label.fill("Gateway");
    await label.press("Escape");
    await expect.poll(() => yaml(page)).toContain("label: Gateway");
    await page.mouse.dblclick(a.x, a.y);
    await label.fill("Nope");
    await label.press("Shift+Escape");
    await expect(label).toHaveCount(0);
    expect(await yaml(page)).not.toContain("Nope");
  });

  test("resizing snaps to a sibling's size and marks the match", async ({ page }) => {
    await openYaml(
      page,
      `mogram: 1
name: Sizes
shapes:
  a: { shape: rectangle, label: A }
  b: { shape: rectangle, label: B }
layout:
  a: { at: [0, 0], size: [16, 8] }
  b: { at: [0, 16], size: [24, 8] }
`,
    );
    const shape = element(page, "a");
    const box = await shape.boundingBox();
    if (box === null) throw new Error("a not on screen");
    const unit = box.width / 16;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const handle = page.locator('[data-handle="resize"][data-dir="e"]');
    const from = await handle.boundingBox();
    if (from === null) throw new Error("no resize handle");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // To a width of 23, a cell short of b's 24: it takes b's width and both get a size mark.
    await page.mouse.move(from.x + from.width / 2 + unit * 7, from.y + from.height / 2, {
      steps: 8,
    });
    await expect(page.locator('[data-guide="size-w"]')).toHaveCount(2);
    await shot(page, "editor/size-guides");
    await page.mouse.up();
    await expect.poll(() => layoutOf(page, "a")).toBe("{ at: [0, 0], size: [24, 8] }");
  });
});
