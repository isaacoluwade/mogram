import { contrast } from "./color";
import { paintColors, type Paint } from "./paint";

/**
 * Typography for free text and sticky notes (ED-25): the fonts Mogram ships, alignment, and the
 * sizes the font size menu offers. Diagram elements keep the system type; only words the author
 * writes freely get a choice.
 */

/** Fonts bundled with the app and embedded in exports, so text looks the same everywhere. */
export const FONT_NAMES = ["inter", "geist", "instrument", "mono"] as const;
export type FontName = (typeof FONT_NAMES)[number];

export const FONT_LABELS: Readonly<Record<FontName, string>> = {
  inter: "Inter",
  geist: "Geist",
  instrument: "Instrument Sans",
  mono: "Geist Mono",
};

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** Sizes the font size menu lists; any whole size in range can be typed. */
export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80] as const;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 200;

/** A sticky note's size in grid units when it is placed with a click. */
export const NOTE_SIZE = { w: 22, h: 18 } as const;

/** The default note fill (the first note colour). */
export const NOTE_FILL = "#fef3a0";

const INK_DARK = "#1c1917";
const INK_LIGHT = "#ffffff";

/** Text colour for a note: near-black on light fills, white on dark ones (worst stop counts). */
export function noteInk(fill: Paint): string {
  const stops = paintColors(fill);
  const worst = (ink: string): number => Math.min(...stops.map((stop) => contrast(ink, stop)));
  return worst(INK_DARK) >= worst(INK_LIGHT) ? INK_DARK : INK_LIGHT;
}
