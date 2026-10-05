/**
 * How connections look (ED-29): arrowheads per end, line pattern and width, corners and line
 * jumps, and the fixed points an end can attach to. Studied from draw.io's markers, dash
 * patterns and connection constraints (docs/research/drawio/02-connectors.md), trimmed to what
 * architecture diagrams use. Names are what the file stores; drawing lives in the web app.
 */

export const ARROWHEADS = [
  "none",
  "open",
  "classic",
  "classic-outline",
  "block",
  "block-outline",
  "async",
  "oval",
  "oval-outline",
  "diamond",
  "diamond-outline",
  "dash",
  "cross",
  "er-one",
  "er-mandatory-one",
  "er-many",
  "er-one-many",
  "er-zero-one",
  "er-zero-many",
] as const;
export type Arrowhead = (typeof ARROWHEADS)[number];

export const ARROWHEAD_LABELS: Readonly<Record<Arrowhead, string>> = {
  none: "None",
  open: "Open arrow",
  classic: "Arrow",
  "classic-outline": "Arrow, outline",
  block: "Triangle",
  "block-outline": "Triangle, outline",
  async: "Half arrow (async)",
  oval: "Dot",
  "oval-outline": "Circle",
  diamond: "Diamond",
  "diamond-outline": "Diamond, outline",
  dash: "Bar",
  cross: "Cross",
  "er-one": "One",
  "er-mandatory-one": "Exactly one",
  "er-many": "Many",
  "er-one-many": "One or many",
  "er-zero-one": "Zero or one",
  "er-zero-many": "Zero or many",
};

export function isArrowhead(value: unknown): value is Arrowhead {
  return typeof value === "string" && (ARROWHEADS as readonly string[]).includes(value);
}

export interface ArrowEnds {
  readonly start: Arrowhead;
  readonly end: Arrowhead;
}

/** The arrowheads a direction implies when a connection doesn't name its own. */
export function defaultArrows(direction: "forward" | "reverse" | "both"): ArrowEnds {
  switch (direction) {
    case "forward":
      return { start: "none", end: "open" };
    case "reverse":
      return { start: "open", end: "none" };
    case "both":
      return { start: "open", end: "open" };
  }
}

/** Arrowhead length in px at the default line width; each end can set its own. */
export const DEFAULT_ARROW_SIZE = 7;
export const MIN_ARROW_SIZE = 2;
export const MAX_ARROW_SIZE = 20;

export const LINE_PATTERNS = ["solid", "dashed", "long-dash", "dotted", "dash-dot"] as const;
export type LinePattern = (typeof LINE_PATTERNS)[number];

export const LINE_PATTERN_LABELS: Readonly<Record<LinePattern, string>> = {
  solid: "Solid",
  dashed: "Dashed",
  "long-dash": "Long dash",
  dotted: "Dotted",
  "dash-dot": "Dash dot",
};

/** Dash lengths for a pattern at the default width; they scale with the line's width. */
export const LINE_DASHES: Readonly<Record<LinePattern, readonly number[] | null>> = {
  solid: null,
  dashed: [6, 4],
  "long-dash": [12, 8],
  dotted: [0.5, 4],
  "dash-dot": [8, 4, 0.5, 4],
};

export const DEFAULT_LINE_WIDTH = 1.5;
export const MIN_LINE_WIDTH = 0.5;
export const MAX_LINE_WIDTH = 8;

export const CORNER_STYLES = ["rounded", "sharp"] as const;
export type CornerStyle = (typeof CORNER_STYLES)[number];

export const JUMP_STYLES = ["none", "arc", "gap"] as const;
export type JumpStyle = (typeof JUMP_STYLES)[number];

// -------------------------------------------------------------------------------------------------
// Anchors: fixed points an end attaches to

/** A point on an element's box as fractions of its width and height (0,0 = top-left). */
export interface Anchor {
  readonly x: number;
  readonly y: number;
}

export const ANCHOR_NAMES = [
  "top",
  "right",
  "bottom",
  "left",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type AnchorName = (typeof ANCHOR_NAMES)[number];

export const NAMED_ANCHORS: Readonly<Record<AnchorName, Anchor>> = {
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
  "top-left": { x: 0, y: 0 },
  "top-right": { x: 1, y: 0 },
  "bottom-left": { x: 0, y: 1 },
  "bottom-right": { x: 1, y: 1 },
};

/**
 * The points offered while connecting: corners, side midpoints and quarter points — draw.io's
 * 16-point rectangle set (02-connectors §7.3).
 */
export const BOX_ANCHORS: readonly Anchor[] = [0, 0.25, 0.5, 0.75, 1].flatMap((t) => {
  const points: Anchor[] = [
    { x: t, y: 0 },
    { x: t, y: 1 },
  ];
  if (t !== 0 && t !== 1) points.push({ x: 0, y: t }, { x: 1, y: t });
  return points;
});

/** The anchor's readable name when it has one (`right`), else null (write `[x, y]`). */
export function anchorName(anchor: Anchor): AnchorName | null {
  for (const name of ANCHOR_NAMES) {
    const named = NAMED_ANCHORS[name];
    if (Math.abs(named.x - anchor.x) < 1e-6 && Math.abs(named.y - anchor.y) < 1e-6) return name;
  }
  return null;
}

export function sameAnchor(a: Anchor | null, b: Anchor | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}
