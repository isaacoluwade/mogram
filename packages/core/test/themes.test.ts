import { describe, expect, it } from "vitest";
import {
  CANVAS_THEMES,
  CANVAS_THEME_INFO,
  GRID_CONTRAST,
  TEXT_CONTRAST,
  backgroundColors,
  contrast,
  gridColorFor,
  linear,
  modeForColor,
  solid,
  themeOnBackground,
} from "../src/presets";

describe("contrast", () => {
  it("measures WCAG contrast, blending translucent colours onto the background first", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("rgba(0,0,0,0)", "#777777")).toBeCloseTo(1, 5);
    expect(contrast("rgba(0,0,0,0.5)", "#ffffff")).toBeGreaterThan(3);
  });
});

describe("canvas grid (ED-9)", () => {
  it("shows on every colour of every theme's background, and stays quiet", () => {
    for (const name of CANVAS_THEMES) {
      const theme = CANVAS_THEME_INFO[name];
      for (const color of backgroundColors(theme.background)) {
        const ratio = contrast(theme.grid, color);
        expect(ratio, `${name} on ${color}`).toBeGreaterThanOrEqual(GRID_CONTRAST);
        expect(ratio, `${name} on ${color}`).toBeLessThan(2);
      }
    }
  });

  it("uses white dots on dark backgrounds and black dots on light ones", () => {
    expect(CANVAS_THEME_INFO.midnight.grid).toMatch(/^rgba\(255,255,255,/);
    expect(CANVAS_THEME_INFO.paper.grid).toMatch(/^rgba\(0,0,0,/);
    expect(gridColorFor(["#7f7f7f"], "light")).toMatch(/^rgba\(0,0,0,/);
  });
});

describe("custom backgrounds (ED-24)", () => {
  it("picks light or dark from the colour itself", () => {
    expect(modeForColor("#ffffff")).toBe("light");
    expect(modeForColor("#f4ebe1")).toBe("light");
    expect(modeForColor("#000000")).toBe("dark");
    expect(modeForColor("#1e3a5f")).toBe("dark");
  });

  it("switches text, lines and grid to suit a light colour on a dark preset", () => {
    const theme = themeOnBackground(CANVAS_THEME_INFO.midnight, solid("#f0e6d2"));
    expect(theme.mode).toBe("light");
    expect(theme.background).toEqual(solid("#f0e6d2"));
    expect(contrast(theme.text, "#f0e6d2")).toBeGreaterThan(7);
    expect(contrast(theme.grid, "#f0e6d2")).toBeGreaterThanOrEqual(GRID_CONTRAST);
  });

  it("keeps a preset's own palette when the colour suits it", () => {
    const theme = themeOnBackground(CANVAS_THEME_INFO.forest, solid("#0b2015"));
    expect(theme.mode).toBe("dark");
    expect(theme.tile).toBe(CANVAS_THEME_INFO.forest.tile);
  });

  it("keeps labels readable on any colour picked", () => {
    const colors = ["#ffffff", "#2563eb", "#7f7f7f", "#ff0000", "#ffd400", "#000000", "#1e3a5f"];
    for (const preset of [CANVAS_THEME_INFO.paper, CANVAS_THEME_INFO.midnight]) {
      for (const color of colors) {
        const theme = themeOnBackground(preset, solid(color));
        expect(contrast(theme.text, color), color).toBeGreaterThanOrEqual(TEXT_CONTRAST);
        expect(contrast(theme.textMuted, color), color).toBeGreaterThanOrEqual(3);
        expect(contrast(theme.grid, color), color).toBeGreaterThanOrEqual(GRID_CONTRAST);
      }
    }
  });

  it("turns labels pure black on colours the palette's text can't reach AA on", () => {
    expect(themeOnBackground(CANVAS_THEME_INFO.midnight, solid("#ff0000")).text).toBe("#000000");
    expect(themeOnBackground(CANVAS_THEME_INFO.paper, solid("#ffffff")).text).toBe(
      CANVAS_THEME_INFO.paper.text,
    );
  });
});

describe("gradient backgrounds", () => {
  it("pick the palette that reads on every colour the gradient passes through", () => {
    const stops = ["#431043", "#d34681"];
    const sunset = themeOnBackground(CANVAS_THEME_INFO.midnight, linear(135, ...stops));
    expect(sunset.mode).toBe("dark");
    const worst = (text: string) => Math.min(...stops.map((c) => contrast(text, c)));
    // No colour reaches AA on both ends of this gradient; the text is the best any colour can do.
    expect(worst(sunset.text)).toBeCloseTo(Math.max(worst("#ffffff"), worst("#000000")), 5);
    // Labels sit on the stop the text reads best on.
    expect(sunset.base).toBe("#431043");
    for (const color of stops) {
      expect(contrast(sunset.grid, color)).toBeGreaterThanOrEqual(GRID_CONTRAST);
    }
  });

  it("keeps the palette's own text on a gradient it reads well on", () => {
    const night = themeOnBackground(CANVAS_THEME_INFO.paper, linear(180, "#0b1020", "#1e2a4a"));
    expect(night.mode).toBe("dark");
    expect(night.text).toBe(CANVAS_THEME_INFO.midnight.text);
  });
});
