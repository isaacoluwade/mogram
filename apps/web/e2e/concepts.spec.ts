import { expect, test, type Locator, type Page } from "@playwright/test";
import { element, openDraft, openYaml, shot, watchErrors, yaml } from "./support";

/**
 * Concepts (D-83, D-85): ideas in the Concepts tab and the gallery, found by topic, platform and
 * search, that play their story, apply to your own elements or insert their example; and your
 * own diagrams becoming concepts, patterns or explainers, filed under a topic.
 */

const SHOP = `mogram: 1
name: Shop
components:
  people: { type: azure/users, label: Shoppers }
  gateway: { type: azure/application-gateways, label: App gateway }
  web: { type: azure/virtual-machine, label: Web }
  orders: { type: azure/sql-database, label: Orders }
connections:
  people_to_gateway: { from: people, to: gateway }
  gateway_to_web: { from: gateway, to: web }
  web_to_orders: { from: web, to: orders }
`;

const REGIONS = `mogram: 1
name: Two regions
components:
  users: { type: generic/users, label: Users }
  dns: { type: generic/dns, label: DNS }
  east: { type: generic/server, label: East region }
  west: { type: generic/server, label: West region }
connections:
  users_to_dns: { from: users, to: dns }
  dns_to_east: { from: dns, to: east }
  dns_to_west: { from: dns, to: west, backup_for: dns_to_east }
scenes:
  east_outage:
    east: down
    dns_to_east: blocked
    dns_to_west: rerouted
`;

const DNS = `mogram: 1
name: How DNS resolves
concept:
  summary: From a name to an address, one server at a time.
  topic: networking
  platform: aws
components:
  browser: { type: generic/users, label: Browser }
  resolver: { type: generic/dns, label: Resolver }
connections:
  browser_to_resolver: { from: browser, to: resolver }
`;

const mod = process.platform === "darwin" ? "Meta" : "Control";

/** The Concepts tab of the left panel. */
async function concepts(page: Page): Promise<Locator> {
  await page
    .getByRole("tablist", { name: "Left panel" })
    .getByRole("tab", { name: "Concepts" })
    .first()
    .click();
  const panel = page.getByRole("region", { name: "Concepts" });
  await expect(panel).toBeVisible();
  return panel;
}

