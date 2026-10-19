import type { YAMLSeq } from "yaml";
import { Scalar, YAMLMap, isMap, isScalar, isSeq, type Node } from "yaml";
import { parseDiagram } from "../format/parse";
import type {
  CardRef,
  Connection,
  Diagram,
  GridPoint,
  GridSize,
  ProjectFiles,
  TextStyle,
  Tone,
  Place,
} from "../model/types";
import { humanize, isValidName, toName } from "../model/names";
import type { ShapeId } from "../presets/shapes";
import type { ContainerStyleName, FlowPreset } from "../presets/names";
import type { Mark, Presence } from "../presets/marks";
import { formatPaint, samePaint, solid, type Paint } from "../presets/paint";
import { NOTE_FILL } from "../presets/text";
import { arranges } from "../layout/place";
import { formatPercent } from "./capacity";
import { edit, type EditContext, type EditResult } from "./context";
import {
  EditError,
  flowMap,
  flowSeq,
  insertSetting,
  pointNode,
  renameKey,
  scalarString,
  setKey,
  sizeNode,
} from "./session";

// -------------------------------------------------------------------------------------------------
// Adding

export interface AddComponentArgs {
  /** Icon reference, e.g. `azure/virtual-machine`. */
  readonly type: string;
  /** Display label; the name is derived from it (FI-1). */
  readonly label: string;
  readonly parent?: string | null;
  readonly at?: GridPoint | null;
}

export function addComponent(
  files: ProjectFiles,
  diagram: Diagram,
  args: AddComponentArgs,
): EditResult {
  return edit(files, diagram, (ctx) => {
    const parent = validParent(ctx, args.parent ?? null);
    const name = ctx.claimName(toName(args.label, "component"));
    const map = new YAMLMap();
    map.set("type", args.type);
    if (parent !== null) map.set("in", parent);
    if (args.label !== humanize(name)) map.set("label", args.label);
    addEntry(ctx.session.section(ctx.homeFor(parent), "components"), name, map, true);
    if (args.at != null) ctx.setAt(name, args.at);
    return [name];
  });
}

export interface AddShapeArgs {
  readonly text?: string;
  readonly file?: string;
  readonly src?: string;
  readonly fit?: "contain" | "cover";
  readonly shape: ShapeId;
  readonly label: string;
  readonly parent?: string | null;
  readonly at?: GridPoint | null;
  readonly look?: Readonly<Record<string, string | number | boolean>>;
}

/** What a code element added with nothing in it shows (D-103). */
export const NEW_LISTING = "# Write or paste code here";

/** Adds a shape (03-shapes-styles-library P0-1), written under `shapes:`. */
export function addShape(files: ProjectFiles, diagram: Diagram, args: AddShapeArgs): EditResult {
  return edit(files, diagram, (ctx) => {
    const parent = validParent(ctx, args.parent ?? null);
    const name = ctx.claimName(toName(args.label.trim() === "" ? args.shape : args.label, "shape"));
    const map = new YAMLMap();
    map.set("shape", args.shape);
    // A new listing says what it's for until it's given code of its own.
    if (args.shape === "code")
      map.set(args.file === undefined ? "text" : "file", args.file ?? args.text ?? NEW_LISTING);
    if (args.shape === "image" && args.src !== undefined) map.set("src", args.src);
    if (args.shape === "image" && args.fit === "cover") map.set("fit", args.fit);
    if (parent !== null) map.set("in", parent);
    // A picture or a listing has no label unless one is given (D-102, D-103).
    const quiet = (args.shape === "image" || args.shape === "code") && args.label.trim() === "";
    if (!quiet && args.label !== humanize(name)) map.set("label", args.label);
    for (const [key, value] of Object.entries(args.look ?? {})) map.set(key, value);
    addEntry(ctx.session.section(ctx.homeFor(parent), "shapes"), name, map, true);
    if (args.at != null) ctx.setAt(name, args.at);
    return [name];
  });
}

export interface AddContainerArgs {
  readonly type: ContainerStyleName;
  readonly label: string;
  /** A header icon other than the kind's own: a cloud's official group icon. */
  readonly icon?: string | null;
  readonly parent?: string | null;
  readonly at?: GridPoint | null;
  readonly size?: GridSize | null;
}

export function addContainer(
  files: ProjectFiles,
  diagram: Diagram,
  args: AddContainerArgs,
): EditResult {
  return edit(files, diagram, (ctx) => {
    const parent = validParent(ctx, args.parent ?? null);
    const name = ctx.claimName(toName(args.label, "container"));
    const map = new YAMLMap();
    if (args.type !== "box") map.set("type", args.type);
    if (parent !== null) map.set("in", parent);
    if (args.label !== humanize(name)) map.set("label", args.label);
    if (args.icon != null) map.set("icon", args.icon);
    addEntry(ctx.session.section(ctx.homeFor(parent), "containers"), name, map);
    if (args.at != null) ctx.setAt(name, args.at);
    if (args.size != null) ctx.setSize(name, args.size);
    return [name];
  });
}

export interface AddConnectionArgs {
  readonly from: string;
  readonly to: string;
  readonly flow?: FlowPreset;
}

