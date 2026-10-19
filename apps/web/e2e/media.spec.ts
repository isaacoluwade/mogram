import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import {
  expectNoHorizontalOverflow,
  openProject,
  openSection,
  shot,
  signIn,
  uniqueEmail,
  WIDTHS,
  yaml,
} from "./support";

/** How strongly a line of a listing is there: the presence group drawn around it. */
const presence = (line: Locator) => line.locator("xpath=..");

const CODE = {
  "mogram.yaml": `mogram: 1
name: Code parts
page: 16:9
shapes:
  listing:
    shape: code
    file: code/main.tf
    lines: 2-4
    numbers: true
    font_size: 22
    parts:
      name: { lines: 2, show: hidden }
      tail: 4
stories:
  main:
    - say: The name
      set:
        listing.name: { show: shown, tone: amber, mark: check }
      focus: listing.name
    - say: The rest
      focus: listing.tail
      zoom: listing.tail
layout:
  listing: [20, 20]
`,
  "code/main.tf": 'resource "example" "main" {\n  name = "example"\n\n  enabled = true\n}\n',
};

async function selectOnCanvas(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("It must be on screen to be clicked.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test("shows a slice of a code file, its parts lit and focused as the story plays", async ({
  page,
}) => {
  const id = await openProject(page, CODE);
  const listing = page.getByTestId("editor-canvas").locator('[data-shape="code"]');
  // Whitespace is kept, numbers are the file's own, and a hidden part starts hidden.
  await expect(listing.locator('[data-code-line="2"] > text').last()).toHaveText(
    '  name = "example"',
    { useInnerText: false },
  );
  await expect(listing.locator('[data-code-line="2"] > text').first()).toHaveText("2");
  await expect(listing.locator("[data-code-line]")).toHaveCount(3);
  await expect(presence(listing.locator('[data-code-line="2"]'))).toHaveAttribute("opacity", "0");

  await selectOnCanvas(page, listing);
  await openSection(page, "Code");
  await expect(page.getByLabel("Code file", { exact: true })).toHaveValue("code/main.tf");
  await expect(page.getByLabel("Lines shown", { exact: true })).toHaveValue("2-4");
  await openSection(page, "Parts");
  await expect(page.getByLabel("Lines of part name", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Lines of part tail", { exact: true })).toHaveValue("4");

  // A part named and given lines from the inspector, then taken away again.
  await page.getByRole("button", { name: "Add lines as a part" }).click();
  const added = page.getByLabel("Name of part lines", { exact: true });
  await expect(added).toBeVisible();
  await added.fill("extra");
  await added.press("Enter");
  const extraLines = page.getByLabel("Lines of part extra", { exact: true });
  await extraLines.fill("3-4");
  await extraLines.press("Enter");
  await expect(extraLines).toHaveValue("3-4");
  expect(await yaml(page)).toContain("extra: 3-4");
  await page.getByRole("button", { name: "Delete part extra" }).click();
  await expect(page.getByLabel("Name of part extra", { exact: true })).toHaveCount(0);

  // Written here takes the file's lines in: nothing on screen changes.
  await page.getByRole("radio", { name: "Written here" }).click();
  await expect(page.getByLabel("Code text", { exact: true })).toHaveValue(/resource "example"/);
  await expect(listing.locator("[data-code-line]")).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByLabel("Code file", { exact: true })).toHaveValue("code/main.tf");

  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  await page.goto(`/draft/${id}/view`);
  await expect(page.getByTestId("viewer-canvas")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("story-caption")).toHaveText("The name");
  const shown = page.getByTestId("viewer-canvas").locator('[data-shape="code"]');
  await expect(presence(shown.locator('[data-code-line="2"]'))).toHaveAttribute("opacity", "1");
  // Focus dims everything else in the listing.
  await expect(shown.locator('[data-code-line="2"]')).toHaveAttribute("opacity", "1");
  await expect(shown.locator('[data-code-line="4"]')).toHaveAttribute("opacity", "0.22");
  await expect(
    shown.locator('[data-named-part="listing.name"] [data-part-tone="amber"]'),
  ).not.toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("story-caption")).toHaveText("The rest");
  await expect(shown.locator('[data-code-line="4"]')).toHaveAttribute("opacity", "1");
  await expect(shown.locator('[data-code-line="2"]')).toHaveAttribute("opacity", "0.22");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    await expect(shown.locator('[data-code-line="4"]')).toBeInViewport({ ratio: 0.99 });
    await shot(page, `viewer/code-parts-${width}`);
  }
});

