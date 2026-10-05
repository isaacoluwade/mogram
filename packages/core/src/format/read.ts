import type { Node } from "yaml";
import type {
  CardRef,
  Component,
  FlowBehaviour,
  Scale,
  ScaleSize,
  ShapeLook,
  Tone,
  Connection,
  Container,
  Density,
  Direction,
  Group,
  Intensity,
  Rollup,
  RouteStyle,
  Speed,
  TrafficPattern,
} from "../model/types";
import { humanize, isValidName } from "../model/names";
import { resolveFromFolder } from "../model/paths";
import {
  CANVAS_THEMES,
  CONTAINER_ALIASES,
  CONTAINER_STYLES,
  type ContainerStyleName,
  FLOW_PRESETS,
  MOTION_PRESETS,
  STATE_PRESETS,
  isCanvasTheme,
  isContainerStyle,
  isFlowPreset,
  isMotionPreset,
  isStatePreset,
} from "../presets/names";
import {
  ARROWHEADS,
  CORNER_STYLES,
  DEFAULT_ARROW_SIZE,
  DEFAULT_LINE_WIDTH,
  JUMP_STYLES,
  LINE_PATTERNS,
  MAX_ARROW_SIZE,
  MAX_LINE_WIDTH,
  MIN_ARROW_SIZE,
  MIN_LINE_WIDTH,
  defaultArrows,
  isArrowhead,
  type Arrowhead,
  type CornerStyle,
  type JumpStyle,
  type LinePattern,
} from "../presets/connectors";
import { SHAPES, isShapeId, type ShapeId } from "../presets/shapes";
import { TONE_NAMES } from "../presets/tones";
import type { DiagnosticSink, Position } from "./diagnostics";
import { didYouMean, listOptions } from "./suggest";
import {
  asString,
  isMap,
  isNullish,
  isScalar,
  isSeq,
  mapEntries,
  positionOf,
  scalarValue,
  type MapEntry,
  type ParsedFile,
  nodeOf,
} from "./yaml-read";
import type {
  Ref,
  RawConcept,
  RawSettings,
  RawComponent,
  RawContainer,
  RawGroup,
  RawConnection,
  FileContribution,
  Mutable,
} from "./raw";
import { normalizeHex } from "../presets/color";
import { parsePaint } from "../presets/paint";
import { SectionReader } from "./read-base";
import {
  CONCEPT_PLATFORMS,
  CONCEPT_TOPICS,
  isConceptPlatform,
  isConceptTopic,
  type ConceptPlatform,
  type ConceptTopic,
} from "../presets/concepts";

const TOPIC_IDS = CONCEPT_TOPICS.map((t) => t.id);
const PLATFORM_IDS = CONCEPT_PLATFORMS.map((p) => p.id);
import { LONGEST_CYCLE, PATTERN_DEFAULTS, SHORTEST_CYCLE } from "../capacity/patterns";

const TRAFFIC_PATTERNS = ["steady", "waves", "bursts"];
import { STYLE_KEYS, type NamedStyles, type StyleTarget } from "./styles";
import { LayoutReader } from "./read-layout";
import { StoryReader } from "./read-story";
import { parseEndpoint } from "./endpoints";

export { endpointToString, parseEndpoint } from "./endpoints";
export type {
  Ref,
  RawSettings,
  RawComponent,
  RawContainer,
  RawGroup,
  RawConnection,
  RawDecoration,
  RawLayout,
  RawScene,
  RawTour,
  StepPositions,
  FileContribution,
} from "./raw";

const SETTINGS_KEYS = [
  "mogram",
  "name",
  "description",
  "concept",
  "theme",
  "background",
  "grid",
  "libraries",
  "ports",
  "data",
] as const;
const SECTION_KEYS = [
  "styles",
  "containers",
  "components",
  "shapes",
  "groups",
  "connections",
  "scenes",
  "tours",
  "layout",
] as const;
/** What a component does to traffic (capacity, D-82). */
export const CAPACITY_KEYS = ["scale", "capacity", "routing", "hit", "queue"];
/** The most copies a scaled-out element can have (they're drawn, so they stay readable). */
export const MAX_COPIES = 24;
/** The most sizes a scaled-up element can step through. */
export const MAX_SIZES = 8;

export const COMPONENT_KEYS = [
  "type",
  "style",
  "label",
  "in",
  "state",
  "motion",
  "intensity",
  "speed",
  "color",
  "card",
  "opens",
  "link",
  "data",
  ...CAPACITY_KEYS,
];
export const SHAPE_KEYS = [
  "shape",
  "style",
  "label",
  "in",
  "state",
  "motion",
  "intensity",
  "speed",
  "color",
  "card",
  "opens",
  "tone",
  "fill",
  "stroke",
  "stroke_width",
  "dash",
  "corner",
  "lid",
  "slant",
  "wave",
  "shadow",
  "opacity",
  "font",
  "font_size",
  "bold",
  "italic",
  "align",
  "text_color",
  "link",
  "data",
  ...CAPACITY_KEYS,
];
export const CONTAINER_KEYS = [
  "type",
  "style",
  "label",
  "in",
  "state",
  "rollup",
  "color",
  "card",
  "icon",
  "link",
  "data",
];
export const GROUP_KEYS = ["label", "members", "link", "data"];
export const CONNECTION_KEYS = [
  "from",
  "to",
  "style",
  "flow",
  "label",
  "direction",
  "speed",
  "density",
  "route",
  "color",
  "arrows",
  "arrow_size",
  "line",
  "width",
  "corners",
  "jumps",
  "backup_for",
  "card",
  "link",
  "data",
  "traffic",
  "share",
];

export const CURRENT_FORMAT_VERSION = 1;
export const DEFAULT_COMPONENT_TYPE = "generic/service";

