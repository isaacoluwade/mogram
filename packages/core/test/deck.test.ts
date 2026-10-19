import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beatsIntoSlide,
  checkDeck,
  deckInfo,
  deckPositionAt,
  deckPositionAtBeat,
  deckSlides,
  deckTimeline,
  nextInDeck,
  previousInDeck,
  slideDiagram,
  startDeck,
  SLIDE_CUT,
  SLIDE_OPENING,
  STILL_SLIDE,
  type DeckPosition,
} from "../src/deck";
import { parseDiagram } from "../src/format";
import { fillPlaceholders, placeholderLookup, type ProjectFiles } from "../src/model";
import { DiagramLoader } from "../src/nested";
import { captionAt } from "../src/picture";

const FLOW = `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
  apply: { label: Apply, show: hidden, style: panel }
  drift: { label: Drift, show: hidden }
stories:
  main:
    - say: You write what you want.
    - say: Terraform plans it.
      set: { plan: shown }
    - say: Then it applies it.
      name: applied
      set: { apply: shown }
    - set: { apply: { mark: check } }
    - say: Later, something drifts.
      set: { drift: shown }
    - say: And the plan shows it.
      set: { drift: { tone: amber } }
layout:
  write: [10, 10]
  plan: [40, 10]
  apply: [70, 10]
  drift: [100, 10]
`;

const DECK = (slides: string, more = "") => `mogram: 1
name: A course
page: 16:9
theme: forest
data: { course: Terraform }
styles:
  panel: { tone: violet }
${more}deck:
  frame: frame
  captions: off
  slides:
${slides}`;

const project = (slides: string, more = ""): ProjectFiles => ({
  "mogram.yaml": DECK(slides, more),
  "frame/mogram.yaml": `mogram: 1\nname: Frame\nshapes:\n  footer: { label: "%deck% · %section% · %slide% / %slides%" }\nlayout:\n  footer: [10, 120]\n`,
  "title/mogram.yaml": `mogram: 1\nname: Title\ntheme: ocean\nshapes:\n  heading: { label: "%course% for beginners" }\nlayout:\n  heading: [60, 50]\n`,
  "flow/mogram.yaml": FLOW,
});

const USUAL = `    - section: What it is
    - title: { frame: false }
    - flow: { to: applied }
    - section: Drift
    - title: { title: A pause, skip: true }
    - flow: { from: applied }
`;

const open = (files: ProjectFiles) => {
  const source = new DiagramLoader(files);
  return { files, source, slides: deckSlides(source) };
};

