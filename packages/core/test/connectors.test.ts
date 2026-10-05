import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { computeLayout } from "../src/layout";
import { routeConnections } from "../src/routing";
import {
  bendingWaypoints,
  crossingsOn,
  jumpedPolyline,
  cornersOf,
  moveSegment,
  nearestAlong,
  pointAlong,
  sameLine,
} from "../src/routing";
import {
  reconnectConnection,
  resetConnectionPath,
  setConnectionRoute,
  reverseConnection,
  setConnectionGeometry,
  setConnectionLook,
} from "../src/edit";
import type { ProjectFiles } from "../src/model";

const BASE = `mogram: 1
name: Wires

components:
  app: generic/service
  db: generic/database
  cache: generic/database

connections:
  app_to_db: { from: app, to: db }
`;

const files = (extra = "", layout = ""): ProjectFiles => ({
  "mogram.yaml": `${BASE}${extra}
layout:
  app: [0, 0]
  db: [30, 0]
  cache: [30, 20]
${layout}`,
});

const parse = (f: ProjectFiles) => parseDiagram(f);
const connection = (f: ProjectFiles, name = "app_to_db") => {
  const found = parse(f).diagram.connections.get(name);
  if (found === undefined) throw new Error(`${name} missing`);
  return found;
};

describe("connection looks (ED-29)", () => {
  it("defaults the arrowheads from the direction, and reads explicit ones", () => {
    expect(connection(files())).toMatchObject({
      arrows: { start: "none", end: "open" },
      hasExplicitArrows: false,
      line: "solid",
      width: 1.5,
      corners: "rounded",
      jumps: "none",
    });
    const both = files(`  both_ways: { from: db, to: cache, direction: both }\n`);
    expect(connection(both, "both_ways").arrows).toEqual({ start: "open", end: "open" });

    const styled = files(
      `  styled:
    from: db
    to: cache
    arrows: { start: diamond-outline, end: block }
    arrow_size: { end: 10 }
    line: dashed
    width: 3
    corners: sharp
    jumps: arc
  short: { from: app, to: cache, arrows: classic, arrow_size: 9, line: "8 4 2 4" }
`,
    );
    const parsed = parse(styled);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.diagram.connections.get("styled")).toMatchObject({
      arrows: { start: "diamond-outline", end: "block" },
      arrowSize: { start: 7, end: 10 },
      line: "dashed",
      dash: null,
      width: 3,
      corners: "sharp",
      jumps: "arc",
    });
    expect(parsed.diagram.connections.get("short")).toMatchObject({
      arrows: { start: "none", end: "classic" },
      arrowSize: { start: 9, end: 9 },
      dash: [8, 4, 2, 4],
    });
  });

  it("explains mistakes", () => {
    const bad = files(
      `  bad: { from: db, to: cache, arrows: { end: arow }, width: 20, line: wavy, corners: soft }\n`,
    );
    const messages = parse(bad).diagnostics.map((d) => d.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`"arow" isn't an arrowhead for the end of "bad".`),
        expect.stringContaining(`The width of "bad" should be a number from 0.5 to 8`),
        expect.stringContaining(`The line of "bad" should be one of`),
        expect.stringContaining(`isn't a corners preset for "bad"`),
      ]),
    );
  });

  it("writes only what differs from the defaults", () => {
    const f = files();
    const styled = setConnectionLook(f, parse(f).diagram, {
      names: ["app_to_db"],
      look: { arrows: { end: "block" }, arrowSize: { end: 10 }, line: "dotted", width: 2.5 },
    });
    const yaml = styled.files["mogram.yaml"] ?? "";
    expect(yaml).toContain(
      "app_to_db: { from: app, to: db, arrows: block, arrow_size: { start: 7, end: 10 }, line: dotted, width: 2.5 }",
    );

    const both = setConnectionLook(styled.files, parse(styled.files).diagram, {
      names: ["app_to_db"],
      look: { arrows: { start: "oval" } },
    });
    expect(both.files["mogram.yaml"]).toContain("arrows: { start: oval, end: block }");

    const reset = setConnectionLook(both.files, parse(both.files).diagram, {
      names: ["app_to_db"],
      look: {
        arrows: { start: "none", end: "open" },
        arrowSize: { start: 7, end: 7 },
        line: "solid",
        width: 1.5,
      },
    });
    expect(reset.files["mogram.yaml"]).toContain("app_to_db: { from: app, to: db }");
  });
});