/** Reads one Mogram file into raw records. Cross-file checks happen in `parse.ts`. */
export function readFile(
  file: ParsedFile,
  folder: string,
  sink: DiagnosticSink,
  styles: NamedStyles = new Map(),
): FileContribution {
  const out: FileContribution = {
    file: file.path,
    settings: null,
    components: [],
    containers: [],
    groups: [],
    connections: [],
    decorations: [],
    layout: [],
    scenes: [],
    tours: [],
    hasLayoutKey: false,
  };
  const root = file.doc.contents;
  if (file.broken || root === null || !isMap(root)) return out;

  const reader = new ElementReader(file, folder, sink, styles);
  const story = new StoryReader(file, folder, sink);
  const layout = new LayoutReader(file, folder, sink);
  for (const entry of mapEntries(file, root, sink)) {
    const at = positionOf(file, entry.keyNode);
    if ((SETTINGS_KEYS as readonly string[]).includes(entry.key)) {
      out.settings ??= emptySettings(positionOf(file, root));
      reader.readSetting(out.settings, entry);
      continue;
    }
    switch (entry.key) {
      case "styles":
        // Read for every file before any element (format/styles.ts).
        break;
      case "containers":
        reader.eachElement(entry, "containers", (name, node, pos) => {
          out.containers.push(reader.readContainer(name, node, pos));
        });
        break;
      case "components":
        reader.eachElement(entry, "components", (name, node, pos) => {
          out.components.push(reader.readComponent(name, node, pos));
        });
        break;
      case "shapes":
        reader.eachElement(entry, "shapes", (name, node, pos) => {
          out.components.push(reader.readShape(name, node, pos));
        });
        break;
      case "groups":
        reader.eachElement(entry, "groups", (name, node, pos) => {
          const group = reader.readGroup(name, node, pos);
          if (group !== null) out.groups.push(group);
        });
        break;
      case "connections":
        reader.eachElement(entry, "connections", (name, node, pos) => {
          const connection = reader.readConnection(name, node, pos);
          if (connection !== null) out.connections.push(connection);
        });
        break;
      case "scenes":
        story.readScenes(entry, out.scenes);
        break;
      case "tours":
        story.readTours(entry, out.tours);
        break;
      case "layout":
        out.hasLayoutKey = true;
        layout.readLayout(entry, out.layout, out.decorations);
        break;
      default:
        sink.warning(
          at,
          `"${entry.key}" isn't a section Mogram knows, so it is ignored.${didYouMean(entry.key, [
            ...SECTION_KEYS,
            ...SETTINGS_KEYS,
          ])}`,
        );
    }
  }
  return out;
}

function emptySettings(at: Position): RawSettings {
  return {
    at,
    name: null,
    description: null,
    concept: null,
    theme: null,
    background: null,
    grid: null,
    libraries: null,
    ports: new Map(),
    data: new Map(),
  };
}

/** Settings and the element sections: components, containers, groups, connections. */
class ElementReader extends SectionReader {
  constructor(
    file: ParsedFile,
    folder: string,
    sink: DiagnosticSink,
    private readonly styles: NamedStyles,
  ) {
    super(file, folder, sink);
  }

  /**
   * The element's fields with its named style's underneath: its own keys win, and only the keys
   * that mean something for this kind are taken.
   */
  private withStyle(
    name: string,
    fields: Map<string, MapEntry>,
    target: StyleTarget,
  ): { fields: Map<string, MapEntry>; style: string | null } {
    const entry = fields.get("style");
    if (entry === undefined) return { fields, style: null };
    const styleName = asString(entry.value);
    if (styleName === null) {
      this.sink.error(
        this.pos(entry.value ?? entry.keyNode),
        `The style of "${name}" should name one of the styles under "styles:", like "style: critical".`,
      );
      return { fields, style: null };
    }
    const style = this.styles.get(styleName);
    if (style === undefined) {
      const known = [...this.styles.keys()];
      this.sink.error(
        this.pos(entry.value),
        known.length === 0
          ? `"${name}" takes style "${styleName}", but there is no "styles:" section with it.`
          : `"${name}" takes style "${styleName}", which isn't under "styles:".${didYouMean(styleName, known)}`,
      );
      return { fields, style: null };
    }
    const merged = new Map(fields);
    for (const [key, value] of style.entries)
      if (STYLE_KEYS[target].includes(key) && !merged.has(key)) merged.set(key, value);
    return { fields: merged, style: styleName };
  }

  // ---------------------------------------------------------------------------------------------
  // Settings

