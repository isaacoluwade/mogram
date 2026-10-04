import type { FontName } from "@mogram/core/presets";

/**
 * Font stacks for author-chosen type (ED-25). The family names are the ones `next/font` gives
 * the app's fonts (matched case-insensitively), and the export embeds its fonts under the same
 * names, so a stack measures and draws the same on screen and in a file.
 */
export const FONT_STACKS: Readonly<Record<FontName, string>> = {
  inter: `"Inter", sans-serif`,
  geist: `"Geist", "Inter", sans-serif`,
  instrument: `"instrument", "Inter", sans-serif`,
  mono: `"geistMono", ui-monospace, monospace`,
};

export function fontStack(font: FontName): string {
  return FONT_STACKS[font];
}
