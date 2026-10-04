import { describe, expect, it } from "vitest";
import {
  autoSize,
  deleteTour,
  isMogramSnippet,
  updateTour,
  updateTourStep,
  writeProjectFile,
} from "../src/edit";
import { parseDiagram } from "../src/format";
import { contains, inflate, union } from "../src/layout";
import {
  basename,
  dirname,
  displayNameForPath,
  isMogramFile,
  joinPath,
  normalizePath,
  resolveFromFolder,
  staysInsideRoot,
  type ProjectFiles,
} from "../src/model";
import {
  curvePath,
  midpointOf,
  pointAtLength,
  polylinePath,
  reversePath,
  simplify,
} from "../src/routing";
import { formatColor, parseColor, withAlpha } from "../src/timeline";
import { exitsOf, stepFor, tourStart } from "../src/tours";

const project = (text: string) => {
  const files: ProjectFiles = { "mogram.yaml": text };
  return { files, diagram: parseDiagram(files).diagram };
};

describe("project paths (AC-7)", () => {
  it("never lets a path climb out of the project", () => {
    expect(staysInsideRoot("docs/a.md")).toBe(true);
    expect(staysInsideRoot("aks/../docs/a.md")).toBe(true);
    expect(staysInsideRoot("../secrets")).toBe(false);
    expect(staysInsideRoot("aks/../../etc/passwd")).toBe(false);
    expect(resolveFromFolder("aks", "../docs/a.md")).toBe("docs/a.md");
    expect(resolveFromFolder("", "../a.md")).toBeNull();
  });

  it("normalises, joins and splits paths", () => {
    expect(normalizePath("./aks//api/../web")).toBe("aks/web");
    expect(joinPath("aks", "", "docs", "x.md")).toBe("aks/docs/x.md");
    expect(dirname("aks/docs/x.md")).toBe("aks/docs");
    expect(dirname("x.md")).toBe("");
    expect(basename("aks/docs/x.md")).toBe("x.md");
  });

  it("recognises Mogram files and names them for display", () => {
    expect(isMogramFile("mogram.yaml")).toBe(true);
    expect(isMogramFile("aks/network.mogram.yaml")).toBe(true);
    expect(isMogramFile("legacy.mogram")).toBe(true);
    expect(isMogramFile("docs/readme.md")).toBe(false);
    expect(displayNameForPath("aks/network.mogram.yaml")).toBe("network");
  });
});

describe("routed paths", () => {
  const path = polylinePath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);

  it("finds points by distance along the drawn shape", () => {
    expect(pointAtLength(path.samples, 0).point).toEqual({ x: 0, y: 0 });
    const end = pointAtLength(path.samples, path.length).point;
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(100);
    expect(midpointOf(path).point.x).toBeGreaterThan(50);
  });

  it("reverses, and drops points that don't turn", () => {
    const reversed = reversePath(path);
    expect(reversed.points[0]).toEqual({ x: 100, y: 100 });
    expect(reversed.length).toBeCloseTo(path.length);
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 40 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
    ]);
  });

  it("samples curves from end to end", () => {
    const curve = curvePath({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 });
    expect(curve.samples[0]).toEqual({ x: 0, y: 0 });
    expect(curve.samples.at(-1)).toEqual({ x: 100, y: 100 });
    expect(curve.length).toBeGreaterThan(Math.hypot(100, 100));
  });
});

describe("geometry and colour", () => {
  it("combines and tests boxes", () => {
    expect(
      union([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 20, y: 5, w: 10, h: 10 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 30, h: 15 });
    expect(union([])).toBeNull();
    expect(inflate({ x: 10, y: 10, w: 10, h: 10 }, 5)).toEqual({ x: 5, y: 5, w: 20, h: 20 });
    expect(contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10 })).toBe(true);
    expect(contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 5 })).toBe(false);
  });

  it("reads and writes colours", () => {
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseColor("#0a0a0a")).toEqual({ r: 10, g: 10, b: 10, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor("hotpink")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(formatColor({ r: 300, g: -5, b: 10.4, a: 2 })).toBe("rgba(255,0,10,1)");
    expect(withAlpha("#ffffff", 0.25)).toBe("rgba(255,255,255,0.25)");
  });
});

const TOURED = `components:
  web: generic/server
  db: generic/database
  cache: generic/database
scenes:
  outage:
    db: down
tours:
  flow:
    title: How it flows
    steps:
      web:
        next: db
`;

describe("tour graphs and edits (TO-6, TO-9)", () => {
  it("starts at the first step, treats unlisted targets as final steps, and lists exits", () => {
    const tour = project(TOURED).diagram.tours[0];
    if (tour === undefined) throw new Error("no tour");
    expect(tourStart(tour)).toBe("web");
    expect(stepFor(tour, "db")).toMatchObject({ target: "db", next: null, choices: [] });
    expect(exitsOf(stepFor(tour, "web"))).toEqual([{ label: "Next", next: "db", scene: null }]);
    expect(exitsOf(stepFor(tour, "db"))).toEqual([]);
  });

  it("renames and retitles a tour, edits a step, and deletes the tour", () => {
    let { files, diagram } = project(TOURED);
    const renamed = updateTour(files, diagram, {
      tour: "flow",
      rename: "request",
      title: "A request",
    });
    expect(renamed.named).toBe("request");
    ({ files, diagram } = { files: renamed.files, diagram: parseDiagram(renamed.files).diagram });
    expect(diagram.tours[0]).toMatchObject({ name: "request", title: "A request" });

    const stepped = updateTourStep(files, diagram, {
      tour: "request",
      step: "db",
      set: { next: "cache", scene: "outage" },
    });
    const step = parseDiagram(stepped.files).diagram.tours[0]?.steps.get("db");
    expect(step).toMatchObject({ next: "cache", scene: "outage" });

    const gone = deleteTour(stepped.files, parseDiagram(stepped.files).diagram, "request");
    expect(parseDiagram(gone.files).diagram.tours).toEqual([]);
  });

  it("refuses to rename a tour onto another tour's name", () => {
    const text = TOURED + "  other:\n    steps:\n      web:\n";
    const { files, diagram } = project(text);
    expect(() => updateTour(files, diagram, { tour: "flow", rename: "other" })).toThrow(
      "already a tour",
    );
  });
});

describe("files and sizes", () => {
  it("lets a hand-sized container fit its contents again", () => {
    const { files, diagram } = project(
      "containers:\n  box: region\ncomponents:\n  web: { type: generic/server, in: box }\nlayout:\n  box: { at: [0, 0], size: [80, 40] }\n",
    );
    const fitted = autoSize(files, diagram, "box");
    expect(parseDiagram(fitted.files).diagram.layout.get("box")?.size ?? null).toBeNull();
  });

  it("writes and removes project files", () => {
    const { files, diagram } = project("components:\n  web: generic/server\n");
    const written = writeProjectFile(files, diagram, { path: "docs/web.md", content: "# Web\n" });
    expect(written.files["docs/web.md"]).toBe("# Web\n");
    const removed = writeProjectFile(written.files, parseDiagram(written.files).diagram, {
      path: "docs/web.md",
      content: null,
    });
    expect(removed.files["docs/web.md"]).toBeUndefined();
  });

  it("recognises copied Mogram snippets on the clipboard", () => {
    expect(isMogramSnippet("mogram: clipboard\ncomponents:\n  a: generic/server\n")).toBe(true);
    expect(isMogramSnippet("just some text")).toBe(false);
  });
});
