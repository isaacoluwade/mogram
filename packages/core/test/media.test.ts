import { describe, expect, it } from "vitest";
import { setPart, removePart, renamePart } from "../src/edit";
import { parseDiagram } from "../src/format";
import { computeLayout, imageContentBox, partBox, IMAGE_WIDTH } from "../src/layout";
import { partOf, type ProjectFiles } from "../src/model";
import { pictureAt } from "../src/picture";
import { routeConnections } from "../src/routing";

const HASH = "ab".repeat(32);
const PNG = `mogram-asset 1 sha256:${HASH} image/png 1000 1600x900`;

/** A diagram from one file and any project files beside it. */
const read = (yaml: string, more: ProjectFiles = {}) =>
  parseDiagram({ "mogram.yaml": `mogram: 1\nname: Slide\n${yaml}`, ...more });
const messages = (yaml: string, more: ProjectFiles = {}) =>
  read(yaml, more).diagnostics.map((d) => d.message);

describe("images (D-102)", () => {
  const PORTAL = `shapes:
  portal:
    shape: image
    src: images/portal.png
    parts:
      name_field: [0.25, 0.5, 0.5, 0.25]
      region: { area: [0, 0, 0.5, 0.5], show: hidden, tone: amber, mark: warn }
layout:
  portal: [0, 0]
`;

  it("finds its picture and its own size, and is 80 cells wide at its proportions", () => {
    const { diagram, diagnostics } = read(PORTAL, { "images/portal.png": PNG });
    expect(diagnostics).toEqual([]);
    const portal = diagram.components.get("portal");
    expect(portal?.image).toEqual({
      src: "images/portal.png",
      path: "images/portal.png",
      fit: "contain",
      natural: { width: 1600, height: 900 },
    });
    expect(computeLayout(diagram).elements.get("portal")?.box).toMatchObject({
      w: IMAGE_WIDTH * 8,
      h: 45 * 8,
    });
    // An SVG says its size itself; one that doesn't is taken as 16:9.
    const svg = read(PORTAL.replace("portal.png", "logo.svg"), {
      "images/logo.svg": '<svg viewBox="0 0 400 400"></svg>',
    }).diagram;
    expect(svg.components.get("portal")?.image?.natural).toEqual({ width: 400, height: 400 });
    expect(computeLayout(svg).elements.get("portal")?.box.h).toBe(80 * 8);
  });

  it("says what's wrong with its picture", () => {
    expect(messages(PORTAL, { "images/portal.jpg": PNG })).toContain(
      `"portal" shows "images/portal.png", but there is no such file. Did you mean "images/portal.jpg"?`,
    );
    expect(
      messages(PORTAL.replace("images/portal.png", "notes.md"), { "notes.md": "#" }),
    ).toContain(
      `"portal" shows "notes.md", which isn't a picture Mogram can show. Use PNG, JPEG, WebP, GIF or SVG.`,
    );
    expect(messages("shapes:\n  portal: { shape: image }\nlayout:\n  portal: [0, 0]\n")).toContain(
      `"portal" is an image, so it needs "src", like src: images/portal.png.`,
    );
    expect(
      messages("shapes:\n  p: { shape: image, src: a.png, fit: fill }\nlayout:\n  p: [0, 0]\n", {
        "a.png": PNG,
      }),
    ).toContain(`"fit" should be contain or cover.`);
  });

  it("ignores what an image doesn't take, saying so", () => {
    expect(
      messages(
        "shapes:\n  p: { shape: image, src: a.png, tone: rose, state: down }\nlayout:\n  p: [0, 0]\n",
        {
          "a.png": PNG,
        },
      ),
    ).toEqual([
      `"tone" doesn't apply to an image, so it is ignored on "p".`,
      `"state" doesn't apply to an image, so it is ignored on "p".`,
    ]);
    expect(
      messages("shapes:\n  box: { src: a.png, language: hcl }\nlayout:\n  box: [0, 0]\n"),
    ).toEqual([
      `"src" only applies to an image, so it is ignored on "box".`,
      `"language" only applies to code, so it is ignored on "box".`,
    ]);
  });

  it("has regions as parts, boxed inside its picture", () => {
    const { diagram } = read(PORTAL, { "images/portal.png": PNG });
    const portal = diagram.components.get("portal");
    expect(portal?.parts.get("name_field")).toMatchObject({ kind: "area", x: 0.25, w: 0.5 });
    expect(portal?.parts.get("region")).toMatchObject({
      show: "hidden",
      tone: "amber",
      mark: "warn",
    });
    const layout = computeLayout(diagram);
    const box = layout.elements.get("portal")?.box;
    expect(box).toBeDefined();
    if (portal === undefined || box === undefined) return;
    expect(imageContentBox(portal, box)).toEqual(box);
    const field = portal.parts.get("name_field");
    if (field === undefined) return;
    expect(partBox(layout, portal, field)).toEqual({ x: 160, y: 180, w: 320, h: 90 });
  });

  it("says when a region isn't one", () => {
    const bad = PORTAL.replace("[0.25, 0.5, 0.5, 0.25]", "[0.8, 0, 0.5, 1]");
    expect(messages(bad, { "images/portal.png": PNG })).toContain(
      `Part "name_field" of "portal" should be four numbers from 0 to 1: x, y, width, height.`,
    );
  });
});