async function choose(page: Page, field: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function select(page: Page, ...names: string[]): Promise<void> {
  for (const [index, name] of names.entries()) {
    const box = await element(page, name).locator("rect").first().boundingBox();
    if (box === null) throw new Error(`${name} is not on screen`);
    if (index > 0) await page.keyboard.down("Shift");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (index > 0) await page.keyboard.up("Shift");
  }
}

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe("concepts (D-83, D-85)", () => {
  test("a concept plays its story, applies to your elements and inserts its example", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openYaml(page, SHOP);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    await select(page, "web");
    const panel = await concepts(page);
    // Every concept here is general, so there's no platform filter that would change anything.
    await expect(panel.getByRole("combobox", { name: "Platform" })).toHaveCount(0);
    await shot(page, "editor/concepts-tab");
    await panel.getByRole("button", { name: "Scaling & performance, 5 concepts" }).click();
    const concept = panel.getByRole("button", { name: "Concept: Horizontal scaling" });
    // Cards, two to a row, each drawing its diagram as it comes into view.
    await expect(concept.locator("[data-element]").first()).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, "editor/concepts-topic");
    await concept.click();

    const dialog = page.getByRole("dialog", { name: "Horizontal scaling" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Scaling & performance · Comes with Mogram");
    // It plays its story: waves of traffic, and the scale set growing with them.
    const preview = dialog.getByTestId("concept-preview");
    await expect(preview).toContainText("App server");
    await expect(preview).toContainText("8 running", { timeout: 15_000 });
    // What's selected plays the part it fits.
    await expect(dialog.getByRole("combobox", { name: "What scales out" })).toContainText("Web");
    // It says what applying changes, worked out from what's picked.
    const changes = dialog.getByTestId("concept-changes");
    await expect(changes).toContainText("Web scales out, 1 to 8 copies.");
    await expect(changes).toContainText(
      "Traffic on Shoppers → App gateway rises and falls between 1× and 5× every 10 s.",
    );
    await shot(page, "editor/concept-dialog");
    // Nothing picked for a part it needs: it says so, and Apply waits.
    await choose(page, "What scales out", "Choose…");
    await expect(changes).toContainText('Pick what plays "What scales out".');
    await expect(dialog.getByRole("button", { name: "Apply" })).toBeDisabled();
    await choose(page, "What scales out", "Web");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/Web scales out, 1 to 8 copies/)).toBeVisible();

    const text = await yaml(page);
    expect(text).toContain(
      "web: { type: azure/virtual-machine, label: Web, scale: { min: 1, max: 8 } }",
    );
    // Waves of traffic where shoppers come in: no scenes, it just plays.
    expect(text).toContain("people_to_gateway: { from: people, to: gateway, traffic: waves }");
    expect(text).not.toContain("scenes:");
    await expect(element(page, "web")).toContainText("8 running", { timeout: 15_000 });
    await shot(page, "editor/concept-applied");

    // It's first under Recently used now.
    await panel.getByRole("button", { name: /Back to topics/ }).click();
    await expect(
      panel
        .getByRole("region", { name: "Recently used" })
        .getByRole("button", { name: "Concept: Horizontal scaling" }),
    ).toBeVisible();
    await panel.getByRole("searchbox", { name: "Search concepts" }).fill("cache");
    await panel.getByRole("button", { name: "Concept: Caching" }).click();
    await page
      .getByRole("dialog", { name: "Caching" })
      .getByRole("button", { name: "Insert the example" })
      .click();
    await expect(page.getByText("Added Caching. Its scenes: Cold cache.")).toBeVisible();
    await expect(element(page, "cache")).toBeVisible();
    await expect(element(page, "cache")).toContainText("80% hit");
    await shot(page, "editor/concept-inserted");
    expect(errors).toEqual([]);
  });

  test("the gallery shows every concept, by topic, platform, kind and search", async ({ page }) => {
    const errors = watchErrors(page);
    await openDraft(page, "blank");
    const panel = await concepts(page);
    // The library is building blocks only.
    await expect(page.getByRole("region", { name: "Icon library" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Browse all" }).click();
    const gallery = page.getByRole("dialog", { name: "Concepts" });
    await expect(gallery).toBeVisible();
    const count = gallery.getByTestId("gallery-count");
    await expect(count).toHaveText("9 concepts");
    // Previews are drawn as cards come into view.
    await expect(
      gallery.getByTestId("concept-card-preview").first().locator("[data-element]").first(),
    ).toBeVisible();
    await shot(page, "editor/concept-gallery");

    const topics = gallery.getByRole("navigation", { name: "Concept topics" });
    await topics.getByRole("button", { name: /Reliability/ }).click();
    await expect(count).toHaveText("1 concept");
    await topics.getByRole("button", { name: /All concepts/ }).click();
    await gallery.getByRole("searchbox", { name: "Search all concepts" }).fill("queue");
    await expect(
      gallery.getByRole("button", { name: "Concept: Queue load levelling" }),
    ).toBeVisible();
    await gallery.getByRole("searchbox", { name: "Search all concepts" }).fill("");
    await expect(count).toHaveText("9 concepts");
    // All general patterns: no platform or kind to filter by.
    await expect(gallery.getByRole("combobox", { name: "Platform" })).toHaveCount(0);
    await expect(gallery.getByRole("radiogroup", { name: "Kind" })).toHaveCount(0);

    // Opening one shows it over the gallery; using it closes both.
    await gallery.getByRole("button", { name: "Concept: Caching" }).click();
    const dialog = page.getByRole("dialog", { name: "Caching" });
    await dialog.getByRole("button", { name: "Insert the example" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(element(page, "cache")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("your own diagram becomes a concept that appears in your library", async ({ page }) => {
    await openYaml(page, REGIONS);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    await select(page, "east", "west");
    await page.keyboard.press(`${mod}+k`);
    await page.keyboard.type("Make a concept");
    await page.keyboard.press("Enter");
    const inspector = page.getByRole("region", { name: "Inspector" });
    const summary = inspector.getByRole("textbox", { name: "Concept summary" });
    await summary.fill("When a region goes down, DNS sends people to the other one.");
    await summary.press("Enter");
    const east = inspector.getByRole("textbox", { name: "What East region does" });
    await east.fill("What usually serves");
    await east.press("Enter");
    // Filed under a topic, with tags for search.
    await choose(page, "Concept topic", "Reliability");
    const tags = inspector.getByRole("textbox", { name: "Concept tags" });
    await tags.fill("DR, regions");
    await tags.press("Enter");
    await expect.poll(() => yaml(page)).toContain(`concept:
  summary: When a region goes down, DNS sends people to the other one.
  topic: reliability
  tags: [dr, regions]
  roles:
    east: What usually serves
    west: West region
`);
    await shot(page, "editor/inspector-concept");
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });

    // Another diagram: it's there under Yours, and applies like a built-in one.
    await openDraft(page, "web-app");
    const panel = await concepts(page);
    const mine = panel
      .getByRole("region", { name: "Yours" })
      .getByRole("button", { name: "Concept: Two regions" });
    await expect(mine).toBeVisible();
    await expect(mine).toContainText("Reliability");
    await mine.click();
    const dialog = page.getByRole("dialog", { name: "Two regions" });
    await expect(dialog).toContainText("Reliability · Yours, in this browser");
    await expect(dialog.getByTestId("concept-preview")).toContainText("East region");
    await dialog.getByRole("button", { name: "Insert the example" }).click();
    await expect.poll(() => yaml(page)).toContain("east_outage:");
  });

  test("on an empty diagram a concept offers its example, or opens as a diagram of its own", async ({
    page,
    context,
  }) => {
    await openDraft(page, "blank");
    const panel = await concepts(page);
    await panel.getByRole("searchbox", { name: "Search concepts" }).fill("failover");
    await panel.getByRole("button", { name: "Concept: Failover" }).click();
    const dialog = page.getByRole("dialog", { name: "Failover" });
    // An empty diagram has nothing to play the parts: it says so, and offers the example.
    await expect(dialog.getByTestId("concept-empty")).toContainText("Your diagram is empty");
    await expect(dialog.getByRole("button", { name: "Apply" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Insert the example" })).toBeVisible();
    await shot(page, "editor/concept-dialog-empty");
    const opened = context.waitForEvent("page");
    await dialog.getByRole("button", { name: "Open as a new diagram" }).click();
    const tab = await opened;
    await tab.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
    await expect(
      tab.getByTestId("editor-canvas").locator('[data-element="standby"]').first(),
    ).toBeVisible();
    await tab.close();
  });

  test("a concept without parts is an explainer; a platform's own brings the filters", async ({
    page,
  }) => {
    await openYaml(page, DNS);
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
    await openDraft(page, "web-app");
    const panel = await concepts(page);
    const mine = panel.getByRole("button", { name: "Concept: How DNS resolves" });
    await expect(mine).toContainText("Networking · AWS · Explainer");

    // An AWS concept makes the platform filter worth having; this Azure diagram has none of
    // Azure's own, so it shows all, and AWS puts its own first.
    const platform = panel.getByRole("combobox", { name: "Platform" });
    await expect(platform).toContainText("All platforms");
    await platform.click();
    await expect(page.getByRole("option")).toHaveText(["All platforms", "AWS (1)"]);
    await page.getByRole("option", { name: "AWS (1)" }).click();
    await panel.getByRole("button", { name: /^Networking, 2 concepts/ }).click();
    await expect(panel.getByRole("button", { name: /^Concept: / }).first()).toHaveAccessibleName(
      "Concept: How DNS resolves",
    );
    await panel.getByRole("button", { name: /Back to topics/ }).click();

    // Two kinds now: the gallery offers Apply / Explain.
    await panel.getByRole("button", { name: "Browse all" }).click();
    const gallery = page.getByRole("dialog", { name: "Concepts" });
    await gallery.getByRole("radio", { name: "Explainers to insert or open" }).click();
    await expect(gallery.getByTestId("gallery-count")).toHaveText("1 concept");
    await page.keyboard.press("Escape");
    await expect(gallery).toHaveCount(0);

    await mine.click();
    const dialog = page.getByRole("dialog", { name: "How DNS resolves" });
    await expect(dialog).toContainText("Networking · AWS · Yours, in this browser");
    await expect(dialog).toContainText("An explainer");
    await expect(dialog.getByRole("button", { name: "Apply" })).toHaveCount(0);
    await expect(dialog.getByTestId("concept-preview")).toContainText("Resolver");
    await page.waitForTimeout(400);
    await shot(page, "editor/concept-explainer");
    await dialog.getByRole("button", { name: "Insert the example" }).click();
    await expect.poll(() => yaml(page)).toContain("resolver:");
  });
});
