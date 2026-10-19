import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { element, inspectorTab, openYaml, shot, viewerSettled, watchErrors, yaml } from "./support";

/**
 * Pages (D-98): a fixed frame a diagram can have. The editor draws it and dims what's off
 * stage; the viewer fits it, edge to edge when presenting; an export is exactly the page.
 */

const SLIDE = `mogram: 1
name: What a plan is
page: 16:9
shapes:
  title: { label: The plan is the difference }
  aside: { label: A note to myself }
layout:
  title: [96, 60]
  aside: [300, 10]
`;

/** A PNG's width and height, from its header. */
function pngSize(file: Buffer): { width: number; height: number } {
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

test.describe("pages (D-98)", () => {
  test("the editor draws the page, the Canvas tab sets it, and an export is exactly it", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openYaml(page, SLIDE);
    const frame = page.getByTestId("page-frame");
    await expect(frame).toBeVisible();
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    // 1920 × 1080 at 100%, whatever the zoom: 16 by 9.
    const box = await frame.boundingBox();
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 2);
    await page.waitForTimeout(400);
    await shot(page, "editor/page");

    // What's off the page is worth a word.
    await inspectorTab(page, "Diagram");
    await expect(page.getByText(/"A note to myself" sits outside the page/)).toBeVisible();

    await inspectorTab(page, "Canvas");
    const choice = page.getByRole("radiogroup", { name: "Page" });
    await expect(choice.getByRole("radio", { name: "16:9" })).toBeChecked();
    await choice.getByRole("radio", { name: "None" }).click();
    await expect(frame).toHaveCount(0);
    expect(await yaml(page)).not.toContain("page:");
    await choice.getByRole("radio", { name: "4:3" }).click();
    expect(await yaml(page)).toContain("page: 4:3");
    const narrower = await frame.boundingBox();
    expect((narrower?.width ?? 0) / (narrower?.height ?? 1)).toBeCloseTo(4 / 3, 2);
    await choice.getByRole("radio", { name: "16:9" }).click();

    // Export offers the page first, at the size it's meant to be seen.
    await page.getByRole("button", { name: "Export" }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export" });
    await expect(
      exportDialog.getByRole("radiogroup", { name: "Area" }).getByRole("radio", { name: "Page" }),
    ).toBeChecked();
    await expect(
      exportDialog.getByRole("radiogroup", { name: "Scale" }).getByRole("radio", { name: "1×" }),
    ).toBeChecked();
    await exportDialog.getByRole("radio", { name: /PNG/ }).click();
    const saved = page.waitForEvent("download", { timeout: 90_000 });
    await exportDialog.getByRole("button", { name: /^Download/ }).click();
    expect(pngSize(readFileSync(await (await saved).path()))).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(errors).toEqual([]);
  });

  test("the viewer fits the page, and fills the screen with it when presenting", async ({
    page,
  }) => {
    const id = await openYaml(page, SLIDE);
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    const canvas = page.getByTestId("viewer-canvas");
    // Fitted between the viewer's own controls, far smaller than 100% and nothing like the
    // 1.1× a loose diagram stops at.
    const fitted = Number(await canvas.getAttribute("data-zoom"));
    expect(fitted).toBeGreaterThan(0.55);
    expect(fitted).toBeLessThan(0.75);
    await expect(element(page, "title")).toBeVisible();
    await shot(page, "viewer/page");

    // Presenting, the page is the screen: 1920 wide into 1440.
    await page.goto(`/draft/${id}/view?present=1`);
    await viewerSettled(page);
    expect(Number(await canvas.getAttribute("data-zoom"))).toBeCloseTo(0.75, 2);
    await shot(page, "viewer/page-present");
  });
});
