import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, yaml } from "./support";

/** Arranging: what's in front is what gets clicked, and z-order follows containers (ED-23). */

async function tileCentre(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** True when `a` is drawn before (behind) `b` on the canvas. */
async function drawnBehind(page: Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(
    ([first, second]) => {
      const find = (name: string) =>
        document.querySelector(`[data-layer="diagram"] [data-element="${name}"]`);
      const x = find(first ?? "");
      const y = find(second ?? "");
      if (x === null || y === null) throw new Error("element not drawn");
      return (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [a, b],
  );
}

const inspectorTitle = (page: Page) =>
  page.getByRole("region", { name: "Inspector" }).getByRole("heading").first();

test("the element on top gets the click, even right after hovering the one beneath", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  // Drag Front Door so it half covers Shoppers (Front Door is drawn above it).
  const shopper = await tileCentre(page, "shopper");
  const door = await tileCentre(page, "front_door");
  await page.mouse.move(door.x, door.y);
  await page.mouse.down();
  await page.mouse.move(shopper.x + 22, shopper.y + 22, { steps: 10 });
  await page.mouse.up();
  await expect(inspectorTitle(page)).toHaveText("Front Door");

  // Hover the visible corner of Shoppers (its halo now surrounds Front Door), then click Front Door.
  await page.mouse.click(10, 300); // empty canvas: clear the selection
  await page.mouse.move(shopper.x - 14, shopper.y - 14);
  const moved = await tileCentre(page, "front_door");
  await page.mouse.move(moved.x, moved.y, { steps: 4 });
  await page.mouse.click(moved.x, moved.y);
  await expect(inspectorTitle(page)).toHaveText("Front Door");
});

test("a container brought to front carries everything inside it", async ({ page }) => {
  await openDraft(page, "web-app");
  expect(await drawnBehind(page, "web_vm", "db_replica")).toBe(true);

  // Right-click East US's header (not one of its children) and bring it to front.
  const east = await element(page, "east_us").locator("rect").first().boundingBox();
  if (east === null) throw new Error("East US is not on screen");
  await page.mouse.click(east.x + 40, east.y + 10, { button: "right" });
  await page.getByRole("menuitem", { name: /Arrange/ }).hover();
  await page.getByRole("menuitem", { name: /Bring to front/ }).click();
  await expect.poll(() => yaml(page)).toMatch(/^ {2}east_us: \{[^}]*z: 1/m);
  expect(await drawnBehind(page, "db_replica", "web_vm")).toBe(true);
  expect(await drawnBehind(page, "west_us", "storage")).toBe(true);
  await shot(page, "editor/arrange-container-front");
});

test("moves that would change nothing are disabled, and connections have no Arrange", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  // Product images is the only component in East US: nothing to stack against.
  const storage = await tileCentre(page, "storage");
  await page.mouse.click(storage.x, storage.y, { button: "right" });
  await page.getByRole("menuitem", { name: /Arrange/ }).hover();
  await expect(page.getByRole("menuitem", { name: /Bring to front/ })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: /Send to back/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // The inspector offers the same, with the same rules.
  await page.mouse.click(storage.x, storage.y);
  await expect(page.getByRole("button", { name: "Bring to front" })).toBeDisabled();

  // Web VM has a sibling: Bring forward works once, then there is nothing above it.
  const vm = await tileCentre(page, "web_vm");
  await page.mouse.click(vm.x, vm.y);
  const forward = page.getByRole("button", { name: "Bring forward" });
  await expect(forward).toBeEnabled();
  await forward.click();
  await expect(forward).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send backward" })).toBeEnabled();
});

test("⌘⌥] brings to front by physical key, whatever character Option types", async ({ page }) => {
  await openDraft(page, "web-app");
  const vm = await tileCentre(page, "web_vm");
  await page.mouse.click(vm.x, vm.y);
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "‘", // what ⌥] types on a Mac
        code: "BracketRight",
        metaKey: true,
        ctrlKey: !navigator.platform.startsWith("Mac"),
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect.poll(() => yaml(page)).toMatch(/^ {2}web_vm: \{[^}]*z: 1/m);
});

test.describe("on a touch screen", () => {
  test.use({ viewport: { width: 834, height: 1112 }, hasTouch: true, isMobile: true });

  test("a long press opens the menu for what was pressed", async ({ page }) => {
    await openDraft(page, "web-app");
    const vm = await tileCentre(page, "web_vm");
    const cdp = await page.context().newCDPSession(page);
    const touch = { x: Math.round(vm.x), y: Math.round(vm.y) };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
    await page.waitForTimeout(900);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("menuitem", { name: /Arrange/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Delete/ })).toBeVisible();
    await shot(page, "editor/touch-long-press-menu");
  });
});
