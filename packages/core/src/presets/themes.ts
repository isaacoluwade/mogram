import { contrast } from "./color";
import type { CanvasThemeName } from "./names";
import { linear, paintColors, radial, solid, type Paint } from "./paint";
import type { ThemeMode } from "./tones";

/**
 * Canvas themes: solid colours and gradients, light and dark (ED-8, PR-5). Values come from
 * Eden's palette and gradients (page #0a0a0a, card #141414, store spotlight #3a3a3a, green
 * #0a140e→#1f3528, ember #1a1010→#2a0808, sand #f4ebe1→#eadec9, mist #fff→#e8e8e8).
 */
export type CanvasBackground = Paint;

export interface CanvasThemeInfo {
  readonly label: string;
  readonly mode: ThemeMode;
  readonly background: CanvasBackground;
  /** Solid colour used where a gradient can't be (JPEG matte, thumbnails' fallback). */
  readonly base: string;
  /** Icon tile fill and border. */
  readonly tile: string;
  readonly tileBorder: string;
  readonly text: string;
  readonly textMuted: string;
  /** Neutral line colour for idle connections and container borders. */
  readonly line: string;
  /** Grid dots, worked out from the background so they show on it (see `gridColorFor`). */
  readonly grid: string;
  /** Selection and focus colour on this canvas. */
  readonly selection: string;
}

const DARK = {
  tile: "#1a1a1a",
  tileBorder: "rgba(255,255,255,0.10)",
  text: "#f5f5f5",
  textMuted: "#a3a3a3",
  line: "rgba(255,255,255,0.32)",
  selection: "#fafafa",
} as const;

const LIGHT = {
  tile: "#ffffff",
  tileBorder: "rgba(0,0,0,0.10)",
  text: "#171717",
  textMuted: "#525252",
  line: "rgba(0,0,0,0.35)",
  selection: "#171717",
} as const;

const PALETTES = { dark: DARK, light: LIGHT } as const;

type ThemeWithoutGrid = Omit<CanvasThemeInfo, "grid">;

/** The colours a background passes through: its one colour, or every stop of its gradient. */
export function backgroundColors(background: CanvasBackground): readonly string[] {
  return paintColors(background);
}

/** Light or dark, for a background colour: whichever palette's text reads better on it. */
export function modeForColor(color: string): ThemeMode {
  return modeForColors([color]);
}

/** Light or dark for a background that passes through several colours: whichever palette's text stays most readable on all of them. */
export function modeForColors(colors: readonly string[]): ThemeMode {
  const worst = (text: string) => Math.min(...colors.map((color) => contrast(text, color)));
  return worst(LIGHT.text) >= worst(DARK.text) ? "light" : "dark";
}

/**
 * How far grid dots stand out from the background (WCAG contrast ratio): easy to see, still
 * quieter than anything drawn on the canvas.
 */
export const GRID_CONTRAST = 1.45;

/**
 * Grid dots for a background: white on dark, black on light, at the lowest opacity that reaches
 * GRID_CONTRAST against every colour the background passes through. A fixed opacity vanishes on
 * the lighter end of a gradient or on a custom colour; this shows on all of them.
 */
export function gridColorFor(colors: readonly string[], mode: ThemeMode): string {
  const ink = mode === "dark" ? "255,255,255" : "0,0,0";
  for (let percent = 6; percent <= 60; percent += 1) {
    const color = `rgba(${ink},${percent / 100})`;
    if (colors.every((background) => contrast(color, background) >= GRID_CONTRAST)) return color;
  }
  return `rgba(${ink},0.6)`;
}

function withGrid(theme: ThemeWithoutGrid): CanvasThemeInfo {
  return { ...theme, grid: gridColorFor(backgroundColors(theme.background), theme.mode) };
}

/** WCAG AA for text: labels on a custom colour reach at least this contrast ratio. */
export const TEXT_CONTRAST = 4.5;

