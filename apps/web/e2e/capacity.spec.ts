import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { element, openSection, openYaml, shot, viewerSettled, watchErrors, yaml } from "./support";

/**
 * Capacity (D-82, D-84): scaling out and up drawn from what the diagram says, the inspector that
 * sets it up, and traffic that rises and falls on its own, in the editor and the viewer.
 */

const SHOP = `mogram: 1
name: Shop
containers:
  web_set: { type: scaling-group, label: Web scale set }
components:
  users: { type: generic/users, label: Customers }
  lb: { type: azure/load-balancers, label: Load balancer }
  web: { type: azure/virtual-machine, label: Web VM, in: web_set, scale: { min: 2, max: 8 } }
  db:
    type: azure/sql-database
    label: Orders DB
    scale:
      sizes:
        - { name: S2, cpu: 2, memory: 8, disks: 1 }
        - { name: S4, cpu: 4, memory: 16, disks: 2 }
        - { name: S8, cpu: 8, memory: 32, disks: 4 }
connections:
  users_to_lb: { from: users, to: lb }
  lb_to_web: { from: lb, to: web_set }
  web_to_db: { from: web, to: db }
scenes:
  spike:
    users_to_lb: 5x
`;

const PLAIN = `mogram: 1
name: Shop
components:
  users: { type: generic/users, label: Customers }
  lb: { type: azure/load-balancers, label: Load balancer }
  web: { type: azure/virtual-machine, label: Web VM }
  db: { type: azure/sql-database, label: Orders DB }
connections:
  users_to_lb: { from: users, to: lb }
  lb_to_web: { from: lb, to: web }
  web_to_db: { from: web, to: db }
scenes:
  spike:
    db: active
`;

/** Frames in a GIF, read block by block. */
function gifFrames(gif: Buffer): number {
  let at = 13;
  const flags = gif[10] ?? 0;
  if (flags & 0x80) at += 3 * 2 ** ((flags & 7) + 1);
  const skipBlocks = () => {
    while ((gif[at] ?? 0) !== 0) at += (gif[at] ?? 0) + 1;
    at++;
  };
  let frames = 0;
  while (at < gif.length) {
    const kind = gif[at];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      at += 2;
      skipBlocks();
    } else if (kind === 0x2c) {
      frames++;
      const local = gif[at + 9] ?? 0;
      at += 10;
      if (local & 0x80) at += 3 * 2 ** ((local & 7) + 1);
      at++;
      skipBlocks();
    } else throw new Error(`Unexpected GIF block ${kind ?? "?"} at ${at}`);
  }
  return frames;
}

const onCanvas = (page: Page, name: string) =>
  page.getByTestId("editor-canvas").locator(`[data-element="${name}"]`).first();

const inspector = (page: Page) => page.getByRole("region", { name: "Inspector" });

