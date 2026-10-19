import type { Box, Point } from "../layout/geometry";

/**
 * Geometric shapes (03-shapes-styles-library §5 P0-1): the outlines a shape element is drawn
 * with, from one registry so the canvas, hit testing, connection ends and exports share the
 * same geometry (draw.io's lesson: wrong perimeters are its most visible bug class).
 *
 * Each shape gives, for a box of w × h px: the filled outline (SVG path), optional detail
 * strokes that cast no shadow (a cylinder's lid edge), a sampled outline polygon for where
 * connections meet it, and the box its label wraps inside.
 */

export const SHAPES = [
  "rectangle",
  "rounded",
  "ellipse",
  "circle",
  "diamond",
  "cylinder",
  "queue",
  "cloud",
  "hexagon",
  "document",
  "person",
  "meter",
  "image",
  "code",
] as const;
export type ShapeId = (typeof SHAPES)[number];

export function isShapeId(value: unknown): value is ShapeId {
  return typeof value === "string" && (SHAPES as readonly string[]).includes(value);
}

export interface ShapeInfo {
  readonly label: string;
  readonly description: string;
  /** Default size in grid units (8 px). */
  readonly size: { readonly w: number; readonly h: number };
  /** Drawn square whatever its box (circle). */
  readonly square?: true;
  /** The label sits under the shape rather than inside it (person). */
  readonly labelBelow?: true;
}

export const SHAPE_INFO: Readonly<Record<ShapeId, ShapeInfo>> = {
  code: {
    label: "Code",
    description: "A listing with preserved indentation",
    size: { w: 60, h: 30 },
  },
  image: {
    label: "Image",
    description: "A picture with an optional caption",
    size: { w: 40, h: 25 },
    labelBelow: true,
  },
  rectangle: { label: "Rectangle", description: "A box, service or node", size: { w: 15, h: 8 } },
  rounded: { label: "Rounded", description: "A service or process", size: { w: 15, h: 8 } },
  ellipse: { label: "Ellipse", description: "A system boundary or state", size: { w: 15, h: 10 } },
  circle: {
    label: "Circle",
    description: "An event, junction, start or end",
    size: { w: 10, h: 10 },
    square: true,
  },
  diamond: { label: "Diamond", description: "A decision or gateway", size: { w: 12, h: 12 } },
  cylinder: { label: "Cylinder", description: "A database or storage", size: { w: 10, h: 12 } },
  queue: { label: "Queue", description: "A queue, stream, topic or bus", size: { w: 15, h: 8 } },
  cloud: {
    label: "Cloud",
    description: "The internet or an outside network",
    size: { w: 15, h: 10 },
  },
  hexagon: {
    label: "Hexagon",
    description: "A microservice or edge function",
    size: { w: 15, h: 10 },
  },
  document: { label: "Document", description: "A file, report or config", size: { w: 15, h: 10 } },
  person: {
    label: "Person",
    description: "A user or operator",
    size: { w: 6, h: 9 },
    labelBelow: true,
  },
  meter: {
    label: "Meter",
    description: "A value against a most: a bar, a timer ring or a number",
    size: { w: 18, h: 5 },
  },
};

/** Corner radius a `rounded` shape starts with, in px. */
export const ROUNDED_CORNER = 12;

export interface ShapeGeometry {
  /** The filled outline, in the shape's own coordinates (0,0 at its top-left). */
  readonly outline: string;
  /** Lines drawn over the fill and never shadowed (a cylinder's lid). */
  readonly details: string | null;
  /** The outline sampled as a closed polygon, for where connections meet the shape. */
  readonly polygon: readonly Point[];
  /** Where the label wraps, in the shape's own coordinates. */
  readonly label: Box;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Builds an SVG path and a sampled polygon from the same moves. */
class Outline {
  private readonly parts: string[] = [];
  readonly points: Point[] = [];
  private at: Point = { x: 0, y: 0 };

  move(x: number, y: number): this {
    this.parts.push(`M${round(x)} ${round(y)}`);
    this.at = { x, y };
    this.points.push(this.at);
    return this;
  }

  line(x: number, y: number): this {
    this.parts.push(`L${round(x)} ${round(y)}`);
    this.at = { x, y };
    this.points.push(this.at);
    return this;
  }

