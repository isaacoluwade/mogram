/** Colour maths shared by themes, state looks and transitions. */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A hex colour as files store it: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (alpha last). */
export const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * A hex colour in the one form Mogram writes: lowercase `#rrggbb`, or `#rrggbbaa` when it is
 * not fully opaque. Null for anything that isn't a hex colour.
 */
export function normalizeHex(input: string): string | null {
  const value = input.trim();
  if (!HEX_COLOR.test(value)) return null;
  const digits = value.slice(1).toLowerCase();
  const long = digits.length <= 4 ? digits.replace(/./g, (c) => c + c) : digits;
  return long.length === 8 && long.endsWith("ff") ? `#${long.slice(0, 6)}` : `#${long}`;
}

/** `{ r, g, b, a }` as `#rrggbb`, or `#rrggbbaa` when translucent. */
export function formatHex({ r, g, b, a }: Rgba): string {
  const byte = (n: number): string =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  const alpha = Math.min(1, Math.max(0, a));
  return `#${byte(r)}${byte(g)}${byte(b)}${alpha >= 1 ? "" : byte(alpha * 255)}`;
}

/** Parses hex colours (with or without alpha) and `rgba(r,g,b,a)`. Unknown formats come back as transparent black. */
export function parseColor(input: string): Rgba {
  const value = input.trim();
  if (value.startsWith("#")) {
    const hex = normalizeHex(value);
    if (hex === null) return { r: 0, g: 0, b: 0, a: 0 };
    const n = Number.parseInt(hex.slice(1, 7), 16);
    const a = hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (match?.[1] !== undefined) {
    const parts = match[1].split(",").map((part) => Number.parseFloat(part));
    return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
  }
  return { r: 0, g: 0, b: 0, a: 0 };
}

export function formatColor({ r, g, b, a }: Rgba): string {
  const round = (n: number): number => Math.round(Math.min(255, Math.max(0, n)));
  return `rgba(${round(r)},${round(g)},${round(b)},${Math.round(Math.min(1, Math.max(0, a)) * 1000) / 1000})`;
}

/** Relative luminance of an opaque colour, 0 (black) to 1 (white), as WCAG 2 defines it. */
export function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast ratio (1 to 21) of `front` drawn on `back`. A translucent `front` is blended
 * onto the background first, which is how it will actually look.
 */
export function contrast(front: string, back: string): number {
  const bg = parseColor(back);
  const fg = parseColor(front);
  const blended = {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
  const [light, dark] = [luminance(blended), luminance(bg)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Hue 0..360, saturation and value 0..1: the model a colour picker's square and strip use. */
export interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

export function rgbToHsv({ r, g, b }: Rgba): Hsv {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv, a = 1): Rgba {
  const chroma = v * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] =
    sector < 1
      ? [chroma, x, 0]
      : sector < 2
        ? [x, chroma, 0]
        : sector < 3
          ? [0, chroma, x]
          : sector < 4
            ? [0, x, chroma]
            : sector < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = v - chroma;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a };
}
