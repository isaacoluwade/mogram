import { describe, expect, it } from "vitest";
import {
  CapacityTimeline,
  isBusy,
  modelsCapacity,
  nextPatternChange,
  patternLevel,
} from "../src/capacity";
import { setFlowValue, setTrafficPattern } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { Diagram, TrafficPattern } from "../src/model";
import { resolveState } from "../src/state";

const WAVES: TrafficPattern = { kind: "waves", high: 5, low: 1, every: 10 };
const BURSTS: TrafficPattern = { kind: "bursts", high: 5, low: 0.5, every: 12 };

const SET = (traffic: string) => `mogram: 1
name: Waves
components:
  users: { type: generic/users }
  web: { type: generic/server, scale: { min: 2, max: 8 } }
connections:
  users_to_web: { from: users, to: web, traffic: ${traffic} }
scenes:
  held:
    users_to_web: 3x
`;

const diagramOf = (yaml: string): Diagram => {
  const { diagram, diagnostics } = parseDiagram({ "mogram.yaml": yaml });
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return diagram;
};

describe("traffic patterns in the format (D-84)", () => {
  it("reads a pattern by name, with its own levels and cycle, or steady", () => {
    expect(diagramOf(SET("waves")).connections.get("users_to_web")?.pattern).toEqual(WAVES);
    expect(diagramOf(SET("bursts")).connections.get("users_to_web")?.pattern).toEqual(BURSTS);
    expect(
      diagramOf(SET("{ pattern: waves, high: 3x, low: 0.5x, every: 8s }")).connections.get(
        "users_to_web",
      )?.pattern,
    ).toEqual({ kind: "waves", high: 3, low: 0.5, every: 8 });
    const steady = diagramOf(SET("{ pattern: steady, level: 2x }")).connections.get("users_to_web");
    expect([steady?.traffic, steady?.pattern]).toEqual([2, null]);
    expect(diagramOf(SET("waves")).connections.get("users_to_web")?.traffic).toBeNull();
    expect(modelsCapacity(diagramOf(SET("waves").replace(", scale: { min: 2, max: 8 }", "")))).toBe(
      true,
    );
  });

  it("says plainly what's wrong, and keeps cycles long enough to see", () => {
    const messages = (traffic: string) =>
      parseDiagram({ "mogram.yaml": SET(traffic) }).diagnostics.map((d) => d.message);
    expect(messages("{ pattern: tides }")[0]).toMatch(/"tides" isn't a traffic pattern/);
    expect(messages("{ pattern: waves, every: 1s }")).toContain(
      'The cycle of the traffic on "users_to_web" is kept between 4s and 120s (so scaling has time to show), so it\'s 4s.',
    );
    expect(messages("{ pattern: waves, high: 1x, low: 4x }")).toContain(
      'The quiet traffic on "users_to_web" (4x) is above its busy traffic (1x), so they\'re swapped.',
    );
  });

  it("writes a pattern by name when it's the usual one, else what differs", () => {
    const files = { "mogram.yaml": SET("2x") };
    const diagram = parseDiagram(files).diagram;
    const waves = setTrafficPattern(files, diagram, { name: "users_to_web", pattern: WAVES });
    expect(waves.files["mogram.yaml"]).toContain(
      "users_to_web: { from: users, to: web, traffic: waves }",
    );
    const custom = setTrafficPattern(files, diagram, {
      name: "users_to_web",
      pattern: { ...BURSTS, high: 8, every: 20 },
    });
    expect(custom.files["mogram.yaml"]).toContain(
      "traffic: { pattern: bursts, high: 8x, every: 20s }",
    );
    expect(
      diagramOf(custom.files["mogram.yaml"] ?? "").connections.get("users_to_web")?.pattern,
    ).toEqual({
      ...BURSTS,
      high: 8,
      every: 20,
    });
    // A steady level replaces the pattern, and clearing leaves it steady at 1x.
    const level = setFlowValue(custom.files, parseDiagram(custom.files).diagram, {
      name: "users_to_web",
      key: "traffic",
      value: 3,
    });
    expect(level.files["mogram.yaml"]).toContain("traffic: 3x }");
    const cleared = setTrafficPattern(waves.files, parseDiagram(waves.files).diagram, {
      name: "users_to_web",
      pattern: null,
    });
    expect(cleared.files["mogram.yaml"]).toContain("users_to_web: { from: users, to: web }");
  });
});

describe("traffic patterns over time", () => {
  it("are quiet first, then busy, and say when they change", () => {
    expect([0, 4.9, 5, 9.9, 10].map((t) => patternLevel(WAVES, t))).toEqual([1, 1, 5, 5, 1]);
    expect([0, 8.9, 9, 11.9, 12].map((t) => isBusy(BURSTS, t))).toEqual([
      false,
      false,
      true,
      true,
      false,
    ]);
    expect([0, 5, 7, 10].map((t) => nextPatternChange(WAVES, t))).toEqual([5, 10, 10, 15]);
    expect(nextPatternChange(BURSTS, 0)).toBe(9);
  });

  it("give the plan when quiet and when busy; a scene's own level holds it steady", () => {
    const diagram = diagramOf(SET("waves"));
    const resolved = resolveState({ diagram });
    const over = resolved.capacityOverTime;
    expect(over?.cycle).toBe(10);
    expect(over?.quiet.elements.get("web")?.copies).toBe(2);
    expect(over?.busy.elements.get("web")?.copies).toBe(8);
    expect(over?.planAt(7).elements.get("web")?.copies).toBe(8);
    expect(resolved.capacity.elements.get("web")?.copies).toBe(2);
    const held = resolveState({
      diagram,
      scene: diagram.scenes.find((s) => s.name === "held")?.entries ?? [],
    });
    expect(held.capacityOverTime).toBeNull();
    expect(held.capacity.elements.get("web")?.copies).toBe(5);
  });

  it("make a scale set grow as traffic rises and shrink as it falls, cycle after cycle", () => {
    const diagram = diagramOf(SET("waves"));
    const resolved = resolveState({ diagram });
    const timeline = new CapacityTimeline(resolved.capacity, diagram, 0, resolved.capacityOverTime);
    expect(timeline.isPatterned).toBe(true);
    expect(timeline.settledAt).toBe(Infinity);
    const serving = (t: number) => timeline.fleet("web", t)?.serving;
    expect(serving(4)).toBe(2);
    expect(serving(9.5)).toBe(8);
    expect(serving(14.5)).toBe(2);
    expect(serving(19.5)).toBe(8);
    expect(serving(24.5)).toBe(2);
  });

  it("show the same thing whenever and however often they're asked", () => {
    const diagram = diagramOf(SET("bursts"));
    const resolved = resolveState({ diagram });
    const make = () =>
      new CapacityTimeline(resolved.capacity, diagram, 0, resolved.capacityOverTime);
    const often = make();
    const seldom = make();
    for (let t = 0; t <= 40; t += 1 / 60) often.fleet("web", t);
    const view = (timeline: CapacityTimeline) =>
      JSON.stringify(timeline.fleet("web", 40.5)?.copies.map((c) => [c.slot, c.serving]));
    expect(view(seldom)).toBe(view(often));
    // Far ahead (a tab left in the background), it picks up where the pattern is.
    const later = make();
    // 2.5 s into a 3 s burst: copies are still starting (2 plus 4 so far).
    expect(later.fleet("web", 1000 * 12 + 11.5)?.serving).toBe(6);
    expect(later.fleet("web", 1000 * 12 + 12 + 8)?.serving).toBe(2);
  });
});
