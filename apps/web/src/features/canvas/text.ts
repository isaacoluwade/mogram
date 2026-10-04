import { useSyncExternalStore } from "react";

/**
 * Label text measurement and wrapping. Uses a canvas 2D context in the browser for exact widths
 * (so export matches the screen), with an estimate where no canvas exists.
 */

let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/**
 * Widths measured before the web fonts finish loading use fallback metrics. When the fonts are
 * ready the cache is cleared and `useFontsVersion` changes, so diagrams measure again.
 */
let fontsVersion = 0;
const fontListeners = new Set<() => void>();

function fontsChanged(): void {
  widths.clear();
  fontsVersion++;
  for (const listener of fontListeners) listener();
}

function measureContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  context =
    typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (context !== null && document.fonts.status !== "loaded") {
    void document.fonts.ready.then(fontsChanged);
  }
  return context;
}

/**
 * Fonts load when first used, so a font picked for a note (ED-25) may not be loaded when its
 * text is first measured: load it, then measure again.
 */
const requested = new Set<string>();
function ensureFont(font: string): void {
  if (requested.has(font)) return;
  requested.add(font);
  if (document.fonts.check(font)) return;
  void document.fonts.load(font).then(
    (faces) => {
      if (faces.length > 0) fontsChanged();
    },
    () => undefined,
  );
}

/** Loads font stacks before measuring with them (exports measure once, so they wait). */
export async function loadFonts(families: readonly string[]): Promise<void> {
  if (typeof document === "undefined" || families.length === 0) return;
  const loads = families.flatMap((family) => {
    for (const weight of [400, 700]) requested.add(`${weight} 16px ${family}`);
    return [400, 700].map((weight) =>
      document.fonts.load(`${weight} 16px ${family}`).catch(() => []),
    );
  });
  const faces = await Promise.all(loads);
  if (faces.some((list) => list.length > 0)) fontsChanged();
}

/** Changes once the web fonts have loaded (so text measured too early is measured again). */
export function useFontsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      fontListeners.add(listener);
      return () => fontListeners.delete(listener);
    },
    () => fontsVersion,
    () => 0,
  );
}

export function measure(
  text: string,
  size: number,
  weight = 500,
  family = "Inter, sans-serif",
): number {
  const key = `${weight}|${size}|${family}|${text}`;
  const cached = widths.get(key);
  if (cached !== undefined) return cached;
  const ctx = measureContext();
  let width: number;
  if (ctx === null) {
    width = text.length * size * 0.56;
  } else {
    ctx.font = `${weight} ${size}px ${family}`;
    ensureFont(`${weight} 16px ${family}`);
    width = ctx.measureText(text).width;
  }
  if (widths.size > 5000) widths.clear();
  widths.set(key, width);
  return width;
}

/** Word-wraps into at most `maxLines` lines, ending with an ellipsis if it overflows. */
export function wrap(
  text: string,
  maxWidth: number,
  size: number,
  maxLines = 2,
  weight = 500,
  family?: string,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";
  const fits = (value: string): boolean => measure(value, size, weight, family) <= maxWidth;
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? "";
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current.length > 0) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) {
      const rest = words.slice(i).join(" ");
      lines.push(ellipsize(rest, maxWidth, size, weight, family));
      return lines;
    }
  }
  if (current.length > 0)
    lines.push(fits(current) ? current : ellipsize(current, maxWidth, size, weight, family));
  return lines.slice(0, maxLines);
}

export function ellipsize(
  text: string,
  maxWidth: number,
  size: number,
  weight = 500,
  family?: string,
): string {
  if (measure(text, size, weight, family) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && measure(`${text.slice(0, end)}…`, size, weight, family) > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}