  quad(cx: number, cy: number, x: number, y: number): this {
    const from = this.at;
    this.parts.push(`Q${round(cx)} ${round(cy)} ${round(x)} ${round(y)}`);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      this.points.push({
        x: u * u * from.x + 2 * u * t * cx + t * t * x,
        y: u * u * from.y + 2 * u * t * cy + t * t * y,
      });
    }
    this.at = { x, y };
    return this;
  }

  cubic(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    const from = this.at;
    this.parts.push(
      `C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(x)} ${round(y)}`,
    );
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const u = 1 - t;
      this.points.push({
        x: u * u * u * from.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
        y: u * u * u * from.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
      });
    }
    this.at = { x, y };
    return this;
  }

  /**
   * Part of an ellipse centred on (cx, cy), from angle `a0` to `a1` in radians (0 = right,
   * increasing clockwise on screen), continuing from the current point.
   */
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): this {
    const end = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) };
    const sweep = a1 > a0 ? 1 : 0;
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    this.parts.push(
      `A${round(rx)} ${round(ry)} 0 ${large} ${sweep} ${round(end.x)} ${round(end.y)}`,
    );
    const steps = Math.max(4, Math.ceil((Math.abs(a1 - a0) / Math.PI) * 16));
    for (let i = 1; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      this.points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    this.at = end;
    return this;
  }

  close(): string {
    return `${this.parts.join(" ")} Z`;
  }
}

