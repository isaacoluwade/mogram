import { expect, test, type Page } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  openDraft,
  openProject,
  shot,
  watchErrors,
  WIDTHS,
} from "./support";

const DECK = {
  "mogram.yaml": "mogram: 1\nname: Terraform course\npage: 16:9\ndeck:\n  slides: [intro, flow]\n",
  "intro/mogram.yaml":
    "mogram: 1\nname: Introduction\nshapes:\n  hello: { label: Hello }\nlayout:\n  hello: [20, 20]\n",
  "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  write: { label: Write }
stories:
  main:
    - say: You write it.
      script: You write what you want in a file.
    - say: Then you plan.
layout:
  write: [20, 20]
`,
};

/** Three things in this browser: two diagrams and a deck, the deck edited last. */
async function fill(page: Page): Promise<void> {
  await openDraft(page, "web-app");
  await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
  await openDraft(page, "aks");
  await expect(page.getByText("Draft saved in this browser", { exact: true })).toBeVisible();
  await openProject(page, DECK, { allowEmptyRoot: true });
  await expect(page.getByRole("button", { name: /Draft saved in this browser/ })).toBeVisible();
  await page.goto("/diagrams");
  await expect(
    page.getByRole("article").filter({ hasText: "Terraform course" }).first(),
  ).toBeVisible();
}

const everything = (page: Page) => page.getByRole("region", { name: "Everything" });

test("starts a diagram, a deck or from files, straight from the top of the page", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/diagrams");
  const start = page.getByRole("region", { name: "Start", exact: true });
  await expect(start.getByRole("button", { name: /^Blank diagram/ })).toBeVisible();
  await expect(start.getByRole("button", { name: /^Open files/ })).toBeVisible();
  await expect(start.getByRole("link", { name: /^Templates/ })).toHaveAttribute(
    "href",
    "/templates",
  );
  // Nothing made yet: the page says so, and there's nothing to continue.
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  await expect(page.getByTestId("continue")).toHaveCount(0);
  await shot(page, "dashboard/home-empty");

  // "N" opens New, with the same ways to start.
  await page.keyboard.press("n");
  await expect(page.getByRole("menuitem", { name: /Blank diagram/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await start.getByRole("button", { name: /^Blank deck/ }).click();
  await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
  await expect(page.getByTestId("slide-rail")).toBeVisible();
  expect(errors).toEqual([]);
});

test("shows what each thing is, carries on with the last, and filters, sorts and lists", async ({
  page,
}) => {
  await fill(page);
  // The last thing worked on, large, with one click to open, preview or present.
  const last = page.getByTestId("continue");
  await expect(last).toContainText("Terraform course");
  await expect(last).toContainText("Deck");
  await expect(last.getByRole("link", { name: "Present" })).toHaveAttribute(
    "href",
    /\/draft\/[^/]+\/view\?present=1$/,
  );

  // A deck says it's one, how many slides, and how far its recording has got.
  const deck = everything(page).getByRole("article").filter({ hasText: "Terraform course" });
  await expect(deck).toHaveAttribute("data-kind", "deck");
  await expect(deck).toContainText("2 slides");
  await expect(deck).toContainText("0 of 1 recorded");
  const diagram = everything(page).getByRole("article").filter({ hasText: "Microservices on AKS" });
  await expect(diagram).toContainText(/\d+ scenes?/);
  // Signed out, everything is in this browser: no card needs to say so.
  await expect(everything(page).getByText("This browser")).toHaveCount(0);
  await shot(page, "dashboard/home");

  await page
    .getByRole("radiogroup", { name: "Kind" })
    .getByRole("radio", { name: "Decks" })
    .click();
  await expect(everything(page).getByRole("article")).toHaveCount(1);
  await page.getByRole("radiogroup", { name: "Kind" }).getByRole("radio", { name: "All" }).click();

  // "/" goes to the search.
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search diagrams" })).toBeFocused();
  await page.keyboard.type("zzz");
  await expect(page.getByText("Nothing is called “zzz”.")).toBeVisible();
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(everything(page).getByRole("article")).toHaveCount(3);

  await page.getByRole("button", { name: "Sort by name" }).click();
  await expect(everything(page).getByRole("article").first()).toContainText("Microservices on AKS");
  await page.getByRole("button", { name: "Show as a list" }).click();
  await expect(everything(page).getByRole("list", { name: "Everything" })).toBeVisible();
  await expect(everything(page).getByRole("article")).toHaveCount(3);
  await shot(page, "dashboard/home-list");
  // The choice is kept.
  await page.reload();
  await expect(everything(page).getByRole("list", { name: "Everything" })).toBeVisible();
});

test("pins to the top and the sidebar, and deletes several at once", async ({ page }) => {
  await fill(page);
  const cards = everything(page).getByRole("article");
  await page.getByRole("button", { name: "Three-tier web app options" }).click();
  await page.getByRole("menuitem", { name: "Pin to the top" }).click();
  await expect(cards.first()).toContainText("Three-tier web app");
  await expect(
    page.getByRole("list", { name: "Pinned" }).getByRole("link", { name: "Three-tier web app" }),
  ).toBeVisible();
  await shot(page, "dashboard/home-pinned");
  await page.getByRole("button", { name: "Three-tier web app options" }).click();
  await page.getByRole("menuitem", { name: "Unpin" }).click();
  await expect(page.getByRole("list", { name: "Pinned" })).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Select Three-tier web app" }).click();
  await page.getByRole("checkbox", { name: "Select Microservices on AKS" }).click();
  await expect(page.getByTestId("selected-count")).toHaveText("2 selected");
  await shot(page, "dashboard/home-selected");
  await page
    .getByRole("toolbar", { name: "Selected" })
    .getByRole("button", { name: "Delete" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete 2 items?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("toolbar", { name: "Selected" })).toHaveCount(0);
});

test("opens files dropped anywhere on the page", async ({ page }) => {
  await page.goto("/diagrams");
  await expect(page.getByRole("region", { name: "Start", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        ["mogram: 1\nname: Dropped\nshapes:\n  a: { label: A }\nlayout:\n  a: [0, 0]\n"],
        "dropped.mogram.yaml",
        { type: "text/yaml" },
      ),
    );
    const target = document.querySelector("main")!;
    target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  });
  await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
  await expect(page.getByTitle("Rename diagram")).toHaveText("Dropped");
});

test("browses templates by kind and cloud, and concepts by topic", async ({ page }) => {
  await page.goto("/templates");
  const cards = page.getByRole("article");
  await expect(cards.filter({ hasText: "Serverless API on AWS" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Cloud" }).getByRole("radio", { name: "AWS" }).click();
  await expect(cards).toHaveCount(1);
  await page
    .getByRole("radiogroup", { name: "Kind" })
    .getByRole("radio", { name: "Decks" })
    .click();
  await expect(page.getByText("No templates of that kind for that cloud yet.")).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Cloud" })
    .getByRole("radio", { name: "Any cloud" })
    .click();
  await expect(cards.filter({ hasText: "Three-tier web app tour" })).toBeVisible();
  await shot(page, "dashboard/templates");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Concepts" })
    .click();
  await expect(page).toHaveURL(/\/concepts$/);
  await expect(page.getByRole("heading", { name: "Concepts", level: 1 })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search concepts" }).fill("blue green");
  const concept = page.getByRole("article").filter({ hasText: "Blue/green deployment" });
  await expect(concept).toBeVisible();
  await shot(page, "dashboard/concepts");
  await concept.getByRole("button", { name: "Open", exact: true }).click();
  await page.waitForURL(/\/draft\/[A-Za-z0-9_-]+$/);
  await expect(page.getByTitle("Rename diagram")).toHaveText("Blue/green deployment");
});

test("keeps reference pages out of the main navigation, and fits every width", async ({ page }) => {
  await fill(page);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText([
    "Home",
    "Templates",
    "Concepts",
    "Script",
  ]);
  await expect(page.getByRole("navigation", { name: "Help" }).getByRole("link")).toHaveText([
    "File format",
    "Security",
  ]);
  // Signed out, the drafts that live only here are counted beside the way to sign in.
  await expect(page.getByText("3 drafts live only in this browser.")).toBeVisible();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await expectNoHorizontalOverflow(page);
    await shot(page, `dashboard/home-${width}`);
  }
});

test("Script lists what there is to say, with its recording, and opens its Script window", async ({
  page,
}) => {
  await page.goto("/prompter");
  await expect(page.getByRole("heading", { name: "Script", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Script" }),
  ).toHaveAttribute("aria-current", "page");
  // Nothing with a story yet: it says what a script is, and any text can still be read.
  await expect(page.getByText("Nothing with a story yet")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Script" })).toBeVisible();
  await shot(page, "dashboard/script-empty");

  await fill(page);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Script" })
    .click();
  const row = page
    .getByRole("list", { name: "Your scripts" })
    .getByRole("article")
    .filter({ hasText: "Terraform course" });
  await expect(row).toContainText("Deck · 2 slides · 1 of 2 beats have a script");
  await expect(row).toContainText("0 of 1 recorded");
  await expect(row.getByRole("link", { name: "Edit Terraform course" })).toHaveAttribute(
    "href",
    /\/draft\/[A-Za-z0-9_-]+$/,
  );
  await shot(page, "dashboard/script");
  const popup = page.waitForEvent("popup");
  await row.getByRole("button", { name: "Read and record" }).click();
  const script = await popup;
  await expect(script).toHaveURL(/\/draft\/[A-Za-z0-9_-]+\/prompter$/);
  await expect(script.getByTestId("prompter")).toContainText("You write what you want in a file.");
  // Its record button is there: a draft keeps its takes with no editor open.
  await expect(script.getByRole("button", { name: "Record each beat" })).toBeVisible();

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await expectNoHorizontalOverflow(page);
    await shot(page, `dashboard/script-${width}`);
  }
});
