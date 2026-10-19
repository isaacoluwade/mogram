import type {
  Component,
  DataValue,
  ElementLink,
  Connection,
  ConnectionLabelPlace,
  Decoration,
  Diagram,
  Intensity,
  ProjectFiles,
  ScaleSize,
  Speed,
  TextLook,
  TextStyle,
  Tone,
} from "@mogram/core/model";
import { withPlaceholders } from "@mogram/core/model";
import {
  byZThenOrder,
  containerRenderOrder,
  GRID,
  LABEL,
  paintOrder,
  frameOf,
  placeMovers,
  codeFontSize,
  partBox,
  textStyleSize,
  type Box,
  type LayoutResult,
  type PaintEntry,
  type Point,
} from "@mogram/core/layout";
import {
  DEFAULT_ARROW_SIZE,
  DEFAULT_LINE_WIDTH,
  LINE_DASHES,
  SHAPE_INFO,
  TONES,
  shapeGeometry,
  solid,
  type ShapeId,
  type TextAlign,
  type ContainerStyleName,
  presenceOpacity,
  type FlowPreset,
  type Mark,
  type MotionPreset,
  type Paint,
  type StatePreset,
} from "@mogram/core/presets";
import {
  JUMP_SIZE,
  crossingsOn,
  jumpedPolyline,
  labelPosition,
  midpointOf,
  pointAlong,
  pointAtLength,
  RouteCache,
  routeConnections,
  trimPath,
  trimPolyline,
  type RoutedPath,
} from "@mogram/core/routing";
import { markerShape, markerTransform, type MarkerShape } from "./markers";
import type { ResolvedState } from "@mogram/core/state";
import { numberOf, scopeOf } from "@mogram/core/picture";
import { isFormula, type Scope } from "@mogram/core/values";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import { CapacityTimeline, isQueue } from "@mogram/core/capacity";
import { fontStack } from "./fonts";
import { iconSource, type IconSource } from "./icons";
import { fitRich, layoutRich, parseRich, type RichLayout } from "./rich-text";
import { measure, wrap } from "./text";
import type { CanvasTheme } from "./theme";
import { highlight, type Token } from "@mogram/core/code";

/**
 * Everything the SVG renderer draws, already positioned and resolved. Built from the diagram,
 * its layout and routes, and the state before/after the current scene change (SC-7).
 */

export interface Pair<T> {
  readonly from: T;
  readonly to: T;
}

export interface SceneComponent {
  /** What an image shows (D-102); null for anything else. */
  readonly image: SceneImage | null;
  /** What a listing shows (D-103); null for anything else. */
  readonly code: SceneCode | null;
  /** Its parts (D-104), in the order they're written. */
  readonly parts: readonly ScenePart[];
  readonly name: string;
  readonly label: string;
  readonly lines: readonly string[];
  readonly box: Box;
  readonly tile: Box;
  readonly icon: IconSource;
  readonly state: Pair<StatePreset>;
  readonly motion: MotionPreset;
  readonly intensity: Intensity;
  readonly speed: Speed;
  readonly color: string | null;
  readonly hasCard: boolean;
  readonly opens: boolean;
  readonly pinned: boolean;
  /** Drawn as a geometric outline instead of an icon tile (shapes, M4). */
  readonly shape: SceneShape | null;
  /** Where a click goes in the viewer, and the hover text listing its data (07 §18). */
  readonly link: ElementLink | null;
  readonly tooltip: string | null;
  /** How it scales (D-82), and the room it keeps for that; null when it doesn't. */
  readonly scaling: SceneScaling | null;
  /** Shows how loaded it is (it has a capacity of its own). */
  readonly measured: boolean;
  /** Holds traffic its consumers can't take yet: shows how full it is. */
  readonly queue: boolean;
  /** A cache's hit rate in this scene. */
  readonly hit: number | null;
  /** The sign at its corner (D-86). */
  readonly mark: Mark | null;
  /** What a meter shows (D-88): its value at each end of the step's run, against its most. */
  readonly meter: SceneMeter | null;
}

/** A picture an image element shows (D-102): its file's text, which a renderer turns into a source. */
export interface SceneImage {
  /** A pointer, a `data:` picture or an SVG's text; empty when the file isn't there. */
  readonly content: string;
  readonly fit: "contain" | "cover";
}

/** A code listing as drawn (D-103): the lines shown, coloured, with what frames them. */
export interface SceneCode {
  /** The shown lines' tokens, in order; the first is line `first` of the file. */
  readonly lines: readonly (readonly Token[])[];
  readonly first: number;
  /** The text or file isn't there: drawn as a missing listing. */
  readonly missing: boolean;
  readonly fontSize: number;
  /** The header's words; null for none. */
  readonly title: string | null;
  readonly numbers: boolean;
}

/** A part as drawn (D-104), its box in the element's own coordinates, its look easing like any other. */
export interface ScenePart {
  readonly name: string;
  /** `element.part`: what focus names. */
  readonly target: string;
  readonly kind: "lines" | "area";
  /** For lines: the file's numbers of the first and last. */
  readonly first: number;
  readonly last: number;
  readonly box: Box;
  /** How strongly it's there, before and after a change of picture. */
  readonly show: Pair<number>;
  readonly tone: Pair<Tone | null>;
  readonly mark: Pair<Mark | null>;
}

