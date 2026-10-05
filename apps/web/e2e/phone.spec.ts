import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, expectNoHorizontalOverflow, openDraft, shot } from "./support";

/** The editor on a phone (F-14): everything reachable, nothing hidden under something else. */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (b === null) throw new Error("not on screen");
  return b;
}

/** A one-finger drag through the DevTools protocol (Playwright has no touch-drag helper). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const point = (p: { x: number; y: number }) => [{ x: Math.round(p.x), y: Math.round(p.y) }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= 8; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(p) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("the toolbar fits: undo and redo are fully on screen, the rest are under More tools", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  const tools = page.getByRole("toolbar", { name: "Tools" });
  const bar = await box(tools);
  for (const name of ["Select", "Connect", "Text", "More tools", "Undo", "Redo"]) {
    const button = await box(tools.getByRole("button", { name, exact: true }));
    expect(button.x).toBeGreaterThanOrEqual(bar.x);
    expect(button.x + button.width).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
  }
  const inspector = await box(page.getByRole("button", { name: "Inspector", exact: true }));
  expect(bar.x + bar.width).toBeLessThanOrEqual(inspector.x);

  await tools.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitemradio", { name: "Container" }).click();
  await expect(tools.getByRole("button", { name: "More tools" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await shot(page, "editor/phone-toolbar");
});

test("buttons that show only an icon still have names", async ({ page }) => {
  await openDraft(page, "web-app");
  await expect(page.getByRole("button", { name: "Present" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  // Both top bars fit: the diagram menu isn't covered (Export is in it on phones).
  await page.getByRole("button", { name: "Diagram menu" }).click();
  await expect(page.getByRole("menuitem", { name: /Export/ }).first()).toBeVisible();
});

/** A point on the canvas with no element under it. */
async function emptySpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    for (let y = 120; y < 560; y += 20)
      for (let x = 30; x < 360; x += 20) {
        const hit = document.elementFromPoint(x, y);
        if (hit?.closest('[data-testid="editor-canvas"]') && !hit.closest("[data-element]"))
          return { x, y };
      }
    return null;
  });
  if (spot === null) throw new Error("no empty canvas on screen");
  return spot;
}

test("one finger on empty canvas pans", async ({ page }) => {
  await openDraft(page, "web-app");
  const before = await box(element(page, "front_door").locator("rect").first());
  const from = await emptySpot(page);
  await swipe(page, from, { x: from.x - 60, y: from.y - 60 });
  await expect
    .poll(async () => (await box(element(page, "front_door").locator("rect").first())).x)
    .toBeLessThan(before.x - 40);
});

test("opening the inspector keeps the selected element in view above the sheet", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  const target = element(page, "storage"); // Product images, near the bottom of the diagram
  const tile = await box(target.locator("rect").first());
  await page.touchscreen.tap(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  const sheet = await box(page.getByRole("region", { name: "Inspector" }));
  await expect
    .poll(async () => {
      const now = await box(target.locator("rect").first());
      return now.y + now.height;
    })
    .toBeLessThan(sheet.y);
  await shot(page, "editor/phone-inspector-selection");
});

test("concepts fit a phone: the tab, and the gallery with its topics in a select (D-85)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("tablist", { name: "Left panel" })
    .getByRole("tab", { name: "Concepts" })
    .click();
  const panel = page.getByRole("region", { name: "Concepts" });
  await expect(panel.getByRole("button", { name: /^Scaling & performance/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "editor/phone-concepts");

  await panel.getByRole("button", { name: "Browse all" }).click();
  const gallery = page.getByRole("dialog", { name: "Concepts" });
  await expect(gallery.getByRole("navigation", { name: "Concept topics" })).toBeHidden();
  await gallery.getByRole("combobox", { name: "Topic" }).click();
  await page.getByRole("option", { name: "Reliability" }).click();
  await expect(gallery.getByTestId("gallery-count")).toHaveText("1 concept");
  const card = await box(gallery.getByRole("button", { name: "Concept: Failover" }));
  const frame = await box(gallery);
  expect(card.x).toBeGreaterThanOrEqual(frame.x);
  expect(card.x + card.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
  await expectNoHorizontalOverflow(page);
  await shot(page, "editor/phone-concept-gallery");
});