/** Endpoints may carry a port: `aks.web` (ED-19). */
export function addConnection(
  files: ProjectFiles,
  diagram: Diagram,
  args: AddConnectionArgs,
): EditResult {
  return edit(files, diagram, (ctx) => {
    const fromElement = args.from.split(".")[0] ?? "";
    const toElement = args.to.split(".")[0] ?? "";
    for (const end of [fromElement, toElement]) {
      const kind = ctx.kindOf(end);
      if (kind !== "component" && kind !== "container") {
        throw new EditError(`Connections join components or containers, and "${end}" isn't one.`);
      }
    }
    if (args.from === args.to) throw new EditError("A connection needs two different ends.");
    const name = ctx.claimName(`${fromElement}_to_${toElement}`);
    const map = new YAMLMap();
    map.set("from", args.from);
    map.set("to", args.to);
    if (args.flow !== undefined && args.flow !== "idle") map.set("flow", args.flow);
    addEntry(ctx.session.section(ctx.fileOf(fromElement), "connections"), name, map);
    return [name];
  });
}

export function addGroup(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly members: readonly string[]; readonly label: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const members = args.members.filter((member) => {
      const kind = ctx.kindOf(member);
      return kind === "component" || kind === "container";
    });
    if (members.length === 0)
      throw new EditError("Select the components a group should surround first.");
    const name = ctx.claimName(toName(args.label, "group"));
    const map = new YAMLMap();
    if (args.label !== humanize(name)) map.set("label", args.label);
    map.set("members", flowSeq(members));
    addEntry(ctx.session.section(ctx.fileOf(members[0] ?? ""), "groups"), name, map);
    return [name];
  });
}

export type DecorationArgs =
  | { readonly variant: "text"; readonly text: string; readonly style?: TextStyle }
  | { readonly variant: "label"; readonly text: string; readonly tone?: Tone }
  | {
      readonly variant: "zone";
      readonly text: string;
      readonly size: GridSize;
      readonly tone?: Tone;
    }
  | {
      readonly variant: "note";
      readonly text: string;
      readonly size: GridSize;
      readonly fill?: Paint;
    };

export function addDecoration(
  files: ProjectFiles,
  diagram: Diagram,
  args: DecorationArgs & { readonly at: GridPoint; readonly parent?: string | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const parent = validParent(ctx, args.parent ?? null);
    const base = args.text.trim().length > 0 ? toName(args.text, args.variant) : args.variant;
    const name = ctx.claimName(base);
    const entries: [string, Node | string | number][] = [];
    switch (args.variant) {
      case "text":
        entries.push(["text", args.text]);
        if (args.style !== undefined && args.style !== "body") entries.push(["style", args.style]);
        break;
      case "label":
        entries.push(["label", args.text]);
        if (args.tone !== undefined && args.tone !== "neutral") entries.push(["tone", args.tone]);
        break;
      case "zone":
        entries.push(["zone", args.text]);
        if (args.tone !== undefined && args.tone !== "neutral") entries.push(["tone", args.tone]);
        break;
      case "note":
        entries.push(["note", args.text]);
        if (args.fill !== undefined && !samePaint(args.fill, solid(NOTE_FILL)))
          entries.push(["fill", formatPaint(args.fill)]);
        break;
    }
    entries.push(["at", pointNode(args.at)]);
    if (args.variant === "zone" || args.variant === "note")
      entries.push(["size", sizeNode(args.size)]);
    if (parent !== null) entries.push(["in", parent]);
    const map = flowMap(entries);
    // Notes are written as blocks so their text can run over several lines.
    if (args.variant === "note") map.flow = false;
    setDecorationText(map, args.variant, args.text);
    ctx.decorationsMap().set(name, map);
    return [name];
  });
}

/** Sets a decoration's words; text over several lines is written as a `|` block. */
function setDecorationText(map: YAMLMap, key: string, text: string): void {
  const scalar = new Scalar(text);
  if (text.includes("\n")) {
    scalar.type = Scalar.BLOCK_LITERAL;
    map.flow = false;
  }
  map.set(key, scalar);
}

function validParent(ctx: EditContext, parent: string | null): string | null {
  if (parent === null) return null;
  if (!ctx.diagram.containers.has(parent)) throw new EditError(`"${parent}" isn't a container.`);
  return parent;
}

// -------------------------------------------------------------------------------------------------
// Moving and arranging

export interface Move {
  readonly name: string;
  /** New parent container, or null for the canvas. */
  readonly parent: string | null;
  /** New position relative to the parent, in grid units. */
  readonly at: GridPoint;
}

/** Moves (and re-parents) elements; dragging pins them (ED-11). */
export function moveElements(
  files: ProjectFiles,
  diagram: Diagram,
  moves: readonly Move[],
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const move of moves) {
      const kind = ctx.requireKind(move.name);
      const at = { x: Math.round(move.at.x), y: Math.round(move.at.y) };
      const parent = validParent(ctx, move.parent);
      if (kind === "container" && parent !== null && isInside(diagram, parent, move.name)) {
        throw new EditError(
          `"${move.name}" can't go inside "${parent}", because "${parent}" is inside it.`,
        );
      }
      if (kind === "decoration") {
        const map = ctx.decoration(move.name);
        map.set("at", pointNode(at));
        setKey(map, "in", parent ?? undefined);
        continue;
      }
      if (kind !== "component" && kind !== "container") continue;
      const component = diagram.components.get(move.name);
      // Into a container that arranges its contents (D-87): it's placed there, not at a point.
      if (component !== undefined && parent !== null && arranges(diagram.containers.get(parent))) {
        const map = ctx.definition(move.name);
        setKey(map, "in", parent);
        map.delete("on");
        ctx.setLayoutField(move.name, "at", undefined);
        continue;
      }
      // Something riding on another thing goes where that goes: it has no place of its own.
      if (component !== undefined && component.on !== null) continue;
      const current =
        kind === "component" ? component?.parent : diagram.containers.get(move.name)?.parent;
      if ((current ?? null) !== parent)
        setKey(ctx.definition(move.name), "in", parent ?? undefined);
      ctx.setAt(move.name, at);
    }
  });
}

