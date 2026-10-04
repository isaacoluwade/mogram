import type {
  Decoration,
  Diagram,
  Intensity,
  ProjectFiles,
  Speed,
  TextLook,
  TextStyle,
  Tone,
} from "@mogram/core/model";
import {
  byZThenOrder,
  containerRenderOrder,
  LABEL,
  paintOrder,
  textStyleSize,
  type Box,
  type LayoutResult,
  type PaintEntry,
  type Point,
} from "@mogram/core/layout";
import type {
  ContainerStyleName,
  FlowPreset,
  MotionPreset,
  Paint,
  StatePreset,
} from "@mogram/core/presets";
import { labelPosition, midpointOf, type RoutedPath } from "@mogram/core/routing";
import type { ResolvedState } from "@mogram/core/state";
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
  readonly hasCard: boolean;
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
}

const LABEL_SIZE = 12;

export function buildScene(input: SceneInput): SceneModel {
  const { diagram, layout, routes, current, theme } = input;
  const previous = input.previous ?? current;
  const family = input.fontFamily;

  const statePair = (name: string): Pair<StatePreset> => ({
    from: previous.elements.get(name)?.state ?? "healthy",
    to: current.elements.get(name)?.state ?? "healthy",
  });

  const containers: SceneContainer[] = [];
  for (const placed of containerRenderOrder(layout)) {
    const container = diagram.containers.get(placed.name);
    if (container === undefined) continue;
    containers.push({
      name: container.name,
      label: container.label,
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
    });
  }

  const components: SceneComponent[] = [];
  const placedComponents = [...layout.elements.values()]
    .filter((e) => e.kind === "component")
    .sort(byZThenOrder);
  for (const placed of placedComponents) {
    const component = diagram.components.get(placed.name);
    const tile = layout.tiles.get(placed.name);
    if (component === undefined || tile === undefined) continue;
    components.push({
      name: component.name,
      label: component.label,
      lines: wrap(component.label, LABEL.maxWidth, LABEL_SIZE, 2, 500, family),
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
    });
  }

  // Connection labels stay off component icons and names, and off each other (as drawn by
  // component-node and connection-node: 12px names under the tile, 20px-high pills).
  const obstacles: Box[] = components.flatMap((component) => {
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
  for (const connection of diagram.connections.values()) {
    const path = routes.get(connection.name);
    if (path === undefined) continue;
    let labelAt = midpointOf(path).point;
    if (connection.text !== null) {
      const size = { w: measure(connection.text, 11, 500, family) + 16, h: 20 };
      labelAt = labelPosition(path, size, obstacles);
      obstacles.push({ x: labelAt.x - size.w / 2, y: labelAt.y - size.h / 2, ...size });
    }
    connections.push({
      name: connection.name,
      path,
      flow: {
        from: previous.connections.get(connection.name)?.flow ?? connection.flow,
        to: current.connections.get(connection.name)?.flow ?? connection.flow,
      },
      direction: connection.direction,
      speed: connection.speed,
      density: connection.density,
      color: connection.color,
      label: connection.text,
      labelAt,
      hasCard: connection.card !== null,
    });
  }

  const groups: SceneGroup[] = [];
  for (const group of diagram.groups.values()) {
    const box = layout.groups.get(group.name);
    if (box !== undefined) groups.push({ name: group.name, label: group.label, box });
  }

  const zones: SceneDecoration[] = [];
  const texts: SceneDecoration[] = [];
  const decorations = [...diagram.decorations.values()]
    .map((decoration) => ({ decoration, placed: layout.elements.get(decoration.name) }))
    .filter((entry) => entry.placed !== undefined)
    .sort((a, b) => (a.placed && b.placed ? byZThenOrder(a.placed, b.placed) : 0));
  for (const { decoration, placed } of decorations) {
    if (placed === undefined) continue;
    const entry: SceneDecoration = {
      name: decoration.name,
      variant: decoration.variant,
      text: decoration.text,
      tone: decoration.tone,
      style: decoration.variant === "text" ? decoration.style : "body",
      box: placed.box,
      ...richDecoration(decoration, placed.box),
    };
    if (decoration.variant === "zone") zones.push(entry);
    else texts.push(entry);
  }

  return {
    theme,
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
