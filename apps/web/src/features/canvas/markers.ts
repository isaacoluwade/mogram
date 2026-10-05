import { DEFAULT_LINE_WIDTH, type Arrowhead } from "@mogram/core/presets";
import type { Point } from "@mogram/core/layout";

/**
 * Arrowhead shapes (ED-29), drawn the way draw.io's markers are (02-connectors §9): the tip sits
 * on the line's end, the shape grows back along the line, and closed shapes report how far the
 * line must stop short (`inset`) so a thick line never pokes through the tip.
 *
 * Shapes are in local coordinates with the tip at (0, 0) pointing along +x.
 */
export interface MarkerShape {
  readonly d: string;
  /** Filled with the line colour. */
  readonly filled: boolean;
  /** Outline shapes cover the line behind them with the canvas colour. */
  readonly knockout: boolean;
  /** How far before the tip the line stops. */
  readonly inset: number;
}

const f = (value: number): string => (Math.round(value * 100) / 100).toString();

/** Length of an arrowhead of `size` on a line of `width` (wider lines get larger heads). */
export function markerLength(size: number, width: number): number {
  return size + Math.max(0, width - DEFAULT_LINE_WIDTH) * 1.5;
}

export function markerShape(kind: Arrowhead, size: number, width: number): MarkerShape | null {
  if (kind === "none") return null;
  const L = markerLength(size, width);
  const h = L * 0.5;
  const shape = (d: string, filled: boolean, inset: number, knockout = false): MarkerShape => ({
    d,
    filled,
    knockout,
    inset,
  });
  const bar = (x: number, half = h) => `M${f(x)} ${f(-half)} L${f(x)} ${f(half)}`;
  const circle = (cx: number, r: number) =>
    `M${f(cx - r)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`;
  const crowsFoot = `M0 ${f(-h)} L${f(-L)} 0 L0 ${f(h)}`;
  switch (kind) {
    case "open": {
      const a = 0.45;
      return shape(
        `M${f(-L * Math.cos(a))} ${f(-L * Math.sin(a))} L0 0 L${f(-L * Math.cos(a))} ${f(L * Math.sin(a))}`,
        false,
        0,
      );
    }
    case "classic":
    case "classic-outline":
      return shape(
        `M0 0 L${f(-L)} ${f(-h)} L${f(-L * 0.7)} 0 L${f(-L)} ${f(h)} Z`,
        kind === "classic",
        L * 0.7,
        kind === "classic-outline",
      );
    case "block":
    case "block-outline":
      return shape(
        `M0 0 L${f(-L)} ${f(-h)} L${f(-L)} ${f(h)} Z`,
        kind === "block",
        L,
        kind === "block-outline",
      );
    case "async":
      return shape(`M0 0 L${f(-L)} ${f(-h)} L${f(-L)} 0 Z`, true, 0);
    case "oval":
    case "oval-outline":
      return shape(circle(-h, h), kind === "oval", L, kind === "oval-outline");
    case "diamond":
    case "diamond-outline":
      return shape(
        `M0 0 L${f(-L / 2)} ${f(-h * 0.8)} L${f(-L)} 0 L${f(-L / 2)} ${f(h * 0.8)} Z`,
        kind === "diamond",
        L,
        kind === "diamond-outline",
      );
    case "dash":
      return shape(bar(-L * 0.4), false, 0);
    case "cross": {
      const c = -L * 0.5;
      const r = h * 0.8;
      return shape(
        `M${f(c - r)} ${f(-r)} L${f(c + r)} ${f(r)} M${f(c - r)} ${f(r)} L${f(c + r)} ${f(-r)}`,
        false,
        0,
      );
    }
    case "er-one":
      return shape(bar(-L * 0.6), false, 0);
    case "er-mandatory-one":
      return shape(`${bar(-L * 0.45)} ${bar(-L * 0.85)}`, false, 0);
    case "er-many":
      return shape(crowsFoot, false, 0);
    case "er-one-many":
      return shape(`${crowsFoot} ${bar(-L * 1.25)}`, false, 0);
    case "er-zero-one":
      return shape(`${bar(-L * 0.45)} ${circle(-L * 1.15, h * 0.55)}`, false, 0, true);
    case "er-zero-many":
      return shape(`${crowsFoot} ${circle(-L * 1.4, h * 0.55)}`, false, 0, true);
  }
}

/** SVG transform placing a marker's tip at `tip`, pointing along `angle` (radians). */
export function markerTransform(tip: Point, angle: number): string {
  return `translate(${f(tip.x)} ${f(tip.y)}) rotate(${f((angle * 180) / Math.PI)})`;
}
