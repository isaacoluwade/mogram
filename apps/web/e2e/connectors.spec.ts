import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, openYaml, shot, yaml } from "./support";

/** Editing connections by hand (ED-18, ED-29), after draw.io's edge handling. */

const DIAGRAM = `mogram: 1
name: Wires
components:
  app: generic/service
  db: generic/database
  cache: generic/database
connections:
  app_to_db: { from: app, to: db, flow: traffic, route: straight, label: SQL }
  app_to_cache: { from: app, to: cache, flow: traffic }
layout:
  app: [0, 0]
  db: [40, 0]
  cache: [40, 26]
`;

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  modifiers: ("Alt" | "Shift" | "Meta" | "Control")[] = [],
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  for (const key of modifiers) await page.keyboard.up(key);
}

/** A point on a connection's drawn line, `at` of the way along it. */
async function pointOnLine(page: Page, name: string, at = 0.5): Promise<{ x: number; y: number }> {
  return element(page, name)
    .locator('[data-part="line"]')
    .evaluate((path: SVGPathElement, fraction) => {
      const point = path.getPointAtLength(path.getTotalLength() * fraction);
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error("no CTM");
      return {
        x: point.x * matrix.a + point.y * matrix.c + matrix.e,
        y: point.x * matrix.b + point.y * matrix.d + matrix.f,
      };
    }, at);
}

const layoutLine = (text: string, name: string): string =>
  new RegExp(`^\\s+${name}: (.+)$`, "m").exec(text.slice(text.lastIndexOf("layout:")))?.[1] ?? "";
const definition = (text: string, name: string): string =>
  new RegExp(`^\\s+${name}: (\\{.+\\})$`, "m").exec(
    text.slice(text.indexOf("connections:")),
  )?.[1] ?? "";

const tile = (page: Page, name: string) => element(page, name).locator("rect").first();