export interface SceneMeter {
  readonly as: "bar" | "ring" | "number";
  /** Where the value starts and ends across the step showing (the same when it isn't running). */
  readonly value: Pair<number>;
  readonly max: number;
  readonly limit: number | null;
  readonly unit: string;
}

/** How a scaling component is drawn (D-82). */
export type SceneScaling =
  | {
      readonly kind: "out";
      readonly min: number;
      readonly max: number;
      /** The frame's full room; copies fill it in rows. */
      readonly room: Box;
      /** Its container is its scale set: the container grows and shrinks instead of a frame. */
      readonly framed: boolean;
    }
  | { readonly kind: "up"; readonly sizes: readonly ScaleSize[]; readonly room: Box };

/** A shape's outline and look, resolved against the theme (03-shapes-styles-library P0). */
export interface SceneShape {
  readonly id: ShapeId;
  /** Outline, detail strokes and label box in the shape's own coordinates (0,0 = its corner). */
  readonly outline: string;
  readonly details: string | null;
  readonly label: Box;
  /** What fills the outline: an opaque base, then the tone's tint or the file's own fill. */
  readonly base: string;
  readonly fill: Paint;
  readonly stroke: string | null;
  readonly strokeWidth: number;
  readonly dash: readonly number[] | null;
  readonly shadow: boolean;
  /** 0–1. */
  readonly opacity: number;
  readonly text: {
    readonly lines: readonly string[];
    readonly size: number;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly color: string;
    readonly align: TextAlign;
    readonly family: string;
  };
  readonly labelBelow: boolean;
}

/** Hover text for an element with custom data: its label, then one line per value. */
export function tooltipOf(label: string, data: ReadonlyMap<string, DataValue>): string | null {
  if (data.size === 0) return null;
  return [label, ...[...data].map(([key, value]) => `${key}: ${String(value)}`)].join("\n");
}

/** Default label size inside shapes, in px. */
export const SHAPE_TEXT_SIZE = 13;

function sceneShape(
  component: Component,
  box: Box,
  theme: CanvasTheme,
  defaultFamily: string | undefined,
): SceneShape | null {
  const shape = component.shape;
  const look = component.look;
  if (shape === null || look === null) return null;
  const geometry = shapeGeometry(shape, box.w, box.h, look);
  const colors = TONES[look.tone][theme.mode];
  const neutral = look.tone === "neutral";
  const text = look.text;
  const family = text.font === null ? (defaultFamily ?? fontStack("inter")) : fontStack(text.font);
  const size = text.fontSize ?? SHAPE_TEXT_SIZE;
  const weight = text.bold ? 650 : 500;
  const info = SHAPE_INFO[shape];
  const lineHeight = size * 1.3;
  const maxLines = Math.max(1, Math.floor(geometry.label.h / lineHeight));
  const width = info.labelBelow === true ? Math.max(geometry.label.w, 140) : geometry.label.w;
  return {
    id: shape,
    outline: geometry.outline,
    details: geometry.details,
    label: geometry.label,
    base: theme.tile,
    fill: look.fill ?? solid(neutral ? theme.tile : colors.fill),
    stroke:
      look.stroke === "none" ? null : (look.stroke ?? (neutral ? theme.tileBorder : colors.border)),
    strokeWidth: look.strokeWidth,
    dash:
      look.dash === "solid"
        ? null
        : (LINE_DASHES[look.dash] ?? []).map((v) => v * Math.max(1, look.strokeWidth / 1.5)),
    shadow: look.shadow,
    opacity: look.opacity / 100,
    text: {
      lines: wrap(
        component.label,
        width,
        size,
        info.labelBelow === true ? 2 : maxLines,
        weight,
        family,
      ),
      size,
      bold: text.bold,
      italic: text.italic,
      color: text.color ?? (neutral ? theme.text : colors.text),
      align: text.align,
      family,
    },
    labelBelow: info.labelBelow === true,
  };
}

export interface SceneContainer {
  readonly name: string;
  readonly label: string;
  readonly type: ContainerStyleName;
  readonly icon: IconSource | null;
  readonly box: Box;
  readonly state: Pair<StatePreset>;
  /** Roll-up states are shown quietly (border + badge); a container's own state also tints it. */
  readonly rolledUp: Pair<boolean>;
  readonly color: string | null;
  readonly hasCard: boolean;
  readonly depth: number;
  readonly link: ElementLink | null;
  readonly tooltip: string | null;
  /** The scaled-out component this container is the scale set of: it grows and shrinks with it. */
  readonly frames: {
    readonly component: string;
    readonly max: number;
    /** The component's room: the container shrinks by however much of it is empty. */
    readonly room: Box;
  } | null;
  readonly mark: Mark | null;
  /** It arranges what's in it (D-87): drawn as a plain tray, with a small title. */
  readonly tray: boolean;
}

export interface SceneConnection {
  readonly name: string;
  readonly path: RoutedPath;
  readonly flow: Pair<FlowPreset>;
  readonly direction: "forward" | "reverse" | "both";
  readonly speed: Speed;
  readonly density: "low" | "normal" | "high";
  readonly color: string | null;
  readonly label: string | null;
  readonly labelAt: Point;
  /** Whether the label sits where the author put it (ED-29) rather than where it fits best. */
  readonly labelPlaced: boolean;
  readonly hasCard: boolean;
  readonly look: ConnectionLook;
  readonly fromElement: string;
  readonly toElement: string;
  /** Its dots follow the traffic it carries (D-82): the diagram models capacity. */
  readonly carries: boolean;
}