/**
 * Puts things a layout places somewhere else (D-87), as they're written: `in` a container that
 * arranges its contents, or `on` an element or connection. `null` for both takes a rider off
 * what it rode on.
 */
export function placeElements(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly place: Place | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      const kind = ctx.requireKind(name);
      if (kind !== "component" && kind !== "decoration")
        throw new EditError(`"${name}" is a ${kind}: components, shapes and text can be placed.`);
      const map = ctx.definition(name);
      const place = args.place;
      if (place?.on !== undefined) {
        if (place.on === name) throw new EditError(`"${name}" can't ride on itself.`);
        if (ctx.kindOf(place.on) === null)
          throw new EditError(`There is no element called "${place.on}".`);
        map.set("on", place.on);
        ctx.setLayoutField(name, "at", undefined);
      } else if (place?.in !== undefined) {
        if (!arranges(diagram.containers.get(place.in)))
          throw new EditError(`"${place.in}" doesn't arrange what's in it.`);
        // Text goes in too (D-102), and is placed like any other child.
        if (kind === "decoration" && diagram.decorations.get(name)?.variant !== "text")
          throw new EditError(`Only text, components and shapes can go in "${place.in}".`);
        map.set("in", place.in);
        map.delete("on");
        ctx.setLayoutField(name, "at", undefined);
      } else {
        map.delete("on");
        map.delete("along");
      }
      if (place?.along !== undefined) map.set("along", formatPercent(place.along));
      if (place?.cell !== undefined) map.set("cell", pointNode(place.cell));
      else if (place?.in !== undefined) map.delete("cell");
    }
    return args.names;
  });
}

/**
 * Puts elements inside a container (or back on the canvas, `null`) and lets automatic placement
 * find them a spot there: their position is cleared, a size they were given is kept. What the
 * assistant uses, since it doesn't pick coordinates.
 */
export function nestElements(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly parent: string | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const parent = validParent(ctx, args.parent);
    for (const name of args.names) {
      const kind = ctx.requireKind(name);
      if (kind === "group" || kind === "connection")
        throw new EditError(`"${name}" is a ${kind}: only elements go inside containers.`);
      if (
        name === parent ||
        (kind === "container" && parent !== null && isInside(diagram, parent, name))
      )
        throw new EditError(
          `"${name}" can't go inside "${parent}", because "${parent}" is inside it.`,
        );
      const map = kind === "decoration" ? ctx.decoration(name) : ctx.definition(name);
      setKey(map, "in", parent ?? undefined);
      // Notes and text keep their spot (relative to the new parent): they aren't placed for you.
      if (kind !== "decoration") ctx.setLayoutField(name, "at", undefined);
    }
    return [...args.names];
  });
}

function isInside(diagram: Diagram, candidate: string, ancestor: string): boolean {
  let current: string | null = candidate;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = diagram.containers.get(current)?.parent ?? null;
  }
  return false;
}

/** A hand resize saves the size (ED-13); resizing from the left/top also moves the corner. */
export function resizeElement(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly size: GridSize; readonly at?: GridPoint },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const kind = ctx.requireKind(args.name);
    const size = {
      w: Math.max(1, Math.round(args.size.w)),
      h: Math.max(1, Math.round(args.size.h)),
    };
    if (kind === "decoration") {
      const map = ctx.decoration(args.name);
      if (!map.has("zone") && !map.has("note") && !map.has("text"))
        throw new EditError("Only text, highlight zones and sticky notes can be resized.");
      if (map.has("text")) map.set("width", size.w);
      else map.set("size", sizeNode(size));
      if (args.at !== undefined) map.set("at", pointNode(args.at));
      return;
    }
    if (kind !== "container" && !ctx.isShape(args.name))
      throw new EditError(
        "Only shapes, containers, highlight zones and sticky notes can be resized.",
      );
    if (args.at !== undefined) ctx.setAt(args.name, args.at);
    ctx.setSize(args.name, size);
  });
}

/** Clears a hand-set size so the container fits its contents again. */
export function autoSize(files: ProjectFiles, diagram: Diagram, name: string): EditResult {
  return edit(files, diagram, (ctx) => {
    ctx.setSize(name, null);
  });
}

/** Saves a hand-bent path (ED-18); `null` returns the connection to automatic routing. */
export function setConnectionPath(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly via: readonly GridPoint[] | null },
): EditResult {
  return edit(files, diagram, (ctx) => {
    if (ctx.requireKind(args.name) !== "connection")
      throw new EditError(`"${args.name}" isn't a connection.`);
    ctx.setVia(
      args.name,
      args.via === null ? null : args.via.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    );
  });
}

// -------------------------------------------------------------------------------------------------
// Properties

/** Values that are never written because they are the default (FI-3). */
const DEFAULTS: Readonly<Record<string, string>> = {
  state: "healthy",
  motion: "none",
  intensity: "normal",
  speed: "normal",
  rollup: "worst",
  flow: "idle",
  direction: "forward",
  density: "normal",
  route: "orthogonal",
  tone: "neutral",
  style: "body",
  align: "left",
  fill: NOTE_FILL,
  font_size: "auto",
  show: "shown",
};

