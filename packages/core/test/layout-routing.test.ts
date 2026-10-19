import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { computeLayout, intersects, type Box, type Point } from "../src/layout";
import {
  labelPosition,
  polylinePath,
  RouteCache,
  routeConnections,
  routeOrthogonal,
  spreadOffsets,
} from "../src/routing";

const diagramOf = (yaml: string) => parseDiagram({ "mogram.yaml": yaml }).diagram;

describe("computeLayout", () => {
  it("places text paragraphs in an arranging column without explicit positions", () => {
    const result = parseDiagram({
      "mogram.yaml": `containers:\n  list: { layout: column, gap: 2 }\nlayout:\n  list: [0, 0]\n  decorations:\n    first: { text: alpha bravo charlie delta echo foxtrot, width: 12, in: list }\n    second: { text: golf hotel india juliet kilo lima, width: 12, in: list }\n`,
    });
    expect(result.diagnostics).toEqual([]);
    const layout = computeLayout(result.diagram);
    const first = layout.elements.get("first")!.box;
    const second = layout.elements.get("second")!.box;
    expect(first.x).toBe(second.x);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h + 16);
    expect(layout.movers).toEqual(["first", "second"]);
    expect(layout.children.get("list") ?? []).toEqual([]);
  });

  it("wraps a fixed-width paragraph while preserving unbounded text", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel";
    const read = (width: string) =>
      parseDiagram({
        "mogram.yaml": `layout:\n  decorations:\n    paragraph: { text: ${text}, at: [0, 0]${width} }\n`,
      });
    const wide = read("");
    const narrow = read(", width: 12");
    expect(narrow.diagnostics).toEqual([]);
    expect(narrow.diagram.decorations.get("paragraph")).toMatchObject({ width: 12 });
    const wideBox = computeLayout(wide.diagram).elements.get("paragraph")!.box;
    const narrowBox = computeLayout(narrow.diagram).elements.get("paragraph")!.box;
    expect(narrowBox.w).toBe(96);
    expect(narrowBox.h).toBeGreaterThan(wideBox.h);
    expect(wideBox.w).toBeGreaterThan(narrowBox.w);
    for (const width of [0, -1, 1.5, 10001]) {
      const invalid = read(`, width: ${width}`);
      expect(invalid.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
      expect(invalid.diagram.decorations.get("paragraph")).toMatchObject({ width: null });
    }
  });

  it("stores positions relative to the parent, so moving a VNet moves its children (ED-10)", () => {
    const base = `containers:
  vnet: { type: vnet }
components:
  web_vm: { in: vnet }
layout:
  web_vm: [4, 8]
`;
    const a = computeLayout(diagramOf(`${base}  vnet: [10, 10]\n`));
    const b = computeLayout(diagramOf(`${base}  vnet: [30, 20]\n`));
    const vmA = a.elements.get("web_vm")!.box;
    const vmB = b.elements.get("web_vm")!.box;
    expect(vmA).toMatchObject({ x: (10 + 4) * 8, y: (10 + 8) * 8, w: 96, h: 96 });
    expect(vmB.x - vmA.x).toBe(20 * 8);
    expect(vmB.y - vmA.y).toBe(10 * 8);
    expect(a.elements.get("web_vm")!.rel).toEqual({ x: 4, y: 8 });
  });

  it("sizes containers to their children plus padding (ED-13)", () => {
    const layout = computeLayout(
      diagramOf(`containers:
  box: {}
components:
  a: { in: box }
layout:
  box: [0, 0]
  a: [3, 7]
`),
    );
    const box = layout.elements.get("box")!;
    expect(box.sized).toBe(false);
    expect(box.size).toEqual(
      { w: 3 + 12 + 3, h: 7 + 12 + 3 }.w < 20 ? { w: 20, h: 22 } : { w: 18, h: 22 },
    );
  });

  it("keeps a hand-set size but never shrinks below the content", () => {
    const layout = computeLayout(
      diagramOf(`containers:
  box: {}
components:
  a: { in: box }
layout:
  box: { at: [0, 0], size: [60, 10] }
  a: [3, 7]
`),
    );
    expect(layout.elements.get("box")!.size).toEqual({ w: 60, h: 22 });
    expect(layout.elements.get("box")!.sized).toBe(true);
  });

  it("places unpinned elements along the traffic, sources first (ED-11)", () => {
    const layout = computeLayout(
      diagramOf(`components:
  db: azure/sql-database
  web: generic/server
  user: generic/user
connections:
  user_to_web: { from: user, to: web }
  web_to_db: { from: web, to: db }
`),
    );
    const x = (name: string) => layout.elements.get(name)!.box.x;
    expect(x("user")).toBeLessThan(x("web"));
    expect(x("web")).toBeLessThan(x("db"));
    expect([...layout.elements.values()].every((e) => !e.pinned)).toBe(true);
    for (const element of layout.elements.values()) {
      expect(Number.isInteger(element.rel.x) && Number.isInteger(element.rel.y)).toBe(true);
    }
  });

  it("places unpinned elements below pinned ones so they never overlap", () => {
    const layout = computeLayout(
      diagramOf(`components:
  a: generic/server
  b: generic/server
layout:
  a: [0, 0]
`),
    );
    expect(intersects(layout.elements.get("a")!.box, layout.elements.get("b")!.box)).toBe(false);
  });

  it("draws group outlines around members across containers (ED-15)", () => {
    const layout = computeLayout(
      diagramOf(`containers:
  zone1: { type: availability-zone }
  zone2: { type: availability-zone }
components:
  vm1: { in: zone1 }
  vm2: { in: zone2 }
groups:
  scale_set: { members: [vm1, vm2] }
layout:
  zone1: [0, 0]
  zone2: [30, 0]
`),
    );
    const outline = layout.groups.get("scale_set")!;
    for (const member of ["vm1", "vm2"]) {
      const box = layout.elements.get(member)!.box;
      expect(box.x).toBeGreaterThan(outline.x);
      expect(box.x + box.w).toBeLessThan(outline.x + outline.w);
    }
  });

  it("previews positions and sizes without touching the file", () => {
    const diagram = diagramOf(`containers:
  box: {}
components:
  a: { in: box }
layout:
  box: [0, 0]
  a: [3, 7]
`);
    const preview = computeLayout(diagram, {
      positions: new Map([["a", { x: 10, y: 9 }]]),
      sizes: new Map([["box", { w: 50, h: 40 }]]),
    });
    expect(preview.elements.get("a")!.rel).toEqual({ x: 10, y: 9 });
    expect(preview.elements.get("a")!.pinned).toBe(true);
    expect(preview.elements.get("box")!.size).toEqual({ w: 50, h: 40 });
  });

  it("translates a dragged container together with its contents", () => {
    const diagram = diagramOf(`containers:
  box: {}
components:
  a: { in: box }
`);
    const moved = computeLayout(diagram, {
      translate: { names: new Set(["box"]), dx: 40, dy: 16 },
    });
    const still = computeLayout(diagram);
    expect(moved.elements.get("a")!.box.x - still.elements.get("a")!.box.x).toBe(40);
    expect(moved.tiles.get("a")!.y - still.tiles.get("a")!.y).toBe(16);
  });
});