/** How a connection is drawn (ED-29): its line, dash and arrowheads, resolved for rendering. */
export interface ConnectionLook {
  readonly width: number;
  /** Dash lengths in px, already scaled to the width; null = solid. */
  readonly dash: readonly number[] | null;
  /** The drawn line, stopped short of filled arrowheads. */
  readonly lineD: string;
  readonly start: SceneMarker | null;
  readonly end: SceneMarker | null;
}

export interface SceneMarker {
  readonly shape: MarkerShape;
  readonly transform: string;
}

/** The default look: a plain line with an open arrow at the end (parent stubs, previews). */
export function plainLook(path: RoutedPath): ConnectionLook {
  return connectionLook(
    {
      width: DEFAULT_LINE_WIDTH,
      dash: null,
      line: "solid",
      arrows: { start: "none", end: "open" },
      arrowSize: { start: DEFAULT_ARROW_SIZE, end: DEFAULT_ARROW_SIZE },
      jumps: "none",
    },
    path,
    [],
  );
}

/** The line a connection is drawn along, for finding where others cross it. */
const crossingLine = (path: RoutedPath): readonly Point[] =>
  path.kind === "polyline" ? path.points : path.samples;

/**
 * `below` holds the lines of connections drawn before this one: where a straight run crosses
 * one of them it jumps (ED-29), as draw.io's later edges hop over earlier ones.
 */
function connectionLook(
  connection: Pick<Connection, "width" | "dash" | "line" | "arrows" | "arrowSize" | "jumps">,
  path: RoutedPath,
  below: readonly (readonly Point[])[],
): ConnectionLook {
  const width = connection.width;
  const pattern = connection.dash ?? LINE_DASHES[connection.line];
  const scale = width / DEFAULT_LINE_WIDTH;
  const samples = path.samples;
  const place = (end: "start" | "end"): SceneMarker | null => {
    const kind = end === "start" ? connection.arrows.start : connection.arrows.end;
    const size = end === "start" ? connection.arrowSize.start : connection.arrowSize.end;
    const shape = markerShape(kind, size, width);
    const tip = end === "start" ? samples[0] : samples[samples.length - 1];
    if (shape === null || tip === undefined || samples.length < 2) return null;
    const near = pointAtLength(samples, end === "start" ? 6 : path.length - 6).point;
    const angle = Math.atan2(tip.y - near.y, tip.x - near.x);
    return { shape, transform: markerTransform(tip, angle) };
  };
  const start = place("start");
  const end = place("end");
  const startInset = start?.shape.inset ?? 0;
  const endInset = end?.shape.inset ?? 0;
  let lineD = trimPath(path, startInset, endInset);
  if (connection.jumps !== "none" && path.kind === "polyline" && below.length > 0) {
    const points = trimPolyline(path.points, startInset, endInset);
    const size = JUMP_SIZE * Math.max(1, scale * 0.75);
    const crossings = crossingsOn(points, below, size + path.radius);
    if (crossings.some((found) => found.length > 0)) {
      lineD = jumpedPolyline(points, path.radius, crossings, connection.jumps, size);
    }
  }
  return {
    width,
    dash: pattern === null ? null : pattern.map((value) => value * scale),
    lineD,
    start,
    end,
  };
}

export interface SceneGroup {
  readonly name: string;
  readonly label: string;
  readonly box: Box;
}

export interface SceneDecoration {
  readonly width?: number | null;
  readonly name: string;
  readonly variant: Decoration["variant"];
  readonly text: string;
  readonly tone: Tone;
  readonly style: TextStyle;
  readonly box: Box;
  /** Free text and notes: how their words are set, and the words laid out (ED-25). */
  readonly look: TextLook | null;
  readonly rich: RichLayout | null;
  readonly family: string | null;
  /** A note's fill. */
  readonly fill: Paint | null;
}

/** Space between a sticky note's edge and its words. */
export const NOTE_PADDING = 14;

function richDecoration(
  decoration: Decoration,
  box: Box,
): Pick<SceneDecoration, "look" | "rich" | "family" | "fill"> {
  if (decoration.variant === "note") {
    const { look } = decoration;
    const family = fontStack(look.font ?? "inter");
    const options = {
      family,
      weight: 400,
      bold: look.bold,
      italic: look.italic,
      tracking: 0,
      maxWidth: box.w - NOTE_PADDING * 2,
    };
    const paragraphs = parseRich(decoration.text);
    const rich =
      look.fontSize === null
        ? fitRich(paragraphs, options, box.h - NOTE_PADDING * 2)
        : layoutRich(paragraphs, { ...options, fontSize: look.fontSize });
    return { look, rich, family, fill: decoration.fill };
  }
  if (decoration.variant === "text") {
    const { look, style } = decoration;
    const display = style === "title" || style === "heading";
    const family = fontStack(look.font ?? (display ? "geist" : "inter"));
    const rich = layoutRich(parseRich(decoration.text), {
      family,
      fontSize: look.fontSize ?? textStyleSize(style),
      weight: display ? 500 : 400,
      bold: look.bold,
      italic: look.italic,
      tracking: style === "title" ? -0.6 : style === "heading" ? -0.3 : 0,
      maxWidth: decoration.width === null ? Number.POSITIVE_INFINITY : decoration.width * 8,
    });
    return { look, rich, family, fill: null };
  }
  return { look: null, rich: null, family: null, fill: null };
}

