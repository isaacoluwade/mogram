import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, openDraft, shot, yaml } from "./support";

/** Editing features beyond the basics (ED-4 … ED-22, SC-2, SC-6, FI-15, FI-16, IC-4, TO-9, NE-8). */

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clicks an element's icon tile (through the hover overlay drawn on top of it). */
async function clickElement(
  page: Page,
  name: string,
  modifiers: ("Shift" | "Meta")[] = [],
): Promise<void> {
  const point = await centre(element(page, name).locator("rect").first());
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(point.x, point.y);
  for (const key of modifiers) await page.keyboard.up(key);
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const count = (text: string, needle: string): number => text.split(needle).length - 1;
const layoutLine = (text: string, name: string): string =>
  new RegExp(`^\\s+${name}: (.+)$`, "m").exec(text.slice(text.lastIndexOf("layout:")))?.[1] ?? "";

test("copy and paste duplicates the selection (ED-4)", async ({ page }) => {
  await openDraft(page, "web-app");
  const before = count(await yaml(page), "type: azure/virtual-machine");
  await clickElement(page, "web_vm");
  await page.keyboard.press(`${mod}+c`);
  await page.keyboard.press(`${mod}+v`);
  await expect
    .poll(async () => count(await yaml(page), "type: azure/virtual-machine"))
    .toBe(before + 1);
});

test("shift-click multi-select, then align left from the inspector (ED-5, ED-6)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  // Two top-level elements, so equal positions are equal numbers in the YAML.
  await clickElement(page, "shopper");
  await clickElement(page, "front_door", ["Shift"]);
  await expect(page.getByRole("region", { name: "Inspector" })).toContainText("2 selected");
  await shot(page, "editor/multi-select");
  await page.getByRole("button", { name: "Align left" }).click();
  await expect
    .poll(async () => {
      const text = await yaml(page);
      const [a, b] = [layoutLine(text, "shopper"), layoutLine(text, "front_door")].map(
        (line) => /\[(-?\d+)/.exec(line)?.[1],
      );
      return a !== undefined && a === b;
    })
    .toBe(true);
});

test("marquee selects everything it touches (ED-5)", async ({ page }) => {
  await openDraft(page, "web-app");
  const shopper = await centre(element(page, "shopper").locator("rect").first());
  await drag(
    page,
    { x: shopper.x - 60, y: shopper.y - 60 },
    { x: shopper.x + 140, y: shopper.y + 60 },
  );
  await expect(page.getByRole("region", { name: "Inspector" })).toContainText("selected");
});

test("the connect tool draws a connection from one element to another (ED-16)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  const before = await yaml(page);
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 140 } });
  await page.keyboard.press("c");
  await drag(
    page,
    await centre(element(page, "shopper").locator("rect").first()),
    await centre(element(page, "db_replica").locator("rect").first()),
  );
  await expect.poll(async () => (await yaml(page)).length).toBeGreaterThan(before.length);
  // The file's connections are one-liners, so the new one is too.
  expect(await yaml(page)).toContain(
    "shopper_to_db_replica: { from: shopper, to: db_replica, flow: traffic }",
  );
});

test("bending a connection by hand saves its waypoints (ED-18)", async ({ page }) => {
  await openDraft(page, "web-app");
  const line = await centre(element(page, "shopper_to_door"));
  await page.mouse.click(line.x, line.y);
  const handle = page.locator('[data-handle="add-waypoint"]').first();
  await expect(handle).toBeVisible();
  const from = await centre(handle);
  await drag(page, from, { x: from.x, y: from.y + 48 });
  await expect.poll(async () => layoutLine(await yaml(page), "shopper_to_door")).toContain("via:");
  await shot(page, "editor/bent-connection");
});

test("the text tool adds a decoration stored with the layout (ED-22)", async ({ page }) => {
  await openDraft(page, "web-app");
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 140 } });
  await page.keyboard.press("t");
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 160 } });
  await expect.poll(async () => (await yaml(page)).includes("decorations:")).toBe(true);
});

test("the container tool draws a container, and resizing saves its size (ED-12, ED-13)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 140 } });
  await page.keyboard.press("b");
  await drag(page, { x: 380, y: 640 }, { x: 560, y: 760 });
  // A plain box with the default label writes nothing but its name (FI-3), then its layout entry.
  await expect
    .poll(async () => /^containers:[\s\S]*?^ {2}container:/m.test(await yaml(page)))
    .toBe(true);
  // The new container is selected: drag its bottom-right handle.
  const handle = page.locator('[data-handle="resize"][data-dir="se"]');
  await expect(handle).toBeVisible();
  const from = await centre(handle);
  await drag(page, from, { x: from.x + 64, y: from.y + 32 });
  await expect.poll(async () => yaml(page)).toMatch(/size: \[\d+, \d+\]/);
  await shot(page, "editor/new-container");
});

