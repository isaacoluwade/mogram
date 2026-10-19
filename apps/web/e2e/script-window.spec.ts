import { expect, test, type Page } from "@playwright/test";
import { openProject, recordTwoBeats, shot, signIn, uniqueEmail } from "./support";

// A microphone that's always there and always allowed: Chrome's own, which plays a tone.
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
  permissions: ["microphone"],
});

const FILES = {
  "mogram.yaml": `mogram: 1
name: Terraform in ten minutes
page: 16:9
deck:
  slides:
    - title: { title: Welcome }
    - flow: { to: plan }
    - flow: { from: plan, title: Apply }
`,
  "title/mogram.yaml": `mogram: 1
name: Title
shapes:
  heading: { label: Terraform in ten minutes }
layout:
  heading: [20, 20]
`,
  "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
  apply: { label: Apply, show: hidden }
stories:
  main:
    - say: You write it.
      script: You write what you want in a file.
    - say: The plan is the difference.
      script: The plan is the difference between your file and what exists.
      name: plan
      set: { plan: shown }
    - say: Apply makes it so.
      script: And apply makes it so.
      set: { apply: shown }
layout:
  write: [20, 20]
  plan: [60, 20]
  apply: [100, 20]
`,
};

/** Opens a slide's story in the editor's dock, at a beat. */
async function showBeat(page: Page, slide: string, beat: string): Promise<void> {
  await page.getByTestId("slide-rail").getByRole("button", { name: slide }).click();
  // A slide opens on its story: nothing to switch to.
  await page.getByRole("button", { name: beat }).click();
}

async function openScriptWindow(page: Page): Promise<Page> {
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Script window: read and record" }).click();
  const script = await popup;
  await expect(script.getByTestId("prompter")).toBeVisible();
  return script;
}

test("reads a deck slide by slide, and the deck follows the reading", async ({ page, context }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const viewer = await context.newPage();
  await viewer.goto(`/draft/${id}/view`);
  await expect(viewer.getByTestId("deck-slide")).toHaveText("1 / 3");

  const script = await openScriptWindow(page);
  // Each slide's number and title over its first beat; a still slide has nothing to read.
  await expect(script.locator("[data-slide-heading]")).toHaveText(["2 · The flow", "3 · Apply"]);
  await expect(script.locator("[data-beat]")).toHaveCount(3);
  await expect(script.getByTestId("prompter-left")).toHaveText(/^−0:\d\d$/);
  await shot(script, "prompter/deck-script-window");

  // The first beat begun: the deck cuts to its slide and plays it.
  await script.keyboard.press("ArrowRight");
  await expect(viewer.getByTestId("deck-slide")).toHaveText("2 / 3");
  await expect(viewer.getByTestId("story-caption")).toHaveText("You write it.");
  await script.keyboard.press("ArrowRight");
  await expect(viewer.getByTestId("story-caption")).toHaveText("The plan is the difference.");
  // Into a slide that carries on: the same picture plays on, with no cut.
  await script.keyboard.press("ArrowRight");
  await expect(viewer.getByTestId("deck-slide")).toHaveText("3 / 3");
  await expect(viewer.getByTestId("story-caption")).toHaveText("Apply makes it so.");
  // Back to the start: the deck goes back with it.
  await script.keyboard.press("Home");
  await expect(viewer.getByTestId("deck-slide")).toHaveText("1 / 3");
});

test("records each beat as it's read, keeps it in the editor, and keeps it after an edit", async ({
  page,
}) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const script = await openScriptWindow(page);

  // Reading starts at the first beat.
  await expect(script.locator('[data-beat="0"][data-reading="true"]')).toBeVisible();
  await script.keyboard.press("r");
  await expect(script.getByTestId("recording-state")).toHaveText(/Recording in \d…/);
  await expect(script.getByTestId("recording-state")).toHaveText(/each beat is kept/, {
    timeout: 8_000,
  });
  // Read for a while, then move on: the first beat's take is kept as it's left.
  await script.waitForTimeout(1500);
  await script.keyboard.press("ArrowRight");
  await expect(script.locator('[data-beat="0"]')).toHaveAttribute("data-voice", "recorded", {
    timeout: 10_000,
  });
  await script.waitForTimeout(1500);
  await script.keyboard.press("r");
  await expect(script.locator('[data-beat="1"]')).toHaveAttribute("data-voice", "recorded", {
    timeout: 10_000,
  });
  await expect(script.locator('[data-beat="2"]')).toHaveAttribute("data-voice", "none");
  await shot(script, "prompter/deck-recorded");

  // The editor has them: on the slide, under the beat's script.
  const rail = page.getByTestId("slide-rail");
  await rail.getByRole("button", { name: "Slide 2: The flow" }).click();
  // A slide opens on its story: nothing to switch to.
  await page.getByRole("button", { name: "Beat 1: You write it." }).click();
  const voice = page.getByTestId("beat-voice");
  await expect(voice).toContainText(/Recorded · \d+\.\d s/);

  // A word changed: the recording is out of date, and can be kept for the new words.
  const field = page.getByLabel("Script", { exact: true });
  await field.fill("You write what you want in a file, by hand.");
  await field.press("Tab");
  await expect(voice).toContainText("Recorded for earlier words");
  await page.getByRole("button", { name: "Keep this recording" }).click();
  await expect(voice).toContainText(/Recorded · /);
  // And the Script window, reading the same files, says so too.
  await expect(script.locator('[data-beat="0"]')).toHaveAttribute("data-voice", "recorded");
  await expect(script.locator('[data-beat="0"]')).toContainText("by hand.");
});

test("removes a recording from the editor", async ({ page }) => {
  await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const script = await openScriptWindow(page);
  await recordTwoBeats(script);
  await showBeat(page, "Slide 2: The flow", "Beat 2: The plan is the difference.");
  const voice = page.getByTestId("beat-voice");
  await expect(voice).toContainText(/Recorded · /);
  await page.getByRole("button", { name: "Remove the recording" }).click();
  await expect(voice).toContainText("Not recorded");
  await expect(script.locator('[data-beat="1"]')).toHaveAttribute("data-voice", "none");
  // Undo brings it back, as any edit.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(voice).toContainText(/Recorded · /);
});

test("plays a deck with its recordings, each beat waiting for its own", async ({
  page,
  context,
}) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  const script = await openScriptWindow(page);
  await recordTwoBeats(script);
  await script.close();
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();

  // Every recording the page starts playing, and where in it.
  const viewer = await context.newPage();
  await viewer.addInitScript(() => {
    const played: { src: string; at: number }[] = [];
    (window as unknown as { played: typeof played }).played = played;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push({ src: this.src, at: this.currentTime });
      return play.call(this);
    };
  });
  await viewer.goto(`/draft/${id}/view`);
  await expect(viewer.getByTestId("deck-slide")).toHaveText("1 / 3");
  // Stepping by hand says nothing.
  await viewer.keyboard.press("Shift+ArrowRight");
  await viewer.keyboard.press("ArrowRight");
  await expect(viewer.getByTestId("story-caption")).toHaveText("You write it.");
  expect(await viewer.evaluate(() => (window as unknown as { played: unknown[] }).played)).toEqual(
    [],
  );
  await viewer.keyboard.press("Home");
  await viewer.getByTestId("deck-bar").getByRole("button", { name: "Play" }).click();
  await expect
    .poll(() => viewer.evaluate(() => (window as unknown as { played: unknown[] }).played.length), {
      timeout: 15_000,
    })
    .toBe(2);
  const played = await viewer.evaluate(
    () => (window as unknown as { played: { src: string; at: number }[] }).played,
  );
  for (const clip of played) expect(clip.src).toMatch(/^blob:/);
  await expect(viewer.getByTestId("story-caption")).toHaveText("The plan is the difference.");
});

test("keeps a recording in the draft when no editor is open", async ({ page, context }) => {
  const id = await openProject(page, FILES, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  await page.goto("/diagrams");
  const script = await context.newPage();
  await script.goto(`/draft/${id}/prompter`);
  await expect(script.getByTestId("prompter")).toBeVisible();
  await recordTwoBeats(script);
  await script.close();
  await page.goto(`/draft/${id}?slide=2`);
  await showBeat(page, "Slide 2: The flow", "Beat 1: You write it.");
  await expect(page.getByTestId("beat-voice")).toContainText(/Recorded · /);
});

test("records into a diagram in the account, and the recordings are saved with it", async ({
  page,
}) => {
  test.skip(process.env.E2E_BASE_URL !== undefined, "needs the development mailbox");
  await signIn(page, uniqueEmail("voice"));
  await openProject(page, FILES, { allowEmptyRoot: true });
  await page.getByRole("button", { name: "Diagram menu" }).click();
  await page.getByRole("menuitem", { name: /Save to cloud/ }).click();
  await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
  const script = await openScriptWindow(page);
  expect(script.url()).toMatch(/\/edit\/[0-9a-f-]{36}\/prompter$/);
  await recordTwoBeats(script);
  await script.close();
  await expect(page.getByText(/Saved/).first()).toBeVisible({ timeout: 15_000 });
  // From the account, in a fresh page: the pointer came back and its bytes are on the server.
  await page.reload();
  await showBeat(page, "Slide 2: The flow", "Beat 1: You write it.");
  await expect(page.getByTestId("beat-voice")).toContainText(/Recorded · /);

  // Shared, its link says it's a deck, and how many slides.
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share" });
  await dialog.getByLabel("General access").click();
  await page.getByRole("option", { name: /Anyone with the link/ }).click();
  const link = await dialog.getByLabel("Link", { exact: true }).inputValue();
  const html = await (await page.request.get(link)).text();
  expect(html).toContain('<meta name="description" content="A deck of 3 slides on Mogram."');
  await page.keyboard.press("Escape");

  // From the Script page, with no editor open: the third beat's take goes straight to the account.
  await page.goto("/prompter");
  const row = page
    .getByRole("list", { name: "Your scripts" })
    .getByRole("article")
    .filter({ hasText: "Terraform in ten minutes" });
  await expect(row).toContainText("2 of 3 recorded");
  const popup = page.waitForEvent("popup");
  await row.getByRole("button", { name: "Read and record" }).click();
  const window = await popup;
  await window.bringToFront();
  await expect(window.locator('[data-beat="0"][data-reading="true"]')).toBeVisible();
  await window.keyboard.press("ArrowRight");
  await window.keyboard.press("ArrowRight");
  await expect(window.locator('[data-beat="2"][data-reading="true"]')).toBeVisible();
  await window.keyboard.press("r");
  await expect(window.getByTestId("recording-state")).toHaveText(/each beat is kept/, {
    timeout: 8_000,
  });
  await window.waitForTimeout(1500);
  await window.keyboard.press("r");
  await expect(window.locator('[data-beat="2"]')).toHaveAttribute("data-voice", "recorded", {
    timeout: 15_000,
  });
  await window.close();
  await page.reload();
  await expect(row).toContainText("All recorded");
});