export interface SceneModel {
  readonly theme: CanvasTheme;
  readonly containers: readonly SceneContainer[];
  readonly components: readonly SceneComponent[];
  readonly connections: readonly SceneConnection[];
  readonly groups: readonly SceneGroup[];
  readonly zones: readonly SceneDecoration[];
  readonly texts: readonly SceneDecoration[];
  /** Back-to-front drawing order: each container is drawn with everything inside it (ED-23). */
  readonly paint: readonly PaintEntry[];
  /** What's framed: the page when the diagram has one (D-98), else its contents. */
  readonly bounds: Box;
  /** The diagram's page, when it has one. Outside the editor nothing beyond it is drawn. */
  readonly page: Box | null;
  /** Clock time the current scene change started, or null when settled. */
  readonly transitionStart: number | null;
  /** How long that change takes, in seconds. */
  readonly transitionSeconds: number;
  /**
   * How strongly things are drawn (D-86), by `kind:name` as painted: faded things, and during a
   * change of picture, what's arriving (from 0) and leaving (to 0). Absent = fully there.
   */
  readonly presence: ReadonlyMap<string, Pair<number>>;
  /** Things whose words or look are changing: the old is drawn fading out under the new. */
  readonly crossfade: ReadonlySet<string>;
  /** The picture being left, for what's leaving or crossfading; null when settled. */
  readonly leaving: SceneModel | null;
  /** What a story step keeps bright while the rest dims; null when nothing dims. */
  readonly focus: ReadonlySet<string> | null;
  /**
   * Things on their way from one place to another while the picture changes (D-87): where each
   * started, and the line it follows there when a connection joins the two places.
   */
  readonly travel: ReadonlyMap<string, Travel>;
  /** The layout as it stands at this moment: what a layout places is where the picture has it. */
  readonly layout: LayoutResult;
  /** When the step showing began and how long its values take to run (D-88); null: settled. */
  readonly ramp: { readonly start: number; readonly seconds: number } | null;
  /**
   * Where traffic reaches and leaves each scaling component (D-82): the ends of its connections
   * (and its scale set's), so traffic can be drawn fanning out to every copy.
   */
  readonly spokes: ReadonlyMap<string, SceneSpokes>;
  /** The capacity plan, settled: what a still picture (or a canvas without a timeline) shows. */
  readonly settled: CapacityTimeline | null;
}

export interface Travel {
  /** Where its centre was, and is now. */
  readonly from: Point;
  readonly to: Point;
  /** The line it follows, from `from` to `to`; null: straight there. */
  readonly along: readonly Point[] | null;
}

export interface SceneSpokes {
  readonly in: readonly SpokeEnd[];
  readonly out: readonly SpokeEnd[];
}

export interface SpokeEnd {
  readonly connection: string;
  readonly at: Point;
}

export interface SceneInput {
  readonly diagram: Diagram;
  readonly files: ProjectFiles;
  readonly layout: LayoutResult;
  readonly routes: ReadonlyMap<string, RoutedPath>;
  readonly current: ResolvedState;
  /** State before the scene change; omit when nothing is transitioning. */
  readonly previous?: ResolvedState | null;
  readonly transitionStart?: number | null;
  /** Seconds the change takes (a slow step takes longer); the usual when left out. */
  readonly transitionSeconds?: number;
  /**
   * Draw what's hidden too, faintly (the editor): something that isn't there yet can still be
   * selected, placed and styled.
   */
  readonly ghosts?: boolean;
  /**
   * Things a layout places that are being dragged (the editor): drawn this far from where
   * they're placed until the drop says where they go.
   */
  readonly dragged?: {
    readonly names: ReadonlySet<string>;
    readonly dx: number;
    readonly dy: number;
  };
  /** When the step showing began and how long it lasts: values run across it (`[30, 0]`). */
  readonly ramp?: { readonly start: number; readonly seconds: number } | null;
  readonly theme: CanvasTheme;
  /** Label font family used for measuring (must match what the SVG renders with). */
  readonly fontFamily?: string;
  /**
   * `useFontsVersion()`: text measured before the web fonts loaded is measured again once they
   * have, so live canvases pass it to rebuild then. Exports measure after loading the fonts.
   */
  readonly fontsVersion?: number;
  /** Label places overriding the file's while a label is dragged. */
  readonly labelPlaces?: ReadonlyMap<string, ConnectionLabelPlace>;
}

const LABEL_SIZE = 12;

/** Routes of connections that touch something a layout places, kept between pictures. */
const placedRoutes = new RouteCache();

/**
 * The layout and routes as they stand for a picture (D-87): what a layout places is put where
 * the picture has it (in which container, riding on what), and the connections touching those
 * things are routed to where they are now. Everything else is as given.
 */
