import { expect, test } from "@playwright/test";
import { openProject, shot } from "./support";

const FILES = {
  "mogram.yaml": `mogram: 1
name: Playback course
page: 16:9
deck:
  frame: frame
  captions: on
  slides:
    - intro: { frame: false }
    - flow: { from: beginning, to: ending }
    - flow: { from: ending, title: Continuation }
`,
  "frame/mogram.yaml": `mogram: 1
name: Frame
shapes:
  footer: { label: "%slide% / %slides%" }
layout:
  footer: [10, 120]
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
  first: { label: First }
  second: { label: Second }
stories:
  main:
    - say: First beat
      name: beginning
      set: { first: shown }
    - say: Second beat
      name: ending
      set: { second: shown }
layout:
  first: [20, 20]
  second: [60, 20]
`,
};

test("opens slides from the overview and plays record mode page-only", async ({ page }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByTitle("Rename diagram")).toHaveText("Introduction");
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.goto(`/draft/${id}/view`);
  await expect(page.getByTestId("deck-player")).toBeVisible();
  await expect(page.getByTestId("deck-slide")).toHaveText("1 / 3");
  await page.keyboard.press("g");
  const overview = page.getByRole("dialog", { name: "All slides" });
  await expect(overview).toBeVisible();
  await expect(
    overview
      .getByRole("button", { name: "Slide 1: Introduction" })
      .locator('[data-element="footer"]'),
  ).toHaveCount(0);
  await expect(
    overview.getByRole("button", { name: "Slide 2: The flow" }).locator('[data-element="footer"]'),
  ).toContainText("2 / 3");
  await shot(page, "viewer/deck-overview-p2");
  await overview.getByRole("button", { name: "Slide 2: The flow" }).click();
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("deck-slide")).toHaveText("1 / 3");
  await page.keyboard.press("End");
  await expect(page.getByTestId("deck-slide")).toHaveText("3 / 3");
  await expect(page).toHaveURL(/slide=3/);
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("deck-slide")).toHaveText("3 / 3");

  await page.goto(`/draft/${id}/view?slide=2&beat=1`);
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(page.getByTestId("story-caption")).toHaveText("Second beat");

  await page.goto(`/draft/${id}/view?record=1`);
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-record", "true");
  const recorded = page.getByTestId("deck-player").locator("[data-slide]");
  await expect(recorded).toHaveAttribute("data-slide", "1");
  await expect(page.getByTestId("deck-bar")).toHaveCount(0);
  // Record mode waits for the presenter: nothing moves until a key is pressed.
  await page.waitForTimeout(4_600);
  await expect(recorded).toHaveAttribute("data-slide", "1");
  await page.keyboard.press("ArrowRight");
  await expect(recorded).toHaveAttribute("data-slide", "2");
  await page.keyboard.press("g");
  await expect(page.getByTestId("deck-overview")).toHaveCount(0);
  await shot(page, "viewer/deck-record-p2");
  // A held key steps once.
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 6; i++)
    await page.dispatchEvent("body", "keydown", { key: "ArrowRight", repeat: true });
  await page.keyboard.up("ArrowRight");
  await expect(page).toHaveURL(/[?&]beat=1(&|$)/);
  await expect(recorded).toHaveAttribute("data-slide", "2");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-bar")).toBeVisible();
});

test("cuts between unrelated slides and keeps a carried slide mounted", async ({ page }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByTitle("Rename diagram")).toHaveText("Introduction");
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  await page.goto(`/draft/${id}/view`);
  const beforeCut = await page.getByTestId("viewer").elementHandle();
  if (beforeCut === null) throw new Error("The viewer should be mounted before the cut.");

  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect.poll(() => beforeCut.evaluate((node) => node.isConnected)).toBe(false);

  await page.goto(`/draft/${id}/view?slide=2`);
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  const carriedViewer = await page.getByTestId("viewer").elementHandle();
  if (carriedViewer === null) throw new Error("The viewer should be mounted before carrying on.");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("story-caption")).toHaveText("Second beat");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("deck-slide")).toHaveText("3 / 3");
  await expect.poll(() => carriedViewer.evaluate((node) => node.isConnected)).toBe(true);
});