test.describe("connections you can shape (ED-29)", () => {
  test("a straight line bends from its faded midpoint handle, and the bend comes out on double-click", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const mid = await pointOnLine(page, "app_to_db", 0.3);
    await page.mouse.click(mid.x, mid.y);
    const add = page.locator('[data-handle="add-waypoint"]').first();
    await expect(add).toBeVisible();
    const from = await centre(add);
    await drag(page, from, { x: from.x, y: from.y + 80 });
    await expect
      .poll(async () => layoutLine(await yaml(page), "app_to_db"))
      .toMatch(/via: \[\[\d+, \d+\]\]/);
    await shot(page, "editor/connection-bent-straight");

    const waypoint = page.locator('[data-handle="waypoint"]').first();
    await expect(waypoint).toBeVisible();
    await waypoint.dblclick();
    await expect.poll(async () => layoutLine(await yaml(page), "app_to_db")).toBe("");
  });

  test("dragging a bend back into line removes it; Alt keeps it", async ({ page }) => {
    await openYaml(page, `${DIAGRAM}  app_to_db: { via: [[24, 12]] }\n`);
    const line = await pointOnLine(page, "app_to_db", 0.5);
    await page.mouse.click(line.x, line.y);
    const waypoint = page.locator('[data-handle="waypoint"]').first();
    const from = await centre(waypoint);
    const start = await centre(tile(page, "app"));
    // Straight back up level with both ends: the bend no longer bends anything.
    await drag(page, from, { x: from.x, y: start.y });
    await expect.poll(async () => layoutLine(await yaml(page), "app_to_db")).toBe("");
  });

  test("dragging an unselected straight line bends it straight away", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const point = await pointOnLine(page, "app_to_db", 0.7);
    await drag(page, point, { x: point.x, y: point.y - 64 });
    await expect.poll(async () => layoutLine(await yaml(page), "app_to_db")).toContain("via:");
  });

  test("an orthogonal segment slides sideways, and sliding it back clears the waypoints", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const point = await pointOnLine(page, "app_to_cache", 0.5);
    await page.mouse.click(point.x, point.y);
    const segment = page.locator('[data-handle="segment"]').nth(1);
    await expect(segment).toBeVisible();
    const from = await centre(segment);
    const horizontal = (await segment.getAttribute("style"))?.includes("row-resize") === true;
    const to = horizontal ? { x: from.x, y: from.y + 48 } : { x: from.x + 48, y: from.y };
    await drag(page, from, to);
    await expect.poll(async () => layoutLine(await yaml(page), "app_to_cache")).toContain("via:");
    await shot(page, "editor/connection-segment-moved");

    const moved = await centre(page.locator('[data-handle="segment"]').nth(1));
    await drag(
      page,
      moved,
      horizontal ? { x: moved.x, y: moved.y - 48 } : { x: moved.x - 48, y: moved.y },
    );
    await expect.poll(async () => layoutLine(await yaml(page), "app_to_cache")).toBe("");
  });

  test("dragging an end onto another element reconnects it; onto one of its points fixes it there", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const point = await pointOnLine(page, "app_to_db", 0.5);
    await page.mouse.click(point.x, point.y);
    const end = page.locator('[data-handle="end"][data-end="to"]');
    await expect(end).toBeVisible();

    // Over empty canvas the end snaps back: nothing changes.
    const from = await centre(end);
    await drag(page, from, { x: from.x + 220, y: from.y - 160 });
    expect(definition(await yaml(page), "app_to_db")).toContain("to: db");

    // Onto the cache tile's left middle point: reconnected and fixed there.
    const cache = await tile(page, "cache").boundingBox();
    if (cache === null) throw new Error("cache not on screen");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(cache.x + 2, cache.y + cache.height / 2, { steps: 14 });
    await expect(page.locator("[data-handle]")).toHaveCount(0);
    await shot(page, "editor/connection-reconnecting");
    await page.mouse.up();
    await expect.poll(async () => definition(await yaml(page), "app_to_db")).toContain("to: cache");
    await expect
      .poll(async () => layoutLine(await yaml(page), "app_to_db"))
      .toContain("to_anchor: left");
    await expect(page.locator('[data-handle="end"][data-end="to"]')).toHaveAttribute("fill", /.+/);

    // Onto the middle of db with Cmd/Ctrl: a copy goes there, the original stays.
    const newEnd = await centre(page.locator('[data-handle="end"][data-end="to"]'));
    const db = await centre(tile(page, "db"));
    await drag(page, newEnd, db, [process.platform === "darwin" ? "Meta" : "Control"]);
    const text = await yaml(page);
    expect(definition(text, "app_to_cache")).toContain("to: cache");
    expect(text).toMatch(/app_to_db: \{ from: app, to: cache/);
    expect(text).toMatch(/app_to_db_2|app_to_db: \{ from: app, to: db/);
  });

  test("the label moves along and beside its line", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const label = element(page, "app_to_db").locator('[data-part="label"]');
    const from = await centre(label);
    const start = await centre(tile(page, "app"));
    await drag(page, from, { x: start.x + (from.x - start.x) * 0.5, y: from.y - 24 });
    await expect
      .poll(async () => layoutLine(await yaml(page), "app_to_db"))
      .toMatch(/label: \{ at: 0\.\d+, offset: [\d.]+ \}/);
    await shot(page, "editor/connection-label-moved");
  });

  test("Escape cancels a drag in the middle", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const point = await pointOnLine(page, "app_to_db", 0.5);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y - 80, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(layoutLine(await yaml(page), "app_to_db")).toBe("");
  });

  test("arrowheads, dashes and widths come from the file", async ({ page }) => {
    await openYaml(
      page,
      DIAGRAM.replace(
        "route: straight, label: SQL }",
        "route: straight, label: SQL, arrows: { start: diamond-outline, end: block }, line: dashed, width: 3 }",
      ),
    );
    const line = element(page, "app_to_db");
    await expect(line.locator('[data-part="start-arrow"]')).toHaveCount(1);
    await expect(line.locator('[data-part="end-arrow"]')).toHaveCount(1);
    await expect(line.locator('[data-part="line"]')).toHaveAttribute("stroke-width", "3");
    await expect(line.locator('[data-part="line"]')).toHaveAttribute("stroke-dasharray", "12 8");
  });

  test("a line set to jump hops over the lines drawn before it", async ({ page }) => {
    await openYaml(
      page,
      `mogram: 1
name: Crossing
components:
  a: generic/service
  b: generic/service
  c: generic/service
  d: generic/service
connections:
  across: { from: a, to: b, route: straight }
  down: { from: c, to: d, route: straight, jumps: arc }
layout:
  a: [0, 12]
  b: [40, 12]
  c: [20, 0]
  d: [20, 26]
`,
    );
    await expect(element(page, "down").locator('[data-part="line"]')).toHaveAttribute("d", / A\d/);
    await expect(element(page, "across").locator('[data-part="line"]')).not.toHaveAttribute(
      "d",
      / A\d/,
    );
    await shot(page, "editor/connection-jumps");
  });

  test("bends follow the element they join when it moves", async ({ page }) => {
    await openYaml(page, `${DIAGRAM}  app_to_db: { via: [[20, 12]] }\n`);
    const before = layoutLine(await yaml(page), "app_to_db");
    expect(before).toContain("[[20, 12]]");
    const db = await centre(tile(page, "db"));
    await drag(page, db, { x: db.x, y: db.y + 96 });
    await expect
      .poll(async () => layoutLine(await yaml(page), "app_to_db"))
      .toMatch(/via: \[\[\d+, (1[3-9]|2\d)\]\]/);
  });

  test("dropping a component on a connection puts it in the middle (Alt keeps it out)", async ({
    page,
  }) => {
    await openYaml(
      page,
      DIAGRAM.replace(
        "  cache: generic/database\n",
        "  cache: generic/database\n  fw: generic/firewall\n",
      ).replace("  cache: [40, 26]\n", "  cache: [40, 26]\n  fw: [20, 16]\n"),
    );
    const fw = await centre(tile(page, "fw"));
    const line = await pointOnLine(page, "app_to_db", 0.5);
    await page.mouse.move(fw.x, fw.y);
    await page.mouse.down();
    await page.mouse.move(line.x, line.y, { steps: 12 });
    await expect(page.locator('[data-overlay="split-target"]')).toHaveCount(1);
    await shot(page, "editor/connection-split-target");
    await page.mouse.up();
    await expect.poll(async () => definition(await yaml(page), "app_to_db")).toContain("to: fw");
    expect(definition(await yaml(page), "fw_to_db")).toContain("from: fw, to: db");
  });
});
