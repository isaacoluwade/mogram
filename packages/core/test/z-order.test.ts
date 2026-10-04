import { describe, expect, it } from "vitest";
import { planZOrder, reorderZ, type ZOrderMove } from "../src/edit";
import { parseDiagram } from "../src/format";
import { computeLayout, paintOrder } from "../src/layout";
import type { Diagram, ProjectFiles } from "../src/model";

const parse = (text: string) => parseDiagram({ "mogram.yaml": text }).diagram;

/** Back-to-front order of the components drawn (what the person sees). */
function painted(diagram: Diagram, kind = "component"): string[] {
  return paintOrder(diagram, computeLayout(diagram))
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.name);
}

function apply(files: ProjectFiles, names: string[], move: ZOrderMove): ProjectFiles {
  const diagram = parseDiagram(files).diagram;
  return reorderZ(files, diagram, { names, move }).files;
}

const SIBLINGS = "components:\n  a: generic/server\n  b: generic/server\n  c: generic/server\n";

describe("z-order (ED-23)", () => {
  it("moves forward and backward exactly one step", () => {
    let files: ProjectFiles = { "mogram.yaml": SIBLINGS };
    files = apply(files, ["a"], "forward");
    expect(painted(parseDiagram(files).diagram)).toEqual(["b", "a", "c"]);
    files = apply(files, ["a"], "forward");
    expect(painted(parseDiagram(files).diagram)).toEqual(["b", "c", "a"]);
    files = apply(files, ["a"], "backward");
    expect(painted(parseDiagram(files).diagram)).toEqual(["b", "a", "c"]);
  });

  it("brings an element back up with one press after sending it to the back", () => {
    let files: ProjectFiles = { "mogram.yaml": SIBLINGS };
    files = apply(files, ["b"], "back");
    expect(painted(parseDiagram(files).diagram)).toEqual(["b", "a", "c"]);
    files = apply(files, ["b"], "forward");
    expect(painted(parseDiagram(files).diagram)).toEqual(["a", "b", "c"]);
  });

  it("does nothing when nothing would change", () => {
    const diagram = parse(SIBLINGS);
    expect(planZOrder(diagram, ["c"], "front").size).toBe(0);
    expect(planZOrder(diagram, ["c"], "forward").size).toBe(0);
    expect(planZOrder(diagram, ["a"], "back").size).toBe(0);
    expect(planZOrder(diagram, ["a"], "backward").size).toBe(0);

    let files: ProjectFiles = { "mogram.yaml": SIBLINGS };
    files = apply(files, ["a"], "front");
    const once = files["mogram.yaml"];
    files = apply(files, ["a"], "front");
    expect(files["mogram.yaml"]).toBe(once); // no z: 2, z: 3 … on repeated presses
  });

  it("has nothing to do for an only child, a connection or a group", () => {
    const diagram = parse(
      "containers:\n  box: region\ncomponents:\n  a: { type: generic/server, in: box }\n  b: generic/server\n" +
        "connections:\n  a_to_b: { from: a, to: b }\ngroups:\n  pair: { members: [a, b] }\n",
    );
    for (const move of ["front", "back", "forward", "backward"] as const) {
      expect(planZOrder(diagram, ["a"], move).size).toBe(0);
      expect(planZOrder(diagram, ["a_to_b"], move).size).toBe(0);
      expect(planZOrder(diagram, ["pair"], move).size).toBe(0);
    }
  });

  it("moves a multi-selection together, keeping its own order", () => {
    let files: ProjectFiles = {
      "mogram.yaml": SIBLINGS + "  d: generic/server\n",
    };
    files = apply(files, ["a", "b"], "front");
    expect(painted(parseDiagram(files).diagram)).toEqual(["c", "d", "a", "b"]);
    files = apply(files, ["a", "b"], "backward");
    expect(painted(parseDiagram(files).diagram)).toEqual(["c", "a", "b", "d"]);
  });

  it("always produces the requested order (randomised)", () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const moves = ["front", "back", "forward", "backward"] as const;
    for (let round = 0; round < 60; round++) {
      const count = 2 + Math.floor(random() * 5);
      const names = Array.from({ length: count }, (_, i) => `n${i}`);
      const zs = names.map(() => Math.floor(random() * 5) - 2);
      let text = "components:\n" + names.map((n) => `  ${n}: generic/server\n`).join("");
      text +=
        "layout:\n" + names.map((n, i) => `  ${n}: { at: [${i * 12}, 0], z: ${zs[i]} }\n`).join("");
      let files: ProjectFiles = { "mogram.yaml": text };
      for (let step = 0; step < 5; step++) {
        const before = painted(parseDiagram(files).diagram);
        const picked = names.filter(() => random() < 0.35);
        if (picked.length === 0) continue;
        const move = moves[Math.floor(random() * moves.length)] ?? "front";
        const expected = expectedOrder(before, new Set(picked), move);
        files = apply(files, picked, move);
        expect(painted(parseDiagram(files).diagram)).toEqual(expected);
      }
    }
  });
});

/** The order a move should produce, written independently of the implementation. */
function expectedOrder(order: string[], picked: Set<string>, move: ZOrderMove): string[] {
  const rest = order.filter((n) => !picked.has(n));
  const chosen = order.filter((n) => picked.has(n));
  if (move === "front") return [...rest, ...chosen];
  if (move === "back") return [...chosen, ...rest];
  const list = [...order];
  if (move === "forward") {
    for (let i = list.length - 2; i >= 0; i--)
      if (picked.has(list[i]!) && !picked.has(list[i + 1]!))
        [list[i], list[i + 1]] = [list[i + 1]!, list[i]!];
  } else {
    for (let i = 1; i < list.length; i++)
      if (!picked.has(list[i - 1]!) && picked.has(list[i]!))
        [list[i - 1], list[i]] = [list[i]!, list[i - 1]!];
  }
  return list;
}

describe("paint order", () => {
  const REGIONS = `containers:
  east: region
  west: region
components:
  e1: { type: generic/server, in: east }
  e2: { type: generic/server, in: east }
  w1: { type: generic/server, in: west }
  user: generic/user
connections:
  e1_to_e2: { from: e1, to: e2 }
  user_to_w1: { from: user, to: w1 }
  west_to_w1: { from: west, to: w1 }
`;

  it("draws each container with everything inside it, so a container's z carries its contents", () => {
    const diagram = parse(REGIONS);
    const order = paintOrder(diagram, computeLayout(diagram)).map((e) => e.name);
    expect(order).toEqual([
      "east",
      "e1_to_e2",
      "e1",
      "e2",
      "west",
      "west_to_w1",
      "w1",
      "user_to_w1",
      "user",
    ]);

    const files = apply({ "mogram.yaml": REGIONS }, ["east"], "front");
    const raised = parseDiagram(files).diagram;
    expect(painted(raised)).toEqual(["w1", "e1", "e2", "user"]);
  });
});