function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < box.x + box.w && maxX > box.x && minY < box.y + box.h && maxY > box.y;
}

describe("routeOrthogonal", () => {
  it("routes around an obstacle with axis-aligned segments (ED-17)", () => {
    const source = { x: 0, y: 100, w: 56, h: 56 };
    const target = { x: 400, y: 100, w: 56, h: 56 };
    const obstacle = { x: 180, y: 60, w: 96, h: 140 };
    const points = routeOrthogonal({ source, target, obstacles: [obstacle] });
    expect(points.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
      expect(segmentHitsBox(a, b, obstacle)).toBe(false);
    }
    expect(points[0]).toEqual({ x: 56, y: 128 });
    expect(points[points.length - 1]).toEqual({ x: 400, y: 128 });
  });

  it("goes straight when nothing is in the way", () => {
    const points = routeOrthogonal({
      source: { x: 0, y: 0, w: 56, h: 56 },
      target: { x: 300, y: 0, w: 56, h: 56 },
      obstacles: [],
    });
    expect(points).toEqual([
      { x: 56, y: 28 },
      { x: 300, y: 28 },
    ]);
  });
});

describe("routeConnections", () => {
  it("avoids unrelated components but not the ends' own containers", () => {
    const diagram = diagramOf(`containers:
  left: {}
  right: {}
components:
  a: { in: left }
  blocker: generic/server
  b: { in: right }
connections:
  a_to_b: { from: a, to: b, flow: traffic }
layout:
  left: [0, 0]
  blocker: [30, 2]
  right: [50, 0]
  a: [3, 7]
  b: [3, 7]
`);
    const layout = computeLayout(diagram);
    const route = routeConnections(diagram, layout).get("a_to_b")!;
    const blocker = layout.elements.get("blocker")!.box;
    for (let i = 1; i < route.points.length; i++) {
      expect(segmentHitsBox(route.points[i - 1]!, route.points[i]!, blocker)).toBe(false);
    }
    expect(route.length).toBeGreaterThan(0);
    expect(route.d.startsWith("M")).toBe(true);
  });

  it("follows hand-bent waypoints relative to the shared container (ED-18)", () => {
    const diagram = diagramOf(`containers:
  box: {}
components:
  a: { in: box }
  b: { in: box }
connections:
  c: { from: a, to: b }
layout:
  box: [10, 10]
  a: [3, 7]
  b: [40, 7]
  c: { via: [[26, 30]] }
`);
    const layout = computeLayout(diagram);
    const route = routeConnections(diagram, layout).get("c")!;
    const via = { x: (10 + 26) * 8, y: (10 + 30) * 8 };
    const onPath = route.points.some((p, i) => {
      const q = route.points[i + 1];
      if (q === undefined) return false;
      const withinX = via.x >= Math.min(p.x, q.x) && via.x <= Math.max(p.x, q.x);
      const withinY = via.y >= Math.min(p.y, q.y) && via.y <= Math.max(p.y, q.y);
      return withinX && withinY && (p.x === q.x || p.y === q.y);
    });
    expect(onPath).toBe(true);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1]!;
      const b = route.points[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  it("supports curved and straight styles", () => {
    const diagram = diagramOf(`components:
  a: generic/server
  b: generic/server
connections:
  curve: { from: a, to: b, route: curved }
  line: { from: a, to: b, route: straight }
`);
    const routes = routeConnections(diagram, computeLayout(diagram));
    expect(routes.get("curve")!.kind).toBe("curve");
    expect(routes.get("curve")!.samples.length).toBe(49);
    expect(routes.get("line")!.points.length).toBe(2);
  });

  it("routes a 60-element diagram quickly and reuses the cache", () => {
    const lines = ["components:"];
    const layout = ["layout:"];
    const connections = ["connections:"];
    for (let i = 0; i < 60; i++) {
      lines.push(`  n${i}: generic/server`);
      layout.push(`  n${i}: [${(i % 10) * 18}, ${Math.floor(i / 10) * 18}]`);
      if (i > 0) connections.push(`  c${i}: { from: n${i - 1}, to: n${(i * 7) % 60} }`);
    }
    const diagram = diagramOf([...lines, ...connections, ...layout].join("\n"));
    const computed = computeLayout(diagram);
    const cache = new RouteCache();
    const started = performance.now();
    const routes = routeConnections(diagram, computed, { cache });
    const firstPass = performance.now() - started;
    const again = performance.now();
    routeConnections(diagram, computed, { cache });
    const secondPass = performance.now() - again;
    expect(routes.size).toBe(59);
    expect(firstPass).toBeLessThan(3000);
    expect(secondPass).toBeLessThan(firstPass);
  });
});

describe("shared sides", () => {
  it("spreads connections that share a side instead of drawing them on one line, in order", () => {
    const { diagram } = parseDiagram({
      "mogram.yaml": `containers:
  cluster: { type: box }
components:
  upper: generic/server
  lower: generic/cache
connections:
  upper_in: { from: upper, to: cluster }
  lower_in: { from: lower, to: cluster }
layout:
  upper: [0, 4]
  lower: [0, 16]
  cluster: { at: [30, 0], size: [30, 30] }
`,
    });
    const layout = computeLayout(diagram);
    const routes = routeConnections(diagram, layout);
    const upper = routes.get("upper_in")!.points.at(-1)!;
    const lower = routes.get("lower_in")!.points.at(-1)!;
    const frame = layout.elements.get("cluster")!.box;
    // Both enter the left side of the container…
    expect(upper.x).toBe(frame.x);
    expect(lower.x).toBe(frame.x);
    // …at different points, the upper connection at the upper point.
    expect(upper.y).toBeLessThan(lower.y);
  });
});

describe("spreadOffsets", () => {
  it("keeps an already-straight line where it is and moves the others past it", () => {
    expect(spreadOffsets([0, 30], 22)).toEqual([0, 22]);
    expect(spreadOffsets([-40, 0], 22)).toEqual([-22, 0]);
  });

  it("centres lines that all want the middle", () => {
    expect(spreadOffsets([0, 0, 0], 22)).toEqual([-12, 0, 12]);
  });

  it("keeps ends at least the spacing apart and inside the side", () => {
    expect(spreadOffsets([22, 22], 22)).toEqual([10, 22]);
    expect(spreadOffsets([-30, -30, 5], 22)).toEqual([-22, -10, 5]);
  });

  it("falls back to an even spread when the side is too short for the spacing", () => {
    expect(spreadOffsets([0, 0, 0, 0, 0], 12)).toEqual([-12, -6, 0, 6, 12]);
  });
});

describe("labelPosition", () => {
  const path = polylinePath([
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ]);
  const size = { w: 40, h: 20 };

  it("uses the middle when it's clear", () => {
    expect(labelPosition(path, size, [])).toEqual({ x: 100, y: 0 });
  });

  it("slides along the line, nearest the middle, to get off a component's name", () => {
    const name = { x: 70, y: -8, w: 60, h: 16 }; // covers the middle
    const at = labelPosition(path, size, [name]);
    expect(at.y).toBe(0);
    expect(Math.abs(at.x - 100)).toBeGreaterThan(40);
    expect(at.x - size.w / 2 >= name.x + name.w || at.x + size.w / 2 <= name.x).toBe(true);
  });

  it("falls back to the middle when everywhere is covered", () => {
    expect(labelPosition(path, size, [{ x: -50, y: -50, w: 300, h: 100 }])).toEqual({
      x: 100,
      y: 0,
    });
  });
});