/** A shape's defaults: what a key left out of its entry means (03 §5 P0-2). */
const SHAPE_DEFAULTS: Readonly<Record<string, string | number>> = {
  state: "healthy",
  motion: "none",
  intensity: "normal",
  speed: "normal",
  shape: "rectangle",
  tone: "neutral",
  dash: "solid",
  stroke_width: 1.5,
  opacity: 100,
  align: "center",
  font_size: "auto",
  show: "shown",
};

export type PropertyValue =
  | string
  | number
  | boolean
  | readonly string[]
  /** A small map such as `data:` or `arrows:`, written in flow style. */
  | Readonly<Record<string, string | number | boolean>>
  | null
  | undefined;

/**
 * Sets properties on an element. `null`/`undefined` removes a key; default values are removed
 * too, so the file only records what differs (FI-3).
 */
export function updateElement(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly set: Readonly<Record<string, PropertyValue>> },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const kind = ctx.requireKind(args.name);
    const map = ctx.definition(args.name);
    const defaults: Readonly<Record<string, string | number>> = ctx.isShape(args.name)
      ? SHAPE_DEFAULTS
      : DEFAULTS;
    for (const [key, raw] of Object.entries(args.set)) {
      if (kind === "container" && key === "type") {
        setKey(map, "type", typeof raw === "string" && raw !== "box" ? raw : undefined);
        continue;
      }
      if (key === "label") {
        const label = typeof raw === "string" ? raw.trim() : "";
        const isDefault =
          kind === "connection"
            ? label.length === 0
            : label.length === 0 || label === humanize(args.name);
        if (kind === "decoration") {
          const textKey = ["text", "label", "zone", "note"].find((k) => map.has(k)) ?? "text";
          setDecorationText(map, textKey, label);
        } else {
          setKey(map, "label", isDefault ? undefined : label);
        }
        continue;
      }
      if (key === "members" && Array.isArray(raw)) {
        map.set("members", flowSeq(raw as readonly string[]));
        continue;
      }
      if (
        raw === null ||
        raw === undefined ||
        raw === "" ||
        raw === false ||
        defaults[key] === raw
      ) {
        map.delete(key);
        continue;
      }
      if (Array.isArray(raw)) {
        map.set(key, flowSeq(raw as readonly string[]));
        continue;
      }
      if (typeof raw === "object") {
        const entries = Object.entries(raw as Readonly<Record<string, string | number | boolean>>);
        if (entries.length === 0) map.delete(key);
        else
          map.set(
            key,
            flowMap(entries.map(([k, v]) => [k, typeof v === "boolean" ? new Scalar(v) : v])),
          );
        continue;
      }
      // Several lines (a listing's text) are written as a block, one line to a line.
      if (typeof raw === "string" && raw.includes("\n")) {
        const block = new Scalar(raw.endsWith("\n") ? raw : `${raw}\n`);
        block.type = Scalar.BLOCK_LITERAL;
        map.flow = false;
        map.set(key, block);
        continue;
      }
      map.set(key, raw);
    }
  });
}

/** Sets an element's card (CA-3): inline text, a `.md` file path, or a title + body. */
export function setCard(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly card: CardRef | null; readonly fileContent?: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const kind = ctx.requireKind(args.name);
    if (kind !== "component" && kind !== "container" && kind !== "connection") {
      throw new EditError("Cards belong to components, containers and connections.");
    }
    const map = ctx.definition(args.name);
    const card = args.card;
    if (card === null) {
      map.delete("card");
      return;
    }
    const folder = diagram.folder;
    const relative = (path: string): string =>
      folder.length > 0 && path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
    if (card.kind === "file") {
      if (args.fileContent !== undefined) ctx.session.writeRaw(card.path, args.fileContent);
      if (card.title === null) map.set("card", relative(card.path));
      else
        map.set(
          "card",
          flowMap([
            ["title", card.title],
            ["file", relative(card.path)],
          ]),
        );
      return;
    }
    if (card.title === null || card.title.trim().length === 0) {
      map.set("card", card.body);
    } else {
      const node = new YAMLMap();
      node.set("title", card.title);
      node.set("body", card.body);
      map.set("card", node);
    }
    const value = map.get("card", true);
    if (isScalar(value) && typeof value.value === "string" && value.value.includes("\n")) {
      value.type = Scalar.BLOCK_LITERAL;
    }
    if (isMap(value)) {
      const body = value.get("body", true);
      if (isScalar(body) && typeof body.value === "string" && body.value.includes("\n"))
        body.type = Scalar.BLOCK_LITERAL;
    }
  });
}

/** What a part covers and how it starts (D-104): lines of a listing, or a region of a picture. */
export interface PartPatch {
  /** For code: the first and last line, in the file's own numbers. */
  readonly lines?: readonly [number, number];
  /** For an image: x, y, width and height, each a share of the picture. */
  readonly area?: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly show?: Presence;
  /** Null takes it away. */
  readonly tone?: Tone | null;
  readonly mark?: Mark | null;
}

/** A share of a picture, to four places: a region drawn by hand doesn't need more. */
const share = (value: number): number =>
  Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;

/**
 * Adds a part to an image or code element, or changes one. A part that only says where it is
 * is written short (`name: 2-6`, `field: [x, y, w, h]`); one that also says how it starts is
 * written long.
 */
