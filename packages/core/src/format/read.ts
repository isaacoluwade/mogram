import type { Node } from "yaml";
import type {
  CardRef,
  Component,
  Connection,
  Container,
  Density,
  Direction,
  Group,
  Intensity,
  Rollup,
  RouteStyle,
  Speed,
} from "../model/types";
import { humanize, isValidName } from "../model/names";
import { resolveFromFolder } from "../model/paths";
import {
  CANVAS_THEMES,
  CONTAINER_STYLES,
  FLOW_PRESETS,
  MOTION_PRESETS,
  STATE_PRESETS,
  isCanvasTheme,
  isContainerStyle,
  isFlowPreset,
  isMotionPreset,
  isStatePreset,
} from "../presets/names";
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
  "theme",
  "background",
  "grid",
  "libraries",
  "ports",
] as const;
const SECTION_KEYS = [
  "containers",
  "components",
  "groups",
  "connections",
  "scenes",
  "tours",
  "layout",
] as const;
const COMPONENT_KEYS = [
  "type",
  "label",
  "in",
  "state",
  "motion",
  "intensity",
  "speed",
  "color",
  "card",
  "opens",
];
const CONTAINER_KEYS = ["type", "label", "in", "state", "rollup", "color", "card", "icon"];
const GROUP_KEYS = ["label", "members"];
const CONNECTION_KEYS = [
  "from",
  "to",
  "flow",
  "label",
  "direction",
  "speed",
  "density",
  "route",
  "color",
  "backup_for",
  "card",
];

export const CURRENT_FORMAT_VERSION = 1;
export const DEFAULT_COMPONENT_TYPE = "generic/service";

/** Reads one Mogram file into raw records. Cross-file checks happen in `parse.ts`. */
export function readFile(file: ParsedFile, folder: string, sink: DiagnosticSink): FileContribution {
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

  const reader = new ElementReader(file, folder, sink);
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
    theme: null,
    background: null,
    grid: null,
    libraries: null,
    ports: new Map(),
  };
}

/** Settings and the element sections: components, containers, groups, connections. */
class ElementReader extends SectionReader {
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
      default:
        return;
    }
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
    const fields =
      shorthandType === null
        ? this.body(name, node, COMPONENT_KEYS, "component")
        : new Map<string, MapEntry>();
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
      type:
        shorthandType ??
        this.optionalString(fields.get("type"), `The type of "${name}"`) ??
        DEFAULT_COMPONENT_TYPE,
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
    };
    return {
      model,
      at,
      parentRef: this.optionalRef(fields.get("in")),
      opensAt: opens === undefined ? null : this.pos(opens.value),
    };
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
    const fields = this.body(name, node, CONTAINER_KEYS, "container");
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
      name,
      label: label ?? humanize(name),
      hasExplicitLabel: label !== null,
      source: { file: at.file, line: at.line },
      type:
        this.optionalEnum(
          fields.get("type"),
          CONTAINER_STYLES,
          isContainerStyle,
          name,
          "container type",
        ) ?? "box",
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
      members: memberRefs.map((ref) => ref.value),
    };
    return { model, at, memberRefs };
  }

  readConnection(name: string, node: Node | null, at: Position): RawConnection | null {
    const fields = this.body(name, node, CONNECTION_KEYS, "connection");
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
    const model: Mutable<Connection> = {
      kind: "connection",
      name,
      label: text ?? humanize(name),
      hasExplicitLabel: text !== null,
      source: { file: at.file, line: at.line },
      from: parseEndpoint(fromValue),
      to: parseEndpoint(toValue),
      flow: flow ?? "idle",
      hasExplicitFlow: flow !== null,
      direction:
        this.optionalLiteral<Direction>(
          fields.get("direction"),
          ["forward", "reverse", "both"],
          name,
          "direction",
        ) ?? "forward",
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
      text,
      backupFor: backup === undefined ? null : asString(backup.value),
      card: this.readCard(name, fields.get("card")),
    };
    return {
      model,
      at,
      fromAt: this.pos(from?.value),
      toAt: this.pos(to?.value),
      backupAt: backup === undefined ? null : this.pos(backup.value),
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