describe("connection geometry (ED-29)", () => {
  it("routes straight and curved lines through waypoints, and from fixed anchors", () => {
    const f = files(
      `  bent: { from: app, to: cache, route: straight }\n  swoop: { from: app, to: cache, route: curved }\n`,
      `  bent: { via: [[10, 20]], from_anchor: bottom }\n  swoop: { via: [[12, 8]], to_anchor: left }\n`,
    );
    const parsed = parse(f);
    expect(parsed.diagnostics).toEqual([]);
    const layout = computeLayout(parsed.diagram);
    const routes = routeConnections(parsed.diagram, layout);
    const bent = routes.get("bent");
    const appBox = layout.tiles.get("app");
    if (bent === undefined || appBox === undefined) throw new Error("not routed");
    // Starts at the bottom middle of app, passes through the waypoint at (80, 160).
    expect(bent.through[0]).toEqual({ x: appBox.x + appBox.w / 2, y: appBox.y + appBox.h });
    expect(bent.through[1]).toEqual({ x: 80, y: 160 });
    const swoop = routes.get("swoop");
    if (swoop === undefined) throw new Error("not routed");
    expect(swoop.kind).toBe("curve");
    expect(swoop.through).toContainEqual({ x: 96, y: 64 });
    const cacheBox = layout.tiles.get("cache");
    expect(swoop.through.at(-1)).toEqual({
      x: cacheBox?.x,
      y: (cacheBox?.y ?? 0) + (cacheBox?.h ?? 0) / 2,
    });
  });

  it("writes anchors by name or as fractions, and the label place", () => {
    const f = files();
    const placed = setConnectionGeometry(f, parse(f).diagram, {
      name: "app_to_db",
      fromAnchor: { x: 1, y: 0.5 },
      toAnchor: { x: 0, y: 0.25 },
      label: { at: 0.3, offset: -1.5 },
    });
    const yaml = placed.files["mogram.yaml"] ?? "";
    expect(yaml).toContain(
      "app_to_db: { from_anchor: right, to_anchor: [0, 0.25], label: { at: 0.3, offset: -1.5 } }",
    );
    const layout = parse(placed.files).diagram.layout.get("app_to_db");
    expect(layout).toMatchObject({
      fromAnchor: { x: 1, y: 0.5 },
      toAnchor: { x: 0, y: 0.25 },
      label: { at: 0.3, offset: -1.5 },
    });
    const cleared = setConnectionGeometry(placed.files, parse(placed.files).diagram, {
      name: "app_to_db",
      fromAnchor: null,
      toAnchor: null,
      label: null,
    });
    expect((cleared.files["mogram.yaml"] ?? "").split("layout:")[1]).not.toContain("app_to_db");
  });

  it("reconnects an end, or a copy of the connection, keeping waypoints", () => {
    const f = files("", "  app_to_db: { via: [[15, 4]] }\n");
    const moved = reconnectConnection(f, parse(f).diagram, {
      name: "app_to_db",
      end: "to",
      endpoint: "cache",
      anchor: { x: 0, y: 0.5 },
    });
    const after = parse(moved.files).diagram;
    expect(after.connections.get("app_to_db")?.to.element).toBe("cache");
    expect(after.layout.get("app_to_db")).toMatchObject({
      via: [{ x: 15, y: 4 }],
      toAnchor: { x: 0, y: 0.5 },
    });

    const copied = reconnectConnection(f, parse(f).diagram, {
      name: "app_to_db",
      end: "to",
      endpoint: "cache",
      anchor: null,
      copy: true,
    });
    const both = parse(copied.files).diagram;
    expect(copied.select).toEqual(["app_to_cache"]);
    expect(both.connections.get("app_to_db")?.to.element).toBe("db");
    expect(both.connections.get("app_to_cache")?.to.element).toBe("cache");
    expect(() =>
      reconnectConnection(f, parse(f).diagram, {
        name: "app_to_db",
        end: "to",
        endpoint: "app",
        anchor: null,
      }),
    ).toThrow(/two different ends/);
  });

  it("reverses ends, waypoints, anchors and label place", () => {
    const f = files(
      "",
      "  app_to_db: { via: [[10, 2], [20, 2]], from_anchor: right, label: { at: 0.25, offset: 1 } }\n",
    );
    const reversed = reverseConnection(f, parse(f).diagram, { names: ["app_to_db"] });
    const after = parse(reversed.files).diagram;
    expect(after.connections.get("app_to_db")).toMatchObject({
      from: { element: "db" },
      to: { element: "app" },
    });
    expect(after.layout.get("app_to_db")).toMatchObject({
      via: [
        { x: 20, y: 2 },
        { x: 10, y: 2 },
      ],
      fromAnchor: null,
      toAnchor: { x: 1, y: 0.5 },
      label: { at: 0.75, offset: -1 },
    });
  });
});

