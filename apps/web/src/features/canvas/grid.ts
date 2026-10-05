import { GRID } from "@mogram/core/layout";

/**
 * The editor grid (ED-9). Everything snaps to 8 px cells whether or not the grid is shown, and
 * positions in the files are counted in those cells (`at: [30, 6]`), so every mark the grid
 * draws is a snap point, anchored at 0,0. It has two levels: single cells, shown while things
 * can be placed cell by cell, and a stronger mark every 10 cells, on the round numbers the YAML,
 * the Arrange fields and the position hint use. Zoomed out, only the 10-cell marks remain (every
 * 100 when even those crowd), and the grid eases lighter, so a small diagram stays the focus.
 */

export type { GridStyle } from "@/lib/preferences";

/** Single cells show fully from this zoom up… */
export const FINE_FULL_ZOOM = 0.75;
/** …and fade out to nothing by this one. */
export const FINE_GONE_ZOOM = 0.6;
/** The closest the 10-cell (or 100-cell) marks may come on screen, in px. */
export const COARSE_MIN_GAP = 16;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface GridLevels {
  /** How strongly single cells show: 1 from 75% up, fading to 0 at 60%. */
  readonly fine: number;
  /** Cells between the stronger marks: 10, or 100 (1000…) when 10 would crowd. */
  readonly coarse: number;
  /** The whole grid's strength: full from 50% up, easing to 0.6 at 10%. */
  readonly strength: number;
}

export function gridLevels(zoom: number): GridLevels {
  let coarse = 10;
  while (coarse * GRID * zoom < COARSE_MIN_GAP && coarse < 1e6) coarse *= 10;
  return {
    fine: clamp01((zoom - FINE_GONE_ZOOM) / (FINE_FULL_ZOOM - FINE_GONE_ZOOM)),
    coarse,
    strength: 0.6 + 0.4 * clamp01((zoom - 0.1) / 0.4),
  };
}

/**
 * Lines one way across [from, to] in world px, as SVG path data: single-cell lines (not on a
 * coarse one; none when `fine` is false) and the coarse ones. A path per level keeps even a
 * dense grid to two elements.
 */
export function gridLines(
  from: number,
  to: number,
  levels: { readonly fine: boolean; readonly coarse: number },
  line: (at: number) => string,
): { readonly fine: string; readonly coarse: string } {
  const coarsePx = levels.coarse * GRID;
  const stepPx = levels.fine ? GRID : coarsePx;
  const fine: string[] = [];
  const coarse: string[] = [];
  for (let at = Math.floor(from / stepPx) * stepPx; at <= to; at += stepPx) {
    if (Math.abs(at % coarsePx) < 1e-6) coarse.push(line(at));
    else fine.push(line(at));
  }
  return { fine: fine.join(""), coarse: coarse.join("") };
}
