import { expect, test } from "@playwright/test";
import { element, inspectorTab, openSection, openYaml, shot, yaml } from "./support";

/** Shapes (M4, 03-shapes-styles-library): add, label, style, resize and connect. */

const DIAGRAM = `mogram: 1
name: Flow
components:
  user: generic/user
shapes:
  intake: { shape: rounded, label: Take order, tone: blue }
  approve: { shape: diamond, label: Approved?, tone: amber }
  orders: { shape: cylinder, label: Orders, shadow: true }
  events: { shape: queue, label: Order events, tone: violet }
  web: { shape: cloud, label: Internet }
  edge: { shape: hexagon, label: Edge fn, tone: green }
  report: { shape: document, label: Report, dash: dashed }
  ops: { shape: person, label: Operator }
  done: { shape: circle, label: Done, tone: green }
  scope: { shape: ellipse, label: Scope, fill: "#1e293b" }
  box: { shape: rectangle, label: Box, tone: rose }
connections:
  user_to_intake: { from: user, to: intake, flow: traffic }
  intake_to_approve: { from: intake, to: approve, flow: traffic }
  approve_to_orders: { from: approve, to: orders, label: yes }
  orders_to_events: { from: orders, to: events, route: straight }
layout:
  user: [0, 0]
  intake: [16, 2]
  approve: [38, 0]
  orders: [58, 0]
  events: [74, 2]
  web: [0, 20]
  edge: [20, 20]
  report: [40, 20]
  ops: [60, 20]
  done: [72, 20]
  scope: [0, 34]
  box: [20, 34]
`;