/**
 * A theme drawn on a custom background, solid or gradient (ED-24). The palette follows the
 * background, not the preset: a light colour picked on a dark preset gets dark text, lines and
 * grid, so nothing disappears into it. Text keeps the palette's colour where that reaches
 * TEXT_CONTRAST on every colour of the background; otherwise it turns whichever of black or white
 * reads best across all of it (a solid colour always reaches 4.58:1 that way; a gradient from dark
 * to mid tones may not, so labels also sit on the background's most contrasting stop).
 */
export function themeOnBackground(preset: CanvasThemeInfo, background: Paint): CanvasThemeInfo {
  const colors = paintColors(background);
  const mode = modeForColors(colors);
  const palette = { ...(mode === preset.mode ? preset : PALETTES[mode]) };
  const worst = (text: string) => Math.min(...colors.map((c) => contrast(text, c)));
  const text =
    worst(palette.text) >= TEXT_CONTRAST
      ? palette.text
      : [palette.text, "#ffffff", "#000000"].reduce((best, candidate) =>
          worst(candidate) > worst(best) ? candidate : best,
        );
  const textMuted = worst(palette.textMuted) >= 3 ? palette.textMuted : text;
  // Label backings use the stop that contrasts most with the text.
  const base = colors.reduce((best, color) =>
    contrast(text, color) > contrast(text, best) ? color : best,
  );
  return withGrid({
    ...preset,
    ...palette,
    text,
    textMuted,
    mode,
    base,
    background,
  });
}

const PRESETS: Readonly<Record<CanvasThemeName, ThemeWithoutGrid>> = {
  midnight: {
    label: "Midnight",
    mode: "dark",
    base: "#0a0a0a",
    background: radial({ x: 0.5, y: 0 }, ["#161616", "#0a0a0a"], { x: 1.2, y: 0.8 }),
    ...DARK,
  },
  graphite: {
    label: "Graphite",
    mode: "dark",
    base: "#141414",
    background: solid("#141414"),
    ...DARK,
    tile: "#1f1f1f",
  },
  spotlight: {
    label: "Spotlight",
    mode: "dark",
    base: "#0c0c0c",
    background: radial({ x: 0.5, y: 0 }, ["#3a3a3a", "#151515", "#0c0c0c"], { x: 1.2, y: 0.8 }),
    ...DARK,
  },
  forest: {
    label: "Forest",
    mode: "dark",
    base: "#0f1d15",
    background: linear(160, "#1f3528", "#0f1d15", "#0a140e"),
    ...DARK,
    tile: "#14241a",
    tileBorder: "rgba(130,184,154,0.18)",
  },
  ember: {
    label: "Ember",
    mode: "dark",
    base: "#1a1010",
    background: linear(160, "#2a0808", "#1a1010", "#120b0b"),
    ...DARK,
    tile: "#211515",
    tileBorder: "rgba(209,120,102,0.18)",
  },
  dusk: {
    label: "Dusk",
    mode: "dark",
    base: "#121019",
    background: linear(160, "#211b33", "#121019", "#0c0b10"),
    ...DARK,
    tile: "#1b1826",
    tileBorder: "rgba(163,140,243,0.18)",
  },
  paper: {
    label: "Paper",
    mode: "light",
    base: "#f6f6f4",
    background: solid("#f6f6f4"),
    ...LIGHT,
  },
  snow: {
    label: "Snow",
    mode: "light",
    base: "#ffffff",
    background: solid("#ffffff"),
    ...LIGHT,
    tile: "#fafafa",
  },
  sand: {
    label: "Sand",
    mode: "light",
    base: "#f4ebe1",
    background: linear(180, "#f4ebe1", "#eadec9"),
    ...LIGHT,
    tile: "#fbf6f0",
  },
  mist: {
    label: "Mist",
    mode: "light",
    base: "#f3f3f3",
    background: linear(180, "#ffffff", "#e8e8e8"),
    ...LIGHT,
  },
};

export const CANVAS_THEME_INFO: Readonly<Record<CanvasThemeName, CanvasThemeInfo>> =
  Object.fromEntries(
    Object.entries(PRESETS).map(([name, theme]) => [name, withGrid(theme)]),
  ) as Record<CanvasThemeName, CanvasThemeInfo>;