async function select(page: Page, name: string): Promise<void> {
  const box = await element(page, name).locator("rect").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Clicks a connection halfway along its line. */
async function selectConnection(page: Page, name: string): Promise<void> {
  const point = await element(page, name)
    .locator('[data-part="line"]')
    .evaluate((path: SVGPathElement) => {
      const at = path.getPointAtLength(path.getTotalLength() / 2);
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error("no CTM");
      return {
        x: at.x * matrix.a + at.y * matrix.c + matrix.e,
        y: at.x * matrix.b + at.y * matrix.d + matrix.f,
      };
    });
  await page.mouse.click(point.x, point.y);
}

async function scene(page: Page, label: string): Promise<void> {
  await page
    .getByRole("region", { name: "Scenes" })
    .getByRole("button", { name: `Scene: ${label}` })
    .click();
}

async function enter(page: Page, field: string, value: string): Promise<void> {
  const box = inspector(page).getByRole("textbox", { name: field, exact: true });
  await box.fill(value);
  await box.press("Enter");
}

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe("capacity (D-82)", () => {
  test("a scale set grows for a spike and shrinks after it; a machine grows to its largest size", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openYaml(page, SHOP);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    const web = onCanvas(page, "web");
    const db = onCanvas(page, "db");
    await expect(web).toContainText("2 running · 50%");
    await expect(db).toHaveAttribute("data-size", "S4");
    await shot(page, "editor/capacity-normal");

    await scene(page, "Spike");
    // Copies start one after another (a ring fills), then take traffic.
    await expect(web).toContainText("starting");
    await shot(page, "editor/capacity-scaling-out");
    await expect(web).toContainText("8 running", { timeout: 10_000 });
    // Five times the traffic is more than the largest size can carry: it's at its ceiling.
    await expect(db).toHaveAttribute("data-size", "S8", { timeout: 10_000 });
    // It grew into it smoothly, taking traffic all the while: no restart.
    await expect(db.locator('[data-part="restart"]')).toHaveCount(0);
    await expect(db).not.toContainText("Restarting");
    await expect(db).toContainText("Largest size");
    await expect(db).toHaveAttribute("data-state", "overloaded");
    await shot(page, "editor/capacity-spike");

    await scene(page, "Normal");
    await expect(web).toContainText("stopping", { timeout: 10_000 });
    await expect(web).toContainText(/2 running · \d+%/, { timeout: 10_000 });
    await expect(db).toHaveAttribute("data-size", "S4", { timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test("the inspector says what each scene does to it, and why", async ({ page }) => {
    await openYaml(page, SHOP);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    await select(page, "db");
    await openSection(page, "Scaling");
    const now = inspector(page).getByTestId("capacity-now");
    await expect(now).toContainText("What happens");
    await expect(now).toContainText("It uses S4, the smallest size that keeps it under 70% (50%)");
    await expect(now).toContainText("give it Waves");
    await expect(inspector(page).locator('[data-in-use="true"]')).toHaveAttribute(
      "data-size",
      "S4",
    );
    await expect(inspector(page).getByTestId("state-note")).toContainText(
      "Its state in every scene",
    );

    await scene(page, "Spike");
    await expect(now).toContainText("In Spike");
    await expect(now).toContainText("Traffic reaching it: 5×");
    await expect(now).toContainText("Even S8, its largest size, can't keep it under 70%");
    // Where the scene makes it busier, one click from changing it.
    await expect(now).toContainText(
      "Its traffic is set on Customers → Load balancer (5× in Spike)",
    );
    await expect(inspector(page).locator('[data-in-use="true"]')).toHaveAttribute(
      "data-size",
      "S8",
    );
    await expect(inspector(page).getByTestId("state-note")).toContainText(
      "On the canvas it’s overloaded: its load is 125% in Spike",
    );
    await expect(inspector(page).getByTestId("state-note")).toContainText("Only in Spike.");
    await shot(page, "editor/inspector-capacity-now");
    await now.getByRole("button", { name: "Customers → Load balancer" }).click();
    await expect(
      inspector(page).getByRole("textbox", { name: "Carries", exact: true }),
    ).toHaveValue("5");
  });

  test("the inspector sets up scaling and traffic, and scenes hold copies and levels", async ({
    page,
  }) => {
    await openYaml(page, PLAIN);
    await page.getByRole("button", { name: "Zoom to fit" }).click();

    await select(page, "web");
    await openSection(page, "Scaling");
    await inspector(page).getByRole("radio", { name: "Scales out: more copies" }).click();
    await expect.poll(() => yaml(page)).toContain("scale: { min: 2, max: 8 }");
    await enter(page, "Max", "4");
    await expect.poll(() => yaml(page)).toContain("scale: { min: 2, max: 4 }");
    await expect(onCanvas(page, "web")).toContainText("running");

    await select(page, "db");
    await openSection(page, "Scaling");
    await inspector(page).getByRole("radio", { name: "Scales up: a bigger size" }).click();
    // A database gets database tiers.
    await expect.poll(() => yaml(page)).toContain("- { name: Basic, cpu: 2, memory: 8, disks: 1 }");
    await inspector(page).getByRole("button", { name: "Presets" }).click();
    await page.getByRole("menuitem", { name: /Virtual machine/ }).click();
    await expect.poll(() => yaml(page)).toContain("name: 16 vCPU");
    await inspector(page).getByRole("button", { name: "Add a size" }).click();
    await expect
      .poll(() => yaml(page))
      .toContain("- { name: 32 vCPU, cpu: 32, memory: 128, disks: 16 }");
    await shot(page, "editor/inspector-scaling");

    await selectConnection(page, "users_to_lb");
    await openSection(page, "Traffic · Normal");
    await enter(page, "Carries", "2");
    await expect
      .poll(() => yaml(page))
      .toContain("users_to_lb: { from: users, to: lb, traffic: 2x }");

    // In a scene, the same controls write that scene's values.
    await scene(page, "Spike");
    await selectConnection(page, "users_to_lb");
    await openSection(page, "Traffic · Spike");
    await enter(page, "Carries", "5");
    await select(page, "web");
    await openSection(page, "Scaling");
    await enter(page, "Copies", "3");
    await expect
      .poll(() => yaml(page))
      .toMatch(/spike:\n {4}db: active\n {4}users_to_lb: 5x\n {4}web: \{ copies: 3 \}/);
    await expect(onCanvas(page, "web")).toContainText("3 running", { timeout: 10_000 });
    await shot(page, "editor/inspector-scene-copies");
  });

  test("waves of traffic on an arrow scale the set out and back in, on their own", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openYaml(page, SHOP.replace("scenes:\n  spike:\n    users_to_lb: 5x\n", ""));
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    await selectConnection(page, "users_to_lb");
    await openSection(page, "Traffic · Normal");
    await inspector(page)
      .getByRole("radio", { name: "Waves: busy, then quiet, again and again" })
      .click();
    await expect
      .poll(() => yaml(page))
      .toContain("users_to_lb: { from: users, to: lb, traffic: waves }");
    await expect(inspector(page)).toContainText("rises and falls between 1× and 5× every 10 s");
    await shot(page, "editor/inspector-traffic-pattern");
    // No scenes: it grows as the wave comes, and shrinks when it goes, again and again.
    const web = onCanvas(page, "web");
    await expect(web).toContainText("8 running", { timeout: 15_000 });
    await shot(page, "editor/traffic-waves");
    await expect(web).toContainText(/2 running · \d+%/, { timeout: 15_000 });
    await expect(web).toContainText("8 running", { timeout: 15_000 });
    // The inspector says what happens to the scale set over the cycle.
    await select(page, "web");
    await openSection(page, "Scaling");
    await expect(inspector(page).getByTestId("capacity-now")).toContainText(
      "It runs 2 copies when quiet and 8 when busy",
    );
    await expect(inspector(page).getByTestId("capacity-now")).toContainText(
      "Customers → Load balancer (waves)",
    );

    // The viewer plays it too.
    await page.getByRole("button", { name: "Preview" }).click();
    await viewerSettled(page);
    await expect(element(page, "web")).toContainText("8 running", { timeout: 15_000 });
    await shot(page, "viewer/traffic-waves");
    expect(errors).toEqual([]);
  });

  test("an animated export of waves lasts whole cycles, so it loops", async ({ page }) => {
    test.setTimeout(240_000);
    await openYaml(
      page,
      SHOP.replace("scenes:\n  spike:\n    users_to_lb: 5x\n", "").replace(
        "users_to_lb: { from: users, to: lb }",
        "users_to_lb: { from: users, to: lb, traffic: { pattern: waves, every: 6s } }",
      ),
    );
    await page.getByRole("button", { name: "Export" }).click();
    const dialog = page.getByRole("dialog", { name: "Export" });
    await dialog.getByRole("radio", { name: /GIF/ }).click();
    await dialog
      .getByRole("radiogroup", { name: "Frame rate" })
      .getByRole("radio", { name: "10" })
      .click();
    await dialog
      .getByRole("radiogroup", { name: "Scale" })
      .getByRole("radio", { name: "1×" })
      .click();
    const download = page.waitForEvent("download", { timeout: 200_000 });
    await dialog.getByRole("button", { name: /^Download/ }).click();
    const gif = readFileSync(await (await download).path());
    // 6 s waves and the 4 s every motion repeats in meet every 12 s: 120 frames at 10 a second.
    expect(gifFrames(gif)).toBe(120);
  });
});