test("grouping, state from the inspector, and a new scene (ED-15, SC-2, SC-6)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await clickElement(page, "cache");
  await clickElement(page, "db_primary", ["Shift"]);
  await page.keyboard.press(`${mod}+g`);
  await expect
    .poll(async () => (await yaml(page)).match(/members: \[cache, db_primary\]/) !== null)
    .toBe(true);

  await clickElement(page, "web_vm");
  await page
    .getByRole("region", { name: "Inspector" })
    .getByRole("radio", { name: /Degraded/ })
    .click();
  await expect
    .poll(
      async () => (await yaml(page)).match(/web_vm:\n(?: {4}.+\n)*? {4}state: degraded/) !== null,
    )
    .toBe(true);

  await page.getByRole("button", { name: "Add scene" }).click();
  await expect.poll(async () => (await yaml(page)).includes("scene_3:")).toBe(true);
  await shot(page, "editor/new-scene");
});

test("editing the YAML updates the canvas, and mistakes are reported with the line (FI-15, FI-16)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await page.getByRole("button", { name: "YAML code" }).click();
  const editor = page.getByRole("textbox", { name: "Contents of mogram.yaml" });
  await editor.click();
  await page.keyboard.press(`${mod}+Home`);
  await page.keyboard.type("# A comment Mogram keeps\n");
  await expect(page.getByText("No problems in this file.")).toBeVisible();
  await expect
    .poll(async () => (await yaml(page)).startsWith("# A comment Mogram keeps"))
    .toBe(true);

  // Reading the file used the Diagram menu: put the cursor back in the editor.
  await editor.click();
  await page.keyboard.press(`${mod}+End`);
  await page.keyboard.type("\nbroken:\n  web_vm_9: { in: nowhere_at_all }\n");
  await expect(page.getByText(/^\d+ problems? in this file/)).toBeVisible();
  await shot(page, "editor/yaml-problem");

  // Half-typed YAML that doesn't parse: the canvas keeps the last version that worked.
  await page.keyboard.type("half: [typed");
  await expect(page.getByRole("alert").filter({ hasText: "isn't valid YAML" })).toBeVisible();
  await expect(element(page, "web_vm")).toBeVisible();
  await expect(page.getByText("Start with a component")).toHaveCount(0);
  await shot(page, "editor/yaml-syntax-error");
  await page.keyboard.type("]");
  await expect(page.getByRole("alert").filter({ hasText: "isn't valid YAML" })).toHaveCount(0);
});

test("uploading an SVG icon puts it in the diagram's icons folder (IC-4)", async ({ page }) => {
  await openDraft(page, "web-app");
  await page.locator('input[type="file"][accept*="svg"]').setInputFiles({
    name: "billing.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#73b490"/></svg>',
    ),
  });
  await expect(page.getByText(/billing\.svg is in this diagram/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add billing" })).toBeVisible();
  await page.getByRole("button", { name: "Add billing" }).click();
  await expect.poll(async () => (await yaml(page)).includes("icons/billing.svg")).toBe(true);
});

test("opening a .mogram.yaml from the computer replaces the diagram, and undo brings it back (AC-2)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await page.getByRole("button", { name: "Diagram menu" }).click();
  await page.getByRole("menuitem", { name: /Open files/ }).click();
  await page
    .getByRole("dialog", { name: "Open files" })
    .locator('input[type="file"][multiple]')
    .setInputFiles({
      name: "payments.mogram.yaml",
      mimeType: "text/yaml",
      buffer: Buffer.from(
        "mogram: 1\nname: Payments\ncomponents:\n  api: generic/api\n  ledger: generic/database\nconnections:\n  api_ledger: { from: api, to: ledger, flow: traffic }\n",
      ),
    });
  await expect(
    page.getByRole("button", { name: "Rename diagram" }).or(page.getByTitle("Rename diagram")),
  ).toHaveText("Payments");
  await expect(element(page, "ledger")).toBeVisible();
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 140 } });
  await page.keyboard.press(`${mod}+z`);
  await expect(page.getByTitle("Rename diagram")).toHaveText("Checkout");
});

