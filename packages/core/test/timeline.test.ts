import { describe, expect, it } from "vitest";
import {
  LOOP_SECONDS,
  flowAt,
  mixColor,
  mixLook,
  motionAt,
  motionPeriod,
  stepScene,
  storyAt,
  transitionProgress,
} from "../src/timeline";
import { FLOW_PRESETS, MOTION_PRESETS, STATE_INFO } from "../src/presets";

const normal = { intensity: "normal", speed: "normal" } as const;
const flowNormal = { speed: "normal", density: "normal", direction: "forward" } as const;

describe("one shared clock with seamless loops (PR-9, D-13)", () => {
  it("every motion preset looks identical at t and t + 4s", () => {
    for (const preset of MOTION_PRESETS) {
      for (const speed of ["slow", "normal", "fast"] as const) {
        for (const t of [0, 0.13, 0.5, 1.7, 3.3]) {
          const a = motionAt(preset, t, { intensity: "normal", speed });
          const b = motionAt(preset, t + LOOP_SECONDS, { intensity: "normal", speed });
          expect(b.dx).toBeCloseTo(a.dx, 6);
          expect(b.dy).toBeCloseTo(a.dy, 6);
          expect(b.scale).toBeCloseTo(a.scale, 6);
          expect((((b.rotate - a.rotate) % 360) + 360) % 360).toBeCloseTo(0, 4);
          expect(b.glow).toBeCloseTo(a.glow, 6);
        }
      }
    }
  });

  it("every flow preset repeats every 4s and every period divides 4s", () => {
    for (const preset of FLOW_PRESETS) {
      for (const density of ["low", "normal", "high"] as const) {
        for (const speed of ["slow", "normal", "fast"] as const) {
          const options = { speed, density, direction: "forward" } as const;
          const a = flowAt(preset, 1.234, options);
          const b = flowAt(preset, 1.234 + LOOP_SECONDS, options);
          expect(b.offset).toBeCloseTo(a.offset, 6);
        }
      }
    }
    for (const preset of MOTION_PRESETS) {
      expect(LOOP_SECONDS % motionPeriod(preset, "slow")).toBe(0);
    }
  });

  it("moves traffic dots one spacing per period, forward along the path", () => {
    const start = flowAt("traffic", 0, flowNormal);
    const quarter = flowAt("traffic", 0.125, flowNormal);
    expect(start.offset).toBeCloseTo(0);
    expect(quarter.offset).toBeCloseTo(-6); // 24px spacing, 0.5s period
    expect(flowAt("traffic", 0.125, { ...flowNormal, direction: "reverse" }).offset).toBeCloseTo(6);
    expect(flowAt("blocked", 0.3, flowNormal).animated).toBe(false);
    expect(flowAt("traffic", 0, { ...flowNormal, direction: "both" }).reverseOffset).not.toBeNull();
  });

  it("pulse, bounce and glow return to rest at the start of each period", () => {
    expect(motionAt("pulse", 0, normal).scale).toBeCloseTo(1);
    expect(motionAt("pulse", 1, normal).scale).toBeGreaterThan(1.05);
    expect(motionAt("bounce", 0, normal).dy).toBeCloseTo(0);
    expect(motionAt("bounce", 0.5, normal).dy).toBeLessThan(-6);
    expect(motionAt("glow", 0, normal).glow).toBeCloseTo(0);
    expect(motionAt("shake", 0.75, normal)).toEqual({ dx: 0, dy: 0, scale: 1, rotate: 0, glow: 0 });
  });
});

describe("scene transitions (SC-7) and stories (SC-9)", () => {
  it("eases between state looks", () => {
    expect(transitionProgress(10, 10)).toBe(0);
    expect(transitionProgress(10.3, 10)).toBeCloseTo(0.5);
    expect(transitionProgress(11, 10)).toBe(1);
    const mid = mixLook(STATE_INFO.healthy.look, STATE_INFO.down.look, 0.5);
    expect(mid.desaturate).toBeCloseTo(0.5);
    expect(mid.dim).toBeCloseTo(0.225);
  });

  it("mixes colours in any of the formats presets use", () => {
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("rgba(128,128,128,1)");
    expect(mixColor("rgba(255,0,0,0)", "#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)");
  });

  it("plays scenes in order and loops seamlessly", () => {
    expect(storyAt(0.1, 3)).toMatchObject({ from: 2, to: 0 });
    expect(storyAt(5, 3)).toMatchObject({ from: 0, to: 1, progress: 1 });
    expect(storyAt(8.3, 3)).toMatchObject({ from: 1, to: 2 });
    expect(storyAt(12.1, 3)).toEqual(storyAt(0.1, 3));
    expect(storyAt(3, 1)).toEqual({ from: 0, to: 0, progress: 1 });
  });
});

describe("stepScene", () => {
  const scenes = ["spike", "outage"];
  it("goes Normal → each scene → Normal, both ways", () => {
    expect(stepScene(scenes, null, 1)).toBe("spike");
    expect(stepScene(scenes, "outage", 1)).toBeNull();
    expect(stepScene(scenes, null, -1)).toBe("outage");
    expect(stepScene(scenes, "spike", -1)).toBeNull();
  });

  it("steps from Normal when the current scene is gone, and stays on Normal with no scenes", () => {
    expect(stepScene(scenes, "deleted", 1)).toBe("spike");
    expect(stepScene([], null, 1)).toBeNull();
  });
});