export function setPart(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly element: string; readonly name: string; readonly set: PartPatch },
): EditResult {
  const component = diagram.components.get(args.element);
  if (component === undefined || (component.image === null && component.code === null))
    throw new EditError("Only images and code have parts.");
  if (component.opens !== null)
    throw new EditError(`"${args.element}" opens a nested diagram, so it can't have parts.`);
  if (!isValidName(args.name))
    throw new EditError(
      `"${args.name}" isn't a valid part name. Use letters, numbers and "_", starting with a letter.`,
    );
  const previous = component.parts.get(args.name);
  if (previous === undefined && component.parts.size >= 64)
    throw new EditError(`"${args.element}" has 64 parts, which is as many as an element can have.`);

  // Where it is: what the patch says, else where it was.
  let where: YAMLSeq | Scalar;
  if (component.code !== null) {
    const lines =
      args.set.lines ??
      (previous?.kind === "lines" ? ([previous.first, previous.last] as const) : null);
    if (lines === null)
      throw new EditError("A part of code needs a line or a range, like 12 or 12-31.");
    const [first, last] = lines;
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first)
      throw new EditError("A part of code needs a line or a range, like 12 or 12-31.");
    where = new Scalar(first === last ? first : `${first}-${last}`);
  } else {
    const area = args.set.area ?? (previous?.kind === "area" ? previous : null);
    if (area === null)
      throw new EditError("A part of a picture needs a region: x, y, width, height.");
    const x = share(area.x);
    const y = share(area.y);
    const w = share(Math.min(area.w, 1 - x));
    const h = share(Math.min(area.h, 1 - y));
    if (w <= 0 || h <= 0) throw new EditError("A part of a picture needs a width and a height.");
    where = flowSeq([x, y, w, h]);
  }

  // How it starts: what the patch says, else what it said.
  const show = args.set.show ?? previous?.show ?? "shown";
  const tone = args.set.tone === undefined ? (previous?.tone ?? null) : args.set.tone;
  const mark = args.set.mark === undefined ? (previous?.mark ?? null) : args.set.mark;

  return edit(files, diagram, (ctx) => {
    const definition = ctx.definition(args.element);
    let parts = definition.get("parts", true) as Node | undefined;
    if (!isMap(parts)) {
      parts = new YAMLMap();
      definition.set("parts", parts);
    }
    if (show === "shown" && tone === null && mark === null) {
      parts.set(args.name, where);
      return [args.element];
    }
    const long = new YAMLMap();
    long.flow = true;
    long.set(component.code !== null ? "lines" : "area", where);
    if (show !== "shown") long.set("show", show);
    if (tone !== null) long.set("tone", tone);
    if (mark !== null) long.set("mark", mark);
    parts.set(args.name, long);
    return [args.element];
  });
}

/** Renames a part, and every `element.part` that names it. */
export function renamePart(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly element: string; readonly from: string; readonly to: string },
): EditResult {
  const component = diagram.components.get(args.element);
  if (component?.parts.has(args.from) !== true)
    throw new EditError(`"${args.element}" has no part called "${args.from}".`);
  if (!isValidName(args.to))
    throw new EditError(
      `"${args.to}" isn't a valid part name. Use letters, numbers and "_", starting with a letter.`,
    );
  if (args.from !== args.to && component.parts.has(args.to))
    throw new EditError(`"${args.element}" already has a part called "${args.to}".`);
  return edit(files, diagram, (ctx) => {
    if (args.from === args.to) return [args.element];
    const parts = ctx.definition(args.element).get("parts", true);
    if (!isMap(parts)) throw new EditError(`"${args.element}" has no parts written.`);
    renameKey(parts, args.from, args.to);
    const from = `${args.element}.${args.from}`;
    const to = `${args.element}.${args.to}`;
    for (const file of diagram.files)
      rewriteReferences(ctx, file, from, (value) => (value === from ? to : null));
    return [args.element];
  });
}

/** Removes a part, the connections that end on it, and every line that names it. */
export function removePart(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly element: string; readonly name: string },
): EditResult {
  if (diagram.components.get(args.element)?.parts.has(args.name) !== true)
    throw new EditError(`"${args.element}" has no part called "${args.name}".`);
  const endsHere = (end: Connection["from"]) =>
    end.element === args.element && end.part === args.name;
  const attached = [...diagram.connections.values()]
    .filter((connection) => endsHere(connection.from) || endsHere(connection.to))
    .map((connection) => connection.name);
  // The connections go first; the part is then removed from the diagram as it is after that.
  const cleared = attached.length === 0 ? null : deleteElements(files, diagram, attached);
  const current = cleared === null ? files : cleared.files;
  const after = cleared === null ? diagram : parseDiagram(current, diagram.folder).diagram;
  return edit(current, after, (ctx) => {
    const definition = ctx.definition(args.element);
    const parts = definition.get("parts", true);
    if (isMap(parts)) {
      parts.delete(args.name);
      if (parts.items.length === 0) definition.delete("parts");
    }
    const doomed = new Set([`${args.element}.${args.name}`]);
    for (const file of after.files) pruneReferences(ctx, file, doomed);
    return [args.element];
  });
}

// -------------------------------------------------------------------------------------------------
// Renaming

