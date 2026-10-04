import {
  GRADIENT_GROUPS,
  evenStops,
  formatHex,
  hsvToRgb,
  namedColors,
  normalizeHex,
  parseColor,
  rgbToHsv,
  samePaint,
  type GradientStop,
  type NamedPaint,
  type Paint,
} from "@mogram/core/presets";

/** The gradient shapes the picker offers, as Canva does: three directions and two radial centres. */
export const GRADIENT_STYLES = [
  { id: "linear-90", label: "Linear, left to right" },
  { id: "linear-180", label: "Linear, top to bottom" },
  { id: "linear-135", label: "Linear, diagonal" },
  { id: "radial-center", label: "Radial from the centre" },
  { id: "radial-corner", label: "Radial from the top-left corner" },
] as const;

export type GradientStyle = (typeof GRADIENT_STYLES)[number]["id"];

export function styled(style: GradientStyle, stops: readonly GradientStop[]): Paint {
  switch (style) {
    case "linear-90":
      return { kind: "linear", angle: 90, stops };
    case "linear-180":
      return { kind: "linear", angle: 180, stops };
    case "linear-135":
      return { kind: "linear", angle: 135, stops };
    case "radial-center":
      return { kind: "radial", center: { x: 0.5, y: 0.5 }, radius: null, stops };
    case "radial-corner":
      return { kind: "radial", center: { x: 0, y: 0 }, radius: null, stops };
  }
}

/** Which offered style a gradient is drawn in, if any. */
export function styleOf(paint: Paint): GradientStyle | null {
  if (paint.kind === "solid") return null;
  return (
    GRADIENT_STYLES.find((style) => samePaint(styled(style.id, paint.stops), paint))?.id ?? null
  );
}

/** The colour a gradient starts from when someone switches a solid colour to a gradient. */
export function seedGradient(color: string): Paint {
  const hsv = rgbToHsv(parseColor(color));
  const darker = formatHex(hsvToRgb({ ...hsv, v: Math.max(0.08, hsv.v * 0.45) }));
  return { kind: "linear", angle: 135, stops: evenStops([color, darker]) };
}

/** A gradient with one more colour, between its last two, and the stops spread evenly again. */
export function withAddedStop(paint: Paint): Paint {
  if (paint.kind === "solid") return paint;
  const colors = paint.stops.map((stop) => stop.color);
  const last = parseColor(colors[colors.length - 1] ?? "#000000");
  const before = parseColor(colors[colors.length - 2] ?? "#ffffff");
  const middle = formatHex({
    r: (last.r + before.r) / 2,
    g: (last.g + before.g) / 2,
    b: (last.b + before.b) / 2,
    a: (last.a + before.a) / 2,
  });
  const next = [...colors.slice(0, -1), middle, colors[colors.length - 1] ?? middle];
  return { ...paint, stops: evenStops(next) };
}

export function withoutStop(paint: Paint, index: number): Paint {
  if (paint.kind === "solid" || paint.stops.length <= 2) return paint;
  return {
    ...paint,
    stops: evenStops(paint.stops.filter((_, i) => i !== index).map((s) => s.color)),
  };
}

export function withStopColor(paint: Paint, index: number, color: string): Paint {
  if (paint.kind === "solid") return { kind: "solid", color };
  return {
    ...paint,
    stops: paint.stops.map((stop, i) => (i === index ? { ...stop, color } : stop)),
  };
}

export interface SearchResult {
  readonly name: string;
  readonly paint: Paint;
}

/**
 * Search by colour name ("blue") or hex ("#00c4cc", "00c4cc"); gradients by name too when the
 * picker offers them.
 */
export function searchPaints(query: string, gradients: boolean): SearchResult[] {
  const text = query.trim().toLowerCase();
  if (text === "") return [];
  const hex = normalizeHex(text.startsWith("#") ? text : `#${text}`);
  const results: SearchResult[] = [];
  if (hex !== null) results.push({ name: hex, paint: { kind: "solid", color: hex } });
  for (const entry of namedColors()) {
    if (entry.name.toLowerCase().includes(text)) {
      results.push({ name: entry.name, paint: { kind: "solid", color: entry.color } });
    }
  }
  if (gradients) {
    for (const entry of allGradients()) {
      if (entry.name.toLowerCase().includes(text)) results.push(entry);
    }
  }
  return results.slice(0, 42);
}

export function allGradients(): NamedPaint[] {
  return GRADIENT_GROUPS.flatMap((group) => group.gradients);
}

const RECENT_KEY = "mogram.colors.recent";
const RECENT_LIMIT = 6;

/** Colours this person made in the custom editor, newest first (a per-browser convenience). */
export function readRecentColors(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? normalizeHex(item) : null))
      .filter((item): item is string => item !== null)
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function rememberColor(color: string): string[] {
  const next = [color, ...readRecentColors().filter((c) => c !== color)].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); recent colours are a convenience only.
  }
  return next;
}