describe("reading a deck (D-99)", () => {
  it("reads the frame, the captions, and slides and sections in order", () => {
    const { diagram, diagnostics } = parseDiagram(project(USUAL));
    expect(diagnostics).toEqual([]);
    const deck = diagram.settings.deck;
    expect(deck).toMatchObject({ frame: "frame", captions: false });
    expect(
      deck?.entries.map((entry) => (entry.kind === "section" ? entry.title : entry.folder)),
    ).toEqual(["What it is", "title", "flow", "Drift", "title", "flow"]);
    expect(deck?.entries[2]).toMatchObject({
      kind: "slide",
      folder: "flow",
      to: "applied",
      frame: true,
    });
    expect(deck?.entries[1]).toMatchObject({ frame: false, skip: false });
    expect(deck?.entries[4]).toMatchObject({ title: "A pause", skip: true });
  });

  it("writes folders from the deck's own folder, and keeps them in the project", () => {
    const files = {
      "course/mogram.yaml": DECK("    - ./title\n    - ../shared/flow\n    - ../../elsewhere\n"),
      "course/title/mogram.yaml": "mogram: 1\nname: Title\n",
      "shared/flow/mogram.yaml": FLOW,
    };
    const result = parseDiagram(files, "course");
    expect(
      result.diagram.settings.deck?.entries.map((e) => (e.kind === "slide" ? e.folder : null)),
    ).toEqual(["course/title", "shared/flow"]);
    expect(result.diagnostics.map((d) => d.message)).toContain(
      `Slide 3 is "../../elsewhere", which is outside the project.`,
    );
  });

  it("says what's wrong with the section itself", () => {
    const messages = (text: string) =>
      parseDiagram({ "mogram.yaml": text }).diagnostics.map((d) => d.message);
    expect(messages("mogram: 1\nname: X\ndeck: title\n")).toContain(
      `"deck" should have its slides listed below it, like "slides: [title, the_flow]".`,
    );
    expect(messages("mogram: 1\nname: X\ndeck:\n  captions: maybe\n  slides: [a]\n")).toContain(
      `"captions" should be on or off.`,
    );
    expect(messages("mogram: 1\nname: X\ndeck:\n  slides: []\n")).toContain(
      `The deck has no slides yet.`,
    );
    expect(
      messages(
        "mogram: 1\nname: X\nshapes:\n  box: { label: Box }\nlayout:\n  box: [0, 0]\ndeck:\n  slides: [a]\n",
      ),
    ).toContain(
      `"box" is an element in a deck's own file. A deck's file holds its settings and its slides; put "box" on a slide or in the frame.`,
    );
  });

  it("checks each slide against the folder it names", () => {
    const withDeck = { ...project(USUAL), "lesson/mogram.yaml": DECK("    - a\n") };
    const more = {
      ...withDeck,
      "mogram.yaml": DECK(
        "    - tittle\n    - flow: { from: aplied }\n    - flow: { story: rollback }\n    - flow: { from: applied, to: applied }\n    - flow: { scene: outage }\n    - lesson\n",
      ).replace("frame: frame", "frame: frme"),
    };
    const messages = checkDeck(more, new DiagramLoader(more)).map((d) => d.message);
    expect(messages).toEqual([
      `"frame" is "frme", but no folder with that name holds a diagram. Did you mean "frame"?`,
      `Slide 1 is "tittle", but no folder with that name holds a diagram. Did you mean "title"?`,
      `Slide 2 plays "flow" from "aplied", but its story "main" has no step with that name. Did you mean "applied"?`,
      `Slide 3 names the story "rollback", but "flow" has no story with that name.`,
      `Slide 4 stops at "applied", which comes before "applied", where it starts.`,
      `Slide 5 lays the scene "outage" over "flow", which has no scene with that name.`,
      `Slide 6 is "lesson", which is a deck. A deck's slides are diagrams.`,
    ]);
    expect(checkDeck(project(USUAL), new DiagramLoader(project(USUAL)))).toEqual([]);
  });

  it("is told from a diagram cheaply, with what a list of decks shows", () => {
    const files = project(USUAL);
    expect(deckInfo(files, new DiagramLoader(files))).toEqual({
      name: "A course",
      slides: 3,
      first: "title",
    });
    const plain = { "mogram.yaml": FLOW };
    expect(deckInfo(plain, new DiagramLoader(plain))).toBeNull();
    expect(deckInfo(files, new DiagramLoader(files), "flow")).toBeNull();
  });
});

