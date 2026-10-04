import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, watchErrors, yaml } from "./support";

const mod = process.platform === "darwin" ? "Meta" : "Control";

function libraries(page: Page) {
  return page.getByRole("group", { name: "Libraries" });
}

async function select(page: Page, name: string): Promise<void> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Waits until every library icon on screen has loaded (they load lazily, as they scroll in). */
async function libraryIconsLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[aria-label="Icon library"] img')]
      .filter((image) => image.getBoundingClientRect().top < window.innerHeight)
      .every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
  );
}

/** The attributes motion changes on a component, sampled twice a moment apart. */
async function motionSamples(page: Page, name: string): Promise<[string, string]> {
  const sample = () =>
    element(page, name).evaluate((node) => {
      const motion = node.querySelector(":scope > g");
      const glow = motion?.querySelector("circle");
      return `${motion?.getAttribute("transform") ?? ""}|${glow?.getAttribute("opacity") ?? ""}`;
    });
  const first = await sample();
  await page.waitForTimeout(350);
  return [first, await sample()];
}

test.describe("cloud icon libraries (IC-7)", () => {
  test("an AWS diagram opens on the AWS library, with AWS group icons on its containers", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDraft(page, "aws-serverless");
    await expect(libraries(page).getByRole("button", { name: "AWS", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["Azure", "Google Cloud", "Kubernetes", "Generic", "Tools", "Mine", "All"]) {
      await expect(libraries(page).getByRole("button", { name, exact: true })).toBeVisible();
    }
    // Every library chip shows, in two rows of a 28px chip and a 4px gap.
    expect((await libraries(page).boundingBox())?.height).toBeLessThanOrEqual(60);
    await expect(
      page.getByRole("button", { name: /^Networking & Content Delivery/ }),
    ).toBeVisible();
    await libraryIconsLoaded(page);
    // AWS Cloud's group icon takes the canvas text colour, so it reads on the dark canvas.
    const header = element(page, "aws_cloud").locator("image").first();
    await expect(header).toHaveAttribute("href", /^data:image\/svg\+xml/);
    expect(await header.getAttribute("href")).not.toContain("currentColor");
    await shot(page, "providers/aws-template");
    expect(errors).toEqual([]);
  });

  test("finds AWS and Google Cloud icons by the names people type and adds them", async ({
    page,
  }) => {
    await openDraft(page, "aws-serverless");
    await page.getByLabel("Search icons").fill("s3");
    const first = page.getByRole("region", { name: "Icon library" }).getByRole("button", {
      name: /^Add /,
    });
    await expect(first.first()).toHaveAccessibleName("Add Amazon S3");
    await libraryIconsLoaded(page);
    await shot(page, "providers/search-s3");
    await first.first().click();
    await expect.poll(async () => (await yaml(page)).includes("type: aws/s3\n")).toBe(true);

    await libraries(page).getByRole("button", { name: "Google Cloud", exact: true }).click();
    await page.getByLabel("Search icons").fill("pubsub");
    await expect(first.first()).toHaveAccessibleName("Add Pub/Sub");
    await first.first().click();
    await expect.poll(async () => (await yaml(page)).includes("type: gcp/pub-sub")).toBe(true);
  });

  test("browses the Google Cloud library by category", async ({ page }) => {
    await openDraft(page, "gcp-pipeline");
    await expect(
      libraries(page).getByRole("button", { name: "Google Cloud", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Data Analytics/ }).click();
    await expect(page.getByRole("button", { name: "Add BigQuery", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Pub/Sub", exact: true })).toBeVisible();
    await libraryIconsLoaded(page);
    await shot(page, "providers/gcp-template");
  });

  test("plays every motion preset on an AWS icon", async ({ page }) => {
    await openDraft(page, "aws-serverless");
    await select(page, "upload");
    const motion = page.getByRole("radiogroup", { name: "Motion" });
    for (const preset of ["Pulse", "Bounce", "Rotate", "Shake", "Glow"]) {
      await motion.getByRole("radio", { name: new RegExp(`^${preset}`) }).click();
      await expect
        .poll(async () => (await yaml(page)).includes(`motion: ${preset.toLowerCase()}`))
        .toBe(true);
      await expect
        .poll(async () => {
          const [before, after] = await motionSamples(page, "upload");
          return before !== after;
        }, `${preset} animates`)
        .toBe(true);
      if (preset === "Rotate") await shot(page, "providers/aws-motion-rotate");
    }
  });

  test("a Kubernetes diagram opens on the Kubernetes library and plays its scenes", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openDraft(page, "kubernetes-app");
    await expect(
      libraries(page).getByRole("button", { name: "Kubernetes", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Scene: Traffic spike" }).click();
    await page.waitForTimeout(900);
    await libraryIconsLoaded(page);
    await shot(page, "providers/kubernetes-traffic-spike");
    expect(errors).toEqual([]);
  });

  test("lists a template for each new library in the gallery", async ({ page }) => {
    await page.goto("/diagrams");
    for (const name of [
      "Serverless API on AWS",
      "Event pipeline on Google Cloud",
      "Web app on Kubernetes",
    ]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await page.getByText("Web app on Kubernetes", { exact: true }).first().scrollIntoViewIfNeeded();
    await shot(page, "providers/templates-gallery");
  });

  test("offers only the libraries a diagram's settings name", async ({ page }) => {
    await openDraft(page, "aws-serverless");
    await page.getByRole("button", { name: "YAML code" }).click();
    const editor = page.getByRole("textbox", { name: "Contents of mogram.yaml" });
    await editor.click();
    await page.keyboard.press(`${mod}+Home`);
    await page.keyboard.type("libraries: [aws, generic]\n");
    await expect(libraries(page).getByRole("button")).toHaveText(["All", "AWS", "Generic", "Mine"]);
    await shot(page, "providers/libraries-setting");
  });
});
