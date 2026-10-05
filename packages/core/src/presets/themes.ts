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

  // Dark, with colour: each tints its tiles and their borders to match.
  slate: {
    label: "Slate",
    mode: "dark",
    base: "#18202b",
    background: linear(180, "#222c3a", "#18202b", "#121821"),
    ...DARK,
    tile: "#232d3b",
    tileBorder: "rgba(148,163,184,0.20)",
  },
  ocean: {
    label: "Ocean",
    mode: "dark",
    base: "#0a1d36",
    background: linear(160, "#0f3460", "#0a1d36", "#06121f"),
    ...DARK,
    tile: "#0f2a4a",
    tileBorder: "rgba(96,165,250,0.22)",
  },
  teal: {
    label: "Teal",
    mode: "dark",
    base: "#0a2a2b",
    background: linear(160, "#0f4545", "#0a2a2b", "#061a1b"),
    ...DARK,
    tile: "#0f3536",
    tileBorder: "rgba(94,234,212,0.20)",
  },
  plum: {
    label: "Plum",
    mode: "dark",
    base: "#260f30",
    background: linear(160, "#44195a", "#260f30", "#170a1d"),
    ...DARK,
    tile: "#311540",
    tileBorder: "rgba(216,180,254,0.20)",
  },
  wine: {
    label: "Wine",
    mode: "dark",
    base: "#2e0a17",
    background: linear(160, "#571229", "#2e0a17", "#1a060d"),
    ...DARK,
    tile: "#3a0f1f",
    tileBorder: "rgba(251,113,133,0.20)",
  },
  olive: {
    label: "Olive",
    mode: "dark",
    base: "#1c210d",
    background: linear(160, "#333b17", "#1c210d", "#121508"),
    ...DARK,
    tile: "#262d12",
    tileBorder: "rgba(190,242,100,0.18)",
  },

  // Vivid gradients: real colour across the canvas, with white labels that read on every part.
  aurora: {
    label: "Aurora",
    mode: "dark",
    base: "#132447",
    background: linear(135, "#0f766e", "#132447", "#4c1d95"),
    ...DARK,
    tile: "#14213d",
    tileBorder: "rgba(153,246,228,0.22)",
    textMuted: "#ccfbf1",
    line: "rgba(255,255,255,0.40)",
  },
  twilight: {
    label: "Twilight",
    mode: "dark",
    base: "#2e1a63",
    background: linear(160, "#312e81", "#5b21b6", "#9d174d"),
    ...DARK,
    tile: "#241a52",
    tileBorder: "rgba(233,213,255,0.22)",
    textMuted: "#e9d5ff",
    line: "rgba(255,255,255,0.40)",
  },
  sunset: {
    label: "Sunset",
    mode: "dark",
    base: "#7f1d3a",
    background: linear(135, "#b4380d", "#9f1239", "#4c1d95"),
    ...DARK,
    tile: "#3b0f24",
    tileBorder: "rgba(254,215,170,0.24)",
    textMuted: "#fed7aa",
    line: "rgba(255,255,255,0.42)",
  },
  lagoon: {
    label: "Lagoon",
    mode: "dark",
    base: "#0b4a63",
    background: linear(160, "#0e7490", "#0b4a63", "#082f49"),
    ...DARK,
    tile: "#0a3a52",
    tileBorder: "rgba(165,243,252,0.24)",
    textMuted: "#cffafe",
    line: "rgba(255,255,255,0.40)",
  },
  nebula: {
    label: "Nebula",
    mode: "dark",
    base: "#140f2e",
    background: radial({ x: 0.3, y: 0.15 }, ["#6d28d9", "#1e1b4b", "#0b0a1a"], { x: 1.3, y: 1.1 }),
    ...DARK,
    tile: "#1a1538",
    textMuted: "#ddd6fe",
    tileBorder: "rgba(196,181,253,0.22)",
  },

  // Drafting boards.
  blueprint: {
    label: "Blueprint",
    mode: "dark",
    base: "#1e3a8a",
    background: linear(180, "#1e45a8", "#1e3a8a"),
    ...DARK,
    tile: "#1b3478",
    tileBorder: "rgba(219,234,254,0.32)",
    textMuted: "#cbd5e1",
    line: "rgba(219,234,254,0.55)",
  },
  chalkboard: {
    label: "Chalkboard",
    mode: "dark",
    base: "#26332c",
    background: linear(180, "#2f3e36", "#26332c"),
    ...DARK,
    tile: "#33443b",
    tileBorder: "rgba(240,253,244,0.16)",
    text: "#f1f5f0",
    textMuted: "#b8c4bc",
    line: "rgba(240,253,244,0.40)",
  },

  // Light, with a hint of colour.
  sky: {
    label: "Sky",
    mode: "light",
    base: "#e6f0fe",
    background: linear(180, "#eff6ff", "#dbeafe"),
    ...LIGHT,
    tileBorder: "rgba(37,99,235,0.16)",
  },
  mint: {
    label: "Mint",
    mode: "light",
    base: "#e3f9ec",
    background: linear(180, "#f0fdf4", "#d1fae5"),
    ...LIGHT,
    tileBorder: "rgba(5,150,105,0.16)",
  },
  blush: {
    label: "Blush",
    mode: "light",
    base: "#fff0f2",
    background: linear(180, "#fff5f6", "#ffe4e6"),
    ...LIGHT,
    tileBorder: "rgba(225,29,72,0.14)",
  },
  lilac: {
    label: "Lilac",
    mode: "light",
    base: "#f4effe",
    background: linear(180, "#faf5ff", "#ede9fe"),
    ...LIGHT,
    tileBorder: "rgba(124,58,237,0.14)",
  },
  butter: {
    label: "Butter",
    mode: "light",
    base: "#fef8dc",
    background: linear(180, "#fefce8", "#fef3c7"),
    ...LIGHT,
    tileBorder: "rgba(202,138,4,0.18)",
  },
  dawn: {
    label: "Dawn",
    mode: "light",
    base: "#f3eafa",
    background: linear(135, "#fdf2f8", "#ede9fe", "#e0e7ff"),
    ...LIGHT,
    tileBorder: "rgba(99,102,241,0.16)",
  },
  seafoam: {
    label: "Seafoam",
    mode: "light",
    base: "#e0f7f4",
    background: linear(135, "#ecfdf5", "#ccfbf1", "#e0f2fe"),
    ...LIGHT,
    tileBorder: "rgba(13,148,136,0.16)",
  },
};

