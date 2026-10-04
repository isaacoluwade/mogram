/**
 * Side panel sizes, in pixels. The same values are `--spacing-panel-*` in styles/tokens.css
 * (Tailwind's `w-panel-library`, `md:left-clear-library`…); `panel-sizes.test.ts` keeps them
 * equal. TypeScript needs them to frame the diagram in the space the panels leave.
 */
export const PANEL = {
  /** Gap between a panel and the window edge. */
  edge: 12,
  library: 288,
  /** Inspector and tours. */
  right: 316,
  code: 360,
  /** Code panel from the xl breakpoint (1280px). */
  codeXl: 440,
} as const;

/** Space a panel takes from the canvas edge, including its margins. */
export const clearOf = (width: number): number => PANEL.edge + width + PANEL.edge;