describe("code (D-103)", () => {
  const MAIN = `shapes:
  main_tf:
    shape: code
    file: code/main.tf
    lines: 2-4
    numbers: true
    parts:
      name: 2
      body: { lines: 3-4, show: faded }
layout:
  main_tf: [0, 0]
`;
  const SOURCE = 'terraform {\n  name = "x"\n  a = 1\n  b = 2\n}\n';

  it("reads its file, its slice, its language and its header", () => {
    const { diagram, diagnostics } = read(MAIN, { "code/main.tf": SOURCE });
    expect(diagnostics).toEqual([]);
    const code = diagram.components.get("main_tf")?.code;
    expect(code).toMatchObject({
      file: "code/main.tf",
      path: "code/main.tf",
      slice: [2, 4],
      language: "hcl",
      title: "main.tf",
      numbers: true,
      listing: { first: 2, last: 4, missing: false },
    });
    expect(code?.listing.lines).toHaveLength(5);
  });

  it("writes text in place with no header unless it has a title, and `none` is no header", () => {
    const inline = read(
      'shapes:\n  plan: { shape: code, language: plan, text: "+ a" }\nlayout:\n  plan: [0, 0]\n',
    );
    expect(inline.diagram.components.get("plan")?.code?.title).toBeNull();
    const none = read(MAIN.replace("numbers: true", "title: none"), { "code/main.tf": SOURCE });
    expect(none.diagram.components.get("main_tf")?.code?.title).toBeNull();
  });

  it("says what's wrong, in the contract's words", () => {
    expect(messages(MAIN, { "code/mian.tf": SOURCE })).toContain(
      `"main_tf" shows "code/main.tf", but there is no such file. Did you mean "code/mian.tf"?`,
    );
    expect(messages(MAIN.replace("2-4", "2-40"), { "code/main.tf": SOURCE })).toContain(
      `"main_tf" shows lines 2-40 of "code/main.tf", which has 5 lines.`,
    );
    expect(messages(MAIN.replace("2-4", "four"), { "code/main.tf": SOURCE })).toContain(
      `"lines" should be a line or a range, like 12 or 12-31.`,
    );
    expect(messages("shapes:\n  c: { shape: code }\nlayout:\n  c: [0, 0]\n")).toContain(
      `"c" is code, so it needs "text" or "file", like file: code/main.tf.`,
    );
    expect(
      messages("shapes:\n  c: { shape: code, text: x, file: a.tf }\nlayout:\n  c: [0, 0]\n", {
        "a.tf": "",
      }),
    ).toContain(`"c" has both "text" and "file". Use one.`);
    expect(
      messages(
        "shapes:\n  c: { shape: code, text: x, language: terraform }\nlayout:\n  c: [0, 0]\n",
      ),
    ).toContain(
      `"language" is "terraform", which isn't one Mogram colours, so it is shown plain. Did you mean "hcl"?`,
    );
    expect(messages(MAIN.replace("name: 2", "name: 40"), { "code/main.tf": SOURCE })).toContain(
      `Part "name" of "main_tf" is line 40, but "code/main.tf" has 5 lines.`,
    );
    expect(
      messages("shapes:\n  c: { shape: code, text: x, font_size: 90 }\nlayout:\n  c: [0, 0]\n"),
    ).toContain(`The font size of "c" should be from 10 to 64 for code.`);
  });

  it("finds a line part's box inside the listing, and none for a line outside the slice", () => {
    const { diagram } = read(MAIN.replace("name: 2", "name: 2\n      gone: 1"), {
      "code/main.tf": SOURCE,
    });
    const layout = computeLayout(diagram);
    const main = diagram.components.get("main_tf");
    if (main === undefined) throw new Error("no main_tf");
    const box = layout.elements.get("main_tf")?.box;
    const name = main.parts.get("name");
    const gone = main.parts.get("gone");
    if (box === undefined || name === undefined || gone === undefined) throw new Error("no parts");
    // Below the 16 px padding and the 36 px header, one 30 px line.
    expect(partBox(layout, main, name)).toEqual({
      x: box.x + 16,
      y: box.y + 52,
      w: box.w - 32,
      h: 30,
    });
    expect(partBox(layout, main, gone)).toBeNull();
  });
});

