import { expect, test, type Page } from "@playwright/test";
import { element, openDraft, shot, watchErrors, yaml } from "./support";

const mod = process.platform === "darwin" ? "Meta" : "Control";

/** The library menu: which icon library the panel browses. */
function libraryMenu(page: Page) {
  return page.getByRole("region", { name: "Icon library" }).getByRole("button", {
    name: /^Icon library:/,
  });
}

async function chooseLibrary(page: Page, name: string): Promise<void> {
  await libraryMenu(page).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
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
    await expect(libraryMenu(page)).toHaveAccessibleName("Icon library: AWS");
    // One menu instead of a row of filters; generic icons are a Basics tab, not a library.
    await libraryMenu(page).click();
    await expect(page.getByRole("menuitemradio")).toHaveText([
      "Azure",
      "AWS",
      "Google Cloud",
      "Kubernetes",
      "Tool logos",
      "Uploaded",
    ]);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /^Networking & Content Delivery, \d+ icons$/ }),
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
    await page.getByLabel("Search shapes and icons").fill("s3");
    const first = page.getByRole("region", { name: "Icon library" }).getByRole("button", {
      name: /^Add /,
    });
    await expect(first.first()).toHaveAccessibleName("Add Amazon S3");
    await libraryIconsLoaded(page);
    await shot(page, "providers/search-s3");
    await first.first().click();
    await expect.poll(async () => (await yaml(page)).includes("type: aws/s3\n")).toBe(true);

    // The library being browsed ranks first in search results.
    await page.getByLabel("Search shapes and icons").fill("");
    await chooseLibrary(page, "Google Cloud");
    await page.getByLabel("Search shapes and icons").fill("pubsub");
    await expect(first.first()).toHaveAccessibleName("Add Pub/Sub");
    await first.first().click();
    await expect.poll(async () => (await yaml(page)).includes("type: gcp/pub-sub")).toBe(true);
  });

  test("browses the Google Cloud library by category", async ({ page }) => {
    await openDraft(page, "gcp-pipeline");
    await expect(libraryMenu(page)).toHaveAccessibleName("Icon library: Google Cloud");
    // A category opens in place, with the way back above it.
    await page.getByRole("button", { name: /^Data Analytics, \d+ icons$/ }).click();
    const category = page.getByRole("list", { name: "Data Analytics" });
    await expect(category.getByRole("button", { name: "Add BigQuery", exact: true })).toBeVisible();
    await expect(category.getByRole("button", { name: "Add Pub/Sub", exact: true })).toBeVisible();
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
    await expect(libraryMenu(page)).toHaveAccessibleName("Icon library: Kubernetes");
    await page.getByRole("button", { name: "Scene: Traffic spike" }).click();
    await page.waitForTimeout(900);
    await libraryIconsLoaded(page);
    await shot(page, "providers/kubernetes-traffic-spike");
    expect(errors).toEqual([]);
  });

  test("lists a template for each new library in the gallery", async ({ page }) => {
    await page.goto("/templates");
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
    await page.getByRole("button", { name: "YAML code" }).click();
    await libraryMenu(page).click();
    await expect(page.getByRole("menuitemradio")).toHaveText(["AWS", "Uploaded"]);
    await shot(page, "providers/libraries-setting");
  });

  test("a big library draws its tiles a page at a time as they scroll in", async ({ page }) => {
    await openDraft(page, "aws-serverless");
    // AWS Analytics: more icons than one page of tiles.
    await page.getByRole("button", { name: /^Analytics, \d+ icons$/ }).click();
    const grid = page
      .getByRole("region", { name: "Icon library" })
      .getByRole("list", { name: "Analytics" });
    const total = Number(await grid.getAttribute("data-tiles"));
    expect(total).toBeGreaterThan(48);
    const tiles = grid.getByRole("button");
    await expect.poll(() => tiles.count()).toBeGreaterThan(0);
    const first = await tiles.count();
    expect(first).toBeLessThan(total);
    // Scrolling to the end of what's drawn draws more.
    await grid.locator("[data-more-tiles]").scrollIntoViewIfNeeded();
    await expect.poll(() => tiles.count()).toBeGreaterThan(first);
  });

  test("containers take the cloud's names and group icons; the left column lines up", async ({
    page,
  }) => {
    await openDraft(page, "aws-serverless");
    const library = page.getByRole("region", { name: "Icon library" });
    // The title bar is exactly as wide as the library below it.
    const title = await page
      .getByRole("button", { name: "Diagram menu" })
      .evaluate((node) => node.closest(".h-11")?.getBoundingClientRect().toJSON());
    const panel = await library.boundingBox();
    expect(title.x).toBe(panel?.x);
    expect(title.width).toBe(panel?.width);

    await library.getByRole("radio", { name: "Containers", exact: true }).click();
    const containers = library.getByRole("list", { name: "Containers" });
    await expect(containers.getByRole("button")).toHaveText([
      "AWS Cloud",
      "AWS account",
      "Region",
      "VPC",
      "Availability Zone",
      "Public subnet",
      "Private subnet",
      "Security group",
      "Auto Scaling group",
      "EKS cluster",
      "Namespace",
      "Corporate data center",
      "Box",
    ]);
    await shot(page, "providers/aws-containers");
    await containers.getByRole("button", { name: "Add VPC" }).click();
    // Written like its neighbours (block style here), with the official group icon.
    await expect
      .poll(() => yaml(page))
      .toMatch(/ {2}vpc:\n {4}type: network\n(?: {4}.*\n)*? {4}icon: aws\/vpc-group/);

    // The same kind on Azure is a virtual network.
    await chooseLibrary(page, "Azure");
    await expect(containers.getByRole("button", { name: "Add Virtual network" })).toBeVisible();
    await expect(containers.getByRole("button", { name: "Add Subscription" })).toBeVisible();
  });
});