  readSetting(settings: RawSettings, entry: MapEntry): void {
    const at = this.pos(entry.value ?? entry.keyNode);
    switch (entry.key) {
      case "mogram": {
        const version = scalarValue(entry.value);
        if (typeof version !== "number" || !Number.isInteger(version)) {
          this.sink.error(
            at,
            `"mogram:" is the format version and should be a whole number, like 1.`,
          );
        } else if (version > CURRENT_FORMAT_VERSION) {
          this.sink.warning(
            at,
            `This diagram was written for Mogram format ${version}, which is newer than this app understands (${CURRENT_FORMAT_VERSION}). Some parts may not show.`,
          );
        }
        return;
      }
      case "name":
        settings.name = this.requireString(entry, "The diagram name");
        return;
      case "description":
        settings.description = this.requireString(entry, "The description");
        return;
      case "concept":
        settings.concept = this.readConcept(entry);
        return;
      case "theme": {
        const theme = asString(entry.value);
        if (isCanvasTheme(theme)) settings.theme = theme;
        else
          this.sink.error(
            at,
            `"${theme ?? ""}" isn't a canvas theme.${didYouMean(theme ?? "", CANVAS_THEMES)} Choose one of ${listOptions(CANVAS_THEMES)}.`,
          );
        return;
      }
      case "background": {
        const text = asString(entry.value);
        const read = parsePaint(text ?? "");
        if ("paint" in read) settings.background = read.paint;
        else this.sink.error(at, `The background: ${read.error}`);
        return;
      }
      case "grid": {
        const color = normalizeHex(asString(entry.value) ?? "");
        if (color !== null) settings.grid = color;
        else
          this.sink.error(
            at,
            `The grid colour should be a hex colour like "#ffffff40" (the last two digits are opacity).`,
          );
        return;
      }
      case "libraries": {
        if (!isSeq(entry.value)) {
          this.sink.error(at, `"libraries" should be a list, like [azure, generic, tools].`);
          return;
        }
        settings.libraries = entry.value.items
          .map((item) => asString(nodeOf(item)))
          .filter((v) => v !== null);
        return;
      }
      case "ports": {
        if (!isMap(entry.value)) {
          this.sink.error(
            at,
            `"ports" should map a port name to an element inside, like "web: ingress".`,
          );
          return;
        }
        for (const port of this.entries(entry.value)) {
          const target = asString(port.value);
          const portAt = this.pos(port.keyNode);
          if (!isValidName(port.key)) {
            this.sink.error(portAt, `"${port.key}" isn't a valid port name.`);
          } else if (target === null) {
            this.sink.error(
              portAt,
              `Port "${port.key}" should name the element it leads to, like "${port.key}: ingress".`,
            );
          } else {
            settings.ports.set(port.key, { value: target, at: this.pos(port.value) });
          }
        }
        return;
      }
      case "data":
        settings.data = this.readData(entry, "the diagram");
        return;
      default:
        return;
    }
  }

  /** `concept:` — a summary, and roles: `element: what it is`, or `{ label, optional }`. */
  private readConcept(entry: MapEntry): RawConcept | null {
    const at = this.pos(entry.keyNode);
    if (!isMap(entry.value)) {
      this.sink.error(
        this.pos(entry.value ?? entry.keyNode),
        `"concept" should have a summary and roles indented below it.`,
      );
      return null;
    }
    const fields = this.body(
      "concept",
      entry.value,
      ["summary", "topic", "platform", "tags", "roles"],
      "concept",
    );
    const summary = this.optionalString(fields.get("summary"), "The concept's summary");
    const topicEntry = fields.get("topic");
    const topicWord = topicEntry === undefined ? null : (asString(topicEntry.value)?.trim() ?? "");
    let topic: ConceptTopic | null = null;
    if (topicWord !== null) {
      if (isConceptTopic(topicWord)) topic = topicWord;
      else
        this.sink.warning(
          this.pos(topicEntry?.value ?? entry.keyNode),
          `"${topicWord}" isn't a concept topic, so it's left out.${didYouMean(topicWord, TOPIC_IDS)} Topics: ${listOptions(TOPIC_IDS)}.`,
        );
    }
    const platformEntry = fields.get("platform");
    const platformWord =
      platformEntry === undefined ? null : (asString(platformEntry.value)?.trim() ?? "");
    let platform: ConceptPlatform = "any";
    if (platformWord !== null) {
      if (isConceptPlatform(platformWord)) platform = platformWord;
      else
        this.sink.warning(
          this.pos(platformEntry?.value ?? entry.keyNode),
          `"${platformWord}" isn't a platform, so the concept is for any.${didYouMean(platformWord, PLATFORM_IDS)} Platforms: ${listOptions(PLATFORM_IDS)}.`,
        );
    }
    const tagsEntry = fields.get("tags");
    const tags: string[] = [];
    if (tagsEntry !== undefined && !isNullish(tagsEntry.value)) {
      if (!isSeq(tagsEntry.value))
        this.sink.error(
          this.pos(tagsEntry.value),
          `A concept's tags should be a list of words, like [autoscaling, vm].`,
        );
      else
        for (const item of tagsEntry.value.items) {
          const tag = asString(nodeOf(item))?.trim().toLowerCase();
          if (tag !== undefined && tag !== "" && !tags.includes(tag)) tags.push(tag);
        }
    }
    const roles: RawConcept["roles"] = [];
    const rolesEntry = fields.get("roles");
    if (rolesEntry !== undefined && !isNullish(rolesEntry.value)) {
      if (!isMap(rolesEntry.value)) {
        this.sink.error(
          this.pos(rolesEntry.value),
          `A concept's roles should name its elements, like "web: What scales out".`,
        );
      } else {
        for (const role of this.entries(rolesEntry.value)) {
          const element = { value: role.key, at: this.pos(role.keyNode) };
          const plain = asString(role.value);
          if (plain !== null) {
            roles.push({ element, label: plain, optional: false });
            continue;
          }
          const parts = this.body(role.key, role.value, ["label", "optional"], "role");
          roles.push({
            element,
            label:
              this.optionalString(parts.get("label"), `The label of role "${role.key}"`) ??
              humanize(role.key),
            optional: this.optionalBoolean(parts.get("optional"), role.key, "optional") ?? false,
          });
        }
      }
    }
    return { at, summary, topic, platform, tags, roles };
  }

  // ---------------------------------------------------------------------------------------------
  // Elements

  eachElement(
    section: MapEntry,
    sectionName: string,
    visit: (name: string, node: Node | null, at: Position) => void,
  ): void {
    if (isNullish(section.value)) return;
    if (!isMap(section.value)) {
      this.sink.error(
        this.pos(section.keyNode),
        `"${sectionName}" should be a list of named entries, like "web_vm:".`,
      );
      return;
    }
    for (const entry of this.entries(section.value)) {
      const at = this.pos(entry.keyNode);
      if (!isValidName(entry.key)) {
        this.sink.error(
          at,
          `"${entry.key}" isn't a valid name. Names start with a letter and use letters, numbers, "_" or "-" (for example web_vm).`,
        );
        continue;
      }
      visit(entry.key, entry.value, at);
    }
  }