function roundedRect(w: number, h: number, corner: number): Outline {
  const r = Math.max(0, Math.min(corner, w / 2, h / 2));
  const o = new Outline();
  if (r === 0) return o.move(0, 0).line(w, 0).line(w, h).line(0, h);
  return o
    .move(r, 0)
    .line(w - r, 0)
    .arc(w - r, r, r, r, -Math.PI / 2, 0)
    .line(w, h - r)
    .arc(w - r, h - r, r, r, 0, Math.PI / 2)
    .line(r, h)
    .arc(r, h - r, r, r, Math.PI / 2, Math.PI)
    .line(0, r)
    .arc(r, r, r, r, Math.PI, (3 * Math.PI) / 2);
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Outline {
  return new Outline()
    .move(cx + rx, cy)
    .arc(cx, cy, rx, ry, 0, Math.PI)
    .arc(cx, cy, rx, ry, Math.PI, 2 * Math.PI);
}

const inset = (w: number, h: number, dx: number, dy: number): Box => ({
  x: dx,
  y: dy,
  w: Math.max(0, w - dx * 2),
  h: Math.max(0, h - dy * 2),
});

/**
 * The one adjustable measure some shapes have (03-shapes-styles-library P1-2, draw.io's yellow
 * handles), in px, written as a plain key: `corner` (rectangle, rounded), `lid` (cylinder,
 * queue), `slant` (hexagon) and `wave` (document). Unset, each takes the shape's own.
 */
export type ShapeParam = "corner" | "lid" | "slant" | "wave";

export type ShapeParams = Readonly<Partial<Record<ShapeParam, number | null>>>;

export interface ShapeAdjust {
  readonly key: ShapeParam;
  readonly label: string;
  /** The value when none is written. */
  readonly initial: (w: number, h: number) => number;
  /** The largest that still draws sensibly. */
  readonly max: (w: number, h: number) => number;
  /** Where the handle sits for `value`, in the shape's own coordinates. */
  readonly at: (w: number, h: number, value: number) => Point;
  /** The value for a handle dragged to `point` (before clamping and rounding). */
  readonly from: (w: number, h: number, point: Point) => number;
}

const cornerAdjust = (initial: number): ShapeAdjust => ({
  key: "corner",
  label: "Corners",
  initial: () => initial,
  max: (w, h) => Math.min(w, h) / 2,
  at: (w, h, value) => ({ x: Math.min(value, w / 2, h / 2), y: 0 }),
  from: (_w, _h, point) => point.x,
});

export const SHAPE_ADJUST: Readonly<Partial<Record<ShapeId, ShapeAdjust>>> = {
  rectangle: cornerAdjust(0),
  rounded: cornerAdjust(ROUNDED_CORNER),
  cylinder: {
    key: "lid",
    label: "Lid",
    initial: (_w, h) => Math.min(12, h / 4),
    max: (_w, h) => h / 3,
    // The front of the lid's edge: drag it down for a deeper lid.
    at: (w, _h, value) => ({ x: w / 2, y: value * 2 }),
    from: (_w, _h, point) => point.y / 2,
  },
  queue: {
    key: "lid",
    label: "Lid",
    initial: (w) => Math.min(12, w / 5),
    max: (w) => w / 3,
    at: (w, h, value) => ({ x: w - value * 2, y: h / 2 }),
    from: (w, _h, point) => (w - point.x) / 2,
  },
  hexagon: {
    key: "slant",
    label: "Slant",
    initial: (w) => Math.min(20, w / 4),
    max: (w) => w / 2,
    at: (_w, _h, value) => ({ x: value, y: 0 }),
    from: (_w, _h, point) => point.x,
  },
  document: {
    key: "wave",
    label: "Wave",
    initial: (_w, h) => Math.min(h * 0.12, 12),
    max: (_w, h) => h / 4,
    at: (_w, h, value) => ({ x: 0, y: h - value }),
    from: (_w, h, point) => h - point.y,
  },
};

/** A shape's adjustable measure for a w × h box: written, else its own, within its bounds. */
export function shapeParam(
  shape: ShapeId,
  w: number,
  h: number,
  params: ShapeParams,
): { readonly key: ShapeParam; readonly value: number } | null {
  const adjust = SHAPE_ADJUST[shape];
  if (adjust === undefined) return null;
  const written = params[adjust.key];
  const value = written ?? adjust.initial(w, h);
  return { key: adjust.key, value: Math.max(0, Math.min(value, adjust.max(w, h))) };
}

/**
 * The geometry of `shape` in a w × h box, with its adjustable measure (`corner`, `lid`, `slant`
 * or `wave`, in px) as written or the shape's own.
 */
export function shapeGeometry(
  shape: ShapeId,
  w: number,
  h: number,
  params: ShapeParams = {},
): ShapeGeometry {
  const measure = shapeParam(shape, w, h, params)?.value ?? 0;
  switch (shape) {
    case "code":
    case "image":
    case "rectangle":
    case "rounded": {
      const corner = measure;
      const o = roundedRect(w, h, corner);
      return { outline: o.close(), details: null, polygon: o.points, label: inset(w, h, 8, 4) };
    }
    case "ellipse": {
      const o = ellipse(w / 2, h / 2, w / 2, h / 2);
      // The largest box inside an ellipse is √½ of its axes.
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: inset(w, h, w * 0.15, h * 0.15),
      };
    }
    case "circle": {
      const d = Math.min(w, h);
      const o = ellipse(w / 2, h / 2, d / 2, d / 2);
      const side = d * Math.SQRT1_2;
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: { x: w / 2 - side / 2, y: h / 2 - side / 2, w: side, h: side },
      };
    }
    case "diamond": {
      const o = new Outline()
        .move(w / 2, 0)
        .line(w, h / 2)
        .line(w / 2, h)
        .line(0, h / 2);
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: inset(w, h, w * 0.14, h * 0.25),
      };
    }
    case "cylinder": {
      const lid = measure;
      const o = new Outline()
        .move(0, lid)
        .arc(w / 2, lid, w / 2, lid, Math.PI, 2 * Math.PI)
        .line(w, h - lid)
        .arc(w / 2, h - lid, w / 2, lid, 0, Math.PI)
        .line(0, lid);
      const details = `M0 ${round(lid)} A${round(w / 2)} ${round(lid)} 0 0 0 ${round(w)} ${round(lid)}`;
      return {
        outline: o.close(),
        details,
        polygon: o.points,
        label: { x: 6, y: lid * 2 + 2, w: Math.max(0, w - 12), h: Math.max(0, h - lid * 3 - 2) },
      };
    }
    case "queue": {
      const lid = measure;
      const o = new Outline()
        .move(lid, 0)
        .line(w - lid, 0)
        .arc(w - lid, h / 2, lid, h / 2, -Math.PI / 2, Math.PI / 2)
        .line(lid, h)
        .arc(lid, h / 2, lid, h / 2, Math.PI / 2, (3 * Math.PI) / 2);
      const details = `M${round(w - lid)} 0 A${round(lid)} ${round(h / 2)} 0 0 0 ${round(w - lid)} ${round(h)}`;
      return {
        outline: o.close(),
        details,
        polygon: o.points,
        label: { x: lid + 4, y: 4, w: Math.max(0, w - lid * 3 - 8), h: Math.max(0, h - 8) },
      };
    }
    case "cloud": {
      // draw.io's cloud (mxCloud), scaled to the box.
      const o = new Outline()
        .move(0.25 * w, 0.25 * h)
        .cubic(0.05 * w, 0.25 * h, 0, 0.5 * h, 0.16 * w, 0.55 * h)
        .cubic(0, 0.66 * h, 0.18 * w, 0.9 * h, 0.31 * w, 0.8 * h)
        .cubic(0.4 * w, h, 0.7 * w, h, 0.8 * w, 0.8 * h)
        .cubic(w, 0.8 * h, w, 0.6 * h, 0.875 * w, 0.5 * h)
        .cubic(w, 0.3 * h, 0.8 * w, 0.1 * h, 0.625 * w, 0.2 * h)
        .cubic(0.5 * w, 0.05 * h, 0.3 * w, 0.05 * h, 0.25 * w, 0.25 * h);
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: { x: w * 0.16, y: h * 0.28, w: w * 0.68, h: h * 0.5 },
      };
    }
    case "hexagon": {
      const slant = measure;
      const o = new Outline()
        .move(slant, 0)
        .line(w - slant, 0)
        .line(w, h / 2)
        .line(w - slant, h)
        .line(slant, h)
        .line(0, h / 2);
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: inset(w, h, slant * 0.75, 4),
      };
    }
    case "document": {
      const wave = measure;
      const o = new Outline()
        .move(0, 0)
        .line(w, 0)
        .line(w, h - wave)
        .quad((3 * w) / 4, h - wave * 3, w / 2, h - wave)
        .quad(w / 4, h + wave, 0, h - wave);
      return {
        outline: o.close(),
        details: null,
        polygon: o.points,
        label: { x: 8, y: 4, w: Math.max(0, w - 16), h: Math.max(0, h - wave * 2 - 6) },
      };
    }
    case "meter": {
      // A plain rounded box: what's in it (a bar, a ring, a number) is drawn by the renderer.
      const o = roundedRect(w, h, Math.min(10, h / 2));
      return { outline: o.close(), details: null, polygon: o.points, label: inset(w, h, 10, 4) };
    }
    case "person": {
      // A head over shoulders, filling the box; the label goes underneath.
      const head = Math.min(w * 0.36, h * 0.24);
      const neck = head * 2 + h * 0.04;
      const r = Math.min(w * 0.3, (h - neck) * 0.45);
      const body = new Outline()
        .move(0, h)
        .line(0, neck + r)
        .arc(r, neck + r, r, r, Math.PI, (3 * Math.PI) / 2)
        .line(w - r, neck)
        .arc(w - r, neck + r, r, r, (3 * Math.PI) / 2, 2 * Math.PI)
        .line(w, h);
      const headPath = `M${round(w / 2 + head)} ${round(head)} A${round(head)} ${round(head)} 0 1 1 ${round(w / 2 - head)} ${round(head)} A${round(head)} ${round(head)} 0 1 1 ${round(w / 2 + head)} ${round(head)} Z`;
      return {
        outline: `${body.close()} ${headPath}`,
        details: null,
        polygon: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        label: { x: -24, y: h + 4, w: w + 48, h: 18 },
      };
    }
  }
}

/**
 * Where a line between `inside` and `outside` crosses the shape's outline (`box` in world px):
 * the crossing nearest `outside`, so lines stop at the drawn edge rather than the bounding box.
 * Falls back to `outside` when the line doesn't cross it.
 */
export function shapePerimeter(
  polygon: readonly Point[],
  box: Box,
  inside: Point,
  outside: Point,
): Point {
  let best: Point | null = null;
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i] as Point;
    const b = polygon[(i + 1) % polygon.length] as Point;
    const p = { x: box.x + a.x, y: box.y + a.y };
    const q = { x: box.x + b.x, y: box.y + b.y };
    const hit = segmentCrossing(inside, outside, p, q);
    if (hit === null) continue;
    const d = Math.hypot(hit.x - outside.x, hit.y - outside.y);
    if (d < nearest) {
      nearest = d;
      best = hit;
    }
  }
  return best ?? outside;
}

function segmentCrossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}
