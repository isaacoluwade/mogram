import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import {
  expectNoHorizontalOverflow,
  openDraft,
  openProject,
  openSection,
  shot,
  signIn,
  uniqueEmail,
  WIDTHS,
  yaml,
} from "./support";

const FILES = {
  "mogram.yaml": `mogram: 1
name: Authoring course
deck:
  slides: [intro]
`,
  "intro/mogram.yaml": `mogram: 1
name: Introduction
shapes:
  welcome: { label: Welcome }
layout:
  welcome: [20, 20]
`,
  "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  request: { label: Request }
  service: { label: Service }
stories:
  main:
    - say: Request arrives
    - say: Service responds
layout:
  request: [12, 18]
  service: [40, 18]
`,
};

/** Opens "Add" at the foot of the rail and picks one of its items. */
async function addFromRail(page: Page, item: string | RegExp): Promise<void> {
  // On a phone the rail is a sheet; the one on screen is the one to use.
  await page
    .getByTestId("slide-rail")
    .filter({ visible: true })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("menuitem", { name: item }).click();
}

/** "Choose a slide…": the dialog of places a slide can come from, on one of its tabs. */
async function chooseSlide(page: Page, tab?: string) {
  await addFromRail(page, /Choose a slide/);
  const dialog = page.getByRole("dialog", { name: "Add a slide" });
  await expect(dialog).toBeVisible();
  if (tab !== undefined) await dialog.getByRole("tab", { name: tab }).click();
  return dialog;
}

/** Every file of the project, as "Download files" saves it. */
async function downloadAll(page: Page): Promise<Record<string, string>> {
  await page.getByRole("button", { name: "Diagram menu" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Download files/ }).click();
  const entries = unzipSync(new Uint8Array(readFileSync(await (await download).path())));
  return Object.fromEntries(
    Object.entries(entries).map(([path, bytes]) => [path, strFromU8(bytes)]),
  );
}

test("adds a diagram of the project as a slide and moves it", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  const rail = page.getByTestId("slide-rail");
  await expect(rail.getByRole("button", { name: "Slide 1: Introduction" })).toBeVisible();

  const dialog = await chooseSlide(page);
  // A diagram already in the project; not the deck itself.
  await expect(dialog.getByRole("button", { name: /Authoring course/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: /The flow/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Slide 2: The flow" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTitle("Rename diagram")).toHaveText("The flow");

  await rail.getByRole("button", { name: "Options for slide 1" }).click();
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect(rail.getByRole("button", { name: "Slide 1: The flow" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Slide 2: Introduction" })).toBeVisible();
  expect(await yaml(page)).toMatch(/slides:\s*\[\s*flow,\s*intro\s*\]|- flow\n\s*- intro/);
  await expectNoHorizontalOverflow(page);
  await shot(page, "editor/deck-authoring-reorder");
});

test("brings in a template, a concept and a browser draft as slides", async ({ page }) => {
  await openDraft(page, "web-app");
  await openProject(page, FILES, { allowEmptyRoot: true });
  const rail = page.getByTestId("slide-rail");

  let dialog = await chooseSlide(page, "Templates");
  await dialog.getByRole("button", { name: /Three-tier web app/ }).click();
  await expect(rail.getByRole("button", { name: "Slide 2: Three-tier web app" })).toBeVisible();
  await shot(page, "editor/deck-authoring-template");

  dialog = await chooseSlide(page, "Concepts");
  await dialog.getByRole("button", { name: /Blue\/green deployment/ }).click();
  await expect(rail.getByRole("button", { name: "Slide 3: Blue/green deployment" })).toBeVisible();

  dialog = await chooseSlide(page, "Saved");
  // Signed out: drafts in this browser, and no account to ask.
  await dialog.getByRole("button", { name: /Three-tier web app.*Browser draft/ }).click();
  await expect(rail.getByRole("button", { name: "Slide 4: Three-tier web app" })).toBeVisible();

  // Each came in as a folder of its own, inside the deck's.
  const files = Object.keys(await downloadAll(page)).filter((path) => path.endsWith("mogram.yaml"));
  expect(files.length).toBeGreaterThanOrEqual(6);
});

test("builds and organizes slides from the rail", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  const rail = page.getByTestId("slide-rail");

  await addFromRail(page, "Section");
  const title = rail.getByRole("textbox", { name: "Section title" });
  await title.fill("Part one");
  await title.press("Enter");
  await expect(rail.getByRole("button", { name: "Part one", exact: true })).toBeVisible();

  await addFromRail(page, "Blank slide");
  await expect(rail.getByRole("button", { name: "Slide 2: New slide" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await rail.getByRole("button", { name: 'Section "Part one"' }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await rail.getByRole("textbox", { name: "Section title" }).fill("Getting started");
  await rail.getByRole("textbox", { name: "Section title" }).press("Enter");
  const section = rail.getByRole("button", { name: "Getting started", exact: true });
  await expect(section).toBeVisible();
  // Folding a section hides its slides; opening it shows them again.
  await section.click();
  await expect(rail.getByRole("button", { name: "Slide 2: New slide" })).toHaveCount(0);
  await section.click();
  await expect(rail.getByRole("button", { name: "Slide 2: New slide" })).toBeVisible();

  await rail.getByRole("button", { name: "Options for slide 1" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(rail.getByRole("button", { name: "Slide 2: Introduction" })).toBeVisible();
  await rail.getByRole("button", { name: "Options for slide 2" }).click();
  await page.getByRole("menuitem", { name: /Detach/ }).click();
  await expect(page.getByTitle("Rename diagram")).toHaveText("Introduction");
  expect(
    Object.keys(await downloadAll(page)).some((path) => /intro_copy\/mogram\.yaml$/.test(path)),
  ).toBe(true);

  await rail.getByRole("button", { name: "Options for slide 2" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Skip when playing" }).click();
  await expect(rail.getByRole("button", { name: "Skipped slide: Introduction" })).toBeVisible();
  // A skipped slide isn't counted: the blank slide is the second now.
  await expect(rail.getByRole("button", { name: "Slide 2: New slide" })).toBeVisible();
  await rail.getByRole("button", { name: "Options for skipped slide Introduction" }).click();
  await page.getByRole("menuitem", { name: "Remove from deck" }).click();
  await expect(rail.getByRole("button", { name: "Skipped slide: Introduction" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rail.getByRole("button", { name: "Skipped slide: Introduction" })).toBeVisible();
});

test("splits a story into two slides at a beat and joins them back", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  const rail = page.getByTestId("slide-rail");
  const dialog = await chooseSlide(page);
  await dialog.getByRole("button", { name: /The flow/ }).click();
  await expect(rail.getByRole("button", { name: "Slide 2: The flow" })).toBeVisible();

  // A slide opens on its story: nothing to switch to.
  await page.getByRole("button", { name: "Beat 2: Service responds" }).click();
  await page.getByRole("button", { name: "Beat options" }).click();
  await page.getByRole("menuitem", { name: "Start a new slide here" }).click();
  // The new slide is the stretch from the beat on, and it's the one showing.
  await expect(rail.getByRole("button", { name: "Slide 3: The flow" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const split = await yaml(page);
  expect(split).toContain("to: request_arrives");
  expect(split).toContain("from: request_arrives");

  await page.getByRole("button", { name: "Beat 2: Service responds" }).click();
  await page.getByRole("button", { name: "Beat options" }).click();
  await page.getByRole("menuitem", { name: "Join with the slide before" }).click();
  await expect(rail.getByRole("button", { name: "Slide 3: The flow" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Slide 2: The flow" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const joined = await yaml(page);
  expect(joined).not.toContain("to: request_arrives");
  expect(joined).not.toContain("from: request_arrives");
});

test("opens on the slide a link names, and keeps the rail usable at every width", async ({
  page,
}) => {
  const id = await openProject(
    page,
    {
      ...FILES,
      "mogram.yaml": `mogram: 1
name: Framed course
page: 16:9
deck:
  frame: frame
  slides: [intro, flow]
`,
      "frame/mogram.yaml": `mogram: 1
name: Course frame
shapes:
  logo: { label: Course logo }
layout:
  logo: [5, 5]
`,
    },
    { allowEmptyRoot: true },
  );
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  await page.goto(`/draft/${id}?slide=2`);
  const rail = page.getByTestId("slide-rail");
  await expect(rail.getByRole("button", { name: "Slide 2: The flow" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTitle("Rename diagram")).toHaveText("The flow");

  // The deck's own settings, and its frame edited like any diagram.
  await page.getByTestId("deck-select").click();
  await openSection(page, "Deck");
  await page.getByRole("button", { name: "Edit frame diagram" }).click();
  await expect(page.locator('[data-layer="diagram"] [data-element="logo"]').first()).toBeVisible();
  await rail.getByRole("button", { name: "Slide 1: Introduction" }).click();
  await expect(page.getByTitle("Rename diagram")).toHaveText("Introduction");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    if (width >= 768) await expect(rail).toBeVisible();
    await shot(page, `editor/deck-rail-${width}`);
  }
});

test("adds a slide from the Slides sheet on a phone", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  await page.setViewportSize({ width: 390, height: 844 });
  // Opened at a desktop width, the inspector is up; on a phone it's a sheet over the dock.
  await page
    .getByRole("region", { name: "Inspector" })
    .getByRole("button", { name: "Hide inspector" })
    .click();
  await page.getByRole("button", { name: "Slides", exact: true }).click();
  const rail = page.getByTestId("slide-rail").filter({ visible: true });
  await expect(rail).toBeVisible();
  const dialog = await chooseSlide(page, "Templates");
  await expect(dialog.getByRole("button", { name: /Three-tier web app/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "editor/deck-authoring-mobile");
  await dialog.getByRole("button", { name: /Three-tier web app/ }).click();
  await expect(rail.getByRole("button", { name: "Slide 2: Three-tier web app" })).toBeVisible();
});

test("starts a deck from the dashboard and counts its slides there", async ({ page }) => {
  await page.goto("/diagrams");
  await page
    .getByRole("region", { name: "Start", exact: true })
    .getByRole("button", { name: /^Blank deck/ })
    .click();
  await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
  await expect(
    page.getByTestId("slide-rail").getByRole("button", { name: "Slide 1: Introduction" }),
  ).toBeVisible();
  await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
  await page.goto("/diagrams");
  await expect(page.getByText("1 slide", { exact: true }).first()).toBeVisible();
});

test("brings in a diagram from the account and remembers where it came from", async ({ page }) => {
  test.skip(process.env.E2E_BASE_URL !== undefined, "needs the development mailbox");
  await signIn(page, uniqueEmail("deck-import"));
  const response = await page.request.post("/api/diagrams", {
    data: { name: "Saved flow", files: { "mogram.yaml": FILES["flow/mogram.yaml"] } },
  });
  expect(response.status()).toBe(201);
  const { diagram: source } = (await response.json()) as {
    diagram: { id: string; version: number };
  };
  await openProject(page, FILES, { allowEmptyRoot: true });
  const dialog = await chooseSlide(page, "Saved");
  await dialog.getByRole("button", { name: /Saved flow.*Account diagram/ }).click();
  await expect(
    page.getByTestId("slide-rail").getByRole("button", { name: "Slide 2: Saved flow" }),
  ).toBeVisible();
  const imported = Object.values(await downloadAll(page)).find((text) =>
    text.includes("from_diagram:"),
  );
  expect(imported).toContain(`from_diagram: ${source.id}`);
  expect(imported).toContain(`from_version: ${source.version}`);
});

test("a slide's dock is its story: scenes are offered only where the slide has some", async ({
  page,
}) => {
  await openProject(
    page,
    {
      "mogram.yaml":
        "mogram: 1\nname: Course\npage: 16:9\ndeck:\n  slides: [intro, flow, outage]\n",
      "intro/mogram.yaml": FILES["intro/mogram.yaml"],
      "flow/mogram.yaml": FILES["flow/mogram.yaml"],
      "outage/mogram.yaml": `mogram: 1
name: An outage
shapes:
  api: { label: API }
scenes:
  down:
    api: down
layout:
  api: [20, 20]
`,
    },
    { allowEmptyRoot: true },
  );
  const rail = page.getByTestId("slide-rail");
  const story = page.getByRole("region", { name: "Story" });
  const switcher = page.getByRole("radiogroup", { name: "Scenes or story" });

  // A still slide: it says so and offers a story, with no strip of scenes beside it.
  await expect(story).toContainText("This slide is still.");
  await expect(switcher).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Scenes" })).toHaveCount(0);
  await expect(page.getByLabel("Scene over it")).toHaveCount(0);
  await shot(page, "editor/deck-dock-still");
  await story.getByRole("button", { name: "Start a story" }).click();
  await expect(story.getByRole("button", { name: /^Beat 1/ })).toBeVisible();

  // A slide with a story opens on it, at its opening.
  await rail.getByRole("button", { name: "Slide 2: The flow" }).click();
  await expect(story.getByRole("button", { name: "Beat 1: Request arrives" })).toBeVisible();
  await expect(switcher).toHaveCount(0);
  await shot(page, "editor/deck-dock-story");

  // A slide whose diagram has scenes offers them, and still opens on the story.
  await rail.getByRole("button", { name: "Slide 3: An outage" }).click();
  await expect(switcher.getByRole("radio", { name: "Story" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("Scene over it")).toBeVisible();
  await switcher.getByRole("radio", { name: "Scenes" }).click();
  await expect(page.getByRole("region", { name: "Scenes" })).toBeVisible();
  // Coming back to it, it's on the story again.
  await rail.getByRole("button", { name: "Slide 1: Introduction" }).click();
  await rail.getByRole("button", { name: "Slide 3: An outage" }).click();
  await expect(story).toBeVisible();
});
