import { describe, expect, it } from "vitest";
import { gridLevels, gridLines } from "./grid";

describe("the editor grid (ED-9)", () => {
  it("shows single cells from 75% up, fading out by 60%", () => {
    expect(gridLevels(1).fine).toBe(1);
    expect(gridLevels(0.75).fine).toBe(1);
    expect(gridLevels(0.675).fine).toBeCloseTo(0.5);
    expect(gridLevels(0.6).fine).toBe(0);
    expect(gridLevels(0.27).fine).toBe(0);
  });

  it("keeps a stronger mark every 10 cells, every 100 once 10 would crowd", () => {
    expect(gridLevels(2).coarse).toBe(10);
    expect(gridLevels(0.27).coarse).toBe(10);
    expect(gridLevels(0.2).coarse).toBe(10);
    expect(gridLevels(0.19).coarse).toBe(100);
    expect(gridLevels(0.01).coarse).toBe(1000);
    for (let zoom = 0.01; zoom <= 4; zoom += 0.01) {
      expect(gridLevels(zoom).coarse * 8 * zoom).toBeGreaterThanOrEqual(16);
    }
  });

  it("eases lighter as you zoom out, so a small diagram stays the focus", () => {
    expect(gridLevels(1).strength).toBe(1);
    expect(gridLevels(0.5).strength).toBe(1);
    expect(gridLevels(0.3).strength).toBeCloseTo(0.8);
    expect(gridLevels(0.1).strength).toBeCloseTo(0.6);
    expect(gridLevels(0.02).strength).toBeCloseTo(0.6);
  });

  it("splits lines into single cells and every 10, anchored at 0", () => {
    const lines = gridLines(-16, 96, { fine: true, coarse: 10 }, (at) => `|${at}`);
    expect(lines.coarse).toBe("|0|80");
    expect(lines.fine.split("|").filter(Boolean).map(Number)).toEqual([
      -16, -8, 8, 16, 24, 32, 40, 48, 56, 64, 72, 88, 96,
    ]);
    // Zoomed out: only the coarse lines.
    const coarse = gridLines(-100, 900, { fine: false, coarse: 10 }, (at) => `|${at}`);
    expect(coarse.fine).toBe("");
    expect(coarse.coarse).toBe("|-160|-80|0|80|160|240|320|400|480|560|640|720|800|880");
  });
});
