import { expect, test, type Page } from "@playwright/test";
import { element, inspectorTab, openSection, openYaml, shot, yaml } from "./support";

/** The properties panel (ED-20, 04-format-panel §16): tabs, sections, fields and mixed values. */

const DIAGRAM = `mogram: 1
name: Panel
containers:
  vnet: { type: vnet, label: Network }
components:
  web: { type: generic/service, in: vnet, label: Web, state: degraded }
  api: { type: generic/service, in: vnet, label: API }
  db: { type: generic/database, label: Database }
connections:
  web_to_api: { from: web, to: api, label: REST }
  api_to_db: { from: api, to: db, line: dashed }
layout:
  vnet: { at: [0, 0], size: [40, 24] }
  web: [2, 4]
  api: [20, 4]
  db: [50, 6]
`;

const inspector = (page: Page) => page.getByRole("region", { name: "Inspector" });

async function click(page: Page, name: string, shift = false): Promise<void> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} not on screen`);
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (shift) await page.keyboard.up("Shift");
}

const layoutOf = async (page: Page, name: string): Promise<string> =>
  new RegExp(`^\\s+${name}: (.+)$`, "m").exec((await yaml(page)).split("layout:")[1] ?? "")?.[1] ??
  "";

test.describe("properties panel (M3)", () => {
  test("tabs by concern, remembered between selections", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await click(page, "web");
    await expect(inspector(page).getByRole("heading", { name: "Web" })).toBeVisible();
    await expect(inspector(page).getByRole("tab", { name: "Element" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await shot(page, "editor/inspector-element");
    await inspectorTab(page, "Style");
    await shot(page, "editor/inspector-style");
    await click(page, "api");
    await expect(inspector(page).getByRole("tab", { name: "Style" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await inspectorTab(page, "Arrange");
    await shot(page, "editor/inspector-arrange");
  });

  test("a folded section stays folded for that kind", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await click(page, "web");
    const card = inspector(page).getByRole("button", { name: "Card", exact: true });
    await expect(card).toHaveAttribute("aria-expanded", "true");
    await card.click();
    await click(page, "db");
    await expect(
      inspector(page).getByRole("button", { name: "Card", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("position fields move the element; arrow keys step and undo as one", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await click(page, "db");
    await inspectorTab(page, "Arrange");
    const x = inspector(page).getByRole("textbox", { name: "X", exact: true });
    await x.fill("60");
    await x.press("Enter");
    await expect.poll(() => layoutOf(page, "db")).toBe("[60, 6]");
    const y = inspector(page).getByRole("textbox", { name: "Y", exact: true });
    await y.press("ArrowUp");
    await y.press("ArrowUp");
    await y.press("Shift+ArrowUp");
    await expect.poll(() => layoutOf(page, "db")).toBe("[60, 18]");
    await page.getByTestId("editor-canvas").click({ position: { x: 900, y: 700 } });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(() => layoutOf(page, "db")).toBe("[60, 6]");
  });

  test("several elements show what they share, chips narrow the selection", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await click(page, "web");
    await click(page, "api", true);
    await expect(inspector(page).getByRole("heading", { name: "2 selected" })).toBeVisible();
    const state = inspector(page).getByRole("radiogroup", { name: "State for all selected" });
    // Web is degraded and API healthy: neither is pressed.
    await expect(state.getByRole("radio", { checked: true })).toHaveCount(0);
    await state.getByRole("radio", { name: /Down/ }).click();
    await expect.poll(async () => (await yaml(page)).match(/state: down/g)?.length ?? 0).toBe(2);

    // Add a connection; the header offers chips per kind.
    const line = element(page, "web_to_api").locator('[data-part="line"]');
    const box = await line.boundingBox();
    if (box === null) throw new Error("no line");
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.up("Shift");
    await expect(inspector(page).getByRole("heading", { name: "3 selected" })).toBeVisible();
    await shot(page, "editor/inspector-mixed");
    await inspector(page).getByRole("button", { name: "1 connection", exact: true }).click();
    await expect(inspector(page).getByRole("heading", { name: "REST" })).toBeVisible();
  });

  test("all properties lists every key and writes YAML back", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const line = element(page, "api_to_db").locator('[data-part="line"]');
    const box = await line.boundingBox();
    if (box === null) throw new Error("no line");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await inspectorTab(page, "Style");
    await inspector(page).getByRole("button", { name: "All properties", exact: true }).click();
    const line_ = inspector(page).getByRole("textbox", { name: "line", exact: true });
    await expect(line_).toHaveValue("dashed");
    await line_.fill("dotted");
    await line_.press("Enter");
    await expect.poll(async () => yaml(page)).toContain("line: dotted");
  });

  test("the panel widens from its left edge and remembers it", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const panel = inspector(page);
    const before = await panel.boundingBox();
    const grip = page.getByRole("separator", { name: "Resize panel" });
    const box = await grip.boundingBox();
    if (before === null || box === null) throw new Error("no panel");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
      .toBe(Math.round(before.width + 60));
    await page.reload();
    await expect
      .poll(async () => Math.round((await inspector(page).boundingBox())?.width ?? 0))
      .toBe(Math.round(before.width + 60));
  });

  test("suggestions point out what an architect wouldn't draw, and select it", async ({ page }) => {
    await openYaml(
      page,
      `mogram: 1
name: Shop
containers:
  vnet: { type: network, label: Shop network }
  data: { type: subnet, label: Data subnet }
components:
  web: { type: azure/app-services, label: Web, in: vnet }
  db: { type: azure/sql-database, label: Orders DB, in: data }
  vault: { type: azure/key-vaults, label: Secrets }
connections:
  web_to_db: { from: web, to: db }
`,
    );
    await openSection(page, "Suggestions");
    const list = inspector(page).getByRole("list", { name: "Suggestions" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    // Probable mistakes first, then what's worth a look.
    await expect(list.getByRole("listitem").first()).toContainText(
      "Data subnet is a subnet that isn't inside a virtual network.",
    );
    await expect(list.getByRole("listitem").last()).toContainText("Nothing connects to Secrets.");
    await shot(page, "editor/inspector-suggestions");
    await list.getByRole("button", { name: /Data subnet/ }).click();
    await expect(inspector(page).getByRole("textbox", { name: "Label", exact: true })).toHaveValue(
      "Data subnet",
    );
  });
});
