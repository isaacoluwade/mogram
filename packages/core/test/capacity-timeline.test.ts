import { describe, expect, it } from "vitest";
import { CAPACITY_TIMING as T, CapacityTimeline } from "../src/capacity";
import { parseDiagram } from "../src/format";
import { resolveState } from "../src/state";

const YAML = `mogram: 1
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers }
  web: { type: azure/virtual-machine, scale: { min: 2, max: 8 } }
  db: { type: azure/sql-database, scale: { sizes: [S1, S2, S4] } }
  queue: { type: aws/sqs }
  workers: { type: aws/lambda, scale: { min: 1, max: 2 } }
connections:
  users_to_lb: { from: users, to: lb }
  lb_to_web: { from: lb, to: web }
  web_to_db: { from: web, to: db }
  web_to_queue: { from: web, to: queue }
  queue_to_workers: { from: queue, to: workers }
`;
const diagram = parseDiagram({ "mogram.yaml": YAML }).diagram;
const planAt = (traffic: number) => resolveState({ diagram, traffic }).capacity;

describe("capacity over time", () => {
  it("adds copies after a short wait, one after another, and the load falls as they start", () => {
    const timeline = new CapacityTimeline(planAt(1), diagram, 0);
    expect(timeline.fleet("web", 0)?.serving).toBe(2);
    timeline.update(planAt(5), diagram, 10);
    // Just after the spike, the two running copies take it all: overloaded.
    const early = timeline.fleet("web", 10 + T.traffic);
    expect(early?.serving).toBe(2);
    expect(early?.load).toBeCloseTo(2.5);
    expect(timeline.load("web", 10 + T.traffic)).toBeGreaterThan(1);
    // The first new copy appears after the wait, starts, then takes traffic.
    const booting = timeline.fleet("web", 10 + T.react + 0.1);
    expect(booting?.copies).toHaveLength(3);
    expect(booting?.copies[2]?.serving).toBe(false);
    expect(booting?.copies[2]?.boot).toBeCloseTo(0.1 / T.boot);
    // The next follows a moment later.
    expect(timeline.fleet("web", 10 + T.react + T.stagger + 0.1)?.copies).toHaveLength(4);
    const firstReady = timeline.fleet("web", 10 + T.react + T.boot + 0.01);
    expect(firstReady?.serving).toBe(3);
    // Settled: 8 copies at 5/8 each.
    const done = timeline.fleet("web", timeline.settledAt);
    expect(done?.serving).toBe(8);
    expect(done?.load).toBeCloseTo(5 / 8);
    expect(done?.copies.map((c) => c.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("removes copies after a cool-down: they stop taking traffic first, then leave", () => {
    const timeline = new CapacityTimeline(planAt(5), diagram, 0);
    timeline.update(planAt(1), diagram, 10);
    expect(timeline.fleet("web", 10 + T.cooldown - 0.01)?.serving).toBe(8);
    const draining = timeline.fleet("web", 10 + T.cooldown + 0.1);
    expect(draining?.serving).toBe(7);
    expect(draining?.copies.at(-1)?.leave).toBeGreaterThan(0);
    expect(draining?.copies.at(-1)?.id).toBe(7);
    expect(timeline.fleet("web", timeline.settledAt + 0.01)?.copies).toHaveLength(2);
  });

  it("calls off copies that haven't started when traffic falls again", () => {
    const timeline = new CapacityTimeline(planAt(1), diagram, 0);
    timeline.update(planAt(5), diagram, 10);
    // Only the first new copy has started by the time traffic is back to normal.
    timeline.update(planAt(1), diagram, 10 + T.react + 0.1);
    const after = timeline.fleet("web", 10 + T.react + 0.2);
    expect(after?.copies).toHaveLength(3);
    expect(timeline.fleet("web", timeline.settledAt + 0.01)?.copies).toHaveLength(2);
  });

  it("grows a machine smoothly into a bigger size and back, taking traffic all the while", () => {
    const timeline = new CapacityTimeline(planAt(0.5), diagram, 0);
    expect(timeline.machine("db", 0)).toMatchObject({ from: 0, to: 0, grow: 1 });
    timeline.update(planAt(2.5), diagram, 10);
    const start = 10 + T.resizeReact;
    expect(timeline.machine("db", start - 0.01)).toMatchObject({ from: 0, to: 0 });
    // Half way, it's half grown and still taking traffic: no restart, no pause.
    const half = timeline.machine("db", start + T.grow / 2);
    expect(half).toMatchObject({ from: 0, to: 2 });
    expect(half?.grow).toBeCloseTo(0.5);
    expect(half?.load).toBeGreaterThan(0);
    const grown = timeline.machine("db", start + T.grow);
    expect(grown).toMatchObject({ from: 0, to: 2, grow: 1 });
    expect(grown?.load).toBeCloseTo(2.5 / 4);
    // And back down the same way.
    timeline.update(planAt(0.5), diagram, 20);
    const shrinking = timeline.machine("db", 20 + T.resizeReact + T.grow / 2);
    expect(shrinking).toMatchObject({ from: 2, to: 0 });
    expect(shrinking?.load).toBeGreaterThan(0);
    expect(timeline.machine("db", 20 + T.resizeReact + T.grow)).toMatchObject({ to: 0, grow: 1 });
  });

  it("fills a queue while consumers can't keep up, then drains it", () => {
    const timeline = new CapacityTimeline(planAt(0.5), diagram, 0);
    expect(timeline.backlog("queue", 0)).toBe(0);
    timeline.update(planAt(4), diagram, 10);
    const filling = [11, 12, 13].map((t) => timeline.backlog("queue", t));
    expect(filling[1]).toBeGreaterThan(filling[0] ?? 1);
    expect(filling[2]).toBeGreaterThan(filling[1] ?? 1);
    timeline.update(planAt(0.5), diagram, 13);
    expect(timeline.backlog("queue", 14)).toBeLessThan(filling[2] ?? 0);
    expect(timeline.backlog("queue", 60)).toBe(0);
  });

  it("eases traffic on connections, and is the same every time", () => {
    // Changes and frames in time order, as on a canvas.
    const run = () => {
      const timeline = new CapacityTimeline(planAt(1), diagram, 0);
      const frame = (t: number) => ({
        carried: timeline.carried("users_to_lb", t),
        fleet: timeline.fleet("web", t),
        db: timeline.machine("db", t),
      });
      timeline.update(planAt(4), diagram, 2);
      const frames = [frame(2.2), frame(3)];
      timeline.update(planAt(2), diagram, 3.3);
      return [...frames, frame(3.5), frame(4.5), frame(8)];
    };
    const first = run();
    expect(run()).toEqual(first);
    expect(first[0]?.carried).toBeGreaterThan(1);
    expect(first[0]?.carried).toBeLessThan(4);
    // Reduced motion: straight to the new picture.
    const instant = new CapacityTimeline(planAt(1), diagram, 0);
    instant.update(planAt(5), diagram, 10, true);
    expect(instant.fleet("web", 10)?.serving).toBe(8);
  });
});