/** Renames an element and every reference to it, in every file of the diagram. */
export function renameElement(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly from: string; readonly to: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const { from, to } = args;
    if (from === to) return [to];
    ctx.requireKind(from);
    if (!isValidName(to)) {
      throw new EditError(
        `"${to}" isn't a valid name. Start with a letter and use letters, numbers, "_" or "-".`,
      );
    }
    if (ctx.isTaken(to)) throw new EditError(`"${to}" is already used by another element.`);
    const kind = ctx.requireKind(from);

    // The definition itself.
    if (kind === "decoration") renameKey(ctx.decorationsMap(ctx.fileOf(from)), from, to);
    else renameKey(ctx.session.section(ctx.fileOf(from), ctx.sectionOf(from)), from, to);
    const layoutEntry = diagram.layout.get(from);
    if (layoutEntry !== undefined) renameKey(ctx.layoutSection(layoutEntry.source.file), from, to);

    const replaceRef = (value: string): string | null => {
      if (value === from) return to;
      if (value.startsWith(`${from}.`)) return `${to}${value.slice(from.length)}`;
      return null;
    };
    for (const file of diagram.files) rewriteReferences(ctx, file, from, replaceRef);
    return [to];
  });
}

function rewriteReferences(
  ctx: EditContext,
  file: string,
  from: string,
  replaceRef: (value: string) => string | null,
): void {
  const root = ctx.session.root(file);
  const eachEntry = (section: string, visit: (map: YAMLMap) => void): void => {
    const node = root.get(section, true) as Node | undefined;
    if (!isMap(node)) return;
    for (const pair of node.items) if (isMap(pair.value)) visit(pair.value);
  };
  const rewriteKey = (map: YAMLMap, key: string): void => {
    const value = scalarString(map.get(key, true));
    if (value === null) return;
    const next = replaceRef(value);
    if (next !== null) map.set(key, next);
  };

  // `link: "#name"` follows a rename too.
  const rewriteLink = (map: YAMLMap): void => {
    const value = scalarString(map.get("link", true));
    if (value === null || !value.startsWith("#")) return;
    const next = replaceRef(value.slice(1));
    if (next !== null) map.set("link", `#${next}`);
  };
  for (const section of ["containers", "components", "shapes", "connections", "groups"])
    eachEntry(section, rewriteLink);
  const layoutNode = root.get("layout", true) as Node | undefined;
  const decorations = isMap(layoutNode)
    ? (layoutNode.get("decorations", true) as Node | undefined)
    : undefined;
  if (isMap(decorations))
    for (const pair of decorations.items) if (isMap(pair.value)) rewriteLink(pair.value);

  eachEntry("containers", (map) => {
    rewriteKey(map, "in");
  });
  eachEntry("components", (map) => {
    rewriteKey(map, "in");
  });
  eachEntry("shapes", (map) => {
    rewriteKey(map, "in");
  });
  eachEntry("connections", (map) => {
    rewriteKey(map, "from");
    rewriteKey(map, "to");
    rewriteKey(map, "backup_for");
  });
  eachEntry("groups", (map) => {
    const members = map.get("members", true);
    if (!isSeq(members)) return;
    for (const item of members.items) {
      if (isScalar(item) && typeof item.value === "string") {
        const next = replaceRef(item.value);
        if (next !== null) item.value = next;
      }
    }
  });

  // Scenes: keys are targets (SC-10 paths included).
  const scenes = root.get("scenes", true) as Node | undefined;
  if (isMap(scenes)) {
    for (const scene of scenes.items) {
      if (!isMap(scene.value)) continue;
      for (const entry of scene.value.items) {
        if (isScalar(entry.key) && typeof entry.key.value === "string") {
          const next = replaceRef(entry.key.value);
          if (next !== null) entry.key.value = next;
        }
      }
    }
  }

  // Stories (D-86): each step's set keys, what a line puts something in or on, focus and zoom.
  const stories = root.get("stories", true) as Node | undefined;
  if (isMap(stories)) {
    for (const story of stories.items) {
      if (!isSeq(story.value)) continue;
      for (const step of story.value.items) {
        if (!isMap(step)) continue;
        rewriteKey(step, "zoom");
        const focus = step.get("focus", true);
        if (isSeq(focus)) {
          for (const item of focus.items)
            if (isScalar(item) && typeof item.value === "string") {
              const next = replaceRef(item.value);
              if (next !== null) item.value = next;
            }
        } else rewriteKey(step, "focus");
        const set = step.get("set", true);
        if (!isMap(set)) continue;
        for (const entry of set.items) {
          if (isScalar(entry.key) && typeof entry.key.value === "string") {
            const next = replaceRef(entry.key.value);
            if (next !== null) entry.key.value = next;
          }
          if (isMap(entry.value)) {
            rewriteKey(entry.value, "in");
            rewriteKey(entry.value, "on");
          }
        }
      }
    }
  }
  // What rides on it, and what's a copy of it, follow too.
  for (const section of ["components", "shapes", "containers"])
    eachEntry(section, (map) => {
      rewriteKey(map, "on");
      rewriteKey(map, "like");
    });
  if (isMap(decorations))
    for (const pair of decorations.items) if (isMap(pair.value)) rewriteKey(pair.value, "on");

  // Tours: start, step keys, next and choices.
  const tours = root.get("tours", true) as Node | undefined;
  if (isMap(tours)) {
    for (const tour of tours.items) {
      if (!isMap(tour.value)) continue;
      rewriteKey(tour.value, "start");
      const steps = tour.value.get("steps", true) as Node | undefined;
      if (!isMap(steps)) continue;
      for (const step of steps.items) {
        if (isScalar(step.key) && typeof step.key.value === "string") {
          const next = replaceRef(step.key.value);
          if (next !== null) step.key.value = next;
        }
        if (!isMap(step.value)) continue;
        rewriteKey(step.value, "next");
        const choices = step.value.get("choices", true) as Node | undefined;
        if (!isMap(choices)) continue;
        for (const choice of choices.items) {
          if (isScalar(choice.value) && typeof choice.value.value === "string") {
            const next = replaceRef(choice.value.value);
            if (next !== null) choice.value.value = next;
          } else if (isMap(choice.value)) {
            rewriteKey(choice.value, "next");
          }
        }
      }
    }
  }

  // Layout: decorations inside a renamed container.
  const layout = root.get("layout", true) as Node | undefined;
  if (isMap(layout)) {
    const decorations = layout.get("decorations", true) as Node | undefined;
    if (isMap(decorations))
      for (const pair of decorations.items) if (isMap(pair.value)) rewriteKey(pair.value, "in");
  }

  // Ports point at inner elements.
  const ports = root.get("ports", true) as Node | undefined;
  if (isMap(ports)) {
    for (const port of ports.items) {
      if (isScalar(port.value) && port.value.value === from) port.value.value = replaceRef(from);
    }
  }

  // A concept's roles are keyed by the elements that play them.
  const roles = conceptRoles(root);
  const renamed = replaceRef(from);
  if (roles !== null && renamed !== null) renameKey(roles, from, renamed);
}

