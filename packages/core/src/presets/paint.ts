import { normalizeHex } from "./color";

/**
 * A fill: one colour, or a gradient between colours (ED-24). Files write it in CSS syntax so it
 * reads like what designers already know:
 *
 *   #1f3528                                         solid (alpha allowed: #1f352880)
 *   linear-gradient(135deg, #431043, #d34681)       angle as CSS measures it
 *   radial-gradient(at 50% 0%, #3a3a3a, #0c0c0c)    centre as a percentage of the box
 *
 * Colour stops may carry a position (`#431043 20%`); without one they spread evenly.
 */
export interface GradientStop {
  readonly color: string;
  /** 0..1 along the gradient. */
  readonly offset: number;
}

export type Paint =
  | { readonly kind: "solid"; readonly color: string }
  | {
      readonly kind: "linear";
      /** Degrees, CSS convention: 0 points up, 90 to the right, 180 down. */
      readonly angle: number;
      readonly stops: readonly GradientStop[];
    }
  | {
      readonly kind: "radial";
      /** Centre, 0..1 of the box's width and height. */
      readonly center: { readonly x: number; readonly y: number };
      /**
       * Radii, as fractions of the box's width and height. Null reaches the farthest corner,
       * as CSS does by default.
       */
      readonly radius: { readonly x: number; readonly y: number } | null;
      readonly stops: readonly GradientStop[];
    };

/** Gradients take between two and this many colours. */
export const MAX_GRADIENT_STOPS = 6;

/** Colours spread evenly: `["#a", "#b", "#c"]` → stops at 0, 0.5 and 1. */
export function evenStops(colors: readonly string[]): GradientStop[] {
  return colors.map((color, index) => ({
    color,
    offset: colors.length === 1 ? 0 : index / (colors.length - 1),
  }));
}

export function solid(color: string): Paint {
  return { kind: "solid", color };
}

export function linear(angle: number, ...colors: readonly string[]): Paint {
  return { kind: "linear", angle, stops: evenStops(colors) };
}

export function radial(
  center: { x: number; y: number },
  colors: readonly string[],
  radius: { x: number; y: number } | null = null,
): Paint {
  return { kind: "radial", center, radius, stops: evenStops(colors) };
}

/** Every colour a paint passes through (for contrast checks and swatches). */
export function paintColors(paint: Paint): readonly string[] {
  return paint.kind === "solid" ? [paint.color] : paint.stops.map((stop) => stop.color);
}

/** The farthest corner of the box from a radial gradient's centre, in box units. */
export function farthestCorner(center: { x: number; y: number }): number {
  const dx = Math.max(center.x, 1 - center.x);
  const dy = Math.max(center.y, 1 - center.y);
  return Math.hypot(dx, dy);
}

const percent = (value: number): string => `${Math.round(value * 1000) / 10}%`;

/**
 * Stops as CSS writes them, leaving out every position CSS would work out by itself: the ends
 * at 0% and 100%, and stops that sit evenly between their neighbours.
 */
function stopsText(stops: readonly GradientStop[]): string {
  const written = stops.map((stop) => stop.offset as number | null);
  for (let index = 0; index < stops.length; index++) {
    const trial = [...written];
    trial[index] = null;
    if (Math.abs((fillOffsets(trial)[index] ?? -1) - (stops[index]?.offset ?? 0)) < 0.0005) {
      written[index] = null;
    }
  }
  return stops
    .map((stop, index) =>
      written[index] === null ? stop.color : `${stop.color} ${percent(stop.offset)}`,
    )
    .join(", ");
}

/**
 * CSS's rule for stops written without a position: the first is at 0%, the last at 100%, and
 * any run in between spreads evenly between the positions either side of it.
 */
function fillOffsets(offsets: readonly (number | null)[]): number[] {
  const out = [...offsets];
  if (out.length === 0) return [];
  if (out[0] === null) out[0] = 0;
  if (out[out.length - 1] === null) out[out.length - 1] = 1;
  let start = 0;
  for (let index = 1; index < out.length; index++) {
    if (out[index] === null) continue;
    const from = out[start] ?? 0;
    const to = out[index] ?? 1;
    for (let gap = start + 1; gap < index; gap++) {
      out[gap] = from + ((to - from) * (gap - start)) / (index - start);
    }
    start = index;
  }
  return out.map((value) => value ?? 0);
}

/** The text a file stores for a paint. */
export function formatPaint(paint: Paint): string {
  switch (paint.kind) {
    case "solid":
      return paint.color;
    case "linear":
      return `linear-gradient(${Math.round(paint.angle * 10) / 10}deg, ${stopsText(paint.stops)})`;
    case "radial": {
      const size =
        paint.radius === null
          ? ""
          : `ellipse ${percent(paint.radius.x)} ${percent(paint.radius.y)} `;
      const at = `at ${percent(paint.center.x)} ${percent(paint.center.y)}`;
      return `radial-gradient(${size}${at}, ${stopsText(paint.stops)})`;
    }
  }
}

