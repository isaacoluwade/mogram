import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { element, openYaml, shot, viewerSettled, watchErrors, yaml } from "./support";

/**
 * Stories (D-86): a diagram played step by step with words. In the viewer: captions, beats,
 * things appearing, marks, choices and links. In the editor: the Story dock, where a step is
 * shown on the canvas and what's changed there belongs to it. And exports that follow the story.
 */

const LEASE = `mogram: 1
name: Visibility timeout
description: A message is leased to a worker, not deleted.
shapes:
  queue: { shape: queue, label: Orders }
  worker_a: { label: Worker A }
  worker_b: { label: Worker B }
  lease: { label: Lease, show: hidden }
  again: { shape: rounded, label: Message 7, tone: blue, show: hidden }
connections:
  to_a: { from: queue, to: worker_a }
  to_b: { from: queue, to: worker_b }
stories:
  main:
    - say: A worker takes message 7. It's leased to them, not deleted.
      set: { lease: shown, worker_a: active }
      focus: [worker_a, lease]
    - set: { lease: { mark: clock } }
    - say: The work is slow, and the lease runs out.
      name: expired
      set: { lease: { show: faded, label: Expired, tone: rose, mark: cross } }
    - say: A second worker takes it too.
      set: { again: shown, worker_b: active }
      choices:
        - { label: Renew in time, play: renewed }
  renewed:
    - say: At 25 seconds the worker renews. One charge.
      rewind: expired
      set: { lease: { show: shown, label: Renewed, tone: green, mark: check } }
layout:
  queue: [0, 6]
  worker_a: [30, 0]
  worker_b: [30, 14]
  lease: [52, 0]
  again: [52, 14]
`;

const SHOP = `mogram: 1
name: Shop
components:
  web: { type: generic/service, label: Web }
  db: { type: generic/database, label: Database }
shapes:
  banner: { label: Sale, show: hidden }
connections:
  web_to_db: { from: web, to: db }
scenes:
  sale:
    banner: shown
    web: { label: Web (busy), mark: warn }
layout:
  web: [0, 0]
  db: [24, 0]
  banner: [10, 16]
`;

const DIALS = `mogram: 1
name: Dials
data:
  lease: 30
  used: "= rps * 10"
components:
  users: { type: generic/users, label: Users }
  web: { type: generic/server, label: Web, scale: { min: 1, max: 8 } }
shapes:
  gauge: { shape: meter, label: Used, value: used, max: 100, limit: 90, unit: "%" }
  flag: { label: Retries on, show: hidden }
connections:
  in: { from: users, to: web, traffic: "= rps / 2" }
controls:
  rps: { dial: [1, 10], start: 2, step: 1, unit: "×", label: Traffic }
  work: { dial: [5, 60], start: 10, step: 5, unit: " s", label: Work takes }
  retries: { toggle: retry_storm, label: Retries }
scenes:
  retry_storm:
    flag: shown
stories:
  main:
    - say: A worker takes the message.
      set: { web: active }
    - say: The lease runs out before the work is done.
      when: "= work > lease"
      set: { web: degraded }
    - say: Done.
layout:
  users: [0, 4]
  web: [24, 0]
  gauge: [0, 22]
  flag: [26, 22]
`;

const caption = (page: Page) => page.getByTestId("story-caption");
const inspector = (page: Page) => page.getByRole("region", { name: "Inspector" });
const dock = (page: Page) => page.getByRole("region", { name: "Story" });

/** The draft is written to the browser a moment after a change: the viewer reads it from there. */
async function saved(page: Page): Promise<void> {
  await expect(page.getByText("Draft saved in this browser")).toBeVisible({ timeout: 10_000 });
}

