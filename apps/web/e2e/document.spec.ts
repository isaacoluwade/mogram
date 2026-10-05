import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { element, openYaml, openSection, shot, viewerSettled, yaml } from "./support";

/** Document workflow (M6, 07-document-workflow): links and data on elements. */

const DIAGRAM = `mogram: 1
name: Docs
components:
  api: { type: generic/service, link: https://example.com/runbook, data: { owner: payments, sla: 99.9 } }
  db: { type: generic/database, link: "#api" }
layout:
  api: [0, 0]
  db: [30, 0]
`;

async function select(page: Page, name: string) {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("links and data (M6)", () => {
  test("the inspector sets an element's link and data", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await select(page, "db");
    const inspector = page.getByRole("region", { name: "Inspector" });
    await openSection(page, "Link");
    const link = inspector.getByRole("textbox", { name: "Link", exact: true });
    await expect(link).toHaveValue("#api");
    await link.fill("scene:outage");
    await link.press("Enter");
    await expect.poll(() => yaml(page)).toMatch(/link: "?scene:outage"?/);
    await openSection(page, "Data");
    await inspector.getByRole("button", { name: "Add a property" }).click();
    await inspector.getByRole("textbox", { name: "New data name" }).fill("tier");
    await inspector.getByRole("textbox", { name: "New data value" }).fill("2");
    await inspector.getByRole("textbox", { name: "New data value" }).press("Enter");
    await expect.poll(() => yaml(page)).toContain("data: { tier: 2 }");
    await shot(page, "editor/link-and-data");
  });

  test("a label shows data through %key% placeholders, the diagram's included", async ({
    page,
  }) => {
    await openYaml(
      page,
      `mogram: 1
name: Docs
components:
  api: { type: generic/service, label: "%owner% API", data: { owner: Payments } }
  db: { type: generic/database, label: "Orders (%env%)" }
layout:
  api: [0, 0]
  db: [30, 0]
`,
    );
    const canvas = page.getByTestId("editor-canvas");
    await expect(element(page, "api")).toContainText("Payments API");
    // %env% isn't set anywhere yet: it shows as written.
    await expect(element(page, "db")).toContainText("Orders (%env%)");
    // Nothing selected: the diagram's own data, which every label can use.
    await canvas.click({ position: { x: 900, y: 700 } });
    const inspector = page.getByRole("region", { name: "Inspector" });
    await openSection(page, "Data");
    await inspector.getByRole("button", { name: "Add a property" }).click();
    await inspector.getByRole("textbox", { name: "New data name" }).fill("env");
    await inspector.getByRole("textbox", { name: "New data value" }).fill("prod");
    await inspector.getByRole("textbox", { name: "New data value" }).press("Enter");
    await expect.poll(() => yaml(page)).toContain("name: Docs\ndata: { env: prod }\n");
    await expect(element(page, "db")).toContainText("Orders (prod)");
    await shot(page, "editor/placeholders");
    // Editing the label edits what's written, tokens and all.
    await select(page, "api");
    await expect(inspector.getByRole("textbox", { name: "Label", exact: true })).toHaveValue(
      "%owner% API",
    );
  });

  test("viewers follow links and see data", async ({ page }) => {
    const id = await openYaml(page, DIAGRAM);
    // The viewer reads the saved draft.
    await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    // db links to api: clicking it brings up api with its data.
    await element(page, "db").click();
    const card = page.getByRole("dialog", { name: "Api" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("definition").first()).toHaveText("payments");
    // api's own link opens in a new tab.
    const popup = page.waitForEvent("popup");
    await card.getByRole("button", { name: /example\.com\/runbook/ }).click();
    expect((await popup).url()).toContain("example.com/runbook");
  });
});

test.describe("exports you can open again (M6)", () => {
  async function exportAs(page: Page, format: RegExp): Promise<Buffer> {
    await page.getByRole("button", { name: "Export" }).click();
    const dialog = page.getByRole("dialog", { name: "Export" });
    await dialog.getByRole("radio", { name: format }).click();
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await dialog.getByRole("button", { name: /^Download/ }).click();
    return readFileSync(await (await download).path());
  }

  test("a PNG carries the diagram, and opening it brings the diagram back", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const png = await exportAs(page, /PNG/);
    expect(png.includes(Buffer.from("tEXtmogram"))).toBe(true);

    await openYaml(page, "mogram: 1\nname: Other\ncomponents:\n  x: generic/service\n");
    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Open files/ }).click();
    await page
      .getByRole("dialog", { name: "Open files" })
      .locator('input[type="file"][multiple]')
      .setInputFiles({ name: "docs.png", mimeType: "image/png", buffer: png });
    await expect.poll(() => yaml(page)).toContain("link: https://example.com/runbook");
  });

  test("PDF is a one-page PDF", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const pdf = await exportAs(page, /PDF/);
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("/Count 1");
  });
});

test("Tidy up lays the diagram out again by its traffic", async ({ page }) => {
  await openYaml(
    page,
    `mogram: 1
name: Messy
components:
  web: generic/service
  api: generic/service
  db: generic/database
connections:
  web_to_api: { from: web, to: api }
  api_to_db: { from: api, to: db }
layout:
  web: [60, 30]
  api: [0, 0]
  db: [3, 40]
`,
  );
  await page.getByTestId("editor-canvas").click({ position: { x: 900, y: 700 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Alt+t" : "Control+Alt+t");
  await expect.poll(async () => /web: \[(\d+), /.exec(await yaml(page))?.[1]).toBe("0");
});
