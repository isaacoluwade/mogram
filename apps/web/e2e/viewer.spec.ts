import { expect, test } from "@playwright/test";
import { element, openDraft, shot, viewerSettled, watchErrors } from "./support";

/** The read-only viewer (SH-2): cards, nested zoom, tours, deep links and present mode. */
test.describe("viewer", () => {
  test("cards zoom the camera and update the link (CA-1, CA-7)", async ({ page }) => {
    const errors = watchErrors(page);
    const id = await openDraft(page, "aks");
    await page.goto(`/draft/${id}/view`);
    await expect(page.getByTestId("viewer-canvas")).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, "viewer/aks-overview");
    await element(page, "front_door").click();
    const card = page.getByRole("dialog", { name: "Front Door" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Global entry point");
    await expect(page).toHaveURL(/card=front_door/);
    await page.waitForTimeout(800);
    await shot(page, "viewer/card-open");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("double-click goes inside a nested diagram with stubs and breadcrumbs (NE-5, NE-6, NE-8)", async ({
    page,
  }) => {
    const id = await openDraft(page, "aks");
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await element(page, "aks").dblclick();
    await expect(page).toHaveURL(/level=aks/);
    await expect(page.getByRole("navigation", { name: "Diagram levels" })).toContainText(
      "AKS cluster",
    );
    await expect(page.getByText("from App Gateway")).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, "viewer/nested-aks");
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/level=/);
  });

  test("a tour moves along steps, into nested levels, and ends zoomed out (TO-1 … TO-6)", async ({
    page,
  }) => {
    const id = await openDraft(page, "aks");
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await page.getByRole("button", { name: "Tours" }).click();
    await page.getByRole("menuitem", { name: /How an order flows/ }).click();
    await expect(page.getByRole("dialog", { name: "Customers" })).toBeVisible();
    await expect(page).toHaveURL(/tour=how_an_order_flows&step=customers/);
    for (const step of ["front_door", "aks", "aks.checkout"]) {
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(new RegExp(`step=${step.replace(".", "\\.")}`));
    }
    await page.waitForTimeout(1500);
    await shot(page, "viewer/tour-nested-step");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/step=orders_db/);
    await viewerSettled(page);
    // A branching step offers choices (TO-6).
    await expect(page.getByRole("group", { name: "Choose where to go" })).toBeVisible();
    await shot(page, "viewer/tour-choices");
    await page
      .getByRole("group", { name: "Choose where to go" })
      .getByRole("button", { name: "Bad deploy" })
      .click();
    await expect(page).toHaveURL(/step=aks\.checkout/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/tour=/);
  });

  test("deep links open straight to a scene, level and card (SH-4)", async ({ page }) => {
    const id = await openDraft(page, "aks");
    await page.goto(`/draft/${id}/view?level=aks&card=checkout&scene=bad_deploy`);
    await expect(page.getByRole("dialog", { name: "Checkout" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Checkout" })).toContainText("Down");
    await page.waitForTimeout(800);
    await shot(page, "viewer/deep-link-scene-card");
  });

  test("viewers can try “what if” states and reset them (SH-3)", async ({ page }) => {
    const id = await openDraft(page, "failover");
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await element(page, "traffic_manager").click();
    const card = page.getByRole("dialog", { name: "Traffic Manager" });
    await card.getByRole("button", { name: "Down" }).click();
    await expect(card).toContainText("Down");
    await page.waitForTimeout(700);
    await shot(page, "viewer/what-if-down");
    await page
      .getByRole("group", { name: "Scenes" })
      .getByRole("button", { name: "Reset" })
      .click();
    await expect(card.getByRole("button", { name: "Healthy" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("present mode offers tours and scenes, with chrome hidden (TO-8)", async ({ page }) => {
    const id = await openDraft(page, "web-app");
    await page.goto(`/draft/${id}/view?present=1`);
    await expect(page.getByText("Presenting")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Diagram levels" })).toBeHidden();
    await page.waitForTimeout(800);
    await shot(page, "viewer/present-start");
    await page.getByRole("button", { name: /How a request flows/ }).click();
    await expect(page.getByRole("dialog", { name: "Shoppers" })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "viewer/present-tour");

    // Escape backs out one thing at a time: the tour, then present mode itself.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Shoppers" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Presenting")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Diagram levels" })).toBeVisible();
    await expect(page).not.toHaveURL(/present=1/);
  });

  test("links in a card move the camera to the linked card (CA-4)", async ({ page }) => {
    const id = await openDraft(page, "web-app");
    await page.goto(`/draft/${id}/view?card=web_vm`);
    const card = page.getByRole("dialog", { name: "Web VM" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "orders database" }).click();
    await expect(page.getByRole("dialog", { name: "Orders database" })).toBeVisible();
    await expect(page).toHaveURL(/card=db_primary/);
  });

  test("wandering off during a tour offers a way back to the step (TO-7)", async ({ page }) => {
    const id = await openDraft(page, "web-app");
    await page.goto(`/draft/${id}/view?tour=request_flow&step=front_door`);
    await expect(page.getByRole("dialog", { name: "Front Door" })).toBeVisible();
    const canvas = page.getByTestId("viewer-canvas");
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("no canvas");
    await page.mouse.move(box.x + 200, box.y + box.height - 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + box.height - 260, { steps: 8 });
    await page.mouse.up();
    const back = page.getByRole("button", { name: /Back to step 2/ });
    await expect(back).toBeVisible();
    await shot(page, "viewer/tour-wandered");
    await back.click();
    await expect(back).toBeHidden();
  });
});

test("the diagram can be explored with the keyboard: Tab to an element, Enter opens its card", async ({
  page,
}) => {
  const id = await openDraft(page, "web-app");
  await page.goto(`/draft/${id}/view`);
  await expect(page.getByTestId("viewer-canvas")).toBeVisible();
  const vm = page.getByRole("button", { name: "Web VM", exact: true });
  await vm.focus();
  await expect(vm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Web VM" })).toBeVisible();
  await shot(page, "viewer/keyboard-card");
});

test("presenting straight after an edit shows the edit (the draft is saved first)", async ({
  page,
}) => {
  await openDraft(page, "web-app");
  await page.getByTitle("Rename diagram").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Fresh off the canvas");
  await page.keyboard.press("Enter");
  // No pause for the autosave: Present saves before it leaves.
  await page.getByRole("button", { name: "Present" }).click();
  await page.waitForURL(/\/view\?present=1/);
  await expect(page.getByRole("heading", { name: "Fresh off the canvas" })).toBeVisible();
});
