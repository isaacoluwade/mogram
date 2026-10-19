import { visit, type Node } from "yaml";
import type {
  CardRef,
  CodeContent,
  ImageContent,
  Deck,
  DeckEntry,
  Component,
  Part,
  ContainerLayout,
  Meter,
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
import { basename, resolveFromFolder } from "../model/paths";
import { lineRange, listingOf, type LineRange } from "../code/listing";
import {
  CODE_LANGUAGES,
  CODE_FONT_SIZES,
  CODE_LANGUAGE_ALIASES,
  isCodeLanguage,
  languageForFile,
} from "../presets/code";
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
import { DiagnosticSink, type Position } from "./diagnostics";
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
import { PAGES, isPage } from "../presets/pages";
import { parsePaint } from "../presets/paint";
import { SectionReader } from "./read-base";
import { FormulaError, isFormula, parseFormula, readsModel } from "../values/formula";
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
import { STYLE_KEYS, STYLE_SOURCES, type NamedStyles, type StyleTarget } from "./styles";
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
  RawControl,
  RawScene,
  RawStory,
  RawTour,
  StepPositions,
  FileContribution,
} from "./raw";

/** The most slides a deck holds. */
const MAX_SLIDES = 400;

const SETTINGS_KEYS = [
  "mogram",
  "name",
  "description",
  "concept",
  "deck",
  "theme",
  "page",
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
  "stories",
  "controls",
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
  "show",
  "mark",
  "on",
  "along",
  "cell",
  "like",
  ...CAPACITY_KEYS,
];
/** The most parts an element can have (D-104). */
const MAX_PARTS = 64;

/** What only an image takes, and what only code takes. */
const IMAGE_KEYS: readonly string[] = ["src", "fit"];
const CODE_KEYS: readonly string[] = ["text", "file", "lines", "language", "title", "numbers"];

/** Keys every other shape ignores: the content of images and code, and their parts. */
const MEDIA_KEYS = new Set([...IMAGE_KEYS, ...CODE_KEYS, "parts"]);

/** Keys an image ignores (D-102): it has no tone, fill, typography, state or motion. */
const NOT_FOR_IMAGES = new Set([
  ...CODE_KEYS,
  "tone",
  "fill",
  "font",
  "font_size",
  "bold",
  "italic",
  "align",
  "text_color",
  "state",
  "motion",
  "intensity",
  "speed",
  "lid",
  "slant",
  "wave",
  "value",
  "max",
  "limit",
  "as",
  "unit",
]);

/** Keys code ignores (D-103): it has no label, tone, state or motion, and its font is mono. */
const NOT_FOR_CODE = new Set([
  ...IMAGE_KEYS,
  "label",
  "tone",
  "font",
  "bold",
  "italic",
  "align",
  "text_color",
  "state",
  "motion",
  "intensity",
  "speed",
  "lid",
  "slant",
  "wave",
  "value",
  "max",
  "limit",
  "as",
  "unit",
]);

export const SHAPE_KEYS = [
  "shape",
  "src",
  "fit",
  "text",
  "file",
  "lines",
  "language",
  "title",
  "numbers",
  "parts",
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
  "show",
  "mark",
  "on",
  "along",
  "cell",
  "like",
  "value",
  "max",
  "limit",
  "as",
  "unit",
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
  "show",
  "mark",
  "layout",
  "gap",
  "columns",
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
  "show",
];

/** What a copy (`like:`) takes from the element it copies: what it is and how it looks. */
const LIKE_KEYS: readonly string[] = [
  "type",
  "shape",
  "style",
  "label",
  "color",
  "icon",
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
  "data",
  "like",
  // What an image or a listing shows, and its parts (D-102 to D-104).
  "src",
  "fit",
  "text",
  "file",
  "lines",
  "language",
  "title",
  "numbers",
  "parts",
];