test("authoring a tour by clicking elements in order (TO-9)", async ({ page }) => {
  await openDraft(page, "failover");
  await page.getByRole("button", { name: "Tours" }).click();
  await page.getByRole("button", { name: "Create a tour" }).click();
  for (const name of ["users", "traffic_manager", "app_east"]) await clickElement(page, name);
  const panel = page.getByRole("region", { name: "Tours" });
  await expect(panel.getByRole("listitem")).toHaveCount(3);
  await shot(page, "editor/tour-authoring");
  await panel.getByRole("button", { name: "Done adding steps" }).click();
  // "Tour 1" is the default title for tour_1, so only the steps are written (FI-3).
  await expect
    .poll(async () => yaml(page))
    .toContain(
      "tours:\n  tour_1:\n    start: users\n    steps:\n      users:\n        next: traffic_manager\n      traffic_manager:\n        next: app_east\n",
    );
});

test("double-clicking a nested component edits the diagram inside, with stubs and breadcrumbs (NE-1, NE-8)", async ({
  page,
}) => {
  await openDraft(page, "aks");
  const aks = await centre(element(page, "aks").locator("rect").first());
  await page.mouse.dblclick(aks.x, aks.y);
  const crumbs = page.getByRole("navigation", { name: "Nested diagram levels" });
  await expect(crumbs).toContainText("AKS cluster");
  await expect(page.getByText("from App Gateway")).toBeVisible();
  await expect(element(page, "ingress")).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, "editor/nested-level");
  // The way back is a real, clickable breadcrumb (not hidden under the library panel)…
  await crumbs.getByRole("button").first().click();
  await expect(element(page, "front_door")).toBeVisible();
  // …and Escape works too.
  await page.mouse.dblclick(aks.x, aks.y);
  await expect(crumbs).toBeVisible();
  await page.getByTestId("editor-canvas").click({ position: { x: 760, y: 120 } });
  await page.keyboard.press("Escape");
  await expect(element(page, "front_door")).toBeVisible();
});

test("a new scene added after deleting one gets a fresh name and is the one selected (SC-6)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  const scenes = page.getByRole("region", { name: "Scenes" });
  await scenes.getByRole("button", { name: "Add scene" }).click();
  await expect(scenes.getByRole("button", { name: "Scene: Scene 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await scenes.getByRole("button", { name: "Traffic spike options" }).click();
  await page.getByRole("menuitem", { name: "Delete scene" }).click();
  await expect(scenes.getByRole("button", { name: "Scene: Traffic spike" })).toHaveCount(0);

  await scenes.getByRole("button", { name: "Add scene" }).click();
  await expect(scenes.getByRole("button", { name: "Scene: Scene 4" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(scenes.getByRole("button", { name: "Scene: Scene 3" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a quick flick still moves the element (ED-3)", async ({ page }) => {
  await openDraft(page, "web-app");
  const before = layoutLine(await yaml(page), "shopper");
  const from = await centre(element(page, "shopper").locator("rect").first());
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 64); // one move event, released at once
  await page.mouse.up();
  await expect.poll(async () => layoutLine(await yaml(page), "shopper")).not.toBe(before);

  // Released past the threshold with no move event at all: still a move.
  const again = layoutLine(await yaml(page), "shopper");
  const now = await centre(element(page, "shopper").locator("rect").first());
  await page.mouse.move(now.x, now.y);
  await page.mouse.down();
  await page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]');
      canvas?.dispatchEvent(
        new PointerEvent("pointerup", { clientX: x, clientY: y, pointerId: 1, bubbles: true }),
      );
    },
    [now.x + 48, now.y] as const,
  );
  await page.mouse.up();
  await expect.poll(async () => layoutLine(await yaml(page), "shopper")).not.toBe(again);
});

test("a container can't be shrunk smaller than what it holds (ED-13)", async ({ page }) => {
  await openDraft(page, "web-app");
  const east = await element(page, "east_us").locator("rect").first().boundingBox();
  if (east === null) throw new Error("East US is not on screen");
  await page.mouse.click(east.x + 40, east.y + 10); // its header, not a child
  const handle = await centre(page.locator('[data-handle="resize"][data-dir="se"]').first());
  await drag(page, handle, { x: east.x + 60, y: east.y + 60 });
  await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
  // East US is sized by its contents and can't get smaller, so no size is written.
  expect(layoutLine(await yaml(page), "east_us")).not.toContain("size");
  const after = await element(page, "east_us").locator("rect").first().boundingBox();
  expect(Math.round(after?.width ?? 0)).toBe(Math.round(east.width));
});