/** The `roles:` map of a concept, if this file has one. */
function conceptRoles(root: YAMLMap): YAMLMap | null {
  const concept = root.get("concept", true) as Node | undefined;
  if (!isMap(concept)) return null;
  const roles = concept.get("roles", true) as Node | undefined;
  return isMap(roles) ? roles : null;
}

// -------------------------------------------------------------------------------------------------
// Deleting

/**
 * Deletes elements and everything that only made sense with them: the contents of a deleted
 * container, connections to deleted elements, scene lines, tour steps and layout entries.
 */
export function deleteElements(
  files: ProjectFiles,
  diagram: Diagram,
  names: readonly string[],
): EditResult {
  return edit(files, diagram, (ctx) => {
    const doomed = new Set<string>();
    const add = (name: string): void => {
      if (doomed.has(name) || ctx.kindOf(name) === null) return;
      doomed.add(name);
      for (const child of [
        ...diagram.containers.values(),
        ...diagram.components.values(),
        ...diagram.decorations.values(),
      ]) {
        // What's inside it goes with it, and so does what rides on it (D-87).
        if (child.parent === name) add(child.name);
        else if (child.kind !== "container" && child.on === name) add(child.name);
      }
    };
    for (const name of names) add(name);
    for (const connection of diagram.connections.values()) {
      if (doomed.has(connection.from.element) || doomed.has(connection.to.element))
        doomed.add(connection.name);
    }
    // Riders on an arrow that's going go too.
    for (const rider of [...diagram.components.values(), ...diagram.decorations.values()])
      if (rider.on !== null && doomed.has(rider.on)) add(rider.name);
    if (doomed.size === 0) return [];

    for (const name of doomed) {
      ctx.removeDefinition(name);
      ctx.removeLayout(name);
    }
    for (const file of diagram.files) pruneReferences(ctx, file, doomed);
    return [];
  });
}

function pruneReferences(ctx: EditContext, file: string, doomed: ReadonlySet<string>): void {
  const root = ctx.session.root(file);
  const gone = (value: string | null): boolean => {
    if (value === null) return false;
    const head = value.split(".")[0] ?? value;
    return doomed.has(value) || doomed.has(head);
  };

  const groups = root.get("groups", true) as Node | undefined;
  if (isMap(groups)) {
    for (const pair of [...groups.items]) {
      if (!isMap(pair.value)) continue;
      const members = pair.value.get("members", true);
      if (!isSeq(members)) continue;
      members.items = members.items.filter((item) => !gone(scalarString(item)));
      if (members.items.length === 0 && isScalar(pair.key)) groups.delete(pair.key.value);
    }
  }

  const connections = root.get("connections", true) as Node | undefined;
  if (isMap(connections)) {
    for (const pair of connections.items) {
      if (isMap(pair.value) && gone(scalarString(pair.value.get("backup_for", true))))
        pair.value.delete("backup_for");
    }
  }

  const scenes = root.get("scenes", true) as Node | undefined;
  if (isMap(scenes)) {
    for (const scene of scenes.items) {
      if (!isMap(scene.value)) continue;
      scene.value.items = scene.value.items.filter((entry) => !gone(scalarString(entry.key)));
    }
  }

  // Stories (D-86): lines about what's gone, and its place in focus and zoom, go with it.
  const stories = root.get("stories", true) as Node | undefined;
  if (isMap(stories)) {
    for (const story of stories.items) {
      if (!isSeq(story.value)) continue;
      for (const step of story.value.items) {
        if (!isMap(step)) continue;
        if (gone(scalarString(step.get("zoom", true)))) step.delete("zoom");
        const focus = step.get("focus", true);
        if (isSeq(focus)) {
          focus.items = focus.items.filter((item) => !gone(scalarString(item)));
          if (focus.items.length === 0) step.delete("focus");
        } else if (gone(scalarString(focus))) step.delete("focus");
        const set = step.get("set", true);
        if (!isMap(set)) continue;
        set.items = set.items.filter(
          (entry) =>
            !gone(scalarString(entry.key)) &&
            !(
              isMap(entry.value) &&
              (gone(scalarString(entry.value.get("in", true))) ||
                gone(scalarString(entry.value.get("on", true))))
            ),
        );
        if (set.items.length === 0) step.delete("set");
      }
      // A wordless step left changing nothing would be dropped on reading: take it out.
      story.value.items = story.value.items.filter((step) => !isMap(step) || step.items.length > 0);
    }
  }

  const tours = root.get("tours", true) as Node | undefined;
  if (isMap(tours)) {
    for (const tour of tours.items) {
      if (!isMap(tour.value)) continue;
      const steps = tour.value.get("steps", true) as Node | undefined;
      if (gone(scalarString(tour.value.get("start", true)))) tour.value.delete("start");
      if (!isMap(steps)) continue;
      steps.items = steps.items.filter((step) => !gone(scalarString(step.key)));
      for (const step of steps.items) {
        if (!isMap(step.value)) continue;
        if (gone(scalarString(step.value.get("next", true)))) step.value.delete("next");
        const choices = step.value.get("choices", true) as Node | undefined;
        if (!isMap(choices)) continue;
        choices.items = choices.items.filter((choice) => {
          const target = isMap(choice.value)
            ? scalarString(choice.value.get("next", true))
            : scalarString(choice.value);
          return !gone(target);
        });
        if (choices.items.length === 0) step.value.delete("choices");
      }
    }
  }

  const ports = root.get("ports", true) as Node | undefined;
  if (isMap(ports)) ports.items = ports.items.filter((port) => !gone(scalarString(port.value)));

  const roles = conceptRoles(root);
  if (roles !== null) roles.items = roles.items.filter((role) => !gone(scalarString(role.key)));
}