/** Why a paint's text can't be read, or the paint. */
export type PaintResult = { readonly paint: Paint } | { readonly error: string };

const FUNCTION = /^(linear|radial)-gradient\((.*)\)$/s;

/**
 * Reads a colour or gradient as files write it (see `Paint`). Errors say what to write instead,
 * since they are shown to people editing YAML by hand.
 */
export function parsePaint(input: string): PaintResult {
  const text = input.trim();
  const hex = normalizeHex(text);
  if (hex !== null) return { paint: { kind: "solid", color: hex } };
  const match = FUNCTION.exec(text.replace(/\s+/g, " "));
  if (match === null && /^(?:linear|radial)-gradient\([^)]*$/.test(text)) {
    // Unquoted in YAML, " #" starts a comment, so everything from the first colour is lost.
    return {
      error: `Put the gradient in quotes, like "linear-gradient(135deg, #431043, #d34681)". Without quotes, YAML reads " #" as the start of a comment and drops the colours.`,
    };
  }
  if (match === null) {
    return {
      error: `"${text}" isn't a colour. Use a hex colour like "#1f3528" or a gradient like "linear-gradient(135deg, #431043, #d34681)".`,
    };
  }
  const [, kind = "", body = ""] = match;
  const parts = body.split(",").map((part) => part.trim());
  const first = parts[0] ?? "";
  const startsWithColour = first.startsWith("#");
  const stopTexts = startsWithColour ? parts : parts.slice(1);
  const stops = readStops(stopTexts);
  if ("error" in stops) return stops;
  if (kind === "linear") {
    if (startsWithColour) return { paint: { kind: "linear", angle: 180, stops: stops.stops } };
    const angle = /^(-?\d+(?:\.\d+)?)deg$/.exec(first);
    if (angle === null) {
      return { error: `A linear gradient starts with an angle like "135deg", not "${first}".` };
    }
    return { paint: { kind: "linear", angle: Number(angle[1]) % 360, stops: stops.stops } };
  }
  if (startsWithColour) {
    return {
      paint: { kind: "radial", center: { x: 0.5, y: 0.5 }, radius: null, stops: stops.stops },
    };
  }
  const shape =
    /^(?:(circle|ellipse)\s*)?(?:(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*)?(?:at\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%)?$/.exec(
      first,
    );
  if (shape === null || first === "") {
    return {
      error: `A radial gradient starts with its centre, like "at 50% 50%", not "${first}".`,
    };
  }
  const [, , rx, ry, cx, cy] = shape;
  return {
    paint: {
      kind: "radial",
      center: {
        x: cx === undefined ? 0.5 : Number(cx) / 100,
        y: cy === undefined ? 0.5 : Number(cy) / 100,
      },
      radius:
        rx === undefined || ry === undefined ? null : { x: Number(rx) / 100, y: Number(ry) / 100 },
      stops: stops.stops,
    },
  };
}

function readStops(
  texts: readonly string[],
): { readonly stops: GradientStop[] } | { readonly error: string } {
  if (texts.length < 2 || texts.length > MAX_GRADIENT_STOPS) {
    return { error: `A gradient needs between 2 and ${MAX_GRADIENT_STOPS} colours.` };
  }
  const read: { color: string; offset: number | null }[] = [];
  for (const text of texts) {
    const match = /^(#[0-9a-fA-F]+)(?:\s+(\d+(?:\.\d+)?)%)?$/.exec(text);
    const color = match?.[1] === undefined ? null : normalizeHex(match[1]);
    if (match === null || color === null) {
      return {
        error: `"${text}" isn't a gradient colour. Use a hex colour, optionally with a position like "#431043 20%".`,
      };
    }
    read.push({ color, offset: match[2] === undefined ? null : Number(match[2]) / 100 });
  }
  const offsets = fillOffsets(read.map((stop) => stop.offset));
  return {
    stops: read.map((stop, index) => ({
      color: stop.color,
      offset: Math.min(1, Math.max(0, offsets[index] ?? 0)),
    })),
  };
}

function cssStops(stops: readonly GradientStop[]): string {
  return stops.map((stop) => `${stop.color} ${percent(stop.offset)}`).join(", ");
}

/** A paint as a CSS `background` value (the live canvas, swatches). */
export function paintCss(paint: Paint): string {
  switch (paint.kind) {
    case "solid":
      return paint.color;
    case "linear":
      return `linear-gradient(${paint.angle}deg, ${cssStops(paint.stops)})`;
    case "radial": {
      const size =
        paint.radius === null
          ? "farthest-corner"
          : `${percent(paint.radius.x)} ${percent(paint.radius.y)}`;
      return `radial-gradient(ellipse ${size} at ${percent(paint.center.x)} ${percent(paint.center.y)}, ${cssStops(paint.stops)})`;
    }
  }
}

/** Whether two paints draw the same (for marking the selected swatch). */
export function samePaint(a: Paint | null, b: Paint | null): boolean {
  if (a === null || b === null) return a === b;
  return formatPaint(a) === formatPaint(b);
}
