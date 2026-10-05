import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, openYaml, shot, yaml } from "./support";

/** The command registry's surfaces (05-ui-shell-commands §13): keys, menus, palette, dialog. */

const DIAGRAM = `mogram: 1
name: Commands
components:
  app: generic/service
  db: generic/database
connections:
  app_to_db: { from: app, to: db, route: straight, label: SQL }
layout:
  app: [0, 0]
  db: [40, 0]
  app_to_db: { via: [[20, 10]] }
`;

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function lineAt(page: Page, name: string, at: number): Promise<{ x: number; y: number }> {
  return element(page, name)
    .locator('[data-part="line"]')
    .evaluate((path: SVGPathElement, fraction) => {
      const point = path.getPointAtLength(path.getTotalLength() * fraction);
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error("no CTM");
      return {
        x: point.x * matrix.a + point.y * matrix.c + matrix.e,
        y: point.x * matrix.b + point.y * matrix.d + matrix.f,
      };
    }, at);
}

const definition = async (page: Page): Promise<string> =>
  /app_to_db: (\{.+\})/.exec((await yaml(page)).split("layout:")[0] ?? "")?.[1] ?? "";
const layoutLine = async (page: Page): Promise<string> =>
  /app_to_db: (.+)/.exec((await yaml(page)).split("layout:")[1] ?? "")?.[1] ?? "";

