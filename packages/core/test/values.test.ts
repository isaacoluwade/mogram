import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { cursorAtBeat, numberOf, pictureAt, scopeOf, storyTimeline } from "../src/picture";
import { resolveState } from "../src/state";
import { FormulaError, evaluate, namesIn, parseFormula, readsModel, shown } from "../src/values";
import type { Diagram } from "../src/model";

const parse = (yaml: string) => parseDiagram({ "mogram.yaml": yaml });
const diagramOf = (yaml: string): Diagram => {
  const result = parse(yaml);
  expect(result.diagnostics).toEqual([]);
  return result.diagram;
};
const messages = (yaml: string) => parse(yaml).diagnostics.map((d) => d.message);

const run = (source: string, values: Record<string, number | string> = {}) =>
  evaluate(parseFormula(source), { value: (name) => values[name] });

describe("formulas", () => {
  it("does arithmetic in the usual order, with brackets", () => {
    expect(run("= 1 + 2 * 3")).toBe(7);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("= 10 - 4 - 3")).toBe(3);
    expect(run("= -2 * 3")).toBe(-6);
    expect(run("= 7 % 4")).toBe(3);
    expect(run("= 50% * 200")).toBe(100);
  });

  it("reads other values by name", () => {
    expect(run("= 1 - errors / allowed", { errors: 30, allowed: 120 })).toBe(0.75);
    expect(run("= lease_left", { lease_left: 12 })).toBe(12);
    expect(namesIn(parseFormula("= max(a, b) + load(web) * c"))).toEqual(["a", "b", "c"]);
  });

  it("compares and chooses", () => {
    expect(run("= work > lease", { work: 40, lease: 30 })).toBe(1);
    expect(run("= work <= lease and not renewed", { work: 40, lease: 30, renewed: 0 })).toBe(0);
    expect(run('= if(load > 1, "over", "fine")', { load: 1.2 })).toBe("over");
    expect(run('= model == "saas"', { model: "saas" })).toBe(1);
    expect(run("= a or b", { a: 0, b: 2 })).toBe(1);
  });

  it("has a few functions, and never divides by nothing", () => {
    expect(run("= min(3, 1, 2) + max(3, 1, 2)")).toBe(4);
    expect(run("= round(2.567, 1)")).toBe(2.6);
    expect(run("= floor(2.9) + ceil(2.1) + abs(-1)")).toBe(6);
    expect(run("= log2(8)")).toBe(3);
    expect(run("= 5 / 0")).toBe(0);
    expect(run('= "Used " + 3 + " of " + 4')).toBe("Used 3 of 4");
  });

  it("says what's wrong", () => {
    const why = (source: string) => {
      try {
        run(source);
        return null;
      } catch (error) {
        return error instanceof FormulaError ? error.message : String(error);
      }
    };
    expect(why("= 1 +")).toBe("The formula stops before it's finished.");
    expect(why("= (1 + 2")).toBe(`A "(" is never closed.`);
    expect(why("= sqrt(4)")).toContain(`"sqrt" isn't a function.`);
    expect(why("= round()")).toBe("round() takes 1 to 2 values.");
    expect(why("= load(1 + 2)")).toBe("load() takes the name of one element, like load(web).");
    expect(why("= missing + 1")).toBe(`There is no value called "missing".`);
    expect(why("= 2 $ 3")).toBe(`"$" isn't something a formula can use.`);
  });

  it("knows which formulas read the model, and shows numbers cleanly", () => {
    expect(readsModel(parseFormula("= 100 - load(web) * 100"))).toBe(true);
    expect(readsModel(parseFormula("= a + min(b, 2)"))).toBe(false);
    expect([shown(3), shown(0.333333), shown(2.5), shown("text")]).toEqual([
      "3",
      "0.33",
      "2.5",
      "text",
    ]);
  });
});

const BUDGET = `data:
  allowed: 120
  errors: 30
  left: "= round((1 - errors / allowed) * 100)"
shapes:
  gauge: { shape: meter, label: Error budget, value: left, max: 100, limit: 20, unit: "%" }
  note: { label: "%left%% of the budget left" }
stories:
  main:
    - say: Errors use the budget up.
      set: { errors: [30, 90] }
    - say: And then it's gone.
      set: { errors: 120 }
`;

