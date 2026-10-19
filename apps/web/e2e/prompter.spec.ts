import { expect, test } from "@playwright/test";
import { openYaml, shot, viewerSettled, watchErrors, yaml } from "./support";

/**
 * The prompter (D-96): a script, large, moved on by beat, with the viewer of the same diagram
 * following along. Following a voice isn't tried here: Chrome's recogniser says nothing under
 * Playwright's launcher. It's tried by `pnpm bench:prompter`, which reads scripts aloud into a
 * plainly started Chrome, and by the follower's unit tests, which replay what that heard.
 */

const TALK = `mogram: 1
name: What a plan is
components:
  code: { type: generic/service, label: Your file }
  cloud: { type: generic/internet, label: Azure }
shapes:
  plan: { label: The plan, show: hidden }
stories:
  main:
    - say: Terraform reads both.
      script: So Terraform has read your file, and it has asked Azure what exists right now.
      set: { code: active, cloud: active }
    - say: The plan is the difference.
      script: And the plan is just the difference between those two things.
      set: { plan: shown }
    - script: Nothing has been touched yet.
layout:
  code: [0, 0]
  cloud: [40, 0]
  plan: [18, 20]
`;

test.describe("prompter (D-96)", () => {
  test("shows the script, steps by beat, mirrors, and the viewer follows", async ({
    page,
    context,
  }) => {
    const errors = watchErrors(page);
    const id = await openYaml(page, TALK);
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await expect(page.getByRole("button", { name: "Open the prompter" })).toBeVisible();

    const prompter = await context.newPage();
    await prompter.setViewportSize({ width: 1024, height: 600 });
    await prompter.goto(`/draft/${id}/prompter`);
    const stage = prompter.getByTestId("prompter");
    // What's spoken, not the captions: a beat with only a script is a beat.
    await expect(stage).toContainText("So Terraform has read your file");
    await expect(stage).toContainText("Nothing has been touched yet.");
    await expect(stage).not.toContainText("Terraform reads both.");
    await expect(prompter.getByTestId("prompter-beat")).toHaveText("1 / 3");

    // A beat on: the viewer of the same draft shows it.
    await prompter.keyboard.press("ArrowRight");
    await expect(prompter.getByTestId("prompter-beat")).toHaveText("2 / 3");
    await expect(prompter.locator('[data-beat="1"]')).toHaveAttribute("data-reading", "true");
    await expect(page.getByTestId("story-caption")).toHaveText("The plan is the difference.");
    await expect(page.locator('[data-element="plan"]').first()).toBeVisible();
    await prompter.waitForTimeout(500);
    await shot(prompter, "prompter/reading");

    await prompter.keyboard.press("ArrowLeft");
    await expect(prompter.getByTestId("prompter-beat")).toHaveText("1 / 3");

    await prompter.getByRole("button", { name: "Mirror for a prompter's glass" }).click();
    await expect(prompter.locator('[data-mirrored="true"]')).toBeVisible();
    await prompter.getByRole("button", { name: "Larger" }).click();
    expect(errors).toEqual([]);
  });

  test("a script written in the editor is what the prompter shows", async ({ page, context }) => {
    const errors = watchErrors(page);
    const id = await openYaml(page, TALK);
    await page.getByRole("radio", { name: "Story" }).click();
    const dock = page.getByRole("region", { name: "Story" });
    await dock.getByRole("button", { name: /^Beat 2: The plan is the difference/ }).click();
    const script = dock.getByRole("textbox", { name: "Script" });
    await expect(script).toHaveValue(
      "And the plan is just the difference between those two things.",
    );
    await script.fill("The plan is only what would change.");
    await script.press("ControlOrMeta+Enter");
    expect(await yaml(page)).toContain("script: The plan is only what would change.");
    // The caption on the diagram is its own thing.
    expect(await yaml(page)).toContain("say: The plan is the difference.");
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });

    const prompter = await context.newPage();
    await prompter.goto(`/draft/${id}/prompter`);
    await expect(prompter.getByTestId("prompter")).toContainText(
      "The plan is only what would change.",
    );

    // Edited again with the prompter open: coming back to it picks the change up.
    await script.fill("The plan is a list of changes.");
    await script.press("ControlOrMeta+Enter");
    await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
    await prompter.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(prompter.getByTestId("prompter")).toContainText("The plan is a list of changes.");
    expect(errors).toEqual([]);
  });

  test("any script can be pasted and read, and is kept in the browser", async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.goto("/prompter");
    const script = page.getByRole("textbox", { name: "Script" });
    await expect(page.getByRole("button", { name: /Read it/ })).toBeDisabled();
    await script.fill(
      "Welcome back. Today is about state.\n\nState is how Terraform remembers\nwhat it made.\n\n\nThat's all it is.",
    );
    await expect(page.getByTestId("script-length")).toContainText("18 words");
    await shot(page, "prompter/script");
    await page.getByRole("button", { name: /Read it/ }).click();

    // A paragraph is a beat, whatever the line breaks inside it.
    const stage = page.getByTestId("prompter");
    await expect(page.getByTestId("prompter-beat")).toHaveText("1 / 3");
    await expect(stage.locator('[data-beat="1"]')).toHaveText(
      /State is how Terraform remembers what it made\./,
    );
    await expect(page.getByTestId("prompter-clock")).toHaveText("0:00");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("prompter-beat")).toHaveText("2 / 3");
    await expect(stage).toHaveAttribute("data-position", "6");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(stage).toHaveAttribute("data-position", "18");
    await expect(page.getByTestId("prompter-beat")).toHaveText("3 / 3");
    await page.keyboard.press("Home");
    await expect(stage).toHaveAttribute("data-position", "0");

    // Space turns listening on once, even with a button in focus. There's no microphone
    // here, so it says why it can't; pressing again tries again.
    await page.getByRole("button", { name: "Smaller" }).click();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status")).toContainText(
      /blocked|no microphone|couldn't be opened/,
    );
    await expect(stage.locator('[data-beat="0"]')).toHaveCSS("font-size", "52px");

    // How far what's heard may move the reader: nearby unless said, and it can be kept in order.
    await page.getByRole("button", { name: "Following and microphone" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Find me nearby/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("menuitemradio", { name: /Stay in order/ }).click();
    await page.getByRole("button", { name: "Following and microphone" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Stay in order/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await shot(page, "prompter/following");
    await page.keyboard.press("Escape");

    // How it's set up is remembered, and so is the script.
    await page.getByRole("button", { name: "Larger" }).click();
    await page.getByRole("button", { name: "Larger" }).click();
    await page.getByRole("button", { name: "Mirror for a prompter's glass" }).click();
    await page.waitForTimeout(400);
    await shot(page, "prompter/mirrored");
    await page.keyboard.press("Escape");
    await expect(script).toHaveValue(/Welcome back\. Today is about state\./);
    await page.reload();
    await expect(script).toHaveValue(/That's all it is\.$/);
    await page.getByRole("button", { name: /Read it/ }).click();
    await expect(page.locator('[data-mirrored="true"]')).toBeVisible();
    await expect(stage.locator('[data-beat="0"]')).toHaveCSS("font-size", "72px");
    await page.getByRole("button", { name: "Following and microphone" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Stay in order/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
});