function settle(
  input: SceneInput,
  drawn: Diagram,
): { readonly layout: LayoutResult; readonly routes: ReadonlyMap<string, RoutedPath> } {
  if (input.layout.movers.length === 0) return { layout: input.layout, routes: input.routes };
  const picture = input.current.picture;
  const whole = picture?.whole ?? input.diagram;
  const absent = new Set(
    [...(picture?.presence ?? [])].filter(([, value]) => value === "hidden").map(([name]) => name),
  );
  const first = placeMovers(input.layout, input.diagram, whole, { absent });
  const movers = new Set(first.movers);
  const touching = new Map(
    [...drawn.connections].filter(
      ([, connection]) => movers.has(connection.from.element) || movers.has(connection.to.element),
    ),
  );
  const routes = new Map(input.routes);
  if (touching.size > 0)
    for (const [name, path] of routeConnections({ ...drawn, connections: touching }, first, {
      cache: placedRoutes,
    }))
      routes.set(name, path);
  // Things riding on a connection sit on its line.
  const placed = placeMovers(first, input.diagram, whole, {
    absent,
    pointOn: (name, along) => {
      const path = routes.get(name);
      return path === undefined ? null : pointAlong(path, along, 0).point;
    },
  });
  const dragged = input.dragged;
  if (dragged === undefined || !placed.movers.some((name) => dragged.names.has(name)))
    return { layout: placed, routes };
  const elements = new Map(placed.elements);
  for (const name of placed.movers) {
    const element = elements.get(name);
    if (element !== undefined && dragged.names.has(name))
      elements.set(name, {
        ...element,
        box: { ...element.box, x: element.box.x + dragged.dx, y: element.box.y + dragged.dy },
      });
  }
  return { layout: { ...placed, elements }, routes };
}

/**
 * Every listing's coloured lines, worked out once for the lines a parse read, and each slice of
 * them kept, so a listing that hasn't changed is the very same lines from one picture to the next.
 */
const highlighted = new WeakMap<
  readonly string[],
  {
    readonly all: readonly (readonly Token[])[];
    readonly slices: Map<string, readonly (readonly Token[])[]>;
  }
>();

function sceneCode(component: Component): SceneCode {
  const code = component.code;
  if (code === null) throw new Error(`"${component.name}" isn't code.`);
  const { listing } = code;
  let cached = highlighted.get(listing.lines);
  if (cached === undefined) {
    // Coloured whole, then sliced: a slice can start inside a comment that opened above it.
    cached = { all: highlight(code.language, listing.lines), slices: new Map() };
    highlighted.set(listing.lines, cached);
  }
  const key = `${listing.first}-${listing.last}`;
  let lines = cached.slices.get(key);
  if (lines === undefined) {
    lines = cached.all.slice(listing.first - 1, listing.last);
    cached.slices.set(key, lines);
  }
  return {
    lines,
    first: listing.first,
    missing: listing.missing,
    fontSize: codeFontSize(component),
    title: code.title,
    numbers: code.numbers,
  };
}

