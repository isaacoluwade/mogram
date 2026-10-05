import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import { selectionInfo } from "../commands/selection";
import { QUICK_BAR, QUICK_CONTROLS, barHome, quickBarFor } from "./quick-bar-schema";

const { diagram } = parseDiagram({
  "mogram.yaml": `mogram: 1
name: Bar
containers:
  vnet: vnet
components:
  api: { type: generic/service, in: vnet, opens: ./inner }
  db: generic/database
shapes:
  step: diamond
connections:
  api_to_db: { from: api, to: db }
layout:
  decorations:
    note: { note: Hello, at: [0, 30] }
    zone: { zone: Hot path, at: [0, 40], size: [10, 6] }
`,
  "inner/mogram.yaml": "mogram: 1\nname: Inner\ncomponents:\n  x: generic/service\n",
});

const ids = (names: string[]) =>
  quickBarFor(selectionInfo(diagram, names), diagram).items.map((item) =>
    item === "|" ? "|" : item.id,
  );

describe("the quick bar, declared (04 §16.9)", () => {
  it("names only controls it knows, each with an inspector home", () => {
    for (const bar of Object.values(QUICK_BAR))
      for (const entry of bar) if (entry !== "|") expect(QUICK_CONTROLS[entry]).toBeDefined();
  });

  it("offers what suits each selection", () => {
    expect(ids(["api"])).toEqual(["state", "motion", "color", "open-nested"]);
    expect(ids(["step"])).toEqual(["state", "motion", "tone"]);
    expect(ids(["vnet"])).toEqual(["state", "color"]);
    expect(ids(["api_to_db"])).toEqual([
      "route",
      "|",
      "line",
      "arrow-start",
      "arrow-end",
      "|",
      "flow",
      "color",
    ]);
    expect(ids(["note"])).toEqual([
      "note-fill",
      "|",
      "font",
      "font-size",
      "|",
      "emphasis",
      "align",
      "list",
      "text-color",
    ]);
    expect(ids(["zone"])).toEqual(["decoration-tone"]);
    // A mixed selection: each control edits the part it applies to.
    const mixed = quickBarFor(selectionInfo(diagram, ["api", "vnet", "api_to_db"]), diagram);
    expect(mixed.items).toEqual([
      { id: "state", names: ["api", "vnet"] },
      { id: "motion", names: ["api"] },
      { id: "flow", names: ["api_to_db"] },
    ]);
  });

  it("deep-links to the section of the bar's first control", () => {
    const bar = (names: string[]) => quickBarFor(selectionInfo(diagram, names), diagram).items;
    expect(barHome(bar(["api_to_db"]))).toEqual({ tab: "style", section: "line" });
    expect(barHome(bar(["api"]))).toEqual({ tab: "element", section: "state" });
    expect(barHome(bar(["note"]))).toEqual({ tab: "style", section: "typography" });
  });
});
