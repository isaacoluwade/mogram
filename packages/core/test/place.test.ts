import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { computeLayout, layoutRooms, paintOrder, placeMovers } from "../src/layout";
import { cursorAtBeat, pictureAt, type Picture } from "../src/picture";
import { routeConnections } from "../src/routing";
import type { Diagram } from "../src/model";

const parse = (yaml: string) => parseDiagram({ "mogram.yaml": yaml });
const diagramOf = (yaml: string): Diagram => {
  const result = parse(yaml);
  expect(result.diagnostics).toEqual([]);
  return result.diagram;
};
const messages = (yaml: string) => parse(yaml).diagnostics.map((d) => d.message);

/** A queue hands messages to a worker; a label rides on the message. */
const QUEUE = `containers:
  queue: { label: Queue, layout: row }
  done: { label: Done, layout: column, gap: none }
shapes:
  worker: { label: Worker }
  m1: { shape: rounded, label: "1", in: queue }
  m2: { like: m1, label: "2", in: queue }
  m3: { like: m1, label: "3", in: queue, show: hidden }
  tag: { label: mine, on: m1, show: hidden }
connections:
  feed: { from: queue, to: worker }
stories:
  main:
    - say: The worker takes the first message.
      set: { m1: { on: worker }, tag: shown }
    - say: It's done, and a third arrives.
      set: { m1: { in: done }, m3: shown }
    - say: The worker takes the second.
      set: { m2: { on: worker } }
layout:
  queue: [0, 10]
  worker: [40, 10]
  done: [70, 6]
  m1: { size: [4, 3] }
  tag: { size: [5, 2] }
  decorations:
    note: { label: next, on: m2 }
`;

const at = (diagram: Diagram, beats: number): Picture =>
  pictureAt(diagram, { scene: null, story: cursorAtBeat(diagram, "main", beats) });

/** The layout at a picture, as the renderer settles it. */
const layoutAt = (diagram: Diagram, picture: Picture) =>
  placeMovers(computeLayout(diagram), diagram, picture.whole, {
    absent: new Set([...picture.presence].filter(([, p]) => p === "hidden").map(([n]) => n)),
  });

describe("reading layouts, riders and copies", () => {
  it("reads a container's layout, gap and columns", () => {
    const diagram = diagramOf(`containers:
  queue: { layout: row }
  stack: { layout: column, gap: none }
  crowd: { layout: grid, columns: 4, gap: 1 }
  plain: {}
`);
    expect(diagram.containers.get("queue")?.layout).toEqual({ kind: "row", gap: 2, columns: null });
    expect(diagram.containers.get("stack")?.layout).toEqual({
      kind: "column",
      gap: 0,
      columns: null,
    });
    expect(diagram.containers.get("crowd")?.layout).toEqual({ kind: "grid", gap: 1, columns: 4 });
    expect(diagram.containers.get("plain")?.layout).toBeNull();
  });

  it("copies what an element is and how it looks with like, and nothing else", () => {
    const diagram = diagramOf(`shapes:
  first: { shape: rounded, label: A, tone: blue, state: down, mark: check, data: { n: 1 } }
  second: { like: first, label: B }
  third: { like: second }
components:
  web: generic/service
  api: { like: web, label: API }
`);
    const second = diagram.components.get("second");
    expect(second).toMatchObject({
      shape: "rounded",
      label: "B",
      like: "first",
      state: "healthy",
      mark: null,
    });
    expect(second?.look?.tone).toBe("blue");
    expect(second?.data.get("n")).toBe(1);
    // A copy of a copy takes what that one took, and its own label.
    expect(diagram.components.get("third")).toMatchObject({ shape: "rounded", label: "B" });
    expect(diagram.components.get("api")).toMatchObject({ type: "generic/service", label: "API" });
  });

  it("says what's wrong with a copy, a rider, a cell and a place", () => {
    expect(
      messages(`containers:
  box: {}
  grid: { layout: grid }
  row: { layout: row, columns: 3 }
components:
  web: generic/service
  free: generic/service
  lost: { type: generic/service, cell: [0, 0] }
shapes:
  a: { like: web }
  b: { like: nobody }
  c: { like: c }
  rider: { on: ghost }
  token: { in: row }
  pill: { in: grid, cell: [1, 2] }
scenes:
  odd:
    free: { on: web }
    token: { in: box }
    pill: { on: token, cell: [0, 0] }
`),
    ).toEqual([
      `"columns" is for a grid, so it is ignored on "row".`,
      `"lost" has a cell, which is for something in a grid (a container with "layout: grid"), so it is ignored.`,
      `"a" is like "web", but one is under shapes: and the other under components:. A copy is the same kind of thing.`,
      `"b" is like "nobody", but there is no such element under shapes:.`,
      `"c" can't be a copy of itself.`,
      `"rider" rides on "ghost", but there is no such element.`,
      `In scene "odd", "free" is given a place, but it's placed freely on the canvas, so it stays where it is. Only something in a container with a layout, or riding on something ("on:"), can move.`,
      `In scene "odd", "token" goes in "box", which doesn't arrange what's in it. Give it "layout: row", "column" or "grid".`,
    ]);
  });

  it("lets text ride on something without a position of its own", () => {
    const diagram = diagramOf(QUEUE);
    expect(diagram.decorations.get("note")).toMatchObject({ on: "m2", variant: "label" });
    expect(messages(`layout:\n  decorations:\n    lost: { label: nowhere }\n`)).toEqual([
      `Decoration "lost" needs a position, like "at: [4, 6]", or something to ride on, like "on: web".`,
    ]);
  });
});