export const CONTAINER_LAYOUTS = ["row", "column", "grid"] as const;
/** Space between the children of a container with a layout, in grid units, when not written. */
export const DEFAULT_LAYOUT_GAP = 2;
/** The furthest cell of a grid. */
export const MAX_CELL = 63;

type LikeSection = "components" | "shapes" | "containers";

interface LikeSource {
  readonly section: LikeSection;
  readonly entries: ReadonlyMap<string, MapEntry>;
}

/** Every component, shape and container as written, by name, for `like:` to copy from. */
export type Likes = ReadonlyMap<string, LikeSource>;

/**
 * Reads every file's elements as written, before any is turned into a model, so one can be a
 * copy of another in any file (as named styles are read first).
 */
export function readLikes(files: readonly ParsedFile[]): Likes {
  const likes = new Map<string, LikeSource>();
  // What's wrong with a key is said when its file is read; here they're only collected.
  const quiet = new DiagnosticSink();
  for (const file of files) {
    const root = file.doc.contents;
    if (file.broken || !isMap(root)) continue;
    for (const section of mapEntries(file, root, quiet)) {
      if (section.key !== "components" && section.key !== "shapes" && section.key !== "containers")
        continue;
      if (!isMap(section.value)) continue;
      for (const element of mapEntries(file, section.value, quiet)) {
        if (likes.has(element.key)) continue;
        const entries = new Map<string, MapEntry>();
        if (isMap(element.value)) {
          for (const entry of mapEntries(file, element.value, quiet)) {
            // Read with each copy, perhaps from another file: its problems are reported
            // where it's written, once.
            if (entry.value !== null)
              visit(entry.value, (_, node) => {
                if (node !== null && typeof node === "object" && "range" in node)
                  STYLE_SOURCES.set(node as Node, file);
              });
            entries.set(entry.key, entry);
          }
        } else if (isScalar(element.value) && typeof element.value.value === "string") {
          // `web: generic/service` and `tank: cylinder` are short for a type or a shape.
          STYLE_SOURCES.set(element.value, file);
          entries.set(section.key === "shapes" ? "shape" : "type", {
            key: section.key === "shapes" ? "shape" : "type",
            keyNode: element.keyNode,
            value: element.value,
          });
        }
        likes.set(element.key, { section: section.key, entries });
      }
    }
  }
  return likes;
}

export const CURRENT_FORMAT_VERSION = 1;
export const DEFAULT_COMPONENT_TYPE = "generic/service";