/**
 * Adds a new entry written the way its neighbours are: when every existing entry in the section
 * is a one-line `{ … }` map (common in hand-written files), the new one is too, so the file keeps
 * one consistent style and the diff stays one line.
 */
export function addEntry(
  section: YAMLMap,
  name: string,
  map: YAMLMap,
  /** Components and shapes can be written `name: type` when that's all they say. */
  shorthand = false,
): void {
  const siblings = section.items.map((pair) => pair.value);
  // `name: generic/service` (or `name: cylinder`) when that's all it says and its neighbours
  // are written that way too, or it's the first one.
  const only = map.items.length === 1 ? map.items[0] : undefined;
  const key = only === undefined ? null : isScalar(only.key) ? only.key.value : only.key;
  const value: unknown =
    only === undefined ? null : isScalar(only.value) ? only.value.value : only.value;
  if (
    shorthand &&
    (key === "type" || key === "shape") &&
    typeof value === "string" &&
    (siblings.length === 0 ||
      siblings.some((sibling) => isScalar(sibling) || typeof sibling === "string"))
  ) {
    section.set(name, value);
    return;
  }
  // One-line maps like their neighbours; the first entry of a section is one line when it's
  // short and plain (`a_to_b: { from: a, to: b }`), as Mogram's own files write them.
  const plain =
    map.items.length <= 4 && map.items.every((pair) => !isMap(pair.value) && !isSeq(pair.value));
  if (siblings.length > 0 ? siblings.every((value) => isMap(value) && value.flow === true) : plain)
    map.flow = true;
  section.set(name, map);
}

/**
 * Locks or unlocks elements (draw.io's Lock/Unlock): a locked element stays selectable but can't
 * be moved, resized or deleted by hand until it's unlocked. Stored as `locked: true` in its
 * layout entry, beside its position.
 */
export function setLocked(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly names: readonly string[]; readonly locked: boolean },
): EditResult {
  return edit(files, diagram, (ctx) => {
    for (const name of args.names) {
      const kind = ctx.requireKind(name);
      if (kind === "group") continue;
      if (kind === "decoration") {
        const map = ctx.decoration(name);
        if (args.locked) map.set("locked", true);
        else map.delete("locked");
        continue;
      }
      ctx.setLayoutField(name, "locked", args.locked ? new Scalar(true) : undefined);
    }
    return [...args.names];
  });
}

/** Whether `name` is locked against moving, resizing and deleting. */
export function isLocked(diagram: Diagram, name: string): boolean {
  return diagram.decorations.get(name)?.locked ?? diagram.layout.get(name)?.locked ?? false;
}

/**
 * Replaces an element's custom properties (`data:`, 07 §18 P0-5), in the order given. Text that
 * reads as a number or true/false is written as one; empty keys are skipped; no rows removes it.
 */
export function setData(
  files: ProjectFiles,
  diagram: Diagram,
  /** `name: null` sets the diagram's own data, which every placeholder can show (07 §6.2). */
  args: { readonly name: string | null; readonly rows: readonly (readonly [string, string])[] },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const map =
      args.name === null ? ctx.session.root(diagram.settingsFile) : ctx.definition(args.name);
    const data = new YAMLMap();
    data.flow = true;
    for (const [rawKey, rawValue] of args.rows) {
      const key = rawKey.trim();
      if (key.length === 0) continue;
      const text = rawValue.trim();
      const value: string | number | boolean =
        text === "true"
          ? true
          : text === "false"
            ? false
            : text !== "" && Number.isFinite(Number(text))
              ? Number(text)
              : text;
      data.set(key, value);
    }
    if (data.items.length === 0) map.delete("data");
    else if (args.name === null && !map.has("data")) insertSetting(map, "data", data);
    else map.set("data", data);
    return args.name === null ? [] : [args.name];
  });
}