export function buildScene(input: SceneInput): SceneModel {
  const { current, theme } = input;
  const previous = input.previous ?? current;
  const family = input.fontFamily;
  // What's there at this moment (D-86): the picture's diagram has hidden things gone and labels
  // and looks as the story and scene left them. Geometry and paint order come from the diagram
  // as written, so nothing shifts as things come and go.
  const ghosts = input.ghosts === true;
  const standing = (ghosts ? current.picture?.whole : current.picture?.diagram) ?? input.diagram;
  const { layout, routes } = settle(input, standing);
  /** A component's parts as drawn, each easing from how it was to how it is (D-104). */
  const sceneParts = (component: Component, box: Box): ScenePart[] =>
    [...component.parts.values()].flatMap((part) => {
      const at = partBox(layout, component, part);
      if (at === null) return [];
      const now = current.picture?.parts.get(component.name)?.get(part.name) ?? part;
      const was = previous.picture?.parts.get(component.name)?.get(part.name) ?? now;
      return [
        {
          name: part.name,
          target: `${component.name}.${part.name}`,
          kind: part.kind,
          first: part.kind === "lines" ? part.first : 0,
          last: part.kind === "lines" ? part.last : 0,
          box: { x: at.x - box.x, y: at.y - box.y, w: at.w, h: at.h },
          show: { from: presenceOpacity(was.show), to: presenceOpacity(now.show) },
          tone: { from: was.tone, to: now.tone },
          mark: { from: was.mark, to: now.mark },
        },
      ];
    });
  // Values as they stand (D-88). Ones that read the model (`= load(web)`) are worked out here,
  // where the model is known; then labels read them like any other.
  const picture = current.picture;
  const model: Scope["model"] = (fn, element) => {
    const planned = current.capacity.elements.get(element);
    if (fn === "load") return planned?.load;
    if (fn === "copies") return planned?.copies;
    if (fn === "traffic") return current.capacity.connections.get(element);
    // What's in or on it now.
    let count = 0;
    for (const component of standing.components.values())
      if (
        (component.on === element || (component.on === null && component.parent === element)) &&
        picture?.presence.get(component.name) !== "hidden"
      )
        count++;
    return count;
  };
  const scopeAt = (end: "from" | "to"): Scope => {
    const values = new Map(picture?.values ?? []);
    if (end === "from")
      for (const [name, ramp] of picture?.ramps ?? []) values.set(name, ramp.from);
    return scopeOf(values, model);
  };
  const scopeNow = scopeAt("to");
  const reads = [...(picture?.values ?? [])].some(([, value]) => isFormula(value));
  const diagram = !reads
    ? standing
    : {
        ...standing,
        settings: {
          ...standing.settings,
          data: new Map(
            [...(picture?.values ?? [])].map(([name]) => [name, scopeNow.value(name) ?? 0]),
          ),
        },
      };
  // Labels and notes as drawn: `%key%` placeholders filled from data (07 §6.2).
  const shown = (name: string, text: string): string => withPlaceholders(diagram, name, text);

  // Something that wasn't there before arrives in the state it has now.
  const statePair = (name: string): Pair<StatePreset> => {
    const to = current.elements.get(name)?.state ?? "healthy";
    return { from: previous.elements.get(name)?.state ?? to, to };
  };

  // A scale set container holding only a scaled-out component grows and shrinks with it.
  const framedBy = new Map<string, string>();
  for (const component of diagram.components.values()) {
    if (component.scale?.kind !== "out" || component.parent === null) continue;
    const parent = diagram.containers.get(component.parent);
    const kids = layout.children.get(component.parent) ?? [];
    if (parent?.type === "scaling-group" && kids.length === 1)
      framedBy.set(parent.name, component.name);
  }

  const containers: SceneContainer[] = [];
  for (const placed of containerRenderOrder(layout)) {
    const container = diagram.containers.get(placed.name);
    if (container === undefined) continue;
    const containerLabel = shown(container.name, container.label);
    containers.push({
      name: container.name,
      label: containerLabel,
      type: container.type,
      icon:
        container.icon === null ? null : iconSource(container.icon, input.files, diagram.folder),
      box: placed.box,
      state: statePair(container.name),
      rolledUp: {
        from: previous.elements.get(container.name)?.reason === "rollup",
        to: current.elements.get(container.name)?.reason === "rollup",
      },
      color: container.color,
      hasCard: container.card !== null,
      depth: placed.depth,
      link: container.link,
      tooltip: tooltipOf(containerLabel, container.data),
      frames: (() => {
        const name = framedBy.get(container.name);
        const fleet = name === undefined ? undefined : diagram.components.get(name);
        const room = name === undefined ? undefined : layout.tiles.get(name);
        return fleet?.scale?.kind === "out" && room !== undefined && name !== undefined
          ? { component: name, max: fleet.scale.max, room }
          : null;
      })(),
      mark: container.mark,
      tray: container.layout !== null,
    });
  }

  const components: SceneComponent[] = [];
  const placedComponents = [...layout.elements.values()]
    .filter((e) => e.kind === "component")
    .sort(byZThenOrder);
  for (const placed of placedComponents) {
    const component = diagram.components.get(placed.name);
    // Shapes have no icon tile: their whole box is what's drawn and what connects.
    const tile =
      layout.tiles.get(placed.name) ?? (component?.shape != null ? placed.box : undefined);
    if (component === undefined || tile === undefined) continue;
    const label = shown(component.name, component.label);
    components.push({
      name: component.name,
      label,
      lines: wrap(label, LABEL.maxWidth, LABEL_SIZE, 2, 500, family),
      box: placed.box,
      tile,
      icon: iconSource(component.type, input.files, diagram.folder),
      state: statePair(component.name),
      motion: current.elements.get(component.name)?.motion ?? component.motion,
      intensity: component.intensity,
      speed: component.speed,
      color: component.color,
      hasCard: component.card !== null,
      opens: component.opens !== null,
      pinned: placed.pinned,
      image:
        component.image === null
          ? null
          : {
              content:
                component.image.path === null
                  ? component.image.src.startsWith("data:image/")
                    ? component.image.src
                    : ""
                  : (input.files[component.image.path] ?? ""),
              fit: component.image.fit,
            },
      code: component.code === null ? null : sceneCode(component),
      parts: sceneParts(component, placed.box),
      shape: sceneShape(
        component.code !== null || (component.image !== null && !component.hasExplicitLabel)
          ? { ...component, label: "" }
          : label === component.label
            ? component
            : { ...component, label },
        placed.box,
        theme,
        family,
      ),
      link: component.link,
      tooltip: tooltipOf(label, component.data),
      scaling:
        component.scale === null || component.shape !== null
          ? null
          : component.scale.kind === "out"
            ? {
                kind: "out",
                min: component.scale.min,
                max: component.scale.max,
                room: tile,
                framed:
                  component.parent !== null && framedBy.get(component.parent) === component.name,
              }
            : { kind: "up", sizes: component.scale.sizes, room: tile },
      measured:
        current.capacity.active && current.capacity.elements.get(component.name)?.measured === true,
      queue: current.capacity.active && isQueue(component),
      hit: current.capacity.active
        ? (current.capacity.elements.get(component.name)?.hit ?? null)
        : null,
      mark: component.mark,
      meter:
        component.meter === null
          ? null
          : {
              as: component.meter.as,
              value: {
                from: numberOf(component.meter.value, scopeAt("from")),
                to: numberOf(component.meter.value, scopeNow),
              },
              max: Math.max(1e-9, numberOf(component.meter.max, scopeNow)),
              limit: component.meter.limit,
              unit: component.meter.unit,
            },
    });
  }

  // Connection labels stay off component icons and names, and off each other (as drawn by
  // component-node and connection-node: 12px names under the tile, 20px-high pills).
  const obstacles: Box[] = components.flatMap((component) => {
    if (component.shape !== null) return [component.box];
    const width = Math.max(
      0,
      ...component.lines.map((line) => measure(line, LABEL_SIZE, 500, family)),
    );
    return [
      component.tile,
      {
        x: component.box.x + component.box.w / 2 - width / 2 - 5,
        y: component.box.y + LABEL.top - 1,
        w: width + 10,
        h: component.lines.length * LABEL.lineHeight + 4,
      },
    ];
  });

  const connections: SceneConnection[] = [];
  const drawn: (readonly Point[])[] = [];
  for (const connection of diagram.connections.values()) {
    const path = routes.get(connection.name);
    if (path === undefined) continue;
    const text = connection.text === null ? null : shown(connection.name, connection.text);
    let labelAt = midpointOf(path).point;
    const place =
      input.labelPlaces?.get(connection.name) ?? diagram.layout.get(connection.name)?.label ?? null;
    if (place !== null) {
      labelAt = pointAlong(path, place.at, place.offset * GRID).point;
    } else if (text !== null) {
      const size = { w: measure(text, 11, 500, family) + 16, h: 20 };
      labelAt = labelPosition(path, size, obstacles);
      obstacles.push({ x: labelAt.x - size.w / 2, y: labelAt.y - size.h / 2, ...size });
    }
    // With capacity, idle connections flow with whatever traffic they carry (D-82).
    const carries =
      current.capacity.active && current.connections.get(connection.name)?.reason === "normal";
    const flowOf = (state: ResolvedState) => {
      const status = state.connections.get(connection.name);
      return carries && status?.reason === "normal" && status.flow === "idle"
        ? "traffic"
        : (status?.flow ?? connection.flow);
    };
    connections.push({
      name: connection.name,
      fromElement: connection.from.element,
      toElement: connection.to.element,
      carries,
      path,
      flow: { from: flowOf(previous), to: flowOf(current) },
      direction: connection.direction,
      speed: connection.speed,
      density: connection.density,
      color: connection.color,
      label: text,
      labelAt,
      labelPlaced: place !== null,
      hasCard: connection.card !== null,
      look: connectionLook(connection, path, drawn),
    });
    drawn.push(crossingLine(path));
  }

  const groups: SceneGroup[] = [];
  for (const group of diagram.groups.values()) {
    const box = layout.groups.get(group.name);
    if (box !== undefined)
      groups.push({ name: group.name, label: shown(group.name, group.label), box });
  }

  const zones: SceneDecoration[] = [];
  const texts: SceneDecoration[] = [];
  const decorations = [...diagram.decorations.values()]
    .map((decoration) => ({ decoration, placed: layout.elements.get(decoration.name) }))
    .filter((entry) => entry.placed !== undefined)
    .sort((a, b) => (a.placed && b.placed ? byZThenOrder(a.placed, b.placed) : 0));
  for (const { decoration: written, placed } of decorations) {
    if (placed === undefined) continue;
    const text = shown(written.name, written.text);
    const decoration = text === written.text ? written : { ...written, text };
    const entry: SceneDecoration = {
      name: decoration.name,
      variant: decoration.variant,
      text,
      tone: decoration.tone,
      style: decoration.variant === "text" ? decoration.style : "body",
      width: decoration.variant === "text" ? decoration.width : null,
      box: placed.box,
      ...richDecoration(decoration, placed.box),
    };
    if (decoration.variant === "zone") zones.push(entry);
    else texts.push(entry);
  }

  // Where traffic reaches and leaves each scaling component (or the scale set that frames it).
  const spokes = new Map<string, SceneSpokes>();
  for (const component of components) {
    if (component.scaling === null) continue;
    const frame = [...framedBy].find(([, name]) => name === component.name)?.[0] ?? null;
    const ends: { in: SpokeEnd[]; out: SpokeEnd[] } = { in: [], out: [] };
    for (const connection of connections) {
      const end = connection.path.through.at(-1);
      const start = connection.path.through[0];
      if ((connection.toElement === component.name || connection.toElement === frame) && end)
        ends.in.push({ connection: connection.name, at: end });
      if ((connection.fromElement === component.name || connection.fromElement === frame) && start)
        ends.out.push({ connection: connection.name, at: start });
    }
    spokes.set(component.name, ends);
  }

  const transitionStart =
    input.previous != null && input.previous !== current ? (input.transitionStart ?? null) : null;
  const built: SceneModel = {
    theme,
    spokes,
    settled: current.capacity.active
      ? new CapacityTimeline(current.capacity, diagram, 0, current.capacityOverTime)
      : null,
    containers,
    components,
    connections,
    groups,
    zones,
    texts,
    paint: paintOrder(input.diagram, layout),
    bounds: frameOf(layout),
    page: layout.page,
    transitionStart,
    transitionSeconds: input.transitionSeconds ?? SCENE_TRANSITION,
    presence: new Map(),
    crossfade: new Set(),
    leaving: null,
    focus: current.picture?.focus ?? null,
    travel: new Map(),
    layout,
    ramp: (picture?.ramps.size ?? 0) > 0 ? (input.ramp ?? null) : null,
  };
  // The picture being left, when what's there (not just its state) may differ from this one.
  const before =
    transitionStart !== null &&
    input.previous != null &&
    (input.previous.picture?.diagram !== current.picture?.diagram ||
      !samePresence(input.previous.picture?.presence, current.picture?.presence))
      ? buildScene({ ...input, current: input.previous, previous: null, transitionStart: null })
      : null;
  return {
    ...built,
    ...presenceBetween(before, built, current, ghosts),
    travel: before === null ? built.travel : travelBetween(before, built, input, diagram),
    leaving: before,
  };
}