test.describe("connection commands (ED-29)", () => {
  test("the right-click menu offers what applies to a connection where it was clicked", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const point = await lineAt(page, "app_to_db", 0.25);
    await page.mouse.click(point.x, point.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Canvas actions" });
    await expect(menu.getByRole("menuitem", { name: /Reverse/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Add bend here/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Clear bends/ })).toBeVisible();
    // Component-only commands stay out of a connection's menu.
    await expect(menu.getByRole("menuitem", { name: /Duplicate/ })).toHaveCount(0);
    await shot(page, "editor/connection-context-menu");

    await menu.getByRole("menuitem", { name: /Route/ }).hover();
    await page.getByRole("menuitemcheckbox", { name: "Curved" }).click();
    await expect.poll(() => definition(page)).toContain("route: curved");
  });

  test("a bend under the pointer can be removed from the menu", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const point = await lineAt(page, "app_to_db", 0.3);
    await page.mouse.click(point.x, point.y);
    const bend = page.locator('[data-handle="waypoint"]').first();
    const box = await bend.boundingBox();
    if (box === null) throw new Error("no bend handle");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    await page.getByRole("menuitem", { name: /Remove bend/ }).click();
    await expect.poll(() => layoutLine(page)).toBe("");
  });

  test("⌘R reverses the selected connection and ⌥⇧R clears its bends", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const point = await lineAt(page, "app_to_db", 0.3);
    await page.mouse.click(point.x, point.y);
    await page.keyboard.press(`${mod}+r`);
    await expect.poll(() => definition(page)).toContain("from: db, to: app");
    await page.keyboard.press("Alt+Shift+r");
    await expect.poll(() => layoutLine(page)).toBe("");
  });

  test("the quick bar sets the line pattern and the end arrowhead", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const point = await lineAt(page, "app_to_db", 0.3);
    await page.mouse.click(point.x, point.y);
    const bar = page.getByRole("toolbar", { name: "Quick edit" });
    await expect(bar.getByRole("radiogroup", { name: "Route" })).toBeVisible();
    await shot(page, "editor/connection-quick-bar");
    await bar.getByRole("button", { name: "Line style" }).click();
    await page.getByRole("menuitemradio", { name: "Dashed" }).click();
    await expect.poll(() => definition(page)).toContain("line: dashed");
    await bar.getByRole("button", { name: "End arrowhead" }).click();
    await page.getByRole("radio", { name: "Diamond", exact: true }).click();
    await expect.poll(() => definition(page)).toMatch(/arrows: \{?[^}]*diamond/);
  });

  test("More in inspector opens the inspector where the bar's controls continue", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const inspector = page.getByRole("region", { name: "Inspector" });
    await inspector.getByRole("button", { name: "Hide inspector" }).click();
    await expect(inspector).toHaveCount(0);
    const point = await lineAt(page, "app_to_db", 0.3);
    await page.mouse.click(point.x, point.y);
    const bar = page.getByRole("toolbar", { name: "Quick edit" });
    await bar.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "More in inspector" }).click();
    await expect(inspector.getByRole("tab", { name: "Style", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(inspector.getByRole("button", { name: "Line", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

test.describe("command palette (⌘K)", () => {
  test("finds and runs a command, and jumps to an element", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await page.getByTestId("editor-canvas").click({ position: { x: 600, y: 600 } });
    await page.keyboard.press(`${mod}+k`);
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("grid");
    await expect(palette.getByRole("option").first()).toContainText("Show grid");
    await shot(page, "editor/command-palette");
    await page.keyboard.press("Enter");
    await expect(palette).toHaveCount(0);

    await page.keyboard.press("/");
    await page.keyboard.type("data");
    await palette
      .getByRole("option", { name: /Database/ })
      .first()
      .click();
    await expect(page.getByRole("toolbar", { name: "Quick edit" })).toBeVisible();
  });
});

test("the shortcuts dialog lists the registry and filters it", async ({ page }) => {
  await openYaml(page, DIAGRAM);
  await page.getByTestId("editor-canvas").click({ position: { x: 600, y: 600 } });
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog.getByText("Reverse direction")).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Filter shortcuts" }).fill("bend");
  await expect(dialog.getByText("Clear bends")).toBeVisible();
  await expect(dialog.getByText("Reverse direction")).toHaveCount(0);
});

const BOXES = `mogram: 1
name: Boxes
containers:
  vnet: { type: vnet, label: Network }
components:
  web: { type: generic/service, in: vnet, label: Web front }
  api: { type: generic/service, in: vnet, color: "#f97316", motion: pulse }
  db: generic/database
connections:
  web_to_api: { from: web, to: api }
layout:
  vnet: { at: [0, 0], size: [40, 24] }
  web: [2, 4]
  api: [20, 4]
  db: [50, 6]
`;

const layoutOf = async (page: Page, name: string): Promise<string> =>
  new RegExp(`^\\s+${name}: (.+)$`, "m").exec((await yaml(page)).split("layout:")[1] ?? "")?.[1] ??
  "";

const tileOf = async (page: Page, name: string) => {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe("editing commands (M2)", () => {
  test("Find steps through matches and selects each", async ({ page }) => {
    await openYaml(page, BOXES);
    await page.getByTestId("editor-canvas").click({ position: { x: 900, y: 700 } });
    await page.keyboard.press(`${mod}+f`);
    const find = page.getByRole("search", { name: "Find" });
    await find.getByRole("textbox", { name: "Find in diagram" }).fill("service");
    await expect(find).toContainText("2 found");
    await page.keyboard.press("Enter");
    await expect(find).toContainText("1 of 2");
    await expect(page.getByRole("toolbar", { name: "Quick edit" })).toBeVisible();
    await shot(page, "editor/find");
    await page.keyboard.press("Enter");
    await expect(find).toContainText("2 of 2");
    await page.keyboard.press("Escape");
    await expect(find).toHaveCount(0);
  });

  test("Find looks inside nested diagrams and goes to the level of each match", async ({
    page,
  }) => {
    await openDraft(page, "aks");
    await page.getByTestId("editor-canvas").click({ position: { x: 900, y: 700 } });
    await page.keyboard.press(`${mod}+f`);
    const find = page.getByRole("search", { name: "Find" });
    // "Orders API" lives in the AKS cluster's own diagram, a level down.
    await find.getByRole("textbox", { name: "Find in diagram" }).fill("orders api");
    await expect(find).toContainText("1 found");
    await page.keyboard.press("Enter");
    await expect(find).toContainText("1 of 1");
    await expect(find.locator("[data-find-level]")).toHaveText("AKS cluster");
    const crumbs = page.getByRole("navigation", { name: "Nested diagram levels" });
    await expect(crumbs).toContainText("AKS cluster");
    await expect(page.getByRole("toolbar", { name: "Quick edit" })).toBeVisible();
    await shot(page, "editor/find-nested");
    // Back to something on the top level: Find goes back out.
    await find.getByRole("textbox", { name: "Find in diagram" }).fill("front door");
    await page.keyboard.press("Enter");
    await expect(crumbs).toHaveCount(0);
    await expect(element(page, "front_door")).toBeVisible();
  });

  test("a locked element can't be dragged or deleted until it's unlocked", async ({ page }) => {
    await openYaml(page, BOXES);
    const db = await tileOf(page, "db");
    await page.mouse.click(db.x, db.y);
    await page.keyboard.press(`${mod}+Shift+l`);
    await expect.poll(() => layoutOf(page, "db")).toContain("locked: true");
    await expect(page.locator('[data-overlay="locked"]')).toHaveCount(1);
    await page.mouse.move(db.x, db.y);
    await page.mouse.down();
    await page.mouse.move(db.x + 120, db.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.press("Backspace");
    expect(await layoutOf(page, "db")).toBe("{ at: [50, 6], locked: true }");
    await page.mouse.click(db.x, db.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Unlock" }).click();
    await expect.poll(() => layoutOf(page, "db")).toBe("[50, 6]");
  });

  test("paste style copies a component's look onto another", async ({ page }) => {
    await openYaml(page, BOXES);
    const api = await tileOf(page, "api");
    await page.mouse.click(api.x, api.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Copy style" }).click();
    const web = await tileOf(page, "web");
    await page.mouse.click(web.x, web.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Paste style" }).click();
    await expect
      .poll(async () => /web: (\{.+\})/.exec(await yaml(page))?.[1] ?? "")
      .toMatch(/color: "#f97316", motion: pulse/);
  });

  test("⌘ + arrows resize a container; Show in YAML opens its line", async ({ page }) => {
    await openYaml(page, BOXES);
    const header = await element(page, "vnet").locator("rect").first().boundingBox();
    if (header === null) throw new Error("vnet not on screen");
    await page.mouse.click(header.x + 30, header.y + 10);
    await page.keyboard.press(`${mod}+ArrowRight`);
    await page.keyboard.press(`${mod}+Shift+ArrowDown`);
    await expect.poll(() => layoutOf(page, "vnet")).toBe("{ at: [0, 0], size: [41, 28] }");
    await page.mouse.click(header.x + 30, header.y + 10, { button: "right" });
    await page.getByRole("menuitem", { name: "Show in YAML" }).click();
    const code = page.getByRole("textbox", { name: /Contents of/ });
    await expect(code).toBeFocused();
    await expect(page.locator(".cm-activeLine")).toContainText("vnet:");
  });
});