test.describe("shapes (M4)", () => {
  test("every shape draws with its look, and lines meet the outline", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    for (const shape of ["rounded", "diamond", "cylinder", "queue", "cloud", "hexagon"]) {
      await expect(
        page.getByTestId("editor-canvas").locator(`[data-shape="${shape}"]`),
      ).toHaveCount(1);
    }
    await expect(element(page, "report").locator('[data-part="outline"]')).toHaveAttribute(
      "stroke-dasharray",
      /\d/,
    );
    await shot(page, "editor/shapes");
  });

  test("a shape from the library lands in the middle with its label open", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await page.getByRole("button", { name: "Add Cylinder" }).click();
    const label = page.getByTestId("editor-canvas").getByRole("textbox", { name: "Label" });
    await expect(label).toBeFocused();
    await label.fill("Payments DB");
    await label.press("Enter");
    // Named after the shape it started as; the label is what was typed.
    await expect
      .poll(() => yaml(page))
      .toContain("cylinder: { shape: cylinder, label: Payments DB }");
    await expect(element(page, "cylinder")).toHaveAttribute("data-shape", "cylinder");
  });

  test("the inspector changes the outline, tone and size", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const box = await element(page, "box").locator('[data-part="fill"]').boundingBox();
    if (box === null) throw new Error("no box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const inspector = page.getByRole("region", { name: "Inspector" });
    await inspector.getByRole("radio", { name: "Hexagon" }).click();
    await expect(element(page, "box")).toHaveAttribute("data-shape", "hexagon");
    await inspectorTab(page, "Style");
    await inspector.getByRole("radio", { name: "Blue" }).click();
    await expect
      .poll(() => yaml(page))
      .toMatch(/box: \{ shape: hexagon, label: Box, tone: blue \}/);
    await shot(page, "editor/shape-style");
    await inspectorTab(page, "Arrange");
    const w = inspector.getByRole("textbox", { name: "W", exact: true });
    await w.fill("20");
    await w.press("Enter");
    // A hexagon is 15 × 10 by default; the width was typed.
    await expect.poll(() => yaml(page)).toContain("box: { at: [20, 34], size: [20, 10] }");
  });

  test("a named style made from one shape is given to another and updated for both", async ({
    page,
  }) => {
    await openYaml(
      page,
      `mogram: 1
name: Styles
shapes:
  a: { shape: diamond, label: A, tone: violet, dash: dashed }
  b: { shape: rectangle, label: B }
layout:
  a: [0, 0]
  b: [30, 0]
`,
    );
    const inspector = page.getByRole("region", { name: "Inspector" });
    const pick = async (name: string) => {
      const box = await element(page, name).locator('[data-part="fill"]').boundingBox();
      if (box === null) throw new Error(`no ${name}`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await pick("a");
    await inspectorTab(page, "Style");
    await openSection(page, "Named style");
    await inspector.getByRole("button", { name: "New style from this" }).click();
    await inspector.getByRole("textbox", { name: "New style name" }).fill("choice");
    await inspector.getByRole("textbox", { name: "New style name" }).press("Enter");
    await expect
      .poll(() => yaml(page))
      .toContain("styles:\n  choice: { tone: violet, dash: dashed }\n");
    await expect.poll(() => yaml(page)).toContain("a: { shape: diamond, label: A, style: choice }");

    await pick("b");
    await inspector.getByRole("combobox", { name: "Named style" }).click();
    await page.getByRole("option", { name: "choice" }).click();
    await expect
      .poll(() => yaml(page))
      .toContain("b: { shape: rectangle, label: B, style: choice }");
    await expect(element(page, "b").locator('[data-part="outline"]')).toHaveAttribute(
      "stroke-dasharray",
      /\d/,
    );

    // A change on b, pushed into the style: a follows.
    await inspector.getByRole("radio", { name: "Rose" }).click();
    await expect(inspector.getByText("Changed here:")).toBeVisible();
    await shot(page, "editor/named-style");
    await inspector.getByRole("button", { name: "Update style" }).click();
    await expect.poll(() => yaml(page)).toContain("choice: { tone: rose, dash: dashed }");
    await expect
      .poll(() => yaml(page))
      .toContain("b: { shape: rectangle, label: B, style: choice }");
  });

  test("a shape's diamond handle drags its lid or corners; Escape puts it back", async ({
    page,
  }) => {
    await openYaml(
      page,
      `mogram: 1
name: Handles
shapes:
  db: { shape: cylinder, label: Orders }
  box: { shape: rectangle, label: Box }
layout:
  db: { at: [0, 0], size: [12, 16] }
  box: [30, 0]
`,
    );
    const pick = async (name: string) => {
      const box = await element(page, name).locator('[data-part="fill"]').boundingBox();
      if (box === null) throw new Error(`no ${name}`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return box;
    };
    const db = await pick("db");
    const unit = db.width / 96; // 12 cells of 8 px
    const handle = page.locator('[data-handle="adjust"][data-key="lid"]');
    await expect(handle).toBeVisible();
    const from = await handle.boundingBox();
    if (from === null) throw new Error("no handle");
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    // The lid starts 12 px deep (its handle at 24 px); drag the handle 16 px lower: 20 px.
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 16 * unit, { steps: 6 });
    // The shape follows live: the handle sits on the new lid edge.
    await expect
      .poll(async () => Math.round(((await handle.boundingBox())?.y ?? 0) - from.y))
      .toBeGreaterThan(12 * unit);
    await shot(page, "editor/shape-handle");
    await page.mouse.up();
    await expect
      .poll(() => yaml(page))
      .toContain("db: { shape: cylinder, label: Orders, lid: 20 }");
    const inspector = page.getByRole("region", { name: "Inspector" });
    await inspectorTab(page, "Style");
    await expect(inspector.getByRole("textbox", { name: "Lid", exact: true })).toHaveValue("20");
    // The whole drag is one undo step.
    await page.getByTestId("editor-canvas").click({ position: { x: 900, y: 700 } });
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect.poll(() => yaml(page)).toContain("db: { shape: cylinder, label: Orders }");

    // Escape during the drag leaves the corners as they were.
    await pick("box");
    const corner = page.locator('[data-handle="adjust"][data-key="corner"]');
    const at = await corner.boundingBox();
    if (at === null) throw new Error("no corner handle");
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + 20, at.y + at.height / 2, { steps: 4 });
    await expect.poll(async () => (await corner.boundingBox())?.x ?? 0).toBeGreaterThan(at.x + 10);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(() => yaml(page)).toContain("box: { shape: rectangle, label: Box }");
  });

  test("the library adds containers and annotations too", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const library = page.getByRole("region", { name: "Icon library" });
    await library.getByRole("radio", { name: "Containers", exact: true }).click();
    await library.getByRole("button", { name: "Add Region" }).click();
    await expect.poll(() => yaml(page)).toMatch(/containers:\s+region: \{ type: region/);
    await library.getByRole("radio", { name: "Notes", exact: true }).click();
    await library.getByRole("button", { name: "Add Highlight zone" }).click();
    await expect.poll(() => yaml(page)).toContain("zone: Highlight");
    await shot(page, "editor/library-sections");
  });
});