const centreOf = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/**
 * What's on its way somewhere while the picture changes (D-87): things a layout places whose
 * place differs, and copies arriving, which grow out of what they copy. A thing moving between
 * two places a connection joins follows that connection, either way along it.
 */
function travelBetween(
  before: SceneModel,
  model: SceneModel,
  input: SceneInput,
  diagram: Diagram,
): ReadonlyMap<string, Travel> {
  const travel = new Map<string, Travel>();
  const was = input.previous?.picture?.whole ?? input.diagram;
  const now = input.current.picture?.whole ?? input.diagram;
  const whereOf = (from: Diagram, name: string): string | null => {
    const item = from.components.get(name) ?? from.decorations.get(name);
    return item === undefined ? null : (item.on ?? item.parent);
  };
  const lineBetween = (from: string | null, to: string | null): readonly Point[] | null => {
    if (from === null || to === null || from === to) return null;
    for (const connection of model.connections) {
      if (connection.fromElement === from && connection.toElement === to)
        return connection.path.samples;
      if (connection.fromElement === to && connection.toElement === from)
        return [...connection.path.samples].reverse();
    }
    return null;
  };
  const moved = (key: string, name: string, from: Box | undefined, to: Box): void => {
    if (from === undefined) return;
    const a = centreOf(from);
    const b = centreOf(to);
    if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) return;
    travel.set(key, { from: a, to: b, along: lineBetween(whereOf(was, name), whereOf(now, name)) });
  };
  const oldComponents = new Map(before.components.map((c) => [c.name, c]));
  for (const component of model.components) {
    const old = oldComponents.get(component.name);
    if (old !== undefined) {
      moved(`component:${component.name}`, component.name, old.box, component.box);
      continue;
    }
    // A copy arriving grows out of what it copies, when that's on screen.
    const original = diagram.components.get(component.name)?.like ?? null;
    const source =
      original === null ? undefined : model.components.find((c) => c.name === original);
    if (source !== undefined)
      travel.set(`component:${component.name}`, {
        from: centreOf(source.box),
        to: centreOf(component.box),
        along: null,
      });
  }
  const oldTexts = new Map(before.texts.map((t) => [t.name, t]));
  for (const text of model.texts)
    moved(`text:${text.name}`, text.name, oldTexts.get(text.name)?.box, text.box);
  return travel;
}