describe("path editing geometry", () => {
  it("drops waypoints that no longer bend the line", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    expect(bendingWaypoints([start, { x: 50, y: 3 }, end])).toEqual([]);
    expect(bendingWaypoints([start, { x: 50, y: 30 }, end])).toEqual([{ x: 50, y: 30 }]);
  });

  it("slides an orthogonal segment sideways and reads corners back", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 40 },
    ];
    // Move the vertical middle segment right by 16.
    expect(moveSegment(route, 1, 16)).toEqual([
      { x: 66, y: 0 },
      { x: 66, y: 40 },
    ]);
    // Moving the first segment moves its corner; the start lines itself up with it.
    expect(moveSegment(route, 0, 8)[0]).toEqual({ x: 50, y: 8 });
    // A single straight segment gets one waypoint in its middle.
    expect(
      moveSegment(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        0,
        16,
      ),
    ).toEqual([{ x: 50, y: 16 }]);
    expect(
      cornersOf([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 10 },
      ]),
    ).toEqual([{ x: 40, y: 0 }]);
    expect(sameLine(route, [...route])).toBe(true);
  });

  it("places a point along the path and finds it again", () => {
    const f = files("", "");
    const parsed = parse(f);
    const route = routeConnections(parsed.diagram, computeLayout(parsed.diagram)).get("app_to_db");
    if (route === undefined) throw new Error("not routed");
    const placed = pointAlong(route, 0.25, 12);
    const found = nearestAlong(route, placed.point);
    expect(found.at).toBeCloseTo(0.25, 1);
    expect(found.offset).toBeCloseTo(12, 0);
  });
});

describe("route style and reset", () => {
  it("switching route clears waypoints; reset clears anchors too", () => {
    const f = files("", "  app_to_db: { via: [[10, 4]], from_anchor: right, label: 0.3 }\n");
    const curved = setConnectionRoute(f, parse(f).diagram, {
      names: ["app_to_db"],
      route: "curved",
    });
    const after = parse(curved.files).diagram;
    expect(after.connections.get("app_to_db")?.route).toBe("curved");
    expect(after.layout.get("app_to_db")).toMatchObject({ via: null, label: { at: 0.3 } });
    const reset = resetConnectionPath(curved.files, after, { names: ["app_to_db"], anchors: true });
    expect(parse(reset.files).diagram.layout.get("app_to_db")).toMatchObject({
      fromAnchor: null,
      toAnchor: null,
    });
  });
});

describe("line jumps", () => {
  it("finds crossings clear of the ends and draws arcs or gaps over them", () => {
    const line = [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ];
    const other = [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const crossings = crossingsOn(line, [other], 10);
    expect(crossings).toEqual([[100]]);
    expect(jumpedPolyline(line, 10, crossings, "arc")).toBe(
      "M0 50 L94 50 A6 6 0 0 1 106 50 L200 50",
    );
    expect(jumpedPolyline(line, 10, crossings, "gap")).toBe("M0 50 L94 50 M106 50 L200 50");
    // A crossing right at the end leaves the line alone.
    expect(
      crossingsOn(
        line,
        [
          [
            { x: 195, y: 0 },
            { x: 195, y: 100 },
          ],
        ],
        10,
      ),
    ).toEqual([[]]);
  });
});