describe("room for what a container holds", () => {
  it("keeps room for the most it ever holds, in any step or scene", () => {
    const diagram = diagramOf(QUEUE);
    const rooms = layoutRooms(diagram);
    // The queue starts with two; a third arrives only after the first has left.
    expect(rooms.get("queue")).toEqual({ columns: 2, rows: 1, cell: { w: 4, h: 3 } });
    // Nothing is done at the start, and one thing is by the end.
    expect(rooms.get("done")).toEqual({ columns: 1, rows: 1, cell: { w: 4, h: 3 } });
  });

  it("sizes a grid from its written cells, its columns, or as a block", () => {
    const diagram = diagramOf(`containers:
  cells: { layout: grid }
  wide: { layout: grid, columns: 3 }
  block: { layout: grid }
shapes:
  a: { in: cells, cell: [0, 0] }
  b: { in: cells, cell: [3, 1] }
  ${[1, 2, 3, 4, 5].map((n) => `w${n}: { in: wide }`).join("\n  ")}
  ${[1, 2, 3, 4, 5].map((n) => `k${n}: { in: block }`).join("\n  ")}
`);
    const rooms = layoutRooms(diagram);
    expect(rooms.get("cells")).toMatchObject({ columns: 4, rows: 2 });
    expect(rooms.get("wide")).toMatchObject({ columns: 3, rows: 2 });
    expect(rooms.get("block")).toMatchObject({ columns: 3, rows: 2 });
  });

  it("never resizes the container or moves anything placed freely", () => {
    const diagram = diagramOf(QUEUE);
    const opening = layoutAt(diagram, at(diagram, 0));
    const later = layoutAt(diagram, at(diagram, 2));
    for (const name of ["queue", "done", "worker"])
      expect(later.elements.get(name)?.box).toEqual(opening.elements.get(name)?.box);
    // Two cells of 4 units and a gap of 2, inside a margin of 2 each side: 14 units wide.
    expect(opening.elements.get("queue")?.size).toEqual({ w: 14, h: 10 });
  });
});