test("crossfades a cut and keeps presenting from slide to slide", async ({ page }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.goto(`/draft/${id}/view?present=1`);
  await expect(page.getByTestId("deck-slide")).toHaveText("1 / 3");
  await expect(page.getByRole("button", { name: "Leave present mode" })).toBeVisible();
  // A deck starts by itself: no "what would you like to see" card.
  await expect(page.getByRole("button", { name: "Just explore" })).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  // The slide going fades off the one that's come, and nothing in it can be clicked.
  const leaving = page.getByTestId("deck-player").locator("[data-leaving]");
  await expect(leaving).toHaveAttribute("data-leaving", "1");
  await expect(leaving.getByTestId("viewer-leaving")).toHaveAttribute("inert", "");
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(leaving).toHaveCount(0);
  // Still presenting on the next slide, and the address says so.
  await expect(page.getByRole("button", { name: "Leave present mode" })).toBeVisible();
  await expect(page).toHaveURL(/slide=2/);
  await expect(page).toHaveURL(/present=1/);

  await page.getByRole("button", { name: "Leave present mode" }).click();
  await expect(page.getByRole("button", { name: "Leave present mode" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/present=1/);
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("deck-slide")).toHaveText("3 / 3");
  await expect(page.getByRole("button", { name: "Leave present mode" })).toHaveCount(0);
});

test("records from the button, keeps recording across cuts, and leaves with Esc", async ({
  page,
}) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.goto(`/draft/${id}/view`);
  await page.getByRole("button", { name: /Record mode/ }).click();
  const viewer = page.getByTestId("viewer");
  await expect(viewer).toHaveAttribute("data-record", "true");
  await expect(page).toHaveURL(/record=1/);
  await expect(page.getByTestId("deck-bar")).toHaveCount(0);
  // The picture and nothing else: nothing to tab to.
  await expect(viewer).toHaveAttribute("inert", "");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("deck-player").locator("[data-slide]")).toHaveAttribute(
    "data-slide",
    "2",
  );
  await expect(viewer).toHaveAttribute("data-record", "true");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-bar")).toBeVisible();
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(page).not.toHaveURL(/record=1/);
  await expect(page.getByRole("button", { name: "Leave present mode" })).toHaveCount(0);
});

test("stops at the end of the deck and goes back to edit the slide showing", async ({ page }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.goto(`/draft/${id}/view?slide=3`);
  await expect(page.getByTestId("deck-slide")).toHaveText("3 / 3");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

  // Both ways back to the editor open the slide showing.
  const back = page.getByRole("link", { name: "Back to editor" });
  await expect(back).toHaveCount(2);
  for (const link of await back.all())
    await expect(link).toHaveAttribute("href", `/draft/${id}?slide=2`);
  await back.last().click();
  await expect(page).toHaveURL(new RegExp(`/draft/${id}\\?slide=2`));
  await expect(page.getByTitle("Rename diagram")).toHaveText("The flow");

  // The editor's Preview opens the deck on the slide being edited.
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page).toHaveURL(new RegExp(`/draft/${id}/view\\?slide=2`));
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
});

test("plays a deck kept in a folder of the project", async ({ page }) => {
  const files = Object.fromEntries(
    Object.entries(FILES).map(([path, text]) => [`talks/${path}`, text]),
  );
  const id = await openProject(
    page,
    {
      ...files,
      "mogram.yaml": `mogram: 1
name: Home
shapes:
  start: { label: Start }
layout:
  start: [20, 20]
`,
    },
    { allowEmptyRoot: true },
  );
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  await page.goto(`/draft/${id}/view?root=talks`);
  await expect(page.getByTestId("deck-player")).toBeVisible();
  await expect(page.getByTestId("deck-slide")).toHaveText("1 / 3");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(page).toHaveURL(/root=talks/);
  await expect(page).toHaveURL(/slide=2/);
  // A slide's own folder is that diagram by itself.
  await page.goto(`/draft/${id}/view?root=talks/flow`);
  await expect(page.getByTestId("viewer")).toBeVisible();
  await expect(page.getByTestId("deck-player")).toHaveCount(0);
});