test("drops a picture, draws a region on it, and keeps its bytes through a cloud share", async ({
  page,
  browser,
}) => {
  test.skip(process.env.E2E_BASE_URL !== undefined, "needs the development mailbox");
  await signIn(page, uniqueEmail("image-assets"));
  await openProject(
    page,
    { "mogram.yaml": "mogram: 1\nname: Pictures\npage: 16:9\n" },
    { allowEmptyRoot: true },
  );
  const original = await page.getByTestId("editor-canvas").evaluate(async (target) => {
    const picture = document.createElement("canvas");
    picture.width = 160;
    picture.height = 80;
    const context = picture.getContext("2d")!;
    context.fillStyle = "#e52640";
    context.fillRect(0, 0, 80, 80);
    context.fillStyle = "#1cba65";
    context.fillRect(80, 0, 80, 80);
    const blob = await new Promise<Blob>((resolve) =>
      picture.toBlob((value) => resolve(value!), "image/png"),
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "two-colors.png", { type: "image/png" }));
    const box = target.getBoundingClientRect();
    target.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      }),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const image = page.getByTestId("editor-canvas").locator('[data-shape="image"] image');
  await expect(image).toHaveAttribute("href", /^data:image\/png;base64,/);
  // The very bytes dropped, drawn at the picture's own proportions.
  const pixels = await image.evaluate(async (node) => {
    const loaded = new Image();
    loaded.src = node.getAttribute("href")!;
    await loaded.decode();
    const canvas = document.createElement("canvas");
    canvas.width = loaded.naturalWidth;
    canvas.height = loaded.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(loaded, 0, 0);
    return [
      loaded.naturalWidth,
      loaded.naturalHeight,
      ...context.getImageData(20, 20, 1, 1).data,
      ...context.getImageData(120, 20, 1, 1).data,
    ];
  });
  expect(pixels).toEqual([160, 80, 229, 38, 64, 255, 28, 186, 101, 255]);

  await selectOnCanvas(page, image);
  await openSection(page, "Picture");
  await expect(page.getByLabel("Picture file", { exact: true })).toHaveValue(/two-colors\.png$/);
  await openSection(page, "Parts");
  await page.getByRole("button", { name: "Draw a region" }).click();
  await expect(page.getByTestId("part-drawing")).toBeVisible();
  const bounds = await image.boundingBox();
  if (bounds === null) throw new Error("The picture must be on screen.");
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.75, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(page.getByTestId("part-drawing")).toHaveCount(0);
  await expect(page.getByLabel("Name of part region", { exact: true })).toBeVisible();
  expect(Number(await page.getByLabel("Left of part region").inputValue())).toBeCloseTo(0.2, 1);
  expect(Number(await page.getByLabel("Width of part region").inputValue())).toBeCloseTo(0.5, 1);

  await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
  await page.reload();
  await expect(image).toHaveAttribute("href", /^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Diagram menu" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Download files/ }).click();
  const archive = unzipSync(new Uint8Array(readFileSync(await (await download).path())));
  const path = Object.keys(archive).find((value) => value.endsWith(".png"))!;
  expect(Array.from(archive[path]!)).toEqual(original);

  await page.getByRole("button", { name: "Diagram menu" }).click();
  await page.getByRole("menuitem", { name: /Save to cloud/ }).click();
  await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(image).toHaveAttribute("href", /^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share" });
  await dialog.getByLabel("General access").click();
  await page.getByRole("option", { name: /Anyone with the link/ }).click();
  const link = await dialog.getByLabel("Link", { exact: true }).inputValue();
  await page.keyboard.press("Escape");
  // Someone else, in another browser: the picture comes from the share.
  const visitor = await browser.newContext();
  try {
    const viewer = await visitor.newPage();
    await viewer.goto(link);
    const shared = viewer.getByTestId("viewer-canvas").locator('[data-shape="image"] image');
    await expect(shared).toHaveAttribute("href", /^data:image\/png;base64,/);
    for (const width of WIDTHS) {
      await viewer.setViewportSize({ width, height: 900 });
      await viewer.reload();
      await expect(shared).toBeInViewport();
      await expectNoHorizontalOverflow(viewer);
      await shot(viewer, `share/image-assets-${width}`);
    }
  } finally {
    await visitor.close();
  }
});

test("wraps text at its written width, and edits it at that width", async ({ page }) => {
  await openProject(
    page,
    {
      "mogram.yaml": `mogram: 1
name: Paragraphs
page: 16:9
containers:
  list: { layout: column, gap: 2 }
layout:
  list: [50, 20]
  decorations:
    first: { text: "A paragraph with several words that wraps across multiple lines.", width: 24, in: list }
    second: { text: "The next paragraph stays below the first one.", width: 24, in: list }
`,
    },
    { allowEmptyRoot: true },
  );
  const canvas = page.getByTestId("editor-canvas");
  const first = canvas.locator('[data-element="first"][data-kind="decoration"]');
  const second = canvas.locator('[data-element="second"][data-kind="decoration"]');
  await expect(first).toBeVisible();
  const firstBox = (await first.boundingBox())!;
  const secondBox = (await second.boundingBox())!;
  // Wrapped paragraphs stack: the second starts below the first's last line.
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
  await first.dblclick();
  const field = page.getByLabel("Text on canvas");
  await expect(field).toBeVisible();
  expect(await field.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("pre-wrap");
  expect((await field.boundingBox())!.width).toBeLessThan(300);
  await page.keyboard.press("Escape");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    await shot(page, `editor/wrapped-paragraphs-${width}`);
  }
});

test("a listing opens its code on double-click, its file is in the code panel, and exports keep its font", async ({
  page,
}) => {
  await openProject(page, CODE);
  const listing = page.getByTestId("editor-canvas").locator('[data-shape="code"]');
  const box = await listing.boundingBox();
  if (box === null) throw new Error("The listing must be on screen.");
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  // No label to type in: its Code section, with the first field ready.
  await expect(page.getByLabel("Code file", { exact: true })).toBeFocused();

  await page.getByRole("button", { name: "YAML code" }).click();
  const files = page
    .getByRole("region", { name: "YAML code" })
    .getByRole("tablist", { name: "Files" });
  await files.getByRole("tab", { name: "code/main.tf" }).click();
  await expect(page.getByRole("textbox", { name: "Contents of code/main.tf" })).toContainText(
    'resource "example" "main"',
  );

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export" });
  await dialog.getByRole("radio", { name: /^SVG/ }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /^Download SVG/ }).click();
  const svg = readFileSync(await (await download).path(), "utf8");
  expect(svg).toContain('font-family:"geistMono"');
});