describe("a deck's slides", () => {
  it("are numbered without the skipped, in their sections, with their stretches found", () => {
    const { slides } = open(project(USUAL));
    expect(slides.map((s) => [s.number, s.folder, s.section, s.title, s.frame])).toEqual([
      [1, "title", "What it is", "Title", false],
      [2, "flow", "What it is", "The flow", true],
      [3, "flow", "Drift", "The flow", true],
    ]);
    expect(slides[1]).toMatchObject({ story: "main", from: null, to: { story: "main", index: 2 } });
    expect(slides[2]).toMatchObject({ from: { story: "main", index: 2 }, to: null });
    expect(slides[0]?.story).toBeNull();
    // Next to each other, the second beginning where the first stopped: one story, no cut.
    expect(slides.map((s) => s.carriesOn)).toEqual([false, false, true]);
    const apart = open(
      project(`    - flow: { to: applied }\n    - title\n    - flow: { from: applied }\n`),
    );
    expect(apart.slides.map((s) => s.carriesOn)).toEqual([false, false, false]);
  });

  it("take the deck's page, theme and values unless they set their own, and its styles", () => {
    const files = project(USUAL);
    const { source, slides } = open(files);
    const deck = source.load("").diagram;
    const title = slideDiagram(
      deck,
      source.load("title").diagram,
      slides[0] ?? null,
      slides.length,
    );
    expect(title.settings).toMatchObject({ page: "16:9", theme: "ocean" });
    const flow = slideDiagram(deck, source.load("flow").diagram, slides[1] ?? null, slides.length);
    expect(flow.settings).toMatchObject({ page: "16:9", theme: "forest" });
    // Read by itself, a slide in the deck's folder is already drawn the deck's way.
    expect(source.load("flow").diagram.settings).toMatchObject({ page: "16:9", theme: "forest" });
    expect(source.load("title").diagram.settings.theme).toBe("ocean");
    expect(source.load("flow").diagram.settings.data.get("course")).toBe("Terraform");
    // A style named in the deck is one a slide's elements can take.
    expect(source.load("flow").diagnostics).toEqual([]);
    expect(source.load("flow").diagram.components.get("apply")?.look?.tone).toBe("violet");
    // The deck's values, and its built-in ones, in any label.
    const text = (diagram: typeof flow, name: string) =>
      fillPlaceholders(diagram.components.get(name)?.label ?? "", placeholderLookup(diagram, name));
    expect(text(title, "heading")).toBe("Terraform for beginners");
    const frame = slideDiagram(
      deck,
      source.load("frame").diagram,
      slides[2] ?? null,
      slides.length,
    );
    expect(text(frame, "footer")).toBe("A course · Drift · 3 / 3");
  });
});

describe("moving through a deck", () => {
  const { source, slides } = open(project(USUAL));
  const caption = (position: DeckPosition) =>
    captionAt(source.load(slides[position.slide]?.folder ?? "").diagram, position.moment.story);
  const forward = (position: DeckPosition) => nextInDeck(source, slides, position).at(-1);

  it("plays a slide's beats, then moves to the next, and stops at the end", () => {
    const seen: [number, string | null][] = [];
    let position = startDeck(source, slides);
    for (let guard = 0; position !== null && guard < 20; guard++) {
      seen.push([position.slide, caption(position)]);
      position = forward(position) ?? null;
    }
    expect(seen).toEqual([
      [0, null],
      [1, null],
      [1, "You write what you want."],
      [1, "Terraform plans it."],
      [1, "Then it applies it."],
      // Straight on into the slide that carries on: no stop at a boundary nobody can see.
      [2, "Later, something drifts."],
      [2, "And the plan shows it."],
    ]);
  });

  it("stops a stretch after the beat of its last step, wordless steps and all", () => {
    const end = deckPositionAtBeat(source, slides, 1, 99);
    expect(caption(end!)).toBe("Then it applies it.");
    expect(end?.moment.story?.played).toHaveLength(4);
    expect(beatsIntoSlide(source, slides, end!)).toBe(3);
    // The slide that carries on begins there.
    const carried = startDeck(source, slides, 2);
    expect(carried?.moment.story?.played).toHaveLength(4);
    expect(beatsIntoSlide(source, slides, carried!)).toBe(0);
  });

  it("goes back a beat, to the slide before's last picture, and no further than the start", () => {
    const last = deckPositionAtBeat(source, slides, 2, 99)!;
    const back: [number, string | null][] = [];
    let position: DeckPosition | null = last;
    for (let guard = 0; position !== null && guard < 20; guard++) {
      back.push([position.slide, caption(position)]);
      position = previousInDeck(source, slides, position);
    }
    expect(back).toEqual([
      [2, "And the plan shows it."],
      [2, "Later, something drifts."],
      [2, "Then it applies it."],
      [1, "Terraform plans it."],
      [1, "You write what you want."],
      [1, null],
      [0, null],
    ]);
  });

  it("opens part-way by slide and beat", () => {
    const position = deckPositionAtBeat(source, slides, 1, 2);
    expect(position?.slide).toBe(1);
    expect(caption(position!)).toBe("Terraform plans it.");
    // Past the last slide is the last slide.
    expect(startDeck(source, slides, 40)?.slide).toBe(2);
    expect(startDeck(source, [])).toBeNull();
  });
});