describe("values in a picture", () => {
  it("works formulas out, in whatever order they're written", () => {
    const diagram = diagramOf(BUDGET);
    const picture = pictureAt(diagram, null);
    expect(picture.values.get("left")).toBe(75);
    // Labels read the number, not the formula.
    expect(picture.diagram.settings.data.get("left")).toBe(75);
    expect(diagram.components.get("gauge")?.meter).toEqual({
      value: "left",
      max: "100",
      as: "bar",
      limit: 20,
      unit: "%",
    });
  });

  it("lets a step set a value, and run it from one number to another", () => {
    const diagram = diagramOf(BUDGET);
    const one = pictureAt(diagram, { scene: null, story: cursorAtBeat(diagram, "main", 1) });
    expect(one.values.get("errors")).toBe(90);
    expect(one.values.get("left")).toBe(25);
    expect([...one.ramps]).toEqual([["errors", { from: 30, to: 90 }]]);
    // What the meter shows at each end of the run.
    const gauge = diagram.components.get("gauge")?.meter;
    const at = (errors: number) =>
      numberOf(gauge?.value ?? "", scopeOf(new Map([...one.values, ["errors", errors]])));
    expect(at(90)).toBe(25);
    // The next step has arrived: nothing is on its way.
    const two = pictureAt(diagram, { scene: null, story: cursorAtBeat(diagram, "main", 2) });
    expect(two.values.get("left")).toBe(0);
    expect(two.ramps.size).toBe(0);
  });

  it("counts a loop of formulas as nothing rather than hanging", () => {
    const diagram = diagramOf(`data:\n  a: "= b + 1"\n  b: "= a + 1"\n`);
    expect(pictureAt(diagram, null).values.get("a")).toBeTypeOf("number");
  });

  it("says what's wrong with a value, a meter and a control", () => {
    expect(
      messages(`data:
  bad: "= 1 +"
  fine: 3
components:
  web: generic/service
shapes:
  gauge: { shape: meter, value: "= (", limit: lots }
connections:
  loop: { from: web, to: web, traffic: "= load(web)" }
controls:
  rps: { dial: [5, 1] }
  retry: { toggle: nowhere }
  model: { pick: [one] }
  odd: { label: Odd }
scenes:
  s:
    web: 3
    nothing: 4
`),
    ).toEqual([
      `"bad" in the data of "the diagram" isn't a formula Mogram can read. The formula stops before it's finished.`,
      `The value of "gauge" should be a number, the name of a value, or a formula like "= used / total * 100". The formula stops before it's finished.`,
      `The limit of "gauge" should be a number: the value it turns red at.`,
      `The traffic on "loop" feeds the model, so its formula can't read the model back (load, copies, traffic or count).`,
      `Connection "loop" starts and ends at the same place.`,
      `The dial "rps" needs its least and most, like "dial: [1, 10]".`,
      `The toggle "retry" turns on scene "nowhere", but there is no such scene.`,
      `The pick "model" should list the scenes to choose from, like "pick: [iaas, paas, saas]".`,
      `The control "odd" should be a dial ("dial: [1, 10]"), a toggle ("toggle: a_scene") or a pick ("pick: [one, two]").`,
      `In scene "s", "web" is a component, so it takes a word like "down" or "shown", not a number.`,
      `Scene "s" sets "nothing", but there is no value by that name in the diagram's "data:".`,
    ]);
  });
});

const DIALS = `data:
  lease: 30
components:
  users: generic/users
  web: { type: generic/server, scale: { min: 1, max: 8 } }
connections:
  in: { from: users, to: web, traffic: "= rps" }
shapes:
  flag: { label: Retries on, show: hidden }
controls:
  rps: { dial: [1, 10], start: 2, step: 1, unit: "×", label: Traffic }
  work: { dial: [5, 60], start: 10, unit: " s" }
  retries: { toggle: retry_storm }
  size: { pick: [normal, big] }
scenes:
  retry_storm:
    flag: shown
  big:
    web: { copies: 8 }
stories:
  main:
    - say: A worker takes the message.
      set: { web: active }
    - say: The lease runs out before the work is done.
      when: "= work > lease"
      set: { web: degraded }
    - say: Done.
`;

describe("controls", () => {
  it("reads dials, toggles and picks", () => {
    const diagram = diagramOf(DIALS);
    expect(diagram.controls.map((control) => [control.name, control.kind, control.label])).toEqual([
      ["rps", "dial", "Traffic"],
      ["work", "dial", "Work"],
      ["retries", "toggle", "Retries"],
      ["size", "pick", "Size"],
    ]);
    expect(diagram.controls[0]).toMatchObject({ min: 1, max: 10, start: 2, step: 1, unit: "×" });
  });

  it("feeds a dial to the model: more traffic, more copies", () => {
    const diagram = diagramOf(DIALS);
    const copies = (rps: number) => {
      const picture = pictureAt(diagram, {
        scene: null,
        story: null,
        controls: new Map([["rps", rps]]),
      });
      return resolveState({ diagram, picture }).capacity.elements.get("web")?.copies;
    };
    expect(pictureAt(diagram, null).diagram.connections.get("in")?.traffic).toBe(2);
    expect(copies(1)).toBeLessThan(copies(5) ?? 0);
    // A dial stays within what it's written to allow.
    expect(
      pictureAt(diagram, { scene: null, story: null, controls: new Map([["rps", 99]]) }).values.get(
        "rps",
      ),
    ).toBe(10);
  });

  it("turns scenes on with a toggle and a pick, in the order the controls are written", () => {
    const diagram = diagramOf(DIALS);
    const off = pictureAt(diagram, null);
    expect(off.presence.get("flag")).toBe("hidden");
    expect(off.values.get("retries")).toBe(0);
    const on = pictureAt(diagram, {
      scene: null,
      story: null,
      controls: new Map<string, boolean | string>([
        ["retries", true],
        ["size", "big"],
      ]),
    });
    expect(on.presence.has("flag")).toBe(false);
    expect(on.values.get("retries")).toBe(1);
    expect(on.entries).toMatchObject([{ target: "web", capacity: { copies: 8 } }]);
  });

  it("plays a step only while its test holds, so a dial changes what happens", () => {
    const diagram = diagramOf(DIALS);
    const captions = (work: number) => {
      const controls = new Map([["work", work]]);
      const timeline = storyTimeline(diagram, undefined, controls);
      return timeline?.segments.map((segment) => segment.to.played.at(-1)?.index);
    };
    // Fast work: the step where the lease runs out is passed over.
    expect(captions(10)).toEqual([0, 2]);
    expect(captions(40)).toEqual([0, 1, 2]);
  });
});
