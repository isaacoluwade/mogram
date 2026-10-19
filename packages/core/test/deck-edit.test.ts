import { describe, expect, it } from "vitest";
import {
  addSection,
  addSlide,
  canJoinSlides,
  canSplitSlide,
  createDeck,
  deleteScene,
  deleteStory,
  detachSlide,
  duplicateSlide,
  importSlideFiles,
  joinSlides,
  moveEntries,
  newSlideFolder,
  relativeFolder,
  removeEntries,
  removeSteps,
  renameScene,
  renameSection,
  renameSlideFolder,
  renameStory,
  setDeckSetting,
  splitSlide,
  updateSlide,
  updateStep,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const FLOW = `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
scenes:
  outage:
    write: down
stories:
  main:
    - say: You write what you want.
    - say: Terraform plans it.
      name: planned
      set: { plan: shown }
    - say: Then it applies it.
    - say: And it writes down what it made.
layout:
  write: [10, 10]
  plan: [40, 10]
`;

const deckFile = (slides: string, more = "") =>
  `mogram: 1\nname: Course\n${more}deck:\n  slides:\n${slides}`;

/** A project, its deck's diagram, and a way to read a file back. */
function project(files: ProjectFiles, folder = "") {
  const read = parseDiagram(files, folder);
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return read.diagram;
}

const slides = (files: ProjectFiles, folder = "") =>
  (parseDiagram(files, folder).diagram.settings.deck?.entries ?? []).map((entry) =>
    entry.kind === "section"
      ? `§ ${entry.title}`
      : [entry.folder, entry.story, entry.from, entry.to, entry.scene, entry.title]
          .map((value) => value ?? "-")
          .join(" "),
  );

const BASE: ProjectFiles = {
  "mogram.yaml": deckFile("    - title\n    - flow\n"),
  "title/mogram.yaml": "mogram: 1\nname: Title\n",
  "flow/mogram.yaml": FLOW,
  "frame/mogram.yaml": "mogram: 1\nname: Frame\n",
};

describe("making and setting a deck", () => {
  it("makes a diagram with no elements a deck, and refuses one with elements", () => {
    const files = { "mogram.yaml": "mogram: 1\nname: Course\n" };
    const made = createDeck(files, project(files), { captions: false });
    expect(made.files["mogram.yaml"]).toBe(
      "mogram: 1\nname: Course\n\ndeck:\n  captions: off\n  slides: []\n",
    );
    const busy = { "mogram.yaml": "mogram: 1\nshapes:\n  box: {}\nlayout:\n  box: [0, 0]\n" };
    expect(() => createDeck(busy, project(busy))).toThrow(/Move its elements onto a slide/);
  });

  it("sets the frame from the deck's folder, and checks it can be one", () => {
    const framed = setDeckSetting(BASE, project(BASE), { key: "frame", value: "frame" });
    expect(project(framed.files).settings.deck?.frame).toBe("frame");
    expect(() => setDeckSetting(BASE, project(BASE), { key: "frame", value: "nowhere" })).toThrow(
      `There is no diagram in the folder "nowhere".`,
    );
    const none = setDeckSetting(framed.files, project(framed.files), { key: "frame", value: null });
    expect(none.files["mogram.yaml"]).toBe(BASE["mogram.yaml"]);
  });

  it("writes captions only when they're off", () => {
    const off = setDeckSetting(BASE, project(BASE), { key: "captions", value: false });
    expect(off.files["mogram.yaml"]).toContain("captions: off");
    const on = setDeckSetting(off.files, project(off.files), { key: "captions", value: true });
    expect(on.files["mogram.yaml"]).toBe(BASE["mogram.yaml"]);
  });
});

describe("the list of slides", () => {
  it("adds a slide or a section where it's asked, writing the folder plainly", () => {
    const added = addSlide(BASE, project(BASE), { folder: "frame", at: 1, title: "Logo" });
    expect(slides(added.files)).toEqual([
      "title - - - - -",
      "frame - - - - Logo",
      "flow - - - - -",
    ]);
    const sectioned = addSection(added.files, project(added.files), { title: "Intro", at: 0 });
    expect(sectioned.files["mogram.yaml"]).toContain(
      "  slides:\n    - section: Intro\n    - title\n    - frame: { title: Logo }\n    - flow\n",
    );
  });

  it("won't add a folder with no diagram, the deck itself, or another deck", () => {
    const files = { ...BASE, "other/mogram.yaml": deckFile("    - a\n") };
    const deck = project(files);
    expect(() => addSlide(files, deck, { folder: "missing" })).toThrow(/no diagram/);
    expect(() => addSlide(files, deck, { folder: "../out" })).toThrow(/inside the project/);
    expect(() => addSlide(files, deck, { folder: "other" })).toThrow(/is a deck/);
  });

  it("changes a slide's keys, and goes back to the plain form when none are left", () => {
    const deck = project(BASE);
    const set = updateSlide(BASE, deck, {
      item: 1,
      patch: { to: "planned", scene: "outage", frame: false, skip: true },
    });
    expect(set.files["mogram.yaml"]).toContain(
      "    - flow: { to: planned, scene: outage, frame: false, skip: true }\n",
    );
    const cleared = updateSlide(set.files, project(set.files), {
      item: 1,
      patch: { to: null, scene: null, frame: true, skip: false },
    });
    expect(cleared.files["mogram.yaml"]).toBe(BASE["mogram.yaml"]);
  });

  it("forgets a stretch when the story changes", () => {
    const set = updateSlide(BASE, project(BASE), { item: 1, patch: { from: "planned" } });
    const changed = updateSlide(set.files, project(set.files), {
      item: 1,
      patch: { story: "other" },
    });
    expect(changed.files["mogram.yaml"]).toContain("    - flow: { story: other }\n");
  });

  it("duplicates, moves and removes entries", () => {
    const twice = duplicateSlide(BASE, project(BASE), { item: 0 });
    expect(slides(twice.files)).toEqual(["title - - - - -", "title - - - - -", "flow - - - - -"]);
    const moved = moveEntries(BASE, project(BASE), { items: [1], to: 0 });
    expect(slides(moved.files)).toEqual(["flow - - - - -", "title - - - - -"]);
    const last = moveEntries(BASE, project(BASE), { items: [0], to: 2 });
    expect(slides(last.files)).toEqual(["flow - - - - -", "title - - - - -"]);
    const removed = removeEntries(BASE, project(BASE), { items: [0] });
    expect(slides(removed.files)).toEqual(["flow - - - - -"]);
    // The folder is still there for anything else that shows it.
    expect(removed.files["title/mogram.yaml"]).toBeDefined();
    expect(() => removeEntries(BASE, project(BASE), { items: [9] })).toThrow(/no entry 10/);
  });

  it("renames a section, and refuses to treat a slide as one", () => {
    const files = { ...BASE, "mogram.yaml": deckFile("    - section: Intro\n    - title\n") };
    const renamed = renameSection(files, project(files), { item: 0, title: "Start" });
    expect(slides(renamed.files)).toEqual(["§ Start", "title - - - - -"]);
    expect(() => renameSection(files, project(files), { item: 1, title: "X" })).toThrow(
      /isn't a section/,
    );
  });

  it("changes the entry the reader saw, even when a line before it couldn't be read", () => {
    // An empty section title and a folder outside the project are left out when read, but
    // they're still in the list: commands count them, so they change what they're asked to.
    const files = {
      ...BASE,
      "mogram.yaml": deckFile('    - section: ""\n    - ../outside\n    - title\n    - flow\n'),
    };
    const deck = parseDiagram(files).diagram;
    const flow = deck.settings.deck?.entries.find((e) => e.kind === "slide" && e.folder === "flow");
    expect(flow?.item).toBe(3);
    const set = updateSlide(files, deck, { item: 3, patch: { title: "The flow" } });
    expect(set.files["mogram.yaml"]).toContain("    - title\n    - flow: { title: The flow }\n");
  });
});

describe("stretches", () => {
  it("splits a slide after a beat, naming the step when it has none, and joins it back", () => {
    const deck = project(BASE);
    expect(canSplitSlide(BASE, deck, 1, 0)).toBe(true);
    expect(canSplitSlide(BASE, deck, 1, 3)).toBe(false);
    expect(canSplitSlide(BASE, deck, 0, 0)).toBe(false);

    const split = splitSlide(BASE, deck, { item: 1, step: 0 });
    expect(split.files["flow/mogram.yaml"]).toContain(
      "    - say: You write what you want.\n      name: you_write_what_you_want\n",
    );
    expect(slides(split.files)).toEqual([
      "title - - - - -",
      "flow - - you_write_what_you_want - -",
      "flow - you_write_what_you_want - - -",
    ]);
    // An existing name is used as it is, and a stretch splits again within itself.
    const again = splitSlide(split.files, project(split.files), { item: 2, step: 1 });
    expect(slides(again.files).slice(1)).toEqual([
      "flow - - you_write_what_you_want - -",
      "flow - you_write_what_you_want planned - -",
      "flow - planned - - -",
    ]);

    const joined = project(again.files);
    expect(canJoinSlides(joined, 3)).toBe(true);
    expect(canJoinSlides(joined, 1)).toBe(false);
    const back = joinSlides(again.files, joined, { item: 3 });
    const whole = joinSlides(back.files, project(back.files), { item: 2 });
    // Split then joined is where it started (but for the step's new name).
    expect(whole.files["mogram.yaml"]).toBe(BASE["mogram.yaml"]);
  });

  it("won't join slides that don't meet", () => {
    expect(() => joinSlides(BASE, project(BASE), { item: 1 })).toThrow(/carries on/);
  });
});

describe("folders for slides", () => {
  it("makes a new slide with a blank diagram of its own", () => {
    const made = newSlideFolder(BASE, project(BASE), { name: "Why state", at: 1 });
    expect(made.folder).toBe("why_state");
    expect(made.files["why_state/mogram.yaml"]).toBe('mogram: 1\nname: "Why state"\n');
    expect(slides(made.files)).toEqual([
      "title - - - - -",
      "why_state - - - - -",
      "flow - - - - -",
    ]);
  });

  it("brings a project in as a slide, remembering a saved diagram it came from", () => {
    const brought = importSlideFiles(BASE, project(BASE), {
      files: { "mogram.yaml": "mogram: 1\nname: Checkout\n", "notes.md": "# Notes" },
      origin: { diagram: "d_123", version: 4 },
    });
    expect(brought.folder).toBe("checkout");
    expect(brought.files["checkout/notes.md"]).toBe("# Notes");
    expect(brought.files["checkout/mogram.yaml"]).toContain("from_diagram: d_123");
    expect(slides(brought.files).at(-1)).toBe("checkout - - - - -");
    // Chosen by another name than its diagram's: the slide is called that.
    const named = importSlideFiles(BASE, project(BASE), {
      files: { "mogram.yaml": "mogram: 1\nname: Checkout\n" },
      name: "Three-tier web app",
    });
    expect(named.folder).toBe("three_tier_web_app");
    expect(named.files["mogram.yaml"]).toContain("title: Three-tier web app");
    expect(() =>
      importSlideFiles(BASE, project(BASE), { files: { "mogram.yaml": deckFile("    - a\n") } }),
    ).toThrow(/A deck can't be a slide/);
  });

  it("detaches a slide into its own copy, keeping paths that lead out of it", () => {
    const files = {
      ...BASE,
      "mogram.yaml": deckFile("    - parts/flow\n    - parts/flow\n"),
      "parts/flow/mogram.yaml": `mogram: 1\nshapes:\n  main: { shape: code, file: ../../code/main.tf }\n  logo: { shape: image, src: logo.png }\nlayout:\n  main: [0, 0]\n  logo: [0, 30]\n`,
      "parts/flow/logo.png": "data",
      "code/main.tf": 'resource "x" "y" {}\n',
    };
    const detached = detachSlide(files, project(files), { item: 1, folder: "copies/flow" });
    expect(slides(detached.files)).toEqual(["parts/flow - - - - -", "copies/flow - - - - -"]);
    const copy = detached.files["copies/flow/mogram.yaml"] ?? "";
    // `../../code/main.tf` from `copies/flow` is the same file; the picture moved with it.
    expect(copy).toContain("file: ../../code/main.tf");
    expect(copy).toContain("src: logo.png");
    expect(detached.files["copies/flow/logo.png"]).toBe("data");
    expect(parseDiagram(detached.files, "copies/flow").diagnostics).toEqual([]);
  });

  it("moves a folder, keeping every deck, frame and opens that named it", () => {
    const files: Record<string, string> = {
      ...BASE,
      "mogram.yaml": deckFile("    - title\n    - flow\n", "").replace(
        "deck:\n",
        "deck:\n  frame: frame\n",
      ),
      "lesson/mogram.yaml": deckFile("    - ../flow\n"),
      "overview/mogram.yaml":
        "mogram: 1\ncomponents:\n  f: { opens: ../flow }\nlayout:\n  f: [0, 0]\n",
      "flow/code/main.tf": "x = 1\n",
    };
    const flow = files["flow/mogram.yaml"] ?? "";
    files["flow/mogram.yaml"] = flow
      .replace("shapes:\n", "shapes:\n  code: { shape: code, file: code/main.tf }\n")
      .replace("layout:\n", "layout:\n  code: [0, 30]\n");
    const movedFrame = renameSlideFolder(files, project(files), { from: "frame", to: "chrome" });
    expect(project(movedFrame.files).settings.deck?.frame).toBe("chrome");
    const moved = renameSlideFolder(files, project(files), { from: "flow", to: "part/flow" });
    expect(slides(moved.files)).toEqual(["title - - - - -", "part/flow - - - - -"]);
    expect(slides(moved.files, "lesson")).toEqual(["part/flow - - - - -"]);
    expect(moved.files["lesson/mogram.yaml"]).toContain("    - ../part/flow\n");
    expect(moved.files["overview/mogram.yaml"]).toContain("opens: ../part/flow");
    expect(moved.files["part/flow/code/main.tf"]).toBe("x = 1\n");
    expect(moved.files["flow/mogram.yaml"]).toBeUndefined();
    expect(parseDiagram(moved.files, "part/flow").diagnostics).toEqual([]);
  });

  it("writes folders from the deck's own folder", () => {
    expect(relativeFolder("", "title")).toBe("title");
    expect(relativeFolder("course", "course/title")).toBe("title");
    expect(relativeFolder("course", "shared/flow")).toBe("../shared/flow");
    expect(relativeFolder("a/b", "a/b")).toBe(".");
  });
});

describe("renames that follow into decks", () => {
  const files = {
    ...BASE,
    "mogram.yaml": deckFile(
      "    - flow: { to: planned }\n    - flow: { from: planned, scene: outage }\n    - flow: { story: main }\n",
    ),
  };
  const flow = () => parseDiagram(files, "flow").diagram;

  it("renames a step where slides start or stop at it", () => {
    const renamed = updateStep(files, flow(), { story: "main", index: 1, patch: { name: "plan" } });
    expect(slides(renamed.files).slice(0, 2)).toEqual([
      "flow - - plan - -",
      "flow - plan - outage -",
    ]);
  });

  it("lets go of a step that's removed, and a story or scene that's deleted", () => {
    const removed = removeSteps(files, flow(), { story: "main", from: 1, count: 1 });
    expect(slides(removed.files).slice(0, 2)).toEqual(["flow - - - - -", "flow - - - outage -"]);
    const noScene = deleteScene(files, flow(), "outage");
    expect(slides(noScene.files)[1]).toBe("flow - planned - - -");
    const noStory = deleteStory(files, flow(), "main");
    expect(slides(noStory.files)[2]).toBe("flow - - - - -");
  });

  it("renames a story or a scene where a slide names it", () => {
    const story = renameStory(files, flow(), { from: "main", to: "intro" });
    expect(slides(story.files)[2]).toBe("flow intro - - - -");
    const scene = renameScene(files, flow(), { from: "outage", to: "down" });
    expect(slides(scene.files)[1]).toBe("flow - planned - down -");
  });
});
