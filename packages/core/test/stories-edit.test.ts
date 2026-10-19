import { describe, expect, it } from "vitest";
import {
  addStep,
  addStory,
  deleteStory,
  moveSteps,
  removeSteps,
  renameStory,
  setSceneCapacity,
  setSceneEntry,
  setStepChoices,
  updateStep,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import { cursorAtStep, pictureAt } from "../src/picture";

const BASE = `components:
  web: generic/service
  db: generic/database
shapes:
  banner: { label: Sale, show: hidden }
connections:
  web_to_db: { from: web, to: db, label: SQL }
`;

const STORY = `${BASE}stories:
  main:
    - say: The database is busy.
      set:
        db: active
    - set:
        banner: shown
    - say: Then it goes down.
      name: outage
      set:
        db: { state: down, mark: cross }
        web_to_db: blocked
`;

const open = (yaml: string) => {
  const files = { "mogram.yaml": yaml };
  const { diagram, diagnostics } = parseDiagram(files);
  expect(diagnostics).toEqual([]);
  return { files, diagram };
};

const text = (result: { files: Record<string, string> }) => result.files["mogram.yaml"] ?? "";

/** The part of the file from `stories:` on. */
const stories = (result: { files: Record<string, string> }) =>
  text(result).slice(text(result).indexOf("stories:"));

describe("stories", () => {
  it("adds a first story called main, after the scenes", () => {
    const { files, diagram } = open(
      `${BASE}scenes:\n  busy:\n    db: active\nlayout:\n  web: [0, 0]\n`,
    );
    const result = addStory(files, diagram, { say: "Here is a web server." });
    expect(result.named).toBe("main");
    expect(text(result)).toContain(
      `scenes:\n  busy:\n    db: active\n\nstories:\n  main:\n    - say: Here is a web server.\nlayout:`,
    );
    expect(open(text(result)).diagram.stories[0]?.steps).toHaveLength(1);
  });

  it("names later stories apart", () => {
    const { files, diagram } = open(STORY);
    const result = addStory(files, diagram, { label: "Main" });
    expect(result.named).toBe("main_2");
  });

  it("renames a story, and the choices that play it", () => {
    const { files, diagram } = open(
      `${STORY}      choices:\n        - { label: Fix it, play: fixed }\n  fixed:\n    - say: Back up.\n      set: { db: healthy }\n`,
    );
    const result = renameStory(files, diagram, { from: "fixed", to: "repaired" });
    expect(stories(result)).toContain(`- { label: Fix it, play: repaired }`);
    expect(stories(result)).toContain(`  repaired:\n    - say: Back up.`);
    expect(open(text(result)).diagram.stories.map((s) => s.name)).toEqual(["main", "repaired"]);
  });

  it("deletes a story, and the section with the last one", () => {
    const { files, diagram } = open(STORY);
    expect(text(deleteStory(files, diagram, "main"))).toBe(BASE);
  });

  it("adds a step with words at the end, or a wordless one in between", () => {
    const { files, diagram } = open(STORY);
    const ended = addStep(files, diagram, { story: "main", say: "Now what?" });
    expect(stories(ended).trimEnd().endsWith("- say: Now what?")).toBe(true);
    const between = addStep(files, diagram, { story: "main", index: 1 });
    expect(stories(between)).toContain(
      `        db: active\n    - set: {}\n    - set:\n        banner: shown`,
    );
  });

  it("changes a step's words, name, pace, hold and focus", () => {
    const { files, diagram } = open(STORY);
    const result = updateStep(files, diagram, {
      story: "main",
      index: 1,
      patch: { say: "A banner goes up.", pace: "slow", hold: 3, focus: ["banner", "web"] },
    });
    expect(stories(result)).toContain(
      `    - say: A banner goes up.\n      set:\n        banner: shown\n      hold: 3s\n      pace: slow\n      focus: [banner, web]\n`,
    );
    const again = open(text(result));
    const back = updateStep(again.files, again.diagram, {
      story: "main",
      index: 1,
      patch: { say: null, pace: "normal", hold: null, focus: [] },
    });
    expect(text(back)).toBe(STORY);
  });

  it("refuses a step name that isn't one", () => {
    const { files, diagram } = open(STORY);
    expect(() =>
      updateStep(files, diagram, { story: "main", index: 0, patch: { name: "start" } }),
    ).toThrow(`"start" isn't a valid step name.`);
  });

  it("turns a caption written on its own into a step it can add to", () => {
    const { files, diagram } = open(`${BASE}stories:\n  main:\n    - Here is a web server.\n`);
    const result = setSceneEntry(files, diagram, {
      scene: { story: "main", index: 0 },
      target: "db",
      value: { state: "down" },
    });
    expect(stories(result)).toBe(
      `stories:\n  main:\n    - say: Here is a web server.\n      set:\n        db: down\n`,
    );
  });

  it("removes steps, and the story with its last one", () => {
    const { files, diagram } = open(STORY);
    const one = removeSteps(files, diagram, { story: "main", from: 1 });
    expect(open(text(one)).diagram.stories[0]?.steps.map((s) => s.say)).toEqual([
      "The database is busy.",
      "Then it goes down.",
    ]);
    expect(text(removeSteps(files, diagram, { story: "main", from: 0, count: 3 }))).toBe(BASE);
  });

  it("moves a beat's steps together", () => {
    const { files, diagram } = open(STORY);
    const result = moveSteps(files, diagram, { story: "main", from: 0, count: 2, to: 3 });
    expect(open(text(result)).diagram.stories[0]?.steps.map((s) => s.say)).toEqual([
      "Then it goes down.",
      "The database is busy.",
      null,
    ]);
  });

  it("sets and clears the choices a step offers", () => {
    const { files, diagram } = open(`${STORY}  fixed:\n    - say: Back up.\n`);
    const set = setStepChoices(files, diagram, {
      story: "main",
      index: 2,
      choices: [{ label: "Fix it", play: "fixed" }],
    });
    expect(stories(set)).toContain(`      choices:\n        - { label: Fix it, play: fixed }\n`);
    const again = open(text(set));
    expect(again.diagram.stories[0]?.steps[2]?.choices).toEqual([
      { label: "Fix it", play: "fixed" },
    ]);
    const cleared = setStepChoices(again.files, again.diagram, {
      story: "main",
      index: 2,
      choices: [],
    });
    expect(text(cleared)).toBe(`${STORY}  fixed:\n    - say: Back up.\n`);
  });
});

describe("what a step changes", () => {
  const step = (index: number) => ({ story: "main", index });

  it("writes one word when one word says it, and keys otherwise", () => {
    const { files, diagram } = open(STORY);
    const hidden = setSceneEntry(files, diagram, {
      scene: step(0),
      target: "web",
      value: { show: "faded" },
    });
    expect(stories(hidden)).toContain(`      set:\n        db: active\n        web: faded\n`);
    const more = open(text(hidden));
    const marked = setSceneEntry(more.files, more.diagram, {
      scene: step(0),
      target: "web",
      value: { state: "degraded", mark: "warn", label: "Web (slow)" },
    });
    expect(stories(marked)).toContain(
      `        web: { show: faded, state: degraded, label: Web (slow), mark: warn }\n`,
    );
  });

  it("keeps what a line already says when another key changes", () => {
    const { files, diagram } = open(STORY);
    const result = setSceneEntry(files, diagram, {
      scene: step(2),
      target: "db",
      value: { state: "degraded" },
    });
    expect(stories(result)).toContain(`        db: { state: degraded, mark: cross }\n`);
    const cleared = setSceneEntry(files, diagram, {
      scene: step(2),
      target: "db",
      value: { state: "down", mark: null },
    });
    expect(stories(cleared)).toContain(`        db: down\n`);
  });

  it("drops a key that says what's true anyway, compared with the picture before", () => {
    const { files, diagram } = open(STORY);
    // Before step 2 the database is active (step 0 said so): setting it active again says nothing.
    const before = pictureAt(diagram, { scene: null, story: cursorAtStep(diagram, step(1)) });
    const was = before.entries.find((entry) => entry.target === "db");
    const result = setSceneEntry(files, diagram, {
      scene: step(2),
      target: "db",
      value: { state: "active", mark: null },
      base: { state: was?.state ?? null },
    });
    expect(stories(result)).toContain(
      `      name: outage\n      set:\n        web_to_db: blocked\n`,
    );
  });

  it("removes a wordless step once it changes nothing", () => {
    const { files, diagram } = open(STORY);
    const result = setSceneEntry(files, diagram, {
      scene: step(1),
      target: "banner",
      value: null,
    });
    expect(open(text(result)).diagram.stories[0]?.steps.map((s) => s.say)).toEqual([
      "The database is busy.",
      "Then it goes down.",
    ]);
    // A step with words stays, without its set.
    const worded = setSceneEntry(files, diagram, { scene: step(0), target: "db", value: null });
    expect(stories(worded)).toContain(
      `    - say: The database is busy.\n    - set:\n        banner: shown\n`,
    );
  });

  it("sets traffic and other numbers in a step", () => {
    const { files, diagram } = open(STORY);
    const result = setSceneCapacity(files, diagram, {
      scene: step(0),
      target: "web_to_db",
      capacity: { traffic: 5 },
    });
    expect(stories(result)).toContain(`        db: active\n        web_to_db: 5x\n`);
  });
});

describe("the wider set in scenes", () => {
  const SCENE = `${BASE}scenes:
  sale:
    banner: shown
    db: { state: active, mark: star }
`;

  it("keeps presence, words and marks when a state changes", () => {
    const { files, diagram } = open(SCENE);
    const result = setSceneEntry(files, diagram, {
      scene: "sale",
      target: "db",
      value: { state: "degraded" },
    });
    expect(text(result)).toContain(`    db: { state: degraded, mark: star }\n`);
    // Back to its own state: the mark is still worth a line.
    const back = setSceneEntry(files, diagram, {
      scene: "sale",
      target: "db",
      value: { state: "healthy" },
    });
    expect(text(back)).toContain(`    db: { mark: star }\n`);
  });

  it("writes a connection's words and takes a line away when it says nothing", () => {
    const { files, diagram } = open(SCENE);
    const labelled = setSceneEntry(files, diagram, {
      scene: "sale",
      target: "web_to_db",
      value: { label: "SQL (slow)" },
    });
    expect(text(labelled)).toContain(`    web_to_db: { label: SQL (slow) }\n`);
    // Its own words say nothing new.
    const same = setSceneEntry(files, diagram, {
      scene: "sale",
      target: "web_to_db",
      value: { label: "SQL" },
    });
    expect(text(same)).toBe(SCENE);
    const shown = setSceneEntry(files, diagram, {
      scene: "sale",
      target: "banner",
      value: { show: "hidden" },
    });
    expect(text(shown)).not.toContain("banner: shown");
  });
});

describe("renaming and deleting follow into stories", () => {
  const YAML = `components:
  web: generic/service
  db: generic/database
shapes:
  tag: { label: hot, on: db }
connections:
  web_to_db: { from: web, to: db }
stories:
  main:
    - say: The database is busy.
      set: { db: active, tag: { on: web } }
      focus: [db, web_to_db]
      zoom: db
    - set: { db: down }
`;

  it("renames an element in a step's set, focus, zoom, and where things ride", async () => {
    const { renameElement } = await import("../src/edit");
    const { files, diagram } = open(YAML);
    const result = renameElement(files, diagram, { from: "db", to: "orders" });
    const after = open(text(result)).diagram;
    expect(after.components.get("tag")?.on).toBe("orders");
    const [first, second] = after.stories[0]?.steps ?? [];
    expect(first?.entries.map((e) => e.target)).toEqual(["orders", "tag"]);
    expect(first).toMatchObject({ focus: ["orders", "web_to_db"], zoom: "orders" });
    expect(second?.entries[0]?.target).toBe("orders");
  });

  it("takes a deleted element out of steps, and a step left with nothing", async () => {
    const { deleteElements } = await import("../src/edit");
    const { files, diagram } = open(YAML);
    const result = deleteElements(files, diagram, ["db"]);
    const parsed = parseDiagram(result.files);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.diagram.stories[0]?.steps).toHaveLength(1);
    expect(parsed.diagram.stories[0]?.steps[0]).toMatchObject({ focus: [], zoom: null });
  });
});