describe("parts (D-104)", () => {
  const TWO = `shapes:
  portal: { shape: image, src: a.png, parts: { field: [0, 0, 0.5, 0.5] } }
  main: { shape: code, text: "a\\nb\\nc", parts: { name: 2 } }
  web: { label: Web }
connections:
  same: { from: portal.field, to: main.name }
scenes:
  reviewed:
    main.name: { mark: check, tone: green }
stories:
  main:
    - say: Look.
      focus: [portal.field, main.name]
      zoom: main.name
    - set: { portal.field: hidden }
layout:
  portal: [0, 0]
  main: [100, 0]
  web: [0, 60]
`;
  const files = { "a.png": PNG };

  it("are named in connections, sets, focus and zoom", () => {
    const { diagram, diagnostics } = read(TWO, files);
    expect(diagnostics).toEqual([]);
    const same = diagram.connections.get("same");
    expect(same?.from).toEqual({ element: "portal", port: null, part: "field" });
    expect(same?.to).toEqual({ element: "main", port: null, part: "name" });
    expect(partOf(diagram.components, "main.name")?.part.name).toBe("name");
    expect(partOf(diagram.components, "web.name")).toBeNull();
    const steps = diagram.stories[0]?.steps;
    expect(steps?.[0]?.focus).toEqual(["portal.field", "main.name"]);
    expect(steps?.[0]?.zoom).toBe("main.name");
  });

  it("are shown, toned and marked by sets and scenes", () => {
    const { diagram } = read(TWO, files);
    const story = diagram.stories[0];
    if (story === undefined) throw new Error("no story");
    const after = pictureAt(diagram, {
      scene: "reviewed",
      story: {
        story: "main",
        played: [
          { story: "main", index: 0 },
          { story: "main", index: 1 },
        ],
        stack: [],
        beats: [],
        rewound: false,
      },
    });
    expect(after.parts.get("main")?.get("name")).toEqual({
      show: "shown",
      tone: "green",
      mark: "check",
    });
    expect(after.parts.get("portal")?.get("field")?.show).toBe("hidden");
    // A connection that ends on a hidden part goes with it.
    expect(after.presence.get("same")).toBe("hidden");
  });

  it("route a connection to the part's box", () => {
    const { diagram } = read(TWO, files);
    const layout = computeLayout(diagram);
    const route = routeConnections(diagram, layout).get("same");
    const main = diagram.components.get("main");
    const name = main?.parts.get("name");
    if (route === undefined || main === undefined || name === undefined)
      throw new Error("no route");
    const box = partBox(layout, main, name);
    const end = route.samples.at(-1);
    if (box === null || end === undefined) throw new Error("no box");
    expect(end.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(end.x).toBeLessThanOrEqual(box.x + box.w + 1);
    expect(end.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(end.y).toBeLessThanOrEqual(box.y + box.h + 1);
  });

  it("say what's wrong, in the contract's words", () => {
    expect(
      messages(TWO.replace("focus: [portal.field, main.name]", "focus: [main.nam]"), files),
    ).toContain(
      `In story "main", "main.nam" names a part of "main" that isn't there. Did you mean "name"?`,
    );
    expect(
      messages(TWO.replace("main.name: { mark: check, tone: green }", "web.name: down"), files),
    ).toContain(
      `In scene "reviewed", "web.name" points inside "web", but "web" has no parts and doesn't open a nested diagram.`,
    );
    expect(messages(TWO.replace("to: main.name", "to: portal.nme_field"), files)).toContain(
      `Connection "same" ends on "portal.nme_field", but "portal" has no part with that name.`,
    );
    expect(
      messages(
        TWO.replace(
          "main.name: { mark: check, tone: green }",
          'main.name: { label: "X", mark: check }',
        ),
        files,
      ),
    ).toContain(`A part can change "show", "tone" and "mark". "label" is ignored on "main.name".`);
    expect(
      messages(
        "shapes:\n  c: { shape: code, text: x, opens: ./x, parts: { a: 1 } }\nlayout:\n  c: [0, 0]\n",
        {
          "x/mogram.yaml": "mogram: 1\n",
        },
      ),
    ).toContain(`"c" has parts, so it can't also open a nested diagram.`);
  });

  it("are added short, changed long, renamed and removed with what names them", () => {
    const { diagram } = read(TWO, files);
    const all = { "mogram.yaml": `mogram: 1\nname: Slide\n${TWO}`, ...files };
    const added = setPart(all, diagram, { element: "main", name: "rest", set: { lines: [2, 3] } });
    expect(added.files["mogram.yaml"]).toContain("parts: { name: 2, rest: 2-3 }");
    const looked = setPart(added.files, parseDiagram(added.files).diagram, {
      element: "main",
      name: "rest",
      set: { show: "hidden", tone: "amber" },
    });
    expect(looked.files["mogram.yaml"]).toContain(
      "rest: { lines: 2-3, show: hidden, tone: amber }",
    );
    const region = setPart(all, diagram, {
      element: "portal",
      name: "corner",
      set: { area: { x: 0.123456, y: 0.5, w: 0.9, h: 0.25 } },
    });
    expect(region.files["mogram.yaml"]).toContain("corner: [0.1235, 0.5, 0.8765, 0.25]");
    const renamed = renamePart(all, diagram, { element: "main", from: "name", to: "title" });
    expect(renamed.files["mogram.yaml"]).toContain("to: main.title");
    expect(renamed.files["mogram.yaml"]).toContain("main.title: { mark: check, tone: green }");
    const removed = removePart(all, diagram, { element: "main", name: "name" });
    const after = parseDiagram(removed.files);
    expect(after.diagnostics).toEqual([]);
    expect(after.diagram.connections.has("same")).toBe(false);
    expect(after.diagram.components.get("main")?.parts.size).toBe(0);
  });
});

describe("suggestions for media and words", () => {
  it("says which line of a listing sized by hand is cut", async () => {
    const { lintDiagram } = await import("../src/lint");
    const { diagram } = read(
      'shapes:\n  plan: { shape: code, text: "short\\na much much longer line here" }\nlayout:\n  plan: { at: [0, 0], size: [20, 10] }\n',
    );
    expect(lintDiagram(diagram).map((finding) => finding.message)).toContain(
      `Line 2 of "plan" is wider than the element at this size, so its end is cut.`,
    );
  });

  it("says when a beat takes long to say", async () => {
    const { lintDiagram } = await import("../src/lint");
    const long = Array.from({ length: 130 }, () => "word").join(" ");
    const { diagram } = read(`stories:\n  main:\n    - script: ${long}\n`);
    expect(lintDiagram(diagram).map((finding) => finding.message)).toContain(
      `Beat 1 of "main" takes about 40 seconds to say. Beats under 25 seconds are easier to record and to follow.`,
    );
  });
});

describe("editing a listing's text", () => {
  it("writes several lines as a block, kept exactly", async () => {
    const { updateElement } = await import("../src/edit");
    const files = {
      "mogram.yaml":
        'mogram: 1\nname: Slide\nshapes:\n  c: { shape: code, text: "x" }\nlayout:\n  c: [0, 0]\n',
    };
    const text = 'resource "a" "b" {\n  name = "x"\n}';
    const written = updateElement(files, parseDiagram(files).diagram, { name: "c", set: { text } });
    expect(written.files["mogram.yaml"]).toContain(
      '    text: |\n      resource "a" "b" {\n        name = "x"\n      }\n',
    );
    const code = parseDiagram(written.files).diagram.components.get("c")?.code;
    expect(code?.listing.lines).toEqual(['resource "a" "b" {', '  name = "x"', "}"]);
  });
});
