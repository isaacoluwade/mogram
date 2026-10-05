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
  type FlowPreset,
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
  trimPath,
  trimPolyline,
  type RoutedPath,
} from "@mogram/core/routing";
import { markerShape, markerTransform, type MarkerShape } from "./markers";
import type { ResolvedState } from "@mogram/core/state";
import { CapacityTimeline, isQueue } from "@mogram/core/capacity";
import { fontStack } from "./fonts";
import { iconSource, type IconSource } from "./icons";
import { fitRich, layoutRich, parseRich, type RichLayout } from "./rich-text";
import { measure, wrap } from "./text";
import type { CanvasTheme } from "./theme";

/**
 * Everything the SVG renderer draws, already positioned and resolved. Built from the diagram,
 * its layout and routes, and the state before/after the current scene change (SC-7).
 */

export interface Pair<T> {
  readonly from: T;
  readonly to: T;
}

export interface SceneComponent {
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
      maxWidth: Number.POSITIVE_INFINITY,
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
  readonly bounds: Box;
  /** Clock time the current scene change started, or null when settled. */
  readonly transitionStart: number | null;
  /**
   * Where traffic reaches and leaves each scaling component (D-82): the ends of its connections
   * (and its scale set's), so traffic can be drawn fanning out to every copy.
   */
  readonly spokes: ReadonlyMap<string, SceneSpokes>;
  /** The capacity plan, settled: what a still picture (or a canvas without a timeline) shows. */
  readonly settled: CapacityTimeline | null;
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

export function buildScene(input: SceneInput): SceneModel {
  const { diagram, layout, routes, current, theme } = input;
  const previous = input.previous ?? current;
  const family = input.fontFamily;
  // Labels and notes as drawn: `%key%` placeholders filled from data (07 §6.2).
  const shown = (name: string, text: string): string => withPlaceholders(diagram, name, text);

  const statePair = (name: string): Pair<StatePreset> => ({
    from: previous.elements.get(name)?.state ?? "healthy",
    to: current.elements.get(name)?.state ?? "healthy",
  });

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
      shape: sceneShape(
        label === component.label ? component : { ...component, label },
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

  return {
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
    paint: paintOrder(diagram, layout),
    bounds: layout.bounds,
    transitionStart:
      input.previous != null && input.previous !== current ? (input.transitionStart ?? null) : null,
  };
}

export { textStyleSize };
