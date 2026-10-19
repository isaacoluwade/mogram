import type { GridSize } from "../model/types";
import { CODE_METRICS } from "../presets/code";
import type { CodeListing } from "./listing";

/** The width of a line-number gutter, in px: room for the largest number and two spaces. */
export function gutterWidth(listing: CodeListing, fontSize: number, numbers: boolean): number {
  if (!numbers) return 0;
  return (String(Math.max(1, listing.last)).length + 2) * fontSize * CODE_METRICS.advance;
}

/** A listing's own size, in grid cells: every line shown whole, with its header and gutter. */
export function codeSize(
  listing: CodeListing,
  options: { readonly fontSize: number; readonly numbers: boolean; readonly header: boolean },
): GridSize {
  const shown = listing.lines.slice(listing.first - 1, listing.last);
  const columns = Math.max(16, ...shown.map((line) => line.length));
  const rows = Math.max(1, shown.length);
  const padding = CODE_METRICS.padding * 2;
  const width =
    columns * options.fontSize * CODE_METRICS.advance +
    gutterWidth(listing, options.fontSize, options.numbers) +
    padding;
  const height =
    rows * options.fontSize * CODE_METRICS.lineHeight +
    padding +
    (options.header ? CODE_METRICS.header : 0);
  return { w: Math.ceil(width / 8), h: Math.ceil(height / 8) };
}

/**
 * How many characters of a line fit across an element of `width` px. A line longer than this is
 * cut with `…` when drawn, and a suggestion says which.
 */
export function columnsThatFit(
  listing: CodeListing,
  width: number,
  options: { readonly fontSize: number; readonly numbers: boolean },
): number {
  const room =
    width - CODE_METRICS.padding * 2 - gutterWidth(listing, options.fontSize, options.numbers);
  return Math.max(0, Math.floor(room / (options.fontSize * CODE_METRICS.advance)));
}