async function select(page: Page, name: string): Promise<void> {
  const box = await element(page, name).locator("rect, path").first().boundingBox();
  if (box === null) throw new Error(`${name} is not on screen`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("stories (D-86)", () => {
  test("the viewer plays a story beat by beat: words, things appearing, marks and a choice", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const id = await openYaml(page, LEASE);
    await saved(page);
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);

    // The opening: nothing has happened, and what's hidden isn't there.
    await expect(caption(page)).toHaveText("A message is leased to a worker, not deleted.");
    await expect(element(page, "lease")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();

    // A beat: its words, what its steps change, and the wordless step that follows on its own.
    await page.keyboard.press("ArrowRight");
    await expect(caption(page)).toHaveText(
      "A worker takes message 7. It's leased to them, not deleted.",
    );
    await expect(element(page, "lease")).toBeVisible();
    await expect(element(page, "worker_a")).toHaveAttribute("data-state", "active");
    await expect(element(page, "lease").locator('[data-mark="clock"]')).toBeVisible();
    await expect(page).toHaveURL(/story=main&beat=1/);
    await expect(page.getByRole("group", { name: "Story" })).toContainText("1 / 3");
    await page.waitForTimeout(700);
    await shot(page, "viewer/story-beat");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(caption(page)).toHaveText("The work is slow, and the lease runs out.");
    await expect(element(page, "lease")).toContainText("Expired");
    await expect(element(page, "lease").locator('[data-mark="cross"]')).toBeVisible();

    // A step can offer a choice: the story it names plays from here.
    await page.keyboard.press("ArrowRight");
    await expect(element(page, "again")).toBeVisible();
    const choices = page.getByRole("group", { name: "What happens next" });
    await page.waitForTimeout(700);
    await shot(page, "viewer/story-choice");
    await choices.getByRole("button", { name: "Renew in time" }).click();
    await expect(caption(page)).toHaveText("At 25 seconds the worker renews. One charge.");
    // It rewound to before the second worker took the message, then renewed the lease.
    await expect(element(page, "again")).toHaveCount(0);
    await expect(element(page, "lease")).toContainText("Renewed");
    await expect(element(page, "lease").locator('[data-mark="check"]')).toBeVisible();

    // Back returns to the choice; a mark for each beat jumps to it.
    await page.keyboard.press("ArrowLeft");
    await expect(caption(page)).toHaveText("A second worker takes it too.");
    await expect(choices).toBeVisible();
    await page.getByRole("button", { name: "Beat 1 of 3" }).click();
    await expect(caption(page)).toContainText("A worker takes message 7.");
    await expect(element(page, "again")).toHaveCount(0);

    // A link opens the story part-way.
    await page.goto(`/draft/${id}/view?story=main&beat=2`);
    await viewerSettled(page);
    await expect(caption(page)).toHaveText("The work is slow, and the lease runs out.");
    await expect(element(page, "lease")).toContainText("Expired");
    expect(errors).toEqual([]);
  });

  test("play runs the story on its own and stops at the end", async ({ page }) => {
    const id = await openYaml(
      page,
      LEASE.replace(/      choices:\n        - \{ label: Renew in time, play: renewed \}\n/, "")
        // Short holds, so the journey doesn't wait to read each caption.
        .replace(/(    - say: [^\n]+\n)/g, "$1      hold: 0.3s\n"),
    );
    await saved(page);
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(caption(page)).toHaveText("A second worker takes it too.", { timeout: 15_000 });
    // At the end play offers to start again.
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("a scene can show what isn't there, relabel and mark it", async ({ page }) => {
    const errors = watchErrors(page);
    await openYaml(page, SHOP);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    // In the editor what's hidden is drawn faintly, so it can still be selected and edited.
    await select(page, "banner");
    await expect(inspector(page).getByRole("heading").first()).toContainText("Sale");
    await expect(inspector(page).getByRole("radiogroup", { name: "Presence" })).toBeVisible();
    await expect(
      inspector(page).getByRole("radiogroup", { name: "Presence" }).getByRole("radio", {
        name: "Hidden",
      }),
    ).toBeChecked();

    await page.getByRole("button", { name: "Scene: Sale" }).click();
    await expect(element(page, "web")).toContainText("Web (busy)");
    await expect(element(page, "web").locator('[data-mark="warn"]')).toBeVisible();
    // In the scene, the section says what happens to it there.
    await expect(
      inspector(page).getByRole("radiogroup", { name: "Presence here" }).getByRole("radio", {
        name: "Shown",
      }),
    ).toBeChecked();
    await page.waitForTimeout(700);
    await shot(page, "editor/scene-presence");
    expect(errors).toEqual([]);
  });

  test("the Story dock starts a story and records what changes at each step", async ({ page }) => {
    const errors = watchErrors(page);
    await openYaml(page, SHOP);
    await page.getByRole("button", { name: "Zoom to fit" }).click();
    await page.getByRole("radio", { name: "Story" }).click();
    await dock(page).getByRole("button", { name: "Start a story" }).click();

    // A first beat, with words to type over.
    const words = dock(page).getByRole("textbox", { name: "Caption" });
    await expect(words).toHaveValue("Say what happens here.");
    await words.fill("The database goes down.");
    await words.press("ControlOrMeta+Enter");
    await expect(
      dock(page).getByRole("button", { name: /^Beat 1: The database goes down/ }),
    ).toBeVisible();

    // What's changed about an element with a step showing belongs to that step.
    await select(page, "db");
    await inspector(page)
      .getByRole("radiogroup", { name: "State" })
      .getByRole("radio", { name: /Down/ })
      .click();
    await expect(element(page, "db")).toHaveAttribute("data-state", "down");
    const changes = dock(page).getByRole("list", { name: "What this step changes" });
    await expect(changes).toContainText("Database: down");

    // Presence, words and a mark, from the section for this step.
    await select(page, "banner");
    await inspector(page)
      .getByRole("radiogroup", { name: "Presence here" })
      .getByRole("radio", { name: "Shown" })
      .click();
    await expect(changes).toContainText("shows Sale");
    const says = inspector(page).getByRole("textbox", { name: "What it says here" });
    await says.fill("Sorry, we're down");
    await says.press("Enter");
    await expect(changes).toContainText("Sale says “Sorry, we're down”");
    await page.waitForTimeout(500);
    await shot(page, "editor/story-dock");

    // A second beat; the first one's changes are still there, and this one adds its own.
    await dock(page).getByRole("button", { name: "Add beat" }).click();
    const second = dock(page).getByRole("textbox", { name: "Caption" });
    await second.fill("It comes back.");
    await second.press("ControlOrMeta+Enter");
    await select(page, "db");
    await inspector(page)
      .getByRole("radiogroup", { name: "State" })
      .getByRole("radio", { name: /Healthy/ })
      .click();
    await expect(element(page, "db")).toHaveAttribute("data-state", "healthy");

    const written = await yaml(page);
    expect(written).toContain(`stories:
  main:
    - say: The database goes down.
      set:
        db: down
        banner: { show: shown, label: "Sorry, we're down" }
    - say: It comes back.
      set:
        db: healthy
`);

    // The opening shows the diagram as it starts; a change's × takes it back.
    await dock(page)
      .getByRole("button", { name: /^Opening/ })
      .click();
    await expect(element(page, "db")).toHaveAttribute("data-state", "healthy");
    await dock(page)
      .getByRole("button", { name: /^Beat 1:/ })
      .click();
    await expect(element(page, "db")).toHaveAttribute("data-state", "down");
    await changes.getByRole("button", { name: "Undo: Database: down" }).click();
    await expect(element(page, "db")).toHaveAttribute("data-state", "healthy");
    await expect(changes).not.toContainText("Database: down");
    expect(errors).toEqual([]);
  });

  test("things a layout places move: a message leaves the queue and rides on its consumer", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/draft/new?concept=visibility-timeout");
    await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
    await expect(page.getByTestId("editor-canvas")).toBeVisible();
    await saved(page);
    const id = page.url().split("/").pop() ?? "";
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    const box = async (name: string) => {
      // A shape's own outline, or a meter's frame.
      const found = await element(page, name)
        .locator('[data-part="fill"], rect')
        .first()
        .boundingBox();
      if (found === null) throw new Error(`${name} is not on screen`);
      return { x: found.x + found.width / 2, y: found.y + found.height / 2, top: found.y };
    };
    const inside = async (name: string, holder: string) => {
      const a = await box(name);
      const b = await page.locator(`[data-element="${holder}"] rect`).last().boundingBox();
      return b !== null && a.x > b.x && a.x < b.x + b.width && a.y > b.y && a.y < b.y + b.height;
    };
    // It starts in the queue, which keeps room for it.
    expect(await inside("msg", "queue")).toBe(true);
    const queue = await page.locator('[data-element="queue"] rect').last().boundingBox();

    await page.keyboard.press("ArrowRight");
    await expect(caption(page)).toContainText("Consumer A receives message 7");
    // It travels to the consumer and sits above it, with the lease riding on it in turn.
    await expect
      .poll(async () => Math.abs((await box("msg")).x - (await box("a")).x), { timeout: 5_000 })
      .toBeLessThan(2);
    expect((await box("msg")).y).toBeLessThan((await box("a")).top);
    expect((await box("lease")).y).toBeLessThan((await box("msg")).top);
    // The queue doesn't shrink when it's empty.
    // (Its size: the camera may still be easing to its place.)
    const after = await page.locator('[data-element="queue"] rect').last().boundingBox();
    expect(Math.round(after?.width ?? 0)).toBe(Math.round(queue?.width ?? -1));
    expect(Math.round(after?.height ?? 0)).toBe(Math.round(queue?.height ?? -1));
    await page.waitForTimeout(600);
    await shot(page, "viewer/story-token");
    expect(errors).toEqual([]);
  });

  test("controls: a dial drives the model and the story, a toggle turns a scene on, a meter follows", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const id = await openYaml(page, DIALS);
    await saved(page);
    await page.goto(`/draft/${id}/view`);
    await viewerSettled(page);
    const controls = page.getByRole("group", { name: "Controls" });
    await expect(controls).toBeVisible();
    const web = element(page, "web");
    await expect(web).toContainText("2 running");
    // The meter reads a value worked out from the dial.
    await expect(element(page, "gauge")).toHaveAttribute("data-value", "20");

    // More traffic: the same model that scales a diagram on its own answers the dial.
    await controls.getByRole("slider", { name: "Traffic" }).fill("8");
    await expect(page.getByTestId("control-rps")).toHaveText("8×");
    await expect(web).toContainText(/[5-8] running/, { timeout: 15_000 });
    await expect(element(page, "gauge")).toHaveAttribute("data-value", "80");

    // A toggle turns its scene on.
    await expect(element(page, "flag")).toHaveCount(0);
    await controls.getByRole("switch", { name: "Retries" }).click();
    await expect(element(page, "flag")).toBeVisible();

    // A step with a test plays only while it holds: slow work makes the lease run out.
    await page.keyboard.press("ArrowRight");
    await expect(caption(page)).toHaveText("A worker takes the message.");
    await page.keyboard.press("ArrowRight");
    await expect(caption(page)).toHaveText("Done.");
    await controls.getByRole("slider", { name: "Work takes" }).fill("45");
    await expect(caption(page)).toHaveText("The lease runs out before the work is done.");
    await page.waitForTimeout(600);
    await shot(page, "viewer/story-controls");
    expect(errors).toEqual([]);
  });

  test("exports follow the story: every beat as an image, and its words in a still", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openYaml(page, LEASE);
    await page.getByRole("radio", { name: "Story" }).click();
    await dock(page)
      .getByRole("button", { name: /^Beat 2:/ })
      .click();

    const exportDialog = page.getByRole("dialog", { name: "Export" });
    const download = async (): Promise<Buffer> => {
      const saved = page.waitForEvent("download", { timeout: 90_000 });
      await exportDialog.getByRole("button", { name: /^Download/ }).click();
      return readFileSync(await (await saved).path());
    };

    // A still is the step showing, with its words under it.
    await page.getByRole("button", { name: "Export" }).click();
    await expect(exportDialog).toContainText("The story, at the step showing");
    await exportDialog.getByRole("radio", { name: /SVG/ }).click();
    const svg = (await download()).toString("utf8");
    expect(svg).toContain("Expired");
    expect(svg).toContain('data-part="caption"');
    expect(svg).toContain("The work is slow, and the lease runs out.");

    // Every beat, zipped: the opening and one per beat.
    await page.getByRole("button", { name: "Export" }).click();
    await exportDialog.getByRole("radio", { name: /PNG/ }).click();
    await exportDialog
      .getByRole("radiogroup", { name: "Scale" })
      .getByRole("radio", { name: "1×" })
      .click();
    await exportDialog
      .getByRole("radiogroup", { name: "What to export" })
      .getByRole("radio", { name: "Every beat" })
      .click();
    await page.waitForTimeout(400);
    await shot(page, "export/story");
    const zip = unzipSync(new Uint8Array(await download()));
    const images = Object.keys(zip)
      .filter((path) => path.endsWith(".png"))
      .sort();
    expect(images).toEqual([
      "visibility-timeout/visibility-timeout-00.png",
      "visibility-timeout/visibility-timeout-01.png",
      "visibility-timeout/visibility-timeout-02.png",
      "visibility-timeout/visibility-timeout-03.png",
    ]);
    for (const path of images)
      expect(
        Buffer.from(zip[path] ?? [])
          .subarray(1, 4)
          .toString("ascii"),
      ).toBe("PNG");
  });
});
