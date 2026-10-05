import type { Tone } from "../model/types";

/**
 * Diagram colour tones. Values are Eden's own tints (see docs/research/eden-design-system.md):
 * green #73b490/#8fe5bb, amber #ecb95b/#f3bd7f, orange-300, cloudberry #d17866 with rose-300,
 * violet #a38cf3. Light-theme variants are darkened for contrast on light canvases.
 */
export interface ToneColors {
  /** Rings, lines, dots. */
  readonly solid: string;
  /** Text and icons drawn in the tone. */
  readonly text: string;
  /** ~12% fill for badges and container tints. */
  readonly fill: string;
  /** ~35–45% border for badges and container borders. */
  readonly border: string;
}

export type ThemeMode = "dark" | "light";

export const TONES: Readonly<Record<Tone, Readonly<Record<ThemeMode, ToneColors>>>> = {
  neutral: {
    dark: {
      solid: "#a3a3a3",
      text: "#f5f5f5",
      fill: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.16)",
    },
    light: {
      solid: "#525252",
      text: "#262626",
      fill: "rgba(0,0,0,0.05)",
      border: "rgba(0,0,0,0.14)",
    },
  },
  blue: {
    dark: {
      solid: "#7aa7f0",
      text: "#a9c6ff",
      fill: "rgba(122,167,240,0.13)",
      border: "rgba(122,167,240,0.42)",
    },
    light: {
      solid: "#2f63c4",
      text: "#1f4d9e",
      fill: "rgba(47,99,196,0.11)",
      border: "rgba(47,99,196,0.42)",
    },
  },
  green: {
    dark: {
      solid: "#73b490",
      text: "#8fe5bb",
      fill: "rgba(115,180,144,0.14)",
      border: "rgba(115,180,144,0.42)",
    },
    light: {
      solid: "#3f7a5a",
      text: "#2f6b4c",
      fill: "rgba(92,151,118,0.14)",
      border: "rgba(92,151,118,0.45)",
    },
  },
  amber: {
    dark: {
      solid: "#ecb95b",
      text: "#f3bd7f",
      fill: "rgba(236,185,91,0.13)",
      border: "rgba(236,185,91,0.42)",
    },
    light: {
      solid: "#b7791f",
      text: "#8a5a12",
      fill: "rgba(217,130,43,0.14)",
      border: "rgba(217,130,43,0.45)",
    },
  },
  orange: {
    dark: {
      solid: "#fdba74",
      text: "#fdba74",
      fill: "rgba(253,186,116,0.12)",
      border: "rgba(253,186,116,0.38)",
    },
    light: {
      solid: "#c2410c",
      text: "#9a3412",
      fill: "rgba(234,88,12,0.12)",
      border: "rgba(234,88,12,0.4)",
    },
  },
  rose: {
    dark: {
      solid: "#d17866",
      text: "#fda4af",
      fill: "rgba(209,120,102,0.15)",
      border: "rgba(209,120,102,0.48)",
    },
    light: {
      solid: "#b4533f",
      text: "#9f3a2c",
      fill: "rgba(209,120,102,0.16)",
      border: "rgba(209,120,102,0.5)",
    },
  },
  violet: {
    dark: {
      solid: "#a38cf3",
      text: "#c4b5fd",
      fill: "rgba(163,140,243,0.13)",
      border: "rgba(163,140,243,0.42)",
    },
    light: {
      solid: "#6d55c9",
      text: "#5b45b0",
      fill: "rgba(109,85,201,0.12)",
      border: "rgba(109,85,201,0.45)",
    },
  },
};

export const TONE_NAMES: readonly Tone[] = [
  "neutral",
  "blue",
  "green",
  "amber",
  "orange",
  "rose",
  "violet",
];

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONE_NAMES as readonly string[]).includes(value);
}