describe("a deck's times", () => {
  const { source, slides } = open(project(USUAL));
  const timeline = deckTimeline(source, slides);

  it("holds a still slide, opens each story slide, and cuts between different pictures", () => {
    const [title, first, second] = timeline.slides;
    expect(title).toMatchObject({ start: 0, end: STILL_SLIDE, cut: false });
    expect(first?.start).toBe(STILL_SLIDE);
    expect(first?.cut).toBe(true);
    expect(first?.segments[0]?.start).toBeCloseTo(STILL_SLIDE + SLIDE_CUT + SLIDE_OPENING, 5);
    expect(first?.segments.filter((s) => s.endsBeat)).toHaveLength(3);
    // Carrying on: no cut and no opening hold.
    expect(second).toMatchObject({ cut: false, start: first?.end });
    expect(second?.segments[0]?.start).toBe(first?.end);
    expect(timeline.duration).toBe(second?.end);
    expect(timeline.sections).toEqual([
      { title: "What it is", start: 0 },
      { title: "Drift", start: first?.end },
    ]);
  });

  it("says where the deck is at a time", () => {
    expect(deckPositionAt(slides, timeline, 1)?.position.slide).toBe(0);
    const cutting = deckPositionAt(slides, timeline, STILL_SLIDE + 0.1);
    expect(cutting).toMatchObject({ cut: true, changeStart: STILL_SLIDE });
    expect(cutting?.previous?.slide).toBe(0);
    const end = deckPositionAt(slides, timeline, timeline.duration + 5);
    expect(end?.position.slide).toBe(2);
    expect(captionAt(source.load("flow").diagram, end?.position.moment.story ?? null)).toBe(
      "And the plan shows it.",
    );
  });
});

describe("the plan's own fixture", () => {
  const root = join(__dirname, "../../../docs/mogram-decks/fixtures/terraform-course");
  const files: Record<string, string> = {};
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:ya?ml|tf|txt)$/i.test(name))
        files[relative(root, path)] = readFileSync(path, "utf8");
    }
  };
  walk(root);

  it("reads as a deck of seven slides in three sections", () => {
    const source = new DiagramLoader(files);
    const slides = deckSlides(source);
    expect(slides.map((s) => s.folder)).toEqual([
      "title",
      "terraform_flow",
      "form_to_code",
      "first_apply",
      "reading_a_plan",
      "why_state",
      "terraform_flow",
    ]);
    expect([...new Set(slides.map((s) => s.section))]).toEqual([
      "What Terraform is",
      "Your first resources",
      "State and drift",
    ]);
    expect(slides[4]?.title).toBe("What is Terraform about to do?");
    expect(checkDeck(files, source)).toEqual([]);
  });

  it("loads each code listing referenced from a slide folder", () => {
    const source = new DiagramLoader(files);
    for (const folder of ["form_to_code", "first_apply", "reading_a_plan"]) {
      const diagram = source.load(folder).diagram;
      const listings = [...diagram.components.values()].filter(
        (component) => component.code !== null,
      );
      expect(listings.length, folder).toBeGreaterThan(0);
      for (const component of listings) {
        expect(component.code?.listing.missing, `${folder}/${component.name}`).toBe(false);
      }
    }
  });
});