  readComponent(name: string, node: Node | null, at: Position): RawComponent {
    const shorthandType = isScalar(node) && typeof node.value === "string" ? node.value : null;
    const styled = this.withStyle(
      name,
      shorthandType === null
        ? this.body(name, node, COMPONENT_KEYS, "component")
        : new Map<string, MapEntry>(),
      "component",
    );
    const fields = styled.fields;
    const type =
      shorthandType ??
      this.optionalString(fields.get("type"), `The type of "${name}"`) ??
      DEFAULT_COMPONENT_TYPE;
    return this.componentFrom(name, fields, at, type, null, null, styled.style);
  }

  /**
   * A shape (03-shapes-styles-library §5 P0-1): a component drawn as an outline. `name: cylinder`
   * is short for `{ shape: cylinder }`; without `shape:` it's a rectangle.
   */
  readShape(name: string, node: Node | null, at: Position): RawComponent {
    const shorthand = isScalar(node) && typeof node.value === "string" ? node.value : null;
    const styled = this.withStyle(
      name,
      shorthand === null ? this.body(name, node, SHAPE_KEYS, "shape") : new Map<string, MapEntry>(),
      "shape",
    );
    const fields = styled.fields;
    let shape: ShapeId = "rectangle";
    if (shorthand !== null) {
      if (isShapeId(shorthand)) shape = shorthand;
      else
        this.sink.error(
          this.pos(node),
          `"${shorthand}" isn't a shape for "${name}".${didYouMean(shorthand, SHAPES)} Choose one of ${listOptions(SHAPES)}.`,
        );
    } else {
      shape =
        this.optionalEnum(fields.get("shape"), SHAPES, isShapeId, name, "shape") ?? "rectangle";
    }
    const widthEntry = fields.get("stroke_width");
    const width = widthEntry === undefined ? null : scalarValue(widthEntry.value);
    if (widthEntry !== undefined && (typeof width !== "number" || width < 0 || width > 8))
      this.sink.error(
        this.pos(widthEntry.value),
        `The stroke width of "${name}" should be a number from 0 to 8, like 2.`,
      );
    // The adjustable measures (corner, lid, slant, wave): px, 0 or more.
    const measure = (key: string, what: string): number | null => {
      const entry = fields.get(key);
      if (entry === undefined) return null;
      const value = scalarValue(entry.value);
      if (typeof value === "number" && value >= 0) return value;
      this.sink.error(this.pos(entry.value), `The ${key} of "${name}" should be ${what}.`);
      return null;
    };
    const corner = measure("corner", "a radius in px, like 12");
    const opacityEntry = fields.get("opacity");
    const opacity = opacityEntry === undefined ? null : scalarValue(opacityEntry.value);
    if (opacityEntry !== undefined && (typeof opacity !== "number" || opacity < 0 || opacity > 100))
      this.sink.error(
        this.pos(opacityEntry.value),
        `The opacity of "${name}" should be from 0 (invisible) to 100 (solid).`,
      );
    const strokeEntry = fields.get("stroke");
    const strokeText = strokeEntry === undefined ? null : asString(strokeEntry.value);
    const look: ShapeLook = {
      tone: this.optionalLiteral<Tone>(fields.get("tone"), TONE_NAMES, name, "tone") ?? "neutral",
      fill: this.optionalPaint(fields.get("fill"), name, "fill"),
      stroke: strokeText === "none" ? "none" : this.optionalColor(strokeEntry, name),
      strokeWidth: typeof width === "number" && width >= 0 && width <= 8 ? width : 1.5,
      dash:
        this.optionalLiteral<LinePattern>(fields.get("dash"), LINE_PATTERNS, name, "dash") ??
        "solid",
      corner,
      lid: measure("lid", "a depth in px, like 12"),
      slant: measure("slant", "a width in px, like 20"),
      wave: measure("wave", "a depth in px, like 10"),
      shadow: this.optionalBoolean(fields.get("shadow"), name, "shadow") ?? false,
      opacity: typeof opacity === "number" && opacity >= 0 && opacity <= 100 ? opacity : 100,
      text: this.readTextLook(fields, name, { colorKey: "text_color", align: "center" }),
    };
    return this.componentFrom(name, fields, at, `shape/${shape}`, shape, look, styled.style);
  }

  private componentFrom(
    name: string,
    fields: ReadonlyMap<string, MapEntry>,
    at: Position,
    type: string,
    shape: ShapeId | null,
    look: ShapeLook | null,
    style: string | null,
  ): RawComponent {
    const label = this.optionalString(fields.get("label"), `The label of "${name}"`);
    const state = this.optionalEnum(
      fields.get("state"),
      STATE_PRESETS,
      isStatePreset,
      name,
      "state",
    );
    const opens = fields.get("opens");
    const opensPath = opens === undefined ? null : this.readOpens(name, opens);
    const model: Mutable<Component> = {
      kind: "component",
      name,
      label: label ?? humanize(name),
      hasExplicitLabel: label !== null,
      source: { file: at.file, line: at.line },
      ...this.readExtras(fields, name),
      type,
      parent: null,
      state: state ?? "healthy",
      hasExplicitState: state !== null,
      motion:
        this.optionalEnum(fields.get("motion"), MOTION_PRESETS, isMotionPreset, name, "motion") ??
        "none",
      intensity:
        this.optionalLiteral<Intensity>(
          fields.get("intensity"),
          ["normal", "low", "high"],
          name,
          "intensity",
        ) ?? "normal",
      speed:
        this.optionalLiteral<Speed>(
          fields.get("speed"),
          ["normal", "slow", "fast"],
          name,
          "speed",
        ) ?? "normal",
      color: this.optionalColor(fields.get("color"), name),
      card: this.readCard(name, fields.get("card")),
      opens: opensPath,
      shape,
      look,
      style,
      ...this.readFlowBehaviour(fields, name, shape),
    };
    return {
      model,
      at,
      parentRef: this.optionalRef(fields.get("in")),
      opensAt: opens === undefined ? null : this.pos(opens.value),
    };
  }