describe("placing what a layout places", () => {
  it("fills a row in file order and closes up when something leaves", () => {
    const diagram = diagramOf(QUEUE);
    const opening = layoutAt(diagram, at(diagram, 0));
    const queue = opening.elements.get("queue")?.box ?? { x: 0, y: 0, w: 0, h: 0 };
    const x = (layout: typeof opening, name: string) =>
      (layout.elements.get(name)?.box.x ?? 0) - queue.x;
    expect([x(opening, "m1"), x(opening, "m2")]).toEqual([16, 64]);
    // The first has gone to the worker: the second closes up into its slot.
    const one = layoutAt(diagram, at(diagram, 1));
    expect(x(one, "m2")).toBe(16);
    // A third arrives behind it.
    const two = layoutAt(diagram, at(diagram, 2));
    expect([x(two, "m2"), x(two, "m3")]).toEqual([16, 64]);
    expect(two.elements.get("m1")?.parent).toBe("done");
  });

  it("puts a rider above what it rides on, and a rider on a rider above that", () => {
    const diagram = diagramOf(QUEUE);
    const one = layoutAt(diagram, at(diagram, 1));
    const worker = one.elements.get("worker")?.box;
    const m1 = one.elements.get("m1")?.box;
    const tag = one.elements.get("tag")?.box;
    if (worker === undefined || m1 === undefined || tag === undefined)
      throw new Error("not placed");
    expect(m1.y + m1.h).toBe(worker.y - 6);
    expect(m1.x + m1.w / 2).toBe(worker.x + worker.w / 2);
    expect(tag.y + tag.h).toBe(m1.y - 6);
    // Text rides too: the label on the second message.
    const note = one.elements.get("note");
    const m2 = one.elements.get("m2")?.box;
    expect(note?.kind).toBe("decoration");
    expect((note?.box.y ?? 0) + (note?.box.h ?? 0)).toBe((m2?.y ?? 0) - 6);
  });

  it("puts a grid's children in their cells, and the rest in the next free ones", () => {
    const diagram = diagramOf(`containers:
  grid: { layout: grid, columns: 3, gap: 1 }
shapes:
  a: { in: grid }
  b: { in: grid, cell: [0, 0] }
  c: { in: grid }
layout:
  a: { size: [4, 4] }
  b: { size: [4, 4] }
  c: { size: [4, 4] }
`);
    const layout = computeLayout(diagram);
    const grid = layout.elements.get("grid")?.box ?? { x: 0, y: 0, w: 0, h: 0 };
    const cell = (name: string) => {
      const box = layout.elements.get(name)?.box ?? grid;
      return [(box.x - grid.x - 16) / 40, (box.y - grid.y - 40) / 40];
    };
    expect(cell("b")).toEqual([0, 0]);
    expect(cell("a")).toEqual([1, 0]);
    expect(cell("c")).toEqual([2, 0]);
  });

  it("puts something riding on an arrow on its line", () => {
    const diagram = diagramOf(`components:
  a: generic/service
  b: generic/service
shapes:
  breaker: { label: Closed, on: link, along: 25% }
connections:
  link: { from: a, to: b, route: straight }
layout:
  a: [0, 0]
  b: [40, 0]
  breaker: { size: [6, 3] }
`);
    const base = computeLayout(diagram);
    // Without routes it's left unplaced; with them it sits a quarter of the way along.
    expect(base.elements.has("breaker")).toBe(false);
    const routes = routeConnections(diagram, base);
    const path = routes.get("link");
    const layout = placeMovers(base, diagram, diagram, {
      pointOn: (name, along) => {
        const samples = name === "link" ? (path?.samples ?? []) : [];
        const from = samples[0];
        const to = samples.at(-1);
        return from === undefined || to === undefined
          ? null
          : { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
      },
    });
    const box = layout.elements.get("breaker")?.box;
    const from = path?.samples[0];
    const to = path?.samples.at(-1);
    if (box === undefined || from === undefined || to === undefined) throw new Error("not placed");
    expect(box.x + box.w / 2).toBeCloseTo(from.x + (to.x - from.x) * 0.25);
    expect(box.y + box.h / 2).toBeCloseTo(from.y);
  });

  it("draws what a layout places over everything else, and routes never go round it", () => {
    const diagram = diagramOf(QUEUE);
    const layout = computeLayout(diagram);
    const order = paintOrder(diagram, layout).map((entry) => `${entry.kind}:${entry.name}`);
    expect(order.slice(-5)).toEqual([
      "component:m1",
      "component:m2",
      "component:m3",
      "component:tag",
      "text:note",
    ]);
    expect(order.indexOf("component:worker")).toBeLessThan(order.indexOf("component:m1"));
    expect(layout.movers).toEqual(["m1", "m2", "m3", "tag", "note"]);
  });

  it("hides a rider with what it rides on, and lets go when it goes into a container", () => {
    const diagram = diagramOf(`containers:
  bin: { layout: row }
shapes:
  host: { show: hidden }
  rider: { on: host }
  label: { on: rider }
scenes:
  shown:
    host: shown
  moved:
    rider: { in: bin }
`);
    expect(Object.fromEntries(pictureAt(diagram, null).presence)).toEqual({
      host: "hidden",
      rider: "hidden",
      label: "hidden",
    });
    expect(pictureAt(diagram, { scene: "shown", story: null }).presence.size).toBe(0);
    const moved = pictureAt(diagram, { scene: "moved", story: null });
    // Off the hidden host and into the bin: it's there, and so is what rides on it.
    expect(Object.fromEntries(moved.presence)).toEqual({ host: "hidden" });
    expect(moved.diagram.components.get("rider")).toMatchObject({ parent: "bin", on: null });
  });
});

describe("writing where something goes", () => {
  const open = (yaml: string) => {
    const files = { "mogram.yaml": yaml };
    return { files, diagram: diagramOf(yaml) };
  };

  it("writes a move into a step, and takes it out when it says nothing", async () => {
    const { setSceneEntry } = await import("../src/edit");
    const { describeChange } = await import("../src/picture");
    const { files, diagram } = open(QUEUE);
    const step = { story: "main", index: 2 };
    const moved = setSceneEntry(files, diagram, {
      scene: step,
      target: "m3",
      value: { place: { in: "done" } },
    });
    const text = moved.files["mogram.yaml"] ?? "";
    expect(text).toContain(`      set:\n        m2: { on: worker }\n        m3: { in: done }\n`);
    const again = open(text);
    const line = again.diagram.stories[0]?.steps[2]?.entries.find((e) => e.target === "m3");
    expect(line === undefined ? [] : describeChange(again.diagram, line)).toEqual([
      "moves 3 into Done",
    ]);
    // Where it already is says nothing: the line goes.
    const back = setSceneEntry(again.files, again.diagram, {
      scene: step,
      target: "m3",
      value: { place: { in: "queue" } },
    });
    const after = open(back.files["mogram.yaml"] ?? "").diagram;
    expect(after.stories[0]?.steps[2]?.entries.map((e) => e.target)).toEqual(["m2"]);
  });
});