/** Reads one Mogram file into raw records. Cross-file checks happen in `parse.ts`. */
export function readFile(
  file: ParsedFile,
  folder: string,
  sink: DiagnosticSink,
  styles: NamedStyles = new Map(),
  likes: Likes = new Map(),
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
    stories: [],
    controls: [],
    tours: [],
    hasLayoutKey: false,
  };
  const root = file.doc.contents;
  if (file.broken || root === null || !isMap(root)) return out;

  const reader = new ElementReader(file, folder, sink, styles, likes);
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
      case "stories":
        story.readStories(entry, out.stories);
        break;
      case "controls":
        story.readControls(entry, out.controls);
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
    deck: null,
    theme: null,
    page: null,
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
    private readonly likes: Likes,
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
      case "deck":
        settings.deck = this.readDeck(entry);
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
      case "page": {
        // `16:9` is a plain string in YAML 1.2; a number (`1`) or anything else isn't a page.
        const page = asString(entry.value);
        if (isPage(page)) settings.page = page;
        else if (page !== "none")
          this.sink.error(at, `"page" should be ${PAGES.join(", ")} or none.`);
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

  /**
   * `deck:` (D-99): the slides, in order, with sections between them. What needs another folder
   * (does it hold a diagram, has its story that step) is checked by `checkDeck`, which can look.
   */
  private readDeck(entry: MapEntry): Deck | null {
    const at = this.pos(entry.keyNode);
    if (!isMap(entry.value)) {
      this.sink.error(
        this.pos(entry.value ?? entry.keyNode),
        `"deck" should have its slides listed below it, like "slides: [title, the_flow]".`,
      );
      return null;
    }
    const fields = this.body("deck", entry.value, ["frame", "captions", "slides"], "deck");
    const here = this.folder;
    const folderOf = (written: string): string | null =>
      resolveFromFolder(here, written.trim().replace(/\/+$/, ""));

    let frame: string | null = null;
    const frameEntry = fields.get("frame");
    const frameWord = this.optionalString(frameEntry, `The deck's frame`);
    if (frameWord !== null && frameWord.trim() !== "" && frameWord !== "none") {
      frame = folderOf(frameWord);
      if (frame === null)
        this.sink.error(
          this.pos(frameEntry?.value),
          `"frame" is "${frameWord}", which is outside the project.`,
        );
    }

    let captions = true;
    const captionsEntry = fields.get("captions");
    if (captionsEntry !== undefined && !isNullish(captionsEntry.value)) {
      const word = asString(captionsEntry.value)?.trim().toLowerCase();
      if (word === "on" || word === "true") captions = true;
      else if (word === "off" || word === "false") captions = false;
      else this.sink.error(this.pos(captionsEntry.value), `"captions" should be on or off.`);
    }

    const entries: DeckEntry[] = [];
    const slidesEntry = fields.get("slides");
    if (slidesEntry !== undefined && !isNullish(slidesEntry.value)) {
      if (!isSeq(slidesEntry.value)) {
        this.sink.error(
          this.pos(slidesEntry.value),
          `A deck's slides should be a list, each a folder that holds a diagram.`,
        );
      } else {
        let number = 0;
        for (const [item, raw] of slidesEntry.value.items.entries()) {
          const node = nodeOf(raw);
          const where = this.pos(node);
          const source = { file: where.file, line: where.line };
          const plain = asString(node);
          let written: string | null = plain;
          let body: Node | null = null;
          if (plain === null && isMap(node)) {
            const pairs = this.entries(node);
            const first = pairs[0];
            if (pairs.length === 1 && first !== undefined) {
              if (first.key === "section") {
                const title = asString(first.value)?.trim() ?? "";
                if (title === "") this.sink.error(where, `A section needs a title.`);
                else entries.push({ kind: "section", item, title, source });
                continue;
              }
              written = first.key;
              body = first.value;
            }
          }
          if (written === null || written.trim() === "") {
            this.sink.error(
              where,
              `An entry in a deck's slides should be a folder, like "- title", or "- section: Getting started".`,
            );
            continue;
          }
          number++;
          if (number > MAX_SLIDES) {
            this.sink.error(
              where,
              `A deck holds up to ${MAX_SLIDES} slides; the rest are left out.`,
            );
            break;
          }
          const folder = folderOf(written);
          if (folder === null) {
            this.sink.error(
              where,
              `Slide ${number} is "${written}", which is outside the project.`,
            );
            continue;
          }
          const keys = isNullish(body)
            ? new Map<string, MapEntry>()
            : this.body(
                written,
                body,
                ["story", "from", "to", "scene", "title", "frame", "skip"],
                "slide",
              );
          const word = (key: string) =>
            this.optionalString(keys.get(key), `The ${key} of slide ${number}`)?.trim() ?? null;
          entries.push({
            kind: "slide",
            item,
            folder,
            story: word("story"),
            from: word("from"),
            to: word("to"),
            scene: word("scene"),
            title: word("title"),
            frame: this.optionalBoolean(keys.get("frame"), `slide ${number}`, "frame") ?? true,
            skip: this.optionalBoolean(keys.get("skip"), `slide ${number}`, "skip") ?? false,
            source,
          });
        }
      }
    }
    return { frame, captions, entries, source: { file: at.file, line: at.line } };
  }

  // ---------------------------------------------------------------------------------------------
  // Copies and layouts (D-87)

  /**
   * `like: other` (D-87): the element is written as a copy of another of its kind. The other's
   * type or shape, look, label and data lie under this one's own keys; where it is, what it's
   * connected to and what happens to it are its own.
   */
  private withLike(
    name: string,
    fields: Map<string, MapEntry>,
    section: LikeSection,
  ): { fields: Map<string, MapEntry>; like: string | null } {
    const entry = fields.get("like");
    if (entry === undefined || isNullish(entry.value)) return { fields, like: null };
    const other = asString(entry.value);
    const source = other === null ? undefined : this.likes.get(other);
    if (other === null || other === name || source === undefined || source.section !== section) {
      const known = [...this.likes].filter(([, s]) => s.section === section).map(([n]) => n);
      this.sink.error(
        this.pos(entry.value),
        other === name
          ? `"${name}" can't be a copy of itself.`
          : source !== undefined
            ? `"${name}" is like "${other ?? ""}", but one is under ${section}: and the other under ${source.section}:. A copy is the same kind of thing.`
            : `"${name}" is like "${other ?? ""}", but there is no such element under ${section}:.${didYouMean(other ?? "", known)}`,
      );
      return { fields, like: null };
    }
    const merged = new Map(fields);
    const seen = new Set([name]);
    for (let from: string | null = other, depth = 0; from !== null && depth < 16; depth++) {
      if (seen.has(from)) break;
      seen.add(from);
      const copy: LikeSource | undefined = this.likes.get(from);
      if (copy === undefined || copy.section !== section) break;
      for (const [key, value] of copy.entries)
        if (LIKE_KEYS.includes(key) && !merged.has(key)) merged.set(key, value);
      // A copy of a copy takes what that one took.
      const next: MapEntry | undefined = copy.entries.get("like");
      from = next === undefined ? null : asString(next.value);
    }
    return { fields: merged, like: other };
  }

  /**
   * A meter's keys (D-88): `value` and `max` are numbers, names of values or formulas; `as` is
   * how it's drawn; `limit` where it warns; `unit` what follows the number.
   */
  private readMeter(fields: ReadonlyMap<string, MapEntry>, name: string): Meter {
    const formula = (key: "value" | "max", fallback: string): string => {
      const entry = fields.get(key);
      if (entry === undefined || isNullish(entry.value)) return fallback;
      const raw = scalarValue(entry.value);
      const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
      try {
        parseFormula(text);
        return text.trim().replace(/^=/, "").trim();
      } catch (error) {
        this.sink.error(
          this.pos(entry.value),
          `The ${key} of "${name}" should be a number, the name of a value, or a formula like "= used / total * 100". ${error instanceof FormulaError ? error.message : ""}`.trim(),
        );
        return fallback;
      }
    };
    const limitEntry = fields.get("limit");
    const limit = limitEntry === undefined ? null : scalarValue(limitEntry.value);
    if (limitEntry !== undefined && typeof limit !== "number")
      this.sink.error(
        this.pos(limitEntry.value),
        `The limit of "${name}" should be a number: the value it turns red at.`,
      );
    return {
      value: formula("value", "0"),
      max: formula("max", "100"),
      as:
        this.optionalLiteral<Meter["as"]>(
          fields.get("as"),
          ["bar", "ring", "number"],
          name,
          "meter",
        ) ?? "bar",
      limit: typeof limit === "number" ? limit : null,
      unit: this.optionalString(fields.get("unit"), `The unit of "${name}"`) ?? "",
    };
  }

  /** `along: 30%` or `0.3`: how far along the connection something rides on. */
  private readAlong(entry: MapEntry | undefined, owner: string): number | null {
    return this.optionalPercent(entry, `How far along "${owner}" sits`);
  }

  /** `cell: [column, row]`, counted from 0. */
  private readCell(entry: MapEntry | undefined, owner: string): { x: number; y: number } | null {
    if (entry === undefined || isNullish(entry.value)) return null;
    const cell = this.readPair(entry.value, owner, "cell");
    if (cell === null) return null;
    if (cell[0] < 0 || cell[1] < 0 || cell[0] > MAX_CELL || cell[1] > MAX_CELL) {
      this.sink.error(
        this.pos(entry.value),
        `The cell of "${owner}" is [column, row], each from 0 to ${MAX_CELL}.`,
      );
      return null;
    }
    return { x: cell[0], y: cell[1] };
  }

  /** `layout: row | column | grid`, with `gap` (grid units, or `none`) and a grid's `columns`. */
  private readContainerLayout(
    fields: ReadonlyMap<string, MapEntry>,
    name: string,
  ): ContainerLayout | null {
    const kind = this.optionalLiteral<ContainerLayout["kind"]>(
      fields.get("layout"),
      CONTAINER_LAYOUTS,
      name,
      "layout",
    );
    const gapEntry = fields.get("gap");
    const columnsEntry = fields.get("columns");
    if (kind === null) {
      for (const entry of [gapEntry, columnsEntry])
        if (entry !== undefined)
          this.sink.warning(
            this.pos(entry.keyNode),
            `"${entry.key}" is for a container with a layout (row, column or grid), so it is ignored on "${name}".`,
          );
      return null;
    }
    let gap = DEFAULT_LAYOUT_GAP;
    if (gapEntry !== undefined && !isNullish(gapEntry.value)) {
      const value = scalarValue(gapEntry.value);
      if (value === "none") gap = 0;
      else if (typeof value === "number" && value >= 0 && value <= 20) gap = value;
      else
        this.sink.error(
          this.pos(gapEntry.value),
          `The gap of "${name}" should be a number of grid units from 0 to 20, or "none".`,
        );
    }
    let columns: number | null = null;
    if (columnsEntry !== undefined && !isNullish(columnsEntry.value)) {
      const value = scalarValue(columnsEntry.value);
      if (kind !== "grid")
        this.sink.warning(
          this.pos(columnsEntry.keyNode),
          `"columns" is for a grid, so it is ignored on "${name}".`,
        );
      else if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 24)
        columns = value;
      else
        this.sink.error(
          this.pos(columnsEntry.value),
          `The columns of "${name}" should be a whole number from 1 to 24.`,
        );
    }
    return { kind, gap, columns };
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
    const copied = this.withLike(
      name,
      shorthandType === null
        ? this.body(name, node, COMPONENT_KEYS, "component")
        : new Map<string, MapEntry>(),
      "components",
    );
    const styled = this.withStyle(name, copied.fields, "component");
    const fields = styled.fields;
    const type =
      shorthandType ??
      this.optionalString(fields.get("type"), `The type of "${name}"`) ??
      DEFAULT_COMPONENT_TYPE;
    return this.componentFrom(name, fields, at, type, null, null, styled.style, copied.like);
  }

  /**
   * A shape (03-shapes-styles-library §5 P0-1): a component drawn as an outline. `name: cylinder`
   * is short for `{ shape: cylinder }`; without `shape:` it's a rectangle.
   */
  readShape(name: string, node: Node | null, at: Position): RawComponent {
    const shorthand = isScalar(node) && typeof node.value === "string" ? node.value : null;
    const copied = this.withLike(
      name,
      shorthand === null ? this.body(name, node, SHAPE_KEYS, "shape") : new Map<string, MapEntry>(),
      "shapes",
    );
    const styled = this.withStyle(name, copied.fields, "shape");
    const fields = new Map(styled.fields);
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
    this.dropKeysNotFor(shape, name, fields);
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
    const look: Mutable<ShapeLook> = {
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
    // Code's text is a listing's: large enough to read on a slide, small enough to fit one.
    const size = look.text.fontSize;
    if (
      shape === "code" &&
      size !== null &&
      (size < CODE_FONT_SIZES.min || size > CODE_FONT_SIZES.max)
    ) {
      this.sink.warning(
        this.pos(fields.get("font_size")?.value),
        `The font size of "${name}" should be from ${CODE_FONT_SIZES.min} to ${CODE_FONT_SIZES.max} for code.`,
      );
      look.text = {
        ...look.text,
        fontSize: Math.min(CODE_FONT_SIZES.max, Math.max(CODE_FONT_SIZES.min, size)),
      };
    }
    return this.componentFrom(
      name,
      fields,
      at,
      `shape/${shape}`,
      shape,
      look,
      styled.style,
      copied.like,
    );
  }

  private componentFrom(
    name: string,
    fields: ReadonlyMap<string, MapEntry>,
    at: Position,
    type: string,
    shape: ShapeId | null,
    look: ShapeLook | null,
    style: string | null,
    liked: string | null,
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
    const parts = this.readParts(fields.get("parts"), shape, name);
    if (parts.size > 0 && opensPath !== null)
      this.sink.error(
        this.pos(opens?.value),
        `"${name}" has parts, so it can't also open a nested diagram.`,
      );
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
      opens: parts.size > 0 ? null : opensPath,
      shape,
      look,
      image: shape === "image" ? this.readImage(fields, name, at) : null,
      style,
      code: shape === "code" ? this.readCode(fields, name, at) : null,
      parts,
      show: this.readShow(fields.get("show"), name),
      mark: this.readMark(fields.get("mark"), name),
      on: this.optionalString(fields.get("on"), `What "${name}" rides on`),
      along: this.readAlong(fields.get("along"), name),
      cell: this.readCell(fields.get("cell"), name),
      like: liked,
      meter: shape === "meter" ? this.readMeter(fields, name) : null,
      ...this.readFlowBehaviour(fields, name, shape),
    };
    const onEntry = fields.get("on");
    return {
      model,
      at,
      parentRef: this.optionalRef(fields.get("in")),
      opensAt: opens === undefined ? null : this.pos(opens.value),
      onAt: onEntry === undefined ? null : this.pos(onEntry.value),
    };
  }

  /**
   * Keys that mean nothing for this kind of shape (D-102, D-103): an image has no tone or
   * typography, code has no label or state, and only images and code have their content keys.
   * Each is dropped with a warning that says so.
   */
  private dropKeysNotFor(shape: ShapeId, name: string, fields: Map<string, MapEntry>): void {
    const notFor =
      shape === "image" ? NOT_FOR_IMAGES : shape === "code" ? NOT_FOR_CODE : MEDIA_KEYS;
    for (const key of [...fields.keys()]) {
      if (!notFor.has(key)) continue;
      const entry = fields.get(key);
      fields.delete(key);
      if (entry === undefined) continue;
      const what = shape === "image" ? "an image" : shape === "code" ? "code" : `a ${shape}`;
      this.sink.warning(
        this.pos(entry.keyNode),
        IMAGE_KEYS.includes(key) && shape !== "image"
          ? `"${key}" only applies to an image, so it is ignored on "${name}".`
          : CODE_KEYS.includes(key) && shape !== "code"
            ? `"${key}" only applies to code, so it is ignored on "${name}".`
            : `"${key}" doesn't apply to ${what}, so it is ignored on "${name}".`,
      );
    }
  }

  /**
   * `src:` and `fit:` (D-102). Whether `src` names a picture in the project is checked once the
   * whole project is known (`parseDiagram`), since this reader sees one file.
   */
  private readImage(
    fields: ReadonlyMap<string, MapEntry>,
    name: string,
    at: Position,
  ): ImageContent {
    const src = this.optionalString(fields.get("src"), `The picture "${name}" shows`)?.trim() ?? "";
    if (src === "")
      this.sink.error(at, `"${name}" is an image, so it needs "src", like src: images/portal.png.`);
    const fitEntry = fields.get("fit");
    let fit: ImageContent["fit"] = "contain";
    if (fitEntry !== undefined && !isNullish(fitEntry.value)) {
      const word = asString(fitEntry.value);
      if (word === "contain" || word === "cover") fit = word;
      else this.sink.error(this.pos(fitEntry.value), `"fit" should be contain or cover.`);
    }
    return { src, path: null, fit, natural: null };
  }

  /**
   * `text:` or `file:`, `lines:`, `language:`, `title:` and `numbers:` (D-103). A file's lines
   * are read once the whole project is known (`parseDiagram`); written text is read here.
   */
  private readCode(fields: ReadonlyMap<string, MapEntry>, name: string, at: Position): CodeContent {
    const text = this.optionalString(fields.get("text"), `The text of "${name}"`);
    const file =
      this.optionalString(fields.get("file"), `The file "${name}" shows`)?.trim() ?? null;
    if (text === null && file === null)
      this.sink.error(
        at,
        `"${name}" is code, so it needs "text" or "file", like file: code/main.tf.`,
      );
    if (text !== null && file !== null)
      this.sink.error(at, `"${name}" has both "text" and "file". Use one.`);
    if (file !== null && resolveFromFolder(this.folder, file) === null)
      this.sink.error(
        this.pos(fields.get("file")?.value),
        `"${name}" shows "${file}", which is outside the project.`,
      );

    const sliceEntry = fields.get("lines");
    let slice: LineRange | null = null;
    if (sliceEntry !== undefined && !isNullish(sliceEntry.value)) {
      slice = lineRange(scalarValue(sliceEntry.value));
      if (slice === null)
        this.sink.error(
          this.pos(sliceEntry.value),
          `"lines" should be a line or a range, like 12 or 12-31.`,
        );
    }

    const languageEntry = fields.get("language");
    let language = languageForFile(text === null ? file : null);
    if (languageEntry !== undefined && !isNullish(languageEntry.value)) {
      const word = asString(languageEntry.value)?.trim().toLowerCase() ?? "";
      if (isCodeLanguage(word)) language = word;
      else {
        const alias = CODE_LANGUAGE_ALIASES[word];
        language = "plain";
        this.sink.warning(
          this.pos(languageEntry.value),
          `"language" is "${word}", which isn't one Mogram colours, so it is shown plain.${
            alias === undefined ? didYouMean(word, CODE_LANGUAGES) : ` Did you mean "${alias}"?`
          }`,
        );
      }
    }

    // A file's name is its header unless the title says otherwise; `none` is no header.
    const titleWord = this.optionalString(fields.get("title"), `The title of "${name}"`);
    const title =
      titleWord === null
        ? file === null || text !== null
          ? null
          : basename(file)
        : titleWord.trim() === "none" || titleWord.trim() === ""
          ? null
          : titleWord;

    return {
      text,
      file: text === null ? file : null,
      path: null,
      slice,
      language,
      title,
      numbers: this.optionalBoolean(fields.get("numbers"), name, "numbers") ?? false,
      listing: listingOf(text, language, slice),
    };
  }

  /**
   * `parts:` (D-104): named lines of a listing (`name: 2`, `required: 2-6`) or regions of a
   * picture (`field: [x, y, w, h]`), each with how it starts.
   */
  private readParts(
    entry: MapEntry | undefined,
    shape: ShapeId | null,
    owner: string,
  ): ReadonlyMap<string, Part> {
    const parts = new Map<string, Part>();
    if (entry === undefined || isNullish(entry.value)) return parts;
    if (shape !== "image" && shape !== "code") {
      this.sink.error(
        this.pos(entry.keyNode),
        `"${owner}" can't have parts: only images and code do.`,
      );
      return parts;
    }
    if (!isMap(entry.value)) {
      this.sink.error(
        this.pos(entry.value),
        shape === "code"
          ? `The parts of "${owner}" should be named lines, like "name: 2" or "required: 2-6".`
          : `The parts of "${owner}" should be named regions, like "name_field: [0.36, 0.42, 0.5, 0.08]".`,
      );
      return parts;
    }
    const where = shape === "code" ? "lines" : "area";
    for (const item of this.entries(entry.value)) {
      const at = this.pos(item.keyNode);
      if (parts.size >= MAX_PARTS) {
        this.sink.error(at, `"${owner}" can have up to ${MAX_PARTS} parts; the rest are left out.`);
        break;
      }
      if (!isValidName(item.key)) {
        this.sink.error(
          at,
          `"${item.key}" isn't a valid part name. Use letters, numbers and "_", starting with a letter.`,
        );
        continue;
      }
      const target = `${owner}.${item.key}`;
      const long = isMap(item.value);
      const fields = long
        ? this.body(target, item.value, [where, "show", "tone", "mark"], "part")
        : new Map<string, MapEntry>();
      const value = long ? (fields.get(where)?.value ?? null) : item.value;
      const look = {
        name: item.key,
        show: this.readShow(fields.get("show"), target),
        tone: this.optionalLiteral<Tone>(fields.get("tone"), TONE_NAMES, target, "tone"),
        mark: this.readMark(fields.get("mark"), target),
        source: { file: at.file, line: at.line },
      };
      if (shape === "code") {
        const lines = lineRange(scalarValue(value));
        if (lines === null) {
          this.sink.error(
            this.pos(value ?? item.keyNode),
            `Part "${item.key}" of "${owner}" should be a line or a range, like 12 or 12-31.`,
          );
          continue;
        }
        parts.set(item.key, { ...look, kind: "lines", first: lines[0], last: lines[1] });
        continue;
      }
      const area = this.readArea(value);
      if (area === null) {
        this.sink.error(
          this.pos(value ?? item.keyNode),
          `Part "${item.key}" of "${owner}" should be four numbers from 0 to 1: x, y, width, height.`,
        );
        continue;
      }
      parts.set(item.key, { ...look, kind: "area", ...area });
    }
    return parts;
  }

  /** `[x, y, w, h]`, each a share of the picture, inside it. Null when it isn't one. */
  private readArea(
    node: Node | null,
  ): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null {
    if (!isSeq(node) || node.items.length !== 4) return null;
    const [x, y, w, h] = node.items.map((item) => scalarValue(nodeOf(item)));
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (typeof w !== "number" || typeof h !== "number") return null;
    // A region drawn to the picture's edge can come out a hair over 1: allow for it.
    const near = 1e-6;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 + near || y + h > 1 + near) return null;
    return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
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
      show: this.readShow(fields.get("show"), name),
      mark: this.readMark(fields.get("mark"), name),
      layout: this.readContainerLayout(fields, name),
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
    // `traffic: "= rps"` (D-88): worked out for each picture, so a dial can drive the model.
    const trafficEntry = fields.get("traffic");
    const trafficText = trafficEntry === undefined ? null : asString(trafficEntry.value);
    let trafficFormula: string | null = null;
    if (isFormula(trafficText)) {
      try {
        const parsed = parseFormula(trafficText);
        if (readsModel(parsed))
          this.sink.error(
            this.pos(trafficEntry?.value),
            `The traffic on "${name}" feeds the model, so its formula can't read the model back (load, copies, traffic or count).`,
          );
        else trafficFormula = trafficText.trim().replace(/^=/, "").trim();
      } catch (error) {
        this.sink.error(
          this.pos(trafficEntry?.value),
          `The traffic on "${name}" isn't a formula Mogram can read. ${error instanceof FormulaError ? error.message : ""}`.trim(),
        );
      }
    }
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
      ...this.readTraffic(isFormula(trafficText) ? undefined : fields.get("traffic"), name),
      share: this.optionalPercent(fields.get("share"), `The share of "${name}"`),
      show: this.readShow(fields.get("show"), name),
      trafficFormula,
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