/** How strongly the editor draws something that's hidden. */
export const GHOST_OPACITY = 0.2;

function samePresence(
  a: ReadonlyMap<string, unknown> | undefined,
  b: ReadonlyMap<string, unknown> | undefined,
): boolean {
  if ((a?.size ?? 0) !== (b?.size ?? 0)) return false;
  for (const [name, value] of a ?? []) if (b?.get(name) !== value) return false;
  return true;
}

/** What each painted thing looks like, as far as a change of picture can alter it. */
function looks(model: SceneModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of model.containers) out.set(`container:${c.name}`, `${c.label}|${c.mark ?? ""}`);
  for (const c of model.components)
    out.set(
      `component:${c.name}`,
      JSON.stringify([c.label, c.mark, c.shape?.fill, c.shape?.stroke, c.shape?.text.color]),
    );
  // A connection whose ends moved runs somewhere else: the old line fades into the new.
  for (const c of model.connections)
    out.set(`connection:${c.name}`, `${c.label ?? ""}|${c.look.lineD}`);
  for (const g of model.groups) out.set(`group:${g.name}`, g.label);
  for (const z of model.zones) out.set(`zone:${z.name}`, `${z.text}|${z.tone}`);
  for (const t of model.texts) out.set(`text:${t.name}`, `${t.text}|${t.tone}`);
  return out;
}

/**
 * How strongly each thing is drawn, from the picture being left (if any) to this one, and
 * which things change their words or look on the way.
 */
function presenceBetween(
  before: SceneModel | null,
  model: SceneModel,
  current: ResolvedState,
  ghosts: boolean,
): Pick<SceneModel, "presence" | "crossfade"> {
  const strength = (state: ResolvedState | null, key: string): number => {
    const presence = state?.picture?.presence.get(key.slice(key.indexOf(":") + 1)) ?? "shown";
    return ghosts && presence === "hidden" ? GHOST_OPACITY : presenceOpacity(presence);
  };
  const presence = new Map<string, Pair<number>>();
  const crossfade = new Set<string>();
  const now = looks(model);
  if (before === null) {
    for (const key of now.keys()) {
      const to = strength(current, key);
      if (to !== 1) presence.set(key, { from: to, to });
    }
    return { presence, crossfade };
  }
  const was = looks(before);
  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const from = was.has(key) ? (before.presence.get(key)?.to ?? 1) : 0;
    const to = now.has(key) ? strength(current, key) : 0;
    if (from !== 1 || to !== 1) presence.set(key, { from, to });
    if (was.has(key) && now.has(key) && was.get(key) !== now.get(key)) crossfade.add(key);
  }
  return { presence, crossfade };
}

export { textStyleSize };