/**
 * The themes by family, as the inspector's "See all" shows them (each theme in exactly one), and
 * the few shown before it: one or two from each family, so the first view has real variety.
 */
export const THEME_FAMILIES: readonly {
  readonly name: string;
  readonly themes: readonly CanvasThemeName[];
}[] = [
  { name: "Dark", themes: ["midnight", "graphite", "spotlight", "slate"] },
  {
    name: "Deep colours",
    themes: ["ocean", "forest", "teal", "dusk", "plum", "wine", "ember", "olive"],
  },
  { name: "Vivid gradients", themes: ["aurora", "twilight", "sunset", "lagoon", "nebula"] },
  { name: "Drafting", themes: ["blueprint", "chalkboard"] },
  { name: "Light", themes: ["paper", "snow", "mist", "sand"] },
  { name: "Pastel", themes: ["sky", "mint", "blush", "lilac", "butter", "dawn", "seafoam"] },
];

export const FEATURED_THEMES: readonly CanvasThemeName[] = [
  "midnight",
  "ocean",
  "forest",
  "wine",
  "aurora",
  "blueprint",
  "twilight",
  "paper",
  "sky",
  "sand",
];

export const CANVAS_THEME_INFO: Readonly<Record<CanvasThemeName, CanvasThemeInfo>> =
  Object.fromEntries(
    Object.entries(PRESETS).map(([name, theme]) => [name, withGrid(theme)]),
  ) as Record<CanvasThemeName, CanvasThemeInfo>;