  /** What a component does to traffic passing through it (capacity, D-82). */
  private readFlowBehaviour(
    fields: ReadonlyMap<string, MapEntry>,
    name: string,
    shape: ShapeId | null,
  ): FlowBehaviour {
    const capacityEntry = fields.get("capacity");
    let capacity =
      capacityEntry === undefined || isNullish(capacityEntry.value)
        ? null
        : this.readMultiple(capacityEntry.value, `The capacity of "${name}"`);
    if (capacity !== null && capacity <= 0) {
      this.sink.error(
        this.pos(capacityEntry?.value),
        `The capacity of "${name}" should be more than 0.`,
      );
      capacity = null;
    }
    const hitEntry = fields.get("hit");
    return {
      scale: this.readScale(fields.get("scale"), name, shape),
      capacity,
      routing:
        this.optionalLiteral<"split" | "copy">(
          fields.get("routing"),
          ["split", "copy"],
          name,
          "routing",
        ) ?? null,
      hit:
        hitEntry === undefined || isNullish(hitEntry.value)
          ? null
          : this.readPercent(hitEntry.value, `The hit rate of "${name}"`),
      queue: this.optionalBoolean(fields.get("queue"), name, "queue") ?? null,
    };
  }

  /**
   * `scale: { min: 2, max: 8 }` scales out (copies); `scale: { sizes: [...] }` scales up (one
   * copy, bigger sizes). Shapes don't scale: they're outlines, not things that run.
   */
  private readScale(
    entry: MapEntry | undefined,
    name: string,
    shape: ShapeId | null,
  ): Scale | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const at = this.pos(entry.value);
    if (shape !== null) {
      this.sink.warning(
        at,
        `Scaling works on icon components, and "${name}" is a shape, so its scale is ignored.`,
      );
      return null;
    }
    if (!isMap(entry.value)) {
      this.sink.error(
        at,
        `"scale" on "${name}" should be { min: 2, max: 8 } to add copies, or a list of sizes to grow.`,
      );
      return null;
    }
    const fields = this.body(name, entry.value, ["min", "max", "target", "sizes"], "scale");
    const targetEntry = fields.get("target");
    let target =
      targetEntry === undefined
        ? 0.7
        : this.readPercent(targetEntry.value, `The target of "${name}"`);
    if (target !== null && target < 0.05) {
      this.sink.error(
        this.pos(targetEntry?.value),
        `The target of "${name}" should be at least 5%.`,
      );
      target = null;
    }
    const sizesEntry = fields.get("sizes");
    if (sizesEntry !== undefined) {
      if (fields.has("min") || fields.has("max"))
        this.sink.warning(
          this.pos(sizesEntry.keyNode),
          `"${name}" scales up through sizes, so its min and max (for copies) are ignored.`,
        );
      const sizes = this.readSizes(sizesEntry, name);
      return sizes === null ? null : { kind: "up", sizes, target: target ?? 0.7 };
    }
    const integer = (key: "min" | "max"): number | null => {
      const field = fields.get(key);
      if (field === undefined) return null;
      const value = scalarValue(field.value);
      if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_COPIES)
        return value;
      this.sink.error(
        this.pos(field.value),
        `The ${key} of "${name}" should be a whole number of copies from 1 to ${MAX_COPIES}.`,
      );
      return null;
    };
    const min = integer("min");
    const max = integer("max");
    if (min === null && max === null) {
      if (!fields.has("min") && !fields.has("max"))
        this.sink.error(
          at,
          `"scale" on "${name}" needs a max (and min) number of copies, like { min: 2, max: 8 }, or sizes.`,
        );
      return null;
    }
    const low = min ?? 1;
    const high = max ?? low;
    if (low > high) {
      this.sink.error(at, `"${name}" can't have a min (${low}) above its max (${high}).`);
      return null;
    }
    return { kind: "out", min: low, max: high, target: target ?? 0.7 };
  }

  /** Sizes, smallest first: names (`[S1, S2]`) or `{ name, cpu, memory, disks, capacity }`. */
  private readSizes(entry: MapEntry, owner: string): ScaleSize[] | null {
    if (!isSeq(entry.value) || entry.value.items.length === 0) {
      this.sink.error(
        this.pos(entry.value ?? entry.keyNode),
        `The sizes of "${owner}" should be a list, smallest first, like [S1, S2, S3].`,
      );
      return null;
    }
    const items = entry.value.items.map((item) => nodeOf(item));
    if (items.length > MAX_SIZES)
      this.sink.warning(
        this.pos(entry.value),
        `"${owner}" lists ${items.length} sizes; the first ${MAX_SIZES} are used.`,
      );
    const sizes: ScaleSize[] = [];
    const seen = new Set<string>();
    for (const [index, node] of items.slice(0, MAX_SIZES).entries()) {
      const doubling = 2 ** index;
      const plain = asString(node);
      if (plain !== null) {
        sizes.push({ name: plain, cpu: null, memory: null, disks: null, capacity: doubling });
      } else if (isMap(node)) {
        const fields = this.body(
          owner,
          node,
          ["name", "cpu", "memory", "disks", "capacity"],
          "size",
        );
        const number = (key: "cpu" | "memory" | "disks"): number | null => {
          const field = fields.get(key);
          if (field === undefined) return null;
          const value = scalarValue(field.value);
          if (typeof value === "number" && value > 0) return value;
          this.sink.error(
            this.pos(field.value),
            `The ${key} of a size of "${owner}" should be a number above 0.`,
          );
          return null;
        };
        const capacityField = fields.get("capacity");
        const capacity =
          capacityField === undefined
            ? null
            : this.readMultiple(capacityField.value, `The capacity of a size of "${owner}"`);
        const cpu = number("cpu");
        const memory = number("memory");
        // Unnamed sizes are named by what they have: "4 vCPU · 16 GB".
        const described = [
          cpu === null ? null : `${cpu} vCPU`,
          memory === null ? null : `${memory} GB`,
        ]
          .filter((part) => part !== null)
          .join(" · ");
        sizes.push({
          name:
            this.optionalString(fields.get("name"), `The name of a size of "${owner}"`) ??
            (described === "" ? `Size ${index + 1}` : described),
          cpu,
          memory,
          disks: number("disks"),
          capacity: capacity !== null && capacity > 0 ? capacity : doubling,
        });
      } else {
        this.sink.error(
          this.pos(node),
          `A size of "${owner}" should be a name, or { name, cpu, memory, disks }.`,
        );
        continue;
      }
      const named = sizes.at(-1)?.name ?? "";
      if (seen.has(named))
        this.sink.warning(this.pos(node), `"${owner}" lists the size "${named}" twice.`);
      seen.add(named);
    }
    return sizes.length === 0 ? null : sizes;
  }

  private readOpens(name: string, entry: MapEntry): string | null {
    const raw = asString(entry.value);
    if (raw === null) {
      this.sink.error(
        this.pos(entry.value ?? entry.keyNode),
        `"opens" on "${name}" should be a folder, like ./aks.`,
      );
      return null;
    }
    const resolved = resolveFromFolder(this.folder, raw);
    if (resolved === null || resolved === this.folder) {
      this.sink.error(
        this.pos(entry.value),
        resolved === null
          ? `"${name}" opens "${raw}", which is outside the project.`
          : `"${name}" opens its own folder. A component opens a different folder, like ./aks.`,
      );
      return null;
    }
    return resolved;
  }

  readContainer(name: string, node: Node | null, at: Position): RawContainer {
    const styled = this.withStyle(
      name,
      this.body(name, node, CONTAINER_KEYS, "container"),
      "container",
    );
    const fields = styled.fields;
    const label = this.optionalString(fields.get("label"), `The label of "${name}"`);
    const state = this.optionalEnum(
      fields.get("state"),
      STATE_PRESETS,
      isStatePreset,
      name,
      "state",
    );
    const model: Mutable<Container> = {
      kind: "container",
      style: styled.style,
      name,
      label: label ?? humanize(name),
      hasExplicitLabel: label !== null,
      source: { file: at.file, line: at.line },
      ...this.readExtras(fields, name),
      type: this.containerType(fields.get("type"), name) ?? "box",
      icon: this.optionalString(fields.get("icon"), `The icon of "${name}"`),
      parent: null,
      state: state ?? "healthy",
      hasExplicitState: state !== null,
      rollup:
        this.optionalLiteral<Rollup>(
          fields.get("rollup"),
          ["worst", "best", "none"],
          name,
          "rollup",
        ) ?? "worst",
      color: this.optionalColor(fields.get("color"), name),
      card: this.readCard(name, fields.get("card")),
    };
    return { model, at, parentRef: this.optionalRef(fields.get("in")) };
  }

  /** A container's kind; `vnet` and `vpc` still read, as the one network kind they became. */
  private containerType(entry: MapEntry | undefined, name: string): ContainerStyleName | null {
    const raw = entry === undefined ? null : asString(entry.value);
    const alias =
      raw !== null && Object.hasOwn(CONTAINER_ALIASES, raw) ? CONTAINER_ALIASES[raw] : undefined;
    if (alias !== undefined) return alias;
    return this.optionalEnum(entry, CONTAINER_STYLES, isContainerStyle, name, "container type");
  }

  readGroup(name: string, node: Node | null, at: Position): RawGroup | null {
    const fields = this.body(name, node, GROUP_KEYS, "group");
    const members = fields.get("members");
    const memberRefs: Ref[] = [];
    if (members === undefined || !isSeq(members.value)) {
      this.sink.error(
        at,
        `Group "${name}" needs "members", a list of the elements it surrounds, like [web_vm_1, web_vm_2].`,
      );
      return null;
    }
    for (const item of members.value.items) {
      const value = asString(nodeOf(item));
      if (value === null)
        this.sink.error(this.pos(nodeOf(item)), `Group members should be element names.`);
      else memberRefs.push({ value, at: this.pos(nodeOf(item)) });
    }
    const label = this.optionalString(fields.get("label"), `The label of "${name}"`);
    const model: Mutable<Group> = {
      kind: "group",
      name,
      label: label ?? humanize(name),
      hasExplicitLabel: label !== null,
      source: { file: at.file, line: at.line },
      ...this.readExtras(fields, name),
      members: memberRefs.map((ref) => ref.value),
    };
    return { model, at, memberRefs };
  }

  readConnection(name: string, node: Node | null, at: Position): RawConnection | null {
    const styled = this.withStyle(
      name,
      this.body(name, node, CONNECTION_KEYS, "connection"),
      "connection",
    );
    const fields = styled.fields;
    const from = fields.get("from");
    const to = fields.get("to");
    const fromValue = from === undefined ? null : asString(from.value);
    const toValue = to === undefined ? null : asString(to.value);
    if (fromValue === null || toValue === null) {
      this.sink.error(
        at,
        `Connection "${name}" needs both "from" and "to", the elements it joins.`,
      );
      return null;
    }
    const flow = this.optionalEnum(fields.get("flow"), FLOW_PRESETS, isFlowPreset, name, "flow");
    const text = this.optionalString(fields.get("label"), `The label of "${name}"`);
    const backup = fields.get("backup_for");
    const direction =
      this.optionalLiteral<Direction>(
        fields.get("direction"),
        ["forward", "reverse", "both"],
        name,
        "direction",
      ) ?? "forward";
    const model: Mutable<Connection> = {
      kind: "connection",
      style: styled.style,
      name,
      label: text ?? humanize(name),
      hasExplicitLabel: text !== null,
      source: { file: at.file, line: at.line },
      ...this.readExtras(fields, name),
      from: parseEndpoint(fromValue),
      to: parseEndpoint(toValue),
      flow: flow ?? "idle",
      hasExplicitFlow: flow !== null,
      direction,
      speed:
        this.optionalLiteral<Speed>(
          fields.get("speed"),
          ["normal", "slow", "fast"],
          name,
          "speed",
        ) ?? "normal",
      density:
        this.optionalLiteral<Density>(
          fields.get("density"),
          ["normal", "low", "high"],
          name,
          "density",
        ) ?? "normal",
      route:
        this.optionalLiteral<RouteStyle>(
          fields.get("route"),
          ["orthogonal", "curved", "straight"],
          name,
          "route",
        ) ?? "orthogonal",
      color: this.optionalColor(fields.get("color"), name),
      ...this.readConnectorLook(fields, name, direction),
      text,
      backupFor: backup === undefined ? null : asString(backup.value),
      card: this.readCard(name, fields.get("card")),
      ...this.readTraffic(fields.get("traffic"), name),
      share: this.optionalPercent(fields.get("share"), `The share of "${name}"`),
    };
    return {
      model,
      at,
      fromAt: this.pos(from?.value),
      toAt: this.pos(to?.value),
      backupAt: backup === undefined ? null : this.pos(backup.value),
    };
  }

  /**
   * A connection's traffic (D-82, D-84): a steady level (`3x`), a pattern by name
   * (`waves`, `bursts`), or `{ pattern, high, low, every }`.
   */
  private readTraffic(
    entry: MapEntry | undefined,
    owner: string,
  ): { traffic: number | null; pattern: TrafficPattern | null } {
    const none = { traffic: null, pattern: null };
    if (entry === undefined || isNullish(entry.value)) return none;
    const word = asString(entry.value)?.trim().toLowerCase() ?? null;
    if (word !== null && /^[a-z]+$/.test(word)) {
      if (word === "steady") return none;
      if (word === "waves" || word === "bursts")
        return { traffic: null, pattern: { ...PATTERN_DEFAULTS[word] } };
      this.sink.error(
        this.pos(entry.value),
        `"${word}" isn't a traffic pattern on "${owner}".${didYouMean(word, TRAFFIC_PATTERNS)} Give a level like 3x, or a pattern: ${listOptions(TRAFFIC_PATTERNS)}.`,
      );
      return none;
    }
    if (!isMap(entry.value))
      return {
        traffic: this.readMultiple(entry.value, `The traffic on "${owner}"`),
        pattern: null,
      };
    const fields = this.body(
      owner,
      entry.value,
      ["pattern", "level", "high", "low", "every"],
      "traffic",
    );
    const kindEntry = fields.get("pattern");
    const kind =
      kindEntry === undefined ? "waves" : (asString(kindEntry.value)?.trim().toLowerCase() ?? "");
    if (kind === "steady")
      return {
        traffic: this.optionalMultiple(fields.get("level"), `The traffic on "${owner}"`),
        pattern: null,
      };
    if (kind !== "waves" && kind !== "bursts") {
      this.sink.error(
        this.pos(kindEntry?.value ?? entry.keyNode),
        `"${kind}" isn't a traffic pattern on "${owner}".${didYouMean(kind, TRAFFIC_PATTERNS)} Patterns: ${listOptions(TRAFFIC_PATTERNS)}.`,
      );
      return none;
    }
    const base = PATTERN_DEFAULTS[kind];
    let high =
      this.optionalMultiple(fields.get("high"), `The busy traffic on "${owner}"`) ?? base.high;
    let low =
      this.optionalMultiple(fields.get("low"), `The quiet traffic on "${owner}"`) ?? base.low;
    if (low > high) {
      this.sink.warning(
        this.pos(entry.keyNode),
        `The quiet traffic on "${owner}" (${low}x) is above its busy traffic (${high}x), so they're swapped.`,
      );
      [low, high] = [high, low];
    }
    return {
      traffic: null,
      pattern: { kind, high, low, every: this.readCycle(fields.get("every"), owner) ?? base.every },
    };
  }

  /** `10s`, `10` or `1.5s`: a pattern's cycle, kept long enough to see scaling happen. */
  private readCycle(entry: MapEntry | undefined, owner: string): number | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const value = scalarValue(entry.value);
    const text =
      typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
    const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(text);
    const seconds = match === null ? Number.NaN : Number(match[1]);
    if (!Number.isFinite(seconds)) {
      this.sink.error(
        this.pos(entry.value),
        `The cycle of the traffic on "${owner}" should be in seconds, like 10s.`,
      );
      return null;
    }
    const kept = Math.min(LONGEST_CYCLE, Math.max(SHORTEST_CYCLE, seconds));
    if (kept !== seconds)
      this.sink.warning(
        this.pos(entry.value),
        `The cycle of the traffic on "${owner}" is kept between ${SHORTEST_CYCLE}s and ${LONGEST_CYCLE}s (so scaling has time to show), so it's ${kept}s.`,
      );
    return kept;
  }

  /** Arrowheads, line pattern and width, corners and jumps (ED-29). */
  private readConnectorLook(
    fields: ReadonlyMap<string, MapEntry>,
    name: string,
    direction: Direction,
  ): Pick<
    Connection,
    "arrows" | "hasExplicitArrows" | "arrowSize" | "line" | "dash" | "width" | "corners" | "jumps"
  > {
    const defaults = defaultArrows(direction);
    let arrows = defaults;
    let hasExplicitArrows = false;
    const arrowsEntry = fields.get("arrows");
    if (arrowsEntry !== undefined && !isNullish(arrowsEntry.value)) {
      const head = (node: Node | null, end: "start" | "end"): Arrowhead | null => {
        const value = asString(node);
        if (isArrowhead(value)) return value;
        this.sink.error(
          this.pos(node),
          `"${value ?? ""}" isn't an arrowhead for the ${end} of "${name}".${didYouMean(value ?? "", ARROWHEADS)} Choose one of ${listOptions(ARROWHEADS)}.`,
        );
        return null;
      };
      if (isMap(arrowsEntry.value)) {
        const ends = this.body(name, arrowsEntry.value, ["start", "end"], "arrows");
        const start = ends.get("start");
        const end = ends.get("end");
        arrows = {
          start:
            start === undefined ? defaults.start : (head(start.value, "start") ?? defaults.start),
          end: end === undefined ? defaults.end : (head(end.value, "end") ?? defaults.end),
        };
      } else {
        // `arrows: block` names the end arrowhead.
        arrows = { start: defaults.start, end: head(arrowsEntry.value, "end") ?? defaults.end };
      }
      hasExplicitArrows = true;
    }

    const size = (node: Node | null): number | null => {
      const value = scalarValue(node);
      if (typeof value === "number" && value >= MIN_ARROW_SIZE && value <= MAX_ARROW_SIZE)
        return value;
      this.sink.error(
        this.pos(node),
        `The arrow size of "${name}" should be a number from ${MIN_ARROW_SIZE} to ${MAX_ARROW_SIZE}, like 8.`,
      );
      return null;
    };
    let arrowSize = { start: DEFAULT_ARROW_SIZE, end: DEFAULT_ARROW_SIZE };
    const sizeEntry = fields.get("arrow_size");
    if (sizeEntry !== undefined && !isNullish(sizeEntry.value)) {
      if (isMap(sizeEntry.value)) {
        const ends = this.body(name, sizeEntry.value, ["start", "end"], "arrow size");
        const start = ends.get("start");
        const end = ends.get("end");
        arrowSize = {
          start:
            start === undefined ? DEFAULT_ARROW_SIZE : (size(start.value) ?? DEFAULT_ARROW_SIZE),
          end: end === undefined ? DEFAULT_ARROW_SIZE : (size(end.value) ?? DEFAULT_ARROW_SIZE),
        };
      } else {
        const both = size(sizeEntry.value) ?? DEFAULT_ARROW_SIZE;
        arrowSize = { start: both, end: both };
      }
    }

    let line: LinePattern = "solid";
    let dash: number[] | null = null;
    const lineEntry = fields.get("line");
    if (lineEntry !== undefined && !isNullish(lineEntry.value)) {
      const custom = (values: unknown[]): number[] | null =>
        values.length >= 2 && values.every((v) => typeof v === "number" && v >= 0 && v <= 100)
          ? (values as number[])
          : null;
      const text = asString(lineEntry.value);
      if (isSeq(lineEntry.value)) {
        dash = custom(lineEntry.value.items.map((item) => scalarValue(nodeOf(item))));
      } else if (text !== null && (LINE_PATTERNS as readonly string[]).includes(text)) {
        line = text as LinePattern;
      } else if (text !== null && /^[\d.\s]+$/.test(text)) {
        dash = custom(text.trim().split(/\s+/).map(Number));
      }
      if (dash === null && line === "solid" && text !== "solid") {
        this.sink.error(
          this.pos(lineEntry.value),
          `The line of "${name}" should be one of ${listOptions(LINE_PATTERNS)}, or dash lengths like "8 4".${didYouMean(text ?? "", LINE_PATTERNS)}`,
        );
      }
    }

    let width = DEFAULT_LINE_WIDTH;
    const widthEntry = fields.get("width");
    if (widthEntry !== undefined && !isNullish(widthEntry.value)) {
      const value = scalarValue(widthEntry.value);
      if (typeof value === "number" && value >= MIN_LINE_WIDTH && value <= MAX_LINE_WIDTH)
        width = value;
      else
        this.sink.error(
          this.pos(widthEntry.value),
          `The width of "${name}" should be a number from ${MIN_LINE_WIDTH} to ${MAX_LINE_WIDTH}, like 2.`,
        );
    }

    return {
      arrows,
      hasExplicitArrows,
      arrowSize,
      line,
      dash,
      width,
      corners:
        this.optionalLiteral<CornerStyle>(fields.get("corners"), CORNER_STYLES, name, "corners") ??
        "rounded",
      jumps:
        this.optionalLiteral<JumpStyle>(fields.get("jumps"), JUMP_STYLES, name, "line jumps") ??
        "none",
    };
  }

  private readCard(name: string, entry: MapEntry | undefined): CardRef | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const at = this.pos(entry.value);
    const text = asString(entry.value);
    if (text !== null) {
      if (/^[^\n]+\.md$/i.test(text.trim())) {
        const path = resolveFromFolder(this.folder, text.trim());
        if (path === null) {
          this.sink.error(at, `The card for "${name}" points outside the diagram folder.`);
          return null;
        }
        return { kind: "file", title: null, path };
      }
      return { kind: "inline", title: null, body: text };
    }
    if (isMap(entry.value)) {
      const fields = this.body(name, entry.value, ["title", "body", "file"], "card");
      const title = this.optionalString(fields.get("title"), `The card title of "${name}"`);
      const file = this.optionalString(fields.get("file"), `The card file of "${name}"`);
      if (file !== null) {
        const path = resolveFromFolder(this.folder, file);
        if (path === null) {
          this.sink.error(at, `The card for "${name}" points outside the diagram folder.`);
          return null;
        }
        return { kind: "file", title, path };
      }
      return {
        kind: "inline",
        title,
        body: this.optionalString(fields.get("body"), `The card body of "${name}"`) ?? "",
      };
    }
    this.sink.error(
      at,
      `The card for "${name}" should be text, a path to a .md file, or a title and body.`,
    );
    return null;
  }
}
