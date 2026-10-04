import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, watchErrors, yaml } from "./support";

const mod = process.platform === "darwin" ? "Meta" : "Control";

/** Layout line for an element, e.g. `web_vm: [3, 7]` → "[3, 7]". */
function layoutOf(text: string, name: string): string | null {
  return (
    new RegExp(`^\\s+${name}: (.+)$`, "m").exec(text.slice(text.lastIndexOf("layout:")))?.[1] ??
    null
  );
}

async function canvasPoint(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("editor (ED-1 … ED-23)", () => {
  test("opens a template with floating chrome, library, inspector and scenes", async ({ page }) => {
    const errors = watchErrors(page);
    await openDraft(page, "web-app");
    await expect(page.getByRole("toolbar", { name: "Tools" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Icon library" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Inspector" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Scenes" })).toBeVisible();
    await expect(page.getByText("Draft saved in this browser")).toBeVisible();
    await shot(page, "editor/overview-1440");
    expect(errors).toEqual([]);
  });

  test("adds an icon from the library, then undo and redo", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByLabel("Search icons").fill("key vault");
    await page
      .getByRole("button", { name: /^Add Key Vaults?$/ })
      .first()
      .click();
    await expect.poll(async () => (await yaml(page)).includes("azure/key-vaults")).toBe(true);
    await shot(page, "editor/added-from-library");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 120 } });
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(async () => (await yaml(page)).includes("azure/key-vaults")).toBe(false);
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect.poll(async () => (await yaml(page)).includes("azure/key-vaults")).toBe(true);
  });

  test("drags an element on the grid and writes one layout line", async ({ page }) => {
    await openDraft(page, "web-app");
    const before = layoutOf(await yaml(page), "shopper");
    const from = await canvasPoint(page, "shopper");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y - 60, { steps: 8 });
    await shot(page, "editor/dragging");
    await page.mouse.up();
    await expect.poll(async () => layoutOf(await yaml(page), "shopper")).not.toBe(before);
  });

  test("brings an element to the front from the context menu (z-order)", async ({ page }) => {
    await openDraft(page, "web-app");
    const point = await canvasPoint(page, "web_vm");
    await page.mouse.click(point.x, point.y, { button: "right" });
    await page.getByRole("menuitem", { name: /Arrange/ }).hover();
    await shot(page, "editor/context-menu-arrange");
    await page.getByRole("menuitem", { name: /Bring to front/ }).click();
    await expect.poll(async () => layoutOf(await yaml(page), "web_vm") ?? "").toMatch(/z: \d+/);
  });

  test("changes the canvas background theme", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
    await page.getByRole("radiogroup", { name: "Canvas theme" }).getByLabel("Paper").click();
    await expect.poll(async () => (await yaml(page)).includes("theme: paper")).toBe(true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await shot(page, "editor/theme-paper");
  });

  test("plays scenes from the strip and shows each one", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByRole("button", { name: "Scene: Region outage" }).click();
    await page.waitForTimeout(900);
    await shot(page, "editor/scene-region-outage");
    await page.getByRole("button", { name: "Scene: Traffic spike" }).click();
    await page.waitForTimeout(900);
    await shot(page, "editor/scene-traffic-spike");
  });

  test("keeps the draft after a reload (autosave to this browser)", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByLabel("Search icons").fill("redis");
    await page
      .getByRole("button", { name: /^Add .*Redis/ })
      .first()
      .click();
    await expect(page.getByText("Draft saved in this browser")).toBeVisible();
    const saved = await yaml(page);
    await page.reload();
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    expect(await yaml(page)).toBe(saved);
  });

  test("shows the keyboard shortcuts", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 140 } });
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await shot(page, "editor/shortcuts");
  });
});

test.describe("export (EX-1 … EX-8)", () => {
  async function exportAs(
    page: Page,
    format: RegExp,
    options: (page: Page) => Promise<void> = async () => {},
  ): Promise<Buffer> {
    await page.getByRole("button", { name: "Export" }).click();
    const dialog = page.getByRole("dialog", { name: "Export" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: format }).click();
    await options(page);
    const download = page.waitForEvent("download", { timeout: 90_000 });
    await dialog.getByRole("button", { name: /^Download/ }).click();
    const file = await (await download).path();
    return readFileSync(file);
  }

  test("PNG, JPEG and SVG are real files of that type", async ({ page }) => {
    await openDraft(page, "web-app");
    await page.getByRole("button", { name: "Export" }).click();
    await page.waitForTimeout(600);
    await shot(page, "export/dialog");
    await page.keyboard.press("Escape");

    const png = await exportAs(page, /PNG/);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    const jpeg = await exportAs(page, /JPEG/);
    expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]);
    const svg = (await exportAs(page, /SVG/)).toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("@font-face");
    expect(svg).not.toMatch(/<script/i);
  });

  test("animated GIF and WebP loop the scene", async ({ page }) => {
    test.setTimeout(240_000);
    await openDraft(page, "web-app");
    const fps10 = async (p: Page) => {
      await p
        .getByRole("radiogroup", { name: "Frame rate" })
        .getByRole("radio", { name: "10" })
        .click();
      await p.getByRole("radiogroup", { name: "Scale" }).getByRole("radio", { name: "1×" }).click();
    };
    const gif = await exportAs(page, /GIF/, fps10);
    expect(gif.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    expect(gif.includes(Buffer.from("NETSCAPE2.0"))).toBe(true);
    const webp = await exportAs(page, /WebP/, fps10);
    expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(webp.includes(Buffer.from("ANIM"))).toBe(true);
  });

  test("a GIF of all scenes plays each scene for 4 seconds, and a nested level exports on its own (EX-6, EX-8)", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await openDraft(page, "web-app");
    const allScenes = async (p: Page) => {
      await p
        .getByRole("radiogroup", { name: "Frame rate" })
        .getByRole("radio", { name: "10" })
        .click();
      await p.getByRole("radiogroup", { name: "Scale" }).getByRole("radio", { name: "1×" }).click();
      await p
        .getByRole("radiogroup", { name: "Animation" })
        .getByRole("radio", { name: "All scenes" })
        .click();
    };
    const gif = await exportAs(page, /GIF/, allScenes);
    // One graphic control extension per frame: Normal + 2 scenes, 4s each, at 10 fps.
    const frames = gif.toString("latin1").split("\x21\xf9\x04").length - 1;
    expect(frames).toBe(120);

    await openDraft(page, "aks");
    const aks = await element(page, "aks").locator("rect").first().boundingBox();
    if (aks === null) throw new Error("aks not on screen");
    await page.mouse.dblclick(aks.x + aks.width / 2, aks.y + aks.height / 2);
    await expect(page.getByText("from App Gateway")).toBeVisible();
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByRole("dialog", { name: "Export" })).toContainText("This level (aks)");
    await page.keyboard.press("Escape");
    const svg = (await exportAs(page, /SVG/)).toString("utf8");
    expect(svg).toContain("Orders API");
    expect(svg).not.toContain("Front Door");
  });
});
