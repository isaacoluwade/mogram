import { expect, test, type Page } from "@playwright/test";
import { openDraft, openProject, openYaml, shot, yaml } from "./support";

/**
 * The assistant (A4), against the scripted provider the dev server runs with
 * (AI_PROVIDER=scripted, AI_ALLOW_ANONYMOUS=1): the whole loop is real — tools, checks,
 * streaming, questions, plans, undo and versions — only the model is a script.
 */

const DIAGRAM = `mogram: 1
name: Shop
components:
  web: { type: azure/app-services, label: Web }
  api: { type: azure/function-apps, label: Orders API }
connections:
  web_to_api: { from: web, to: api }
layout:
  web: [0, 0]
  api: [20, 0]
`;

const onCanvas = (page: Page, name: string) =>
  page.getByTestId("editor-canvas").locator(`[data-element="${name}"]`).first();

async function ask(page: Page, prompt: string) {
  const field = page.getByRole("textbox", { name: /^Message / });
  await field.fill(prompt);
  await field.press("Enter");
}

async function openAssistant(page: Page) {
  await page.keyboard.press("ControlOrMeta+j");
  const panel = page.getByRole("region", { name: "Assistant" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("textbox", { name: /^Message / })).toBeFocused();
  return panel;
}

const lastReply = (page: Page) => page.getByTestId("assistant-reply").last();

test.describe("assistant", () => {
  test.beforeEach(async ({ request }) => {
    const config = (await (await request.get("/api/ai/config")).json()) as {
      assistant: { enabled: boolean; models: { fast: string } | null };
    };
    test.skip(
      config.assistant.models?.fast !== "scripted-fast" || !config.assistant.enabled,
      "Needs a server started with AI_PROVIDER=scripted AI_ALLOW_ANONYMOUS=1",
    );
  });

  test("sets up scaling on the person's own elements (D-83)", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    await openAssistant(page);
    await ask(page, "Make the API scale out when traffic grows");
    await expect(lastReply(page)).toHaveAttribute("data-status", "done");
    await expect(lastReply(page)).toContainText("scales out from 1 to 8 copies");
    await expect(onCanvas(page, "api")).toHaveAttribute("data-scaling", "out");
    const text = await yaml(page);
    expect(text).toContain("scale: { min: 1, max: 8 }");
    expect(text).toContain("web_to_api: { from: web, to: api, traffic: waves }");
  });

  test("changes the diagram as one undo step and one version", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const panel = await openAssistant(page);
    await ask(page, "Add a cache for the API");
    await expect(onCanvas(page, "cache")).toBeVisible();
    await expect(lastReply(page)).toHaveAttribute("data-status", "done");
    await expect(lastReply(page)).toContainText("Added a cache");
    const card = panel.getByTestId("change-card");
    await expect(card).toContainText("Added Cache and reads");
    await expect
      .poll(() => yaml(page))
      .toContain("api_to_cache: { from: api, to: cache, label: reads }");
    await page.waitForTimeout(300);
    await shot(page, "editor/assistant");

    // The turn is a version of its own, named by the request.
    await page.getByRole("button", { name: "Diagram menu" }).click();
    await page.getByRole("menuitem", { name: /Version history/ }).click();
    const versions = page.getByRole("region", { name: "Version history" }).getByTestId("version");
    await expect(versions.first()).toContainText("Add a cache for the API");
    await expect(versions.first().getByLabel("Assistant")).toBeVisible();

    // One step to undo, from the card.
    await card.getByRole("button", { name: "Undo" }).click();
    await expect(onCanvas(page, "cache")).toHaveCount(0);
    await expect(card).toContainText("Undone");
  });

  test("asks a question with options, and builds from the answer", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const panel = await openAssistant(page);
    await ask(page, "Ask me which database to use");
    const question = panel.getByTestId("question-card");
    await expect(question).toContainText("Which database should orders use?");
    await expect(question.getByRole("button", { name: /Azure SQL/ })).toBeVisible();
    await expect(question.getByRole("button", { name: "Something else…" })).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, "editor/assistant-question");
    // The second answer, by its number.
    await page.getByTestId("editor-canvas").click({ position: { x: 700, y: 600 } });
    await page.keyboard.press("2");
    await expect(panel.getByText("Cosmos DB", { exact: true }).first()).toBeVisible();
    await expect(onCanvas(page, "orders_db")).toBeVisible();
    await expect
      .poll(() => yaml(page))
      .toContain("orders_db: { type: azure/cosmos-db, label: Orders DB }");
  });

  test("proposes a plan for a build, then builds it", async ({ page }) => {
    await openDraft(page, "blank");
    const panel = await openAssistant(page);
    await expect(panel).toContainText("Describe what you want to build");
    await ask(page, "Plan a shop for me");
    const plan = panel.getByTestId("plan-card");
    await expect(plan).toContainText("A three-tier shop on Azure");
    await plan.getByRole("button", { name: "Build it" }).click();
    await expect(onCanvas(page, "storefront")).toBeVisible();
    await expect(onCanvas(page, "orders_db")).toBeVisible();
    await expect(lastReply(page)).toHaveAttribute("data-status", "done");
    await expect(lastReply(page)).toContainText("Built the shop");
    await expect(page.getByTitle("Rename diagram")).toHaveText("Online shop");
    // A big build is framed whole, with nothing left selected.
    await expect(page.getByRole("region", { name: "Inspector" })).toContainText("Diagram");
    await page.waitForTimeout(400);
    await shot(page, "editor/assistant-build");
  });

  test("the person's edits wait while it works, and Stop ends the turn", async ({ page }) => {
    await openYaml(page, DIAGRAM);
    const panel = await openAssistant(page);
    await ask(page, "Give me a long answer");
    await expect(lastReply(page)).toHaveAttribute("data-status", "working");
    // While it works, the person's own changes wait.
    const box = await onCanvas(page, "web").locator("rect").first().boundingBox();
    if (box === null) throw new Error("web not on screen");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press("Delete");
    await expect(page.getByText(/The assistant is changing the diagram/)).toBeVisible();
    await expect(onCanvas(page, "web")).toBeVisible();
    await panel.getByRole("button", { name: "Stop" }).click();
    await expect(lastReply(page)).toHaveAttribute("data-status", "stopped");
    await expect(panel.getByRole("button", { name: "Send" })).toBeVisible();
  });

  test("points at what it's asked about, and closing the panel keeps the conversation", async ({
    page,
  }) => {
    await openYaml(page, DIAGRAM);
    const panel = await openAssistant(page);
    await ask(page, "Where is the orders API?");
    await expect(lastReply(page)).toContainText("That's the API");
    await expect(
      page
        .getByRole("region", { name: "Inspector" })
        .getByRole("textbox", { name: "Label", exact: true }),
    ).toHaveValue("Orders API");
    await page.keyboard.press("ControlOrMeta+j");
    await expect(panel).toBeHidden();
    await page.getByRole("button", { name: "Assistant", exact: true }).first().click();
    await expect(page.getByRole("region", { name: "Assistant" })).toContainText("That's the API");
  });

  test("a description on the diagrams page becomes a diagram the assistant builds", async ({
    page,
  }) => {
    await page.goto("/diagrams");
    const describe = page.getByRole("form", { name: "Describe a new diagram" });
    await describe.getByRole("textbox").fill("Build it: an online shop");
    await shot(page, "dashboard/describe");
    await describe.getByRole("button", { name: "Build it" }).click();
    await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
    const panel = page.getByRole("region", { name: "Assistant" });
    await expect(panel).toContainText("Build it: an online shop");
    await expect(onCanvas(page, "storefront")).toBeVisible();
    await expect(page.getByTitle("Rename diagram")).toHaveText("Online shop");
    // The request isn't sent again on reload.
    await page.reload();
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(page.getByTestId("assistant-reply")).toHaveCount(1);
  });

  test("builds a deck: adds a slide and gives its beat words (D-107)", async ({ page }) => {
    await openProject(
      page,
      {
        "mogram.yaml": "mogram: 1\nname: Course\ndeck:\n  slides: [intro]\n",
        "intro/mogram.yaml":
          "mogram: 1\nname: Introduction\nshapes:\n  hello: { label: Hello }\nlayout:\n  hello: [20, 20]\n",
        "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  door: { label: Front door }
stories:
  main:
    - say: Something happens.
layout:
  door: [20, 20]
`,
      },
      { allowEmptyRoot: true },
    );
    const panel = await openAssistant(page);
    await ask(page, "Add a slide for the flow");
    await expect(lastReply(page)).toHaveAttribute("data-status", "done");
    await expect(lastReply(page)).toContainText("Added a slide, How it flows");
    const rail = page.getByTestId("slide-rail");
    await expect(rail.getByRole("button", { name: "Slide 2: How it flows" })).toBeVisible();
    // The beat has the words it was given, caption and script.
    await rail.getByRole("button", { name: "Slide 2: How it flows" }).click();
    // A slide opens on its story: nothing to switch to.
    await page.getByRole("button", { name: "Beat 1: A request arrives." }).click();
    await expect(page.getByLabel("Script", { exact: true })).toHaveValue(
      "Everything starts when a request arrives at the front door.",
    );
    // One step to undo, the slide and the words together.
    await panel.getByTestId("change-card").getByRole("button", { name: "Undo" }).click();
    await expect(rail.getByRole("button", { name: "Slide 2: How it flows" })).toHaveCount(0);
  });
});
