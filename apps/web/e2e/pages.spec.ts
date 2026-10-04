import { expect, test } from "@playwright/test";
import { WIDTHS, expectNoHorizontalOverflow, openDraft, shot, watchErrors } from "./support";

/** Every page at phone, tablet, laptop and desktop widths: no sideways scroll, no errors. */
const PAGES = [
  { path: "/", name: "landing" },
  { path: "/sign-in", name: "sign-in" },
  { path: "/diagrams", name: "dashboard" },
  { path: "/security", name: "security" },
  { path: "/docs/format", name: "file-format" },
  { path: "/this-does-not-exist", name: "not-found" },
];

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });

    for (const { path, name } of PAGES) {
      test(`${name} fits and loads cleanly`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        await expectNoHorizontalOverflow(page);
        await shot(page, `pages/${name}-${width}`);
        expect(errors).toEqual([]);
      });
    }

    test("editor fits and loads cleanly", async ({ page }) => {
      const errors = watchErrors(page);
      await openDraft(page, "web-app");
      await page.waitForTimeout(600);
      await expectNoHorizontalOverflow(page);
      await shot(page, `pages/editor-${width}`);
      expect(errors).toEqual([]);
    });

    test("viewer fits and loads cleanly", async ({ page }) => {
      const errors = watchErrors(page);
      const id = await openDraft(page, "aks");
      await page.goto(`/draft/${id}/view`);
      await expect(page.getByTestId("viewer-canvas")).toBeVisible();
      await page.waitForTimeout(900);
      await expectNoHorizontalOverflow(page);
      await shot(page, `pages/viewer-${width}`);
      expect(errors).toEqual([]);
    });
  });
}

test("the landing page's call to action opens the dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start free" }).first().click();
  await expect(page).toHaveURL(/\/diagrams$/);
});

test("a link to a template that doesn't exist says so, instead of opening a blank diagram", async ({
  page,
}) => {
  await page.goto("/draft/new?template=no-such-template");
  await expect(page.getByText("That template doesn't exist")).toBeVisible();
  await expect(page.getByText(/no-such-template/)).toBeVisible();
  await expect(page).toHaveURL(/\/draft\/new\?template=no-such-template$/);
});
