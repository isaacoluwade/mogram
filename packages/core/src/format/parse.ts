import type {
  Concept,
  ConceptRole,
  Control,
  Deck,
  Diagnostic,
  Diagram,
  DiagramSettings,
  LayoutEntry,
  Place,
  ProjectFiles,
  Scene,
  SceneEntry,
  Story,
  StoryStep,
  Tour,
} from "../model/types";
import { displayNameForPath } from "../model/paths";
import { DiagnosticSink, sortDiagnostics, type Position } from "./diagnostics";
import { diagramFileSet, layoutFileFor } from "./project";
import {
  readFile,
  readLikes,
  type FileContribution,
  type RawComponent,
  type RawConnection,
  type RawContainer,
  type RawControl,
  type RawDecoration,
  type RawGroup,
  type RawScene,
  type RawStory,
  type RawTour,
  type Ref,
} from "./read";
import { didYouMean } from "./suggest";
import { readStyles, type NamedStyle, type NamedStyles } from "./styles";
import { parseYamlFile } from "./yaml-read";
import { resolveMedia } from "./media";

export interface ParseResult {
  readonly diagram: Diagram;
  readonly diagnostics: readonly Diagnostic[];
  /** Files whose YAML couldn't be read at all (they contribute nothing to `diagram`). */
  readonly brokenFiles: readonly string[];
}

type NamedKind = "component" | "container" | "group" | "connection" | "decoration";

const KIND_NOUN: Readonly<Record<NamedKind, string>> = {
  component: "component",
  container: "container",
  group: "group",
  connection: "connection",
  decoration: "decoration",
};

/**
 * Parses the diagram in `folder` (`""` = project root) from every Mogram file in that folder.
 * Never throws for bad input: problems become diagnostics and the rest still renders (FI-16).
 */
export function parseDiagram(files: ProjectFiles, folder = ""): ParseResult {
  const sink = new DiagnosticSink();
  const set = diagramFileSet(files, folder);
  if (set === null) {
    sink.add(
      "error",
      folder.length > 0 ? `${folder}/mogram.yaml` : "mogram.yaml",
      1,
      1,
      "There is no Mogram file here yet.",
    );
    return { diagram: emptyDiagram(folder), diagnostics: sink.items, brokenFiles: [] };
  }

  const brokenFiles: string[] = [];
  const parsedFiles = set.files.map((path) => {
    const parsed = parseYamlFile(path, files[path] ?? "", sink);
    if (parsed.broken) brokenFiles.push(path);
    return parsed;
  });
  // Named styles first, so an element in any file can take a style from any other. A slide
  // takes its deck's too (D-99), its own winning.
  const styles: NamedStyles = new Map([
    ...deckStyles(files, folder),
    ...readStyles(parsedFiles, sink),
  ]);
  // And every element as written, so one can be a copy of another in any file.
  const likes = readLikes(parsedFiles);
  const contributions: FileContribution[] = parsedFiles.map((parsed) =>
    readFile(parsed, folder, sink, styles, likes),
  );

  const merged = new Merger(sink);
  for (const contribution of contributions)
    merged.add(contribution, contribution.file === set.settingsFile);
  const diagram = merged.build({
    folder,
    styles: new Map(
      [...styles.values()].map((style) => [
        style.name,
        {
          name: style.name,
          source: { file: style.at.file, line: style.at.line },
          keys: [...style.entries.keys()],
        },
      ]),
    ),
    mode: set.mode,
    files: set.files,
    settingsFile: set.settingsFile,
    layoutFile: layoutFileFor(
      set,
      contributions.filter((c) => c.hasLayoutKey).map((c) => c.file),
    ),
    defaultName: displayNameForPath(
      folder.length > 0
        ? folder
        : set.settingsFile === "mogram.yaml"
          ? "Untitled diagram"
          : set.settingsFile,
    ),
  });
  return {
    diagram: inDeck(files, folder, resolveMedia(files, diagram, sink)),
    diagnostics: sortDiagnostics(sink.items),
    brokenFiles,
  };
}

/** A line that makes a folder's settings file a deck's, found without parsing. */
const DECK_LINE = /^deck\s*:/m;

/**
 * The named styles of the deck a folder sits in: the nearest folder above it whose files have a
 * `deck:` section. Their problems are reported when the deck itself is read, not here.
 */
function deckStyles(files: ProjectFiles, folder: string): NamedStyles {
  const deck = deckAbove(files, folder);
  const set = deck === null ? null : diagramFileSet(files, deck);
  if (set === null) return new Map<string, NamedStyle>();
  const quiet = new DiagnosticSink();
  return readStyles(
    set.files.map((path) => parseYamlFile(path, files[path] ?? "", quiet)),
    quiet,
  );
}

/** The folder of the deck a folder sits in, or null: the nearest above it with a `deck:`. */
function deckAbove(files: ProjectFiles, folder: string): string | null {
  for (let at = folder; at !== "";) {
    at = at.includes("/") ? at.slice(0, at.lastIndexOf("/")) : "";
    const set = diagramFileSet(files, at);
    if (set !== null && set.files.some((path) => DECK_LINE.test(files[path] ?? ""))) return at;
  }
  return null;
}

/**
 * A diagram inside a deck's folder is drawn the deck's way unless it says otherwise (D-99): its
 * page, theme, background and grid, and its values under the diagram's own. So a slide looks
 * the same in the editor, a thumbnail and an export as it does in the deck.
 */
function inDeck(files: ProjectFiles, folder: string, diagram: Diagram): Diagram {
  const above = deckAbove(files, folder);
  if (above === null) return diagram;
  const deck = parseDiagram(files, above).diagram.settings;
  if (deck.deck === null) return diagram;
  const own = diagram.settings;
  return {
    ...diagram,
    settings: {
      ...own,
      page: own.page ?? deck.page,
      theme: own.themeSet ? own.theme : deck.theme,
      themeSet: own.themeSet || deck.themeSet,
      background: own.background ?? deck.background,
      grid: own.grid ?? deck.grid,
      data: new Map([...deck.data, ...own.data]),
    },
  };
}

function emptyDiagram(folder: string): Diagram {
  return {
    folder,
    mode: "single",
    files: [],
    settingsFile: folder.length > 0 ? `${folder}/mogram.yaml` : "mogram.yaml",
    layoutFile: folder.length > 0 ? `${folder}/mogram.yaml` : "mogram.yaml",
    settings: {
      name: "Untitled diagram",
      description: null,
      concept: null,
      deck: null,
      theme: "midnight",
      themeSet: false,
      page: null,
      background: null,
      grid: null,
      libraries: null,
      ports: new Map(),
      data: new Map(),
    },
    components: new Map(),
    containers: new Map(),
    groups: new Map(),
    connections: new Map(),
    decorations: new Map(),
    styles: new Map(),
    layout: new Map(),
    scenes: [],
    stories: [],
    controls: [],
    tours: [],
  };
}

interface BuildInfo {
  readonly folder: string;
  readonly styles: Diagram["styles"];
  readonly mode: Diagram["mode"];
  readonly files: readonly string[];
  readonly settingsFile: string;
  readonly layoutFile: string;
  readonly defaultName: string;
}

class Merger {
  private readonly owners = new Map<string, { kind: NamedKind; at: Position }>();
  private readonly components = new Map<string, RawComponent>();
  private readonly containers = new Map<string, RawContainer>();
  private readonly groups = new Map<string, RawGroup>();
  private readonly connections = new Map<string, RawConnection>();
  private readonly decorations = new Map<string, RawDecoration>();
  private readonly layout = new Map<string, LayoutEntry & { readonly at_: Position }>();
  private readonly scenes = new Map<string, RawScene>();
  private readonly stories = new Map<string, RawStory>();
  private readonly controls = new Map<string, RawControl>();
  private readonly tours = new Map<string, RawTour>();
  private settings: FileContribution["settings"] = null;

  constructor(private readonly sink: DiagnosticSink) {}

  add(contribution: FileContribution, isSettingsFile: boolean): void {
    if (contribution.settings !== null) {
      if (isSettingsFile) this.settings = contribution.settings;
      else
        this.sink.warning(
          contribution.settings.at,
          `Settings like name and theme belong in mogram.yaml. Mogram ignores them in ${contribution.file}.`,
        );
    }
    for (const raw of contribution.containers) {
      if (this.claim(raw.model.name, "container", raw.at)) this.containers.set(raw.model.name, raw);
    }
    for (const raw of contribution.components) {
      if (this.claim(raw.model.name, "component", raw.at)) this.components.set(raw.model.name, raw);
    }
    for (const raw of contribution.groups) {
      if (this.claim(raw.model.name, "group", raw.at)) this.groups.set(raw.model.name, raw);
    }
    for (const raw of contribution.connections) {
      if (this.claim(raw.model.name, "connection", raw.at))
        this.connections.set(raw.model.name, raw);
    }
    for (const raw of contribution.decorations) {
      if (this.claim(raw.model.name, "decoration", raw.at))
        this.decorations.set(raw.model.name, raw);
    }
    for (const raw of contribution.layout) {
      const existing = this.layout.get(raw.name);
      if (existing !== undefined) {
        this.sink.error(
          raw.at,
          `"${raw.name}" has a layout entry in ${existing.at_.file} (line ${existing.at_.line}) and in ${raw.at.file} (line ${raw.at.line}). Keep just one.`,
        );
        continue;
      }
      this.layout.set(raw.name, { ...raw.entry, at_: raw.at });
    }
    for (const raw of contribution.scenes) {
      const existing = this.scenes.get(raw.model.name);
      if (existing !== undefined) {
        this.sink.error(raw.at, duplicateMessage(`Scene "${raw.model.name}"`, existing.at, raw.at));
        continue;
      }
      this.scenes.set(raw.model.name, raw);
    }
    for (const raw of contribution.stories) {
      const existing = this.stories.get(raw.model.name);
      if (existing !== undefined) {
        this.sink.error(raw.at, duplicateMessage(`Story "${raw.model.name}"`, existing.at, raw.at));
        continue;
      }
      this.stories.set(raw.model.name, raw);
    }
    for (const raw of contribution.controls) {
      const existing = this.controls.get(raw.model.name);
      if (existing !== undefined) {
        this.sink.error(
          raw.at,
          duplicateMessage(`Control "${raw.model.name}"`, existing.at, raw.at),
        );
        continue;
      }
      this.controls.set(raw.model.name, raw);
    }
    for (const raw of contribution.tours) {
      const existing = this.tours.get(raw.model.name);
      if (existing !== undefined) {
        this.sink.error(raw.at, duplicateMessage(`Tour "${raw.model.name}"`, existing.at, raw.at));
        continue;
      }
      this.tours.set(raw.model.name, raw);
    }
  }

  /** One namespace across all files (FI-9). Returns false for a duplicate. */
  private claim(name: string, kind: NamedKind, at: Position): boolean {
    const existing = this.owners.get(name);
    if (existing === undefined) {
      this.owners.set(name, { kind, at });
      return true;
    }
    const subject =
      existing.kind === kind
        ? `"${name}"`
        : `"${name}" (a ${KIND_NOUN[kind]}, already used by a ${KIND_NOUN[existing.kind]})`;
    this.sink.error(at, duplicateMessage(subject, existing.at, at));
    return false;
  }

  /**
   * Internal links point at something that exists (draw.io's "Page not found"): an element of
   * this diagram, or a scene or tour when this diagram has any (nested diagrams use the top
   * diagram's). Wrong ones are warnings: the element still draws.
   */
  private validateLinks(scenes: ReadonlySet<string>, tours: ReadonlySet<string>): void {
    const all = [
      ...this.components.values(),
      ...this.containers.values(),
      ...this.groups.values(),
      ...this.connections.values(),
      ...this.decorations.values(),
    ];
    for (const raw of all) {
      const link = raw.model.link;
      if (link === null) continue;
      const at = raw.at;
      if (link.kind === "element" && !this.owners.has(link.element))
        this.sink.warning(
          at,
          `"${raw.model.name}" links to "#${link.element}", but there is no element by that name.`,
        );
      if (link.kind === "scene" && scenes.size > 0 && !scenes.has(link.scene))
        this.sink.warning(
          at,
          `"${raw.model.name}" links to scene "${link.scene}", which this diagram doesn't have.`,
        );
      if (link.kind === "tour" && tours.size > 0 && !tours.has(link.tour))
        this.sink.warning(
          at,
          `"${raw.model.name}" links to tour "${link.tour}", which this diagram doesn't have.`,
        );
    }
  }

  build(info: BuildInfo): Diagram {
    this.resolveParents();
    this.resolveRiders();
    this.validateGroups();
    this.validateConnections();
    this.validateLayout();
    const scenes = this.validateScenes();
    const stories = this.validateStories();
    const tours = this.validateTours(new Set(scenes.map((scene) => scene.name)));
    this.validateLinks(
      new Set(scenes.map((scene) => scene.name)),
      new Set(tours.map((tour) => tour.name)),
    );

    const settings: DiagramSettings = {
      name: this.settings?.name ?? info.defaultName,
      description: this.settings?.description ?? null,
      concept: this.validateConcept(),
      deck: this.validateDeck(),
      theme: this.settings?.theme ?? "midnight",
      themeSet: this.settings?.theme != null,
      background: this.settings?.background ?? null,
      page: this.settings?.page ?? null,
      grid: this.settings?.grid ?? null,
      libraries: this.settings?.libraries ?? null,
      ports: this.resolvePorts(),
      data: this.settings?.data ?? new Map(),
    };

    const layout = new Map<string, LayoutEntry>();
    for (const [name, entry] of this.layout) {
      layout.set(name, {
        at: entry.at,
        size: entry.size,
        z: entry.z,
        via: entry.via,
        fromAnchor: entry.fromAnchor,
        toAnchor: entry.toAnchor,
        label: entry.label,
        locked: entry.locked,
        source: entry.source,
      });
    }

    return {
      folder: info.folder,
      mode: info.mode,
      files: info.files,
      settingsFile: info.settingsFile,
      layoutFile: info.layoutFile,
      settings,
      components: mapValues(this.components, (raw) => raw.model),
      containers: mapValues(this.containers, (raw) => raw.model),
      groups: mapValues(this.groups, (raw) => raw.model),
      connections: mapValues(this.connections, (raw) => raw.model),
      decorations: mapValues(this.decorations, (raw) => raw.model),
      styles: info.styles,
      layout,
      scenes,
      stories,
      controls: this.validateControls(new Set(scenes.map((scene) => scene.name))),
      tours,
    };
  }

  /** Controls (D-88): a toggle and a pick name scenes that exist; a name is a value's or a control's, not both. */
  private validateControls(scenes: ReadonlySet<string>): Control[] {
    const controls: Control[] = [];
    for (const raw of this.controls.values()) {
      const control = raw.model;
      if (this.settings?.data.has(control.name) === true)
        this.sink.warning(
          raw.at,
          `"${control.name}" is a control and a value in "data:". Formulas read the control.`,
        );
      if (control.kind === "toggle" && !scenes.has(control.scene)) {
        this.sink.error(
          raw.at,
          `The toggle "${control.name}" turns on scene "${control.scene}", but there is no such scene.${didYouMean(control.scene, scenes)}`,
        );
        continue;
      }
      if (control.kind === "pick") {
        const known = control.scenes.filter((scene) => scenes.has(scene) || scene === "normal");
        const missing = control.scenes.filter((scene) => !known.includes(scene));
        if (missing.length > 0)
          this.sink.error(
            raw.at,
            `The pick "${control.name}" offers ${missing.map((m) => `"${m}"`).join(", ")}, but there ${missing.length === 1 ? "is no such scene" : "are no such scenes"}. ("normal" is the diagram as it is.)`,
          );
        if (known.length < 2) continue;
        controls.push({
          ...control,
          scenes: known,
          start: known.includes(control.start) ? control.start : (known[0] ?? ""),
        });
        continue;
      }
      controls.push(control);
    }
    return controls;
  }

  private resolvePorts(): Map<string, string> {
    const ports = new Map<string, string>();
    for (const [port, ref] of this.settings?.ports ?? []) {
      if (!this.components.has(ref.value) && !this.containers.has(ref.value)) {
        this.sink.error(
          ref.at,
          `Port "${port}" leads to "${ref.value}", but there is no such element.${didYouMean(ref.value, this.placeableNames())}`,
        );
        continue;
      }
      ports.set(port, ref.value);
    }
    return ports;
  }

  private placeableNames(): string[] {
    return [...this.components.keys(), ...this.containers.keys()];
  }

  /** `in:` must name a container; cycles are broken and reported (ED-12). */
  private resolveParents(): void {
    const parentOf = (ref: Ref | null, child: string): string | null => {
      if (ref === null) return null;
      if (this.containers.has(ref.value)) {
        if (ref.value === child) {
          this.sink.error(ref.at, `"${child}" can't be inside itself.`);
          return null;
        }
        return ref.value;
      }
      const what = this.components.has(ref.value)
        ? `"${ref.value}" is a component, not a container`
        : `there is no container with that name`;
      this.sink.error(
        ref.at,
        `"${child}" is inside "${ref.value}", but ${what}.${didYouMean(ref.value, this.containers.keys())}`,
      );
      return null;
    };
    for (const raw of this.containers.values())
      raw.model.parent = parentOf(raw.parentRef, raw.model.name);
    for (const raw of this.components.values())
      raw.model.parent = parentOf(raw.parentRef, raw.model.name);
    for (const raw of this.decorations.values()) {
      raw.model.parent = parentOf(raw.parentRef, raw.model.name);
      if (
        raw.needsPosition &&
        (raw.model.parent === null || this.containers.get(raw.model.parent)?.model.layout == null)
      ) {
        this.sink.error(
          raw.at,
          `Decoration "${raw.model.name}" needs a position, like "at: [4, 6]", or an arranging container, like "in: list".`,
        );
        this.decorations.delete(raw.model.name);
      }
    }

    // Break cycles: walk up from each container; if we come back to it, detach it.
    for (const raw of this.containers.values()) {
      const seen = new Set<string>([raw.model.name]);
      let current = raw.model.parent;
      while (current !== null) {
        if (seen.has(current)) {
          this.sink.error(
            raw.parentRef?.at ?? raw.at,
            `Containers "${[...seen].join('", "')}" are inside each other in a loop. "${raw.model.name}" is shown at the top level until that's fixed.`,
          );
          raw.model.parent = null;
          break;
        }
        seen.add(current);
        current = this.containers.get(current)?.model.parent ?? null;
      }
    }
  }

  /**
   * `on:` names what something rides on (D-87): a component, a container or a connection. A
   * `cell:` means something in a grid.
   */
  private resolveRiders(): void {
    const riders = [...this.components.values(), ...this.decorations.values()];
    for (const raw of riders) {
      const on = raw.model.on;
      if (on === null) continue;
      const kind = this.owners.get(on)?.kind;
      const fine =
        on !== raw.model.name &&
        (kind === "component" || kind === "container" || kind === "connection");
      if (fine) continue;
      this.sink.error(
        raw.onAt ?? raw.at,
        on === raw.model.name
          ? `"${on}" can't ride on itself.`
          : kind === undefined
            ? `"${raw.model.name}" rides on "${on}", but there is no such element.${didYouMean(on, [...this.placeableNames(), ...this.connections.keys()])}`
            : `"${raw.model.name}" rides on "${on}", which is a ${kind === "decoration" ? "text" : kind}. Things ride on components, containers and connections.`,
      );
      raw.model.on = null;
    }
    // Riding in a loop: the last link is dropped.
    for (const raw of riders) {
      const seen = new Set([raw.model.name]);
      for (let at = raw.model.on; at !== null;) {
        if (seen.has(at)) {
          this.sink.error(
            raw.onAt ?? raw.at,
            `"${raw.model.name}" rides on something that rides on it. It's shown on its own until that's fixed.`,
          );
          raw.model.on = null;
          break;
        }
        seen.add(at);
        at = this.components.get(at)?.model.on ?? null;
      }
    }
    for (const raw of this.components.values()) {
      if (raw.model.cell === null) continue;
      const parent = raw.model.parent === null ? null : this.containers.get(raw.model.parent);
      if (parent?.model.layout?.kind === "grid") continue;
      this.sink.warning(
        raw.at,
        `"${raw.model.name}" has a cell, which is for something in a grid (a container with "layout: grid"), so it is ignored.`,
      );
      raw.model.cell = null;
    }
  }

  private validateGroups(): void {
    for (const raw of this.groups.values()) {
      const members: string[] = [];
      for (const ref of raw.memberRefs) {
        if (this.components.has(ref.value) || this.containers.has(ref.value))
          members.push(ref.value);
        else
          this.sink.error(
            ref.at,
            `Group "${raw.model.name}" includes "${ref.value}", but there is no such element.${didYouMean(ref.value, this.placeableNames())}`,
          );
      }
      raw.model.members = members;
    }
  }

  private validateConnections(): void {
    for (const raw of this.connections.values()) {
      const model = raw.model;
      for (const [end, at, side] of [
        ["from", raw.fromAt, "starts at"],
        ["to", raw.toAt, "goes to"],
      ] as const) {
        const endpoint = model[end];
        const component = this.components.get(endpoint.element);
        if (component === undefined && !this.containers.has(endpoint.element)) {
          this.sink.error(
            at,
            `Connection "${model.name}" ${side} "${endpoint.element}", but there is no such element.${didYouMean(endpoint.element, this.placeableNames())}`,
          );
          continue;
        }
        if (endpoint.port === null) continue;
        // After the dot: a part, when the element has parts (D-104), or a port when it opens a
        // nested diagram.
        const parts = component?.model.parts;
        if (parts !== undefined && parts.size > 0) {
          if (parts.has(endpoint.port))
            model[end] = { element: endpoint.element, port: null, part: endpoint.port };
          else
            this.sink.error(
              at,
              `Connection "${model.name}" ends on "${endpoint.element}.${endpoint.port}", but "${endpoint.element}" has no part with that name.${didYouMean(endpoint.port, parts.keys())}`,
            );
        } else if (component?.model.opens == null)
          this.sink.error(
            at,
            `Connection "${model.name}" ${side} "${endpoint.element}.${endpoint.port}", but "${endpoint.element}" has no parts and doesn't open a nested diagram.`,
          );
      }
      if (
        model.from.element === model.to.element &&
        model.from.port === model.to.port &&
        model.from.part === model.to.part
      ) {
        this.sink.warning(raw.at, `Connection "${model.name}" starts and ends at the same place.`);
      }
      if (model.backupFor !== null && !this.connections.has(model.backupFor)) {
        this.sink.error(
          raw.backupAt ?? raw.at,
          `Connection "${model.name}" is a backup for "${model.backupFor}", but there is no connection with that name.${didYouMean(model.backupFor, this.connections.keys())}`,
        );
        model.backupFor = null;
      }
    }
  }

  private validateLayout(): void {
    for (const [name, entry] of this.layout) {
      const kind = this.owners.get(name)?.kind;
      if (kind === undefined) {
        this.sink.warning(
          entry.at_,
          `The layout mentions "${name}", but there is no element with that name, so it is ignored.`,
        );
        this.layout.delete(name);
      } else if (kind === "group") {
        this.sink.warning(
          entry.at_,
          `Groups are drawn around their members and have no position, so the layout for "${name}" is ignored.`,
        );
        this.layout.delete(name);
      } else if (kind === "connection" && (entry.at !== null || entry.size !== null)) {
        this.sink.warning(
          entry.at_,
          `Connections only take "via" points in the layout; the position for "${name}" is ignored.`,
        );
      } else if (
        kind !== "connection" &&
        (entry.fromAnchor !== null || entry.toAnchor !== null || entry.label !== null)
      ) {
        this.sink.warning(
          entry.at_,
          `Only connections take anchors and a label place in the layout; they are ignored for "${name}".`,
        );
      } else if (
        kind === "component" &&
        entry.size !== null &&
        this.components.get(name)?.model.shape == null
      ) {
        this.sink.warning(
          entry.at_,
          `Icon components have a fixed size, so the size for "${name}" is ignored. Shapes can be resized.`,
        );
      }
    }
  }

  /** A deck's own file holds its settings and its slides (D-99): what one file can know. */
  private validateDeck(): Deck | null {
    const deck = this.settings?.deck ?? null;
    if (deck === null) return null;
    const at = { file: deck.source.file, line: deck.source.line, column: 1 };
    for (const [name, owner] of this.owners) {
      if (owner.kind === "connection") continue;
      this.sink.warning(
        at,
        `"${name}" is an element in a deck's own file. A deck's file holds its settings and its slides; put "${name}" on a slide or in the frame.`,
      );
      break;
    }
    if (!deck.entries.some((entry) => entry.kind === "slide"))
      this.sink.warning(at, `The deck has no slides yet.`);
    return deck;
  }

  /** A concept's roles name its components and containers (D-83). */
  private validateConcept(): Concept | null {
    const raw = this.settings?.concept ?? null;
    if (raw === null) return null;
    const roles: ConceptRole[] = [];
    for (const role of raw.roles) {
      const kind = this.owners.get(role.element.value)?.kind;
      if (kind === "component" || kind === "container") {
        roles.push({ element: role.element.value, label: role.label, optional: role.optional });
        continue;
      }
      this.sink.error(
        role.element.at,
        kind === undefined
          ? `The concept's role "${role.element.value}" should name an element in this diagram.${didYouMean(role.element.value, [...this.components.keys(), ...this.containers.keys()])}`
          : `The concept's role "${role.element.value}" is a ${kind}; roles are played by components and containers.`,
      );
    }
    return {
      summary: raw.summary,
      topic: raw.topic,
      platform: raw.platform,
      tags: raw.tags,
      roles,
    };
  }

  private validateScenes(): Scene[] {
    const scenes: Scene[] = [];
    for (const raw of this.scenes.values()) {
      const entries: SceneEntry[] = [];
      const where = `scene "${raw.model.name}"`;
      raw.model.entries.forEach((entry, index) => {
        const at = raw.entryPositions[index] ?? raw.at;
        const checked = this.validateSceneEntry(where, entry, at);
        if (checked !== null) entries.push(this.validateSceneCapacity(where, checked, at));
      });
      scenes.push({ ...raw.model, entries });
    }
    return scenes;
  }

  /** Stories (D-86): each step's `set` is checked like a scene's, and its names must exist. */
  private validateStories(): Story[] {
    const stories: Story[] = [];
    // A story a choice plays picks up where the one that offered it is, so it can rewind to
    // that story's steps too.
    const namedIn = (story: string): string[] =>
      (this.stories.get(story)?.model.steps ?? []).flatMap((step) => step.name ?? []);
    for (const raw of this.stories.values()) {
      const where = `story "${raw.model.name}"`;
      const names = new Set<string>();
      const elsewhere = new Set(
        [...this.stories.keys()].filter((name) => name !== raw.model.name).flatMap(namedIn),
      );
      const steps: StoryStep[] = [];
      raw.model.steps.forEach((step, index) => {
        const positions = raw.steps[index];
        const stepAt = positions?.at ?? raw.at;
        const entries: SceneEntry[] = [];
        step.entries.forEach((entry, line) => {
          const at = positions?.entries[line] ?? stepAt;
          const checked = this.validateSceneEntry(where, entry, at);
          if (checked !== null) entries.push(this.validateSceneCapacity(where, checked, at));
        });
        const focus = step.focus.filter((name, at) => {
          const problem = this.targetProblem(where, name);
          if (problem === null) return true;
          this.sink.error(
            positions?.focus[at] ?? stepAt,
            problem === "missing"
              ? `In ${where}, a step focuses on "${name}", but there is no such element.${didYouMean(name, this.owners.keys())}`
              : problem,
          );
          return false;
        });
        let zoom = step.zoom;
        const zoomProblem = zoom === null ? null : this.targetProblem(where, zoom);
        if (zoom !== null && zoomProblem !== null) {
          this.sink.error(
            positions?.zoom ?? stepAt,
            zoomProblem === "missing"
              ? `In ${where}, a step zooms to "${zoom}", but there is no such element.${didYouMean(zoom, this.owners.keys())}`
              : zoomProblem,
          );
          zoom = null;
        }
        // A step rewinds to the start, or to a step played before it.
        let rewind = step.rewind;
        if (rewind !== null && rewind !== "start" && !names.has(rewind) && !elsewhere.has(rewind)) {
          this.sink.error(
            positions?.rewind ?? stepAt,
            `In ${where}, a step rewinds to "${rewind}", but no step before it has that name. Use "start", or name an earlier step with "name:".${didYouMean(rewind, ["start", ...names, ...elsewhere])}`,
          );
          rewind = null;
        }
        if (step.name !== null) {
          if (names.has(step.name))
            this.sink.warning(stepAt, `Two steps of ${where} are named "${step.name}".`);
          names.add(step.name);
        }
        const choices = step.choices.filter((choice, at) => {
          if (this.stories.has(choice.play)) return true;
          this.sink.error(
            positions?.choices[at] ?? stepAt,
            `In ${where}, the choice "${choice.label}" plays "${choice.play}", but there is no story by that name.${didYouMean(choice.play, this.stories.keys())}`,
          );
          return false;
        });
        steps.push({ ...step, entries, focus, zoom, rewind, choices });
      });
      if (steps.length === 0)
        this.sink.warning(raw.at, `Story "${raw.model.name}" has no steps yet.`);
      stories.push({ ...raw.model, steps });
    }
    return stories;
  }

  /** An element of this diagram, a part of one (D-104), or a path into a nested diagram. */
  private knownTarget(target: string): boolean {
    return this.targetProblem("", target) === null;
  }

  /**
   * What's wrong with a name a step or scene points at: null when nothing is, `missing` for an
   * element that isn't there, or the message for a dotted name that leads nowhere.
   */
  private targetProblem(where: string, target: string): string | null {
    const dot = target.indexOf(".");
    if (dot === -1) return this.owners.has(target) ? null : "missing";
    const owner = target.slice(0, dot);
    const after = target.slice(dot + 1);
    const component = this.components.get(owner)?.model;
    if (component === undefined)
      return this.owners.has(owner) ? this.pointsInside(where, target, owner) : "missing";
    if (component.parts.size > 0)
      return component.parts.has(after)
        ? null
        : `In ${where}, "${target}" names a part of "${owner}" that isn't there.${didYouMean(after, component.parts.keys())}`;
    return component.opens != null ? null : this.pointsInside(where, target, owner);
  }

  private pointsInside(where: string, target: string, owner: string): string {
    return `In ${where}, "${target}" points inside "${owner}", but "${owner}" has no parts and doesn't open a nested diagram.`;
  }

  /**
   * One line of a `set`, kept as far as it means something for what it names: a wrong key for
   * that kind of element is dropped with a message, and the rest of the line stays. Null when
   * nothing is left, or the target doesn't exist. `where` reads `scene "outage"`.
   */
  private validateSceneEntry(where: string, entry: SceneEntry, at: Position): SceneEntry | null {
    const dot = entry.target.indexOf(".");
    if (dot !== -1) {
      // Nested path (SC-10): the first segment must open a nested diagram. Deeper checks happen
      // in @mogram/core/nested once the nested diagram is loaded.
      const owner = entry.target.slice(0, dot);
      const component = this.components.get(owner);
      if (component !== undefined && component.model.parts.size > 0) {
        const problem = this.targetProblem(where, entry.target);
        if (problem !== null) {
          this.sink.error(at, problem);
          return null;
        }
        // A part can be shown, toned and marked (D-104); anything else on its line is dropped.
        const ignored = [
          entry.state !== null ? "state" : null,
          entry.flow !== null ? "flow" : null,
          entry.motion !== null ? "motion" : null,
          entry.capacity !== undefined ? "capacity" : null,
          entry.label !== undefined ? "label" : null,
          entry.place !== undefined ? "place" : null,
          entry.value !== undefined ? "value" : null,
        ].filter((key) => key !== null);
        for (const key of ignored)
          this.sink.warning(
            at,
            `A part can change "show", "tone" and "mark". "${key}" is ignored on "${entry.target}".`,
          );
        const kept: SceneEntry = {
          target: entry.target,
          source: entry.source,
          state: null,
          flow: null,
          motion: null,
          ...(entry.show === undefined ? {} : { show: entry.show }),
          ...(entry.tone === undefined ? {} : { tone: entry.tone }),
          ...(entry.mark === undefined ? {} : { mark: entry.mark }),
        };
        return kept.show !== undefined || kept.tone !== undefined || kept.mark !== undefined
          ? kept
          : null;
      }
      if (component?.model.opens == null) {
        this.sink.error(at, this.pointsInside(where, entry.target, owner));
        return null;
      }
      return entry;
    }
    const kind = this.owners.get(entry.target)?.kind;
    // A value (D-88): the line names a key of the diagram's data, and gives it a number.
    const values = this.settings?.data;
    if (entry.value !== undefined) {
      if (kind === undefined && values?.has(entry.target) === true) return entry;
      this.sink.error(
        at,
        kind !== undefined
          ? `In ${where}, "${entry.target}" is ${kind === "decoration" ? "text" : `a ${kind}`}, so it takes a word like "down" or "shown", not a number.`
          : `${capitalize(where)} sets "${entry.target}", but there is no value by that name in the diagram's "data:".${didYouMean(entry.target, [...(values?.keys() ?? [])])}`,
      );
      return null;
    }
    if (kind === undefined) {
      this.sink.error(
        at,
        `${capitalize(where)} changes "${entry.target}", but there is no such element.${didYouMean(entry.target, this.owners.keys())}`,
      );
      return null;
    }
    if (kind === "group") {
      this.sink.error(
        at,
        `"${entry.target}" is a group, which only outlines its members: change them instead.`,
      );
      return null;
    }
    const kept: { -readonly [K in keyof SceneEntry]: SceneEntry[K] } = { ...entry };
    if (kind === "connection" && (entry.state !== null || entry.motion !== null)) {
      this.sink.error(
        at,
        `"${entry.target}" is a connection, so it takes a flow preset (traffic, slow, blocked, rerouted or idle).`,
      );
      kept.state = null;
      kept.motion = null;
    }
    if (kind !== "connection" && entry.flow !== null) {
      this.sink.error(
        at,
        kind === "decoration"
          ? `"${entry.target}" is text, which has no flow.`
          : `"${entry.target}" is a ${kind}, so it takes a state preset (healthy, active, scaling, degraded, overloaded or down).`,
      );
      kept.flow = null;
    }
    if (kind === "container" && entry.motion !== null) {
      this.sink.error(at, `Motion applies to components, not containers like "${entry.target}".`);
      kept.motion = null;
    }
    if (kind === "decoration" && (entry.state !== null || entry.motion !== null)) {
      this.sink.error(
        at,
        `"${entry.target}" is text, which has no state: it can be shown, faded or hidden, and its words and tone can change.`,
      );
      kept.state = null;
      kept.motion = null;
    }
    if (entry.mark !== undefined && kind !== "component" && kind !== "container") {
      this.sink.error(
        at,
        `Marks sit on components and containers, not on a ${kind === "decoration" ? "text" : kind} like "${entry.target}".`,
      );
      delete kept.mark;
    }
    if (entry.tone !== undefined) {
      const shape = this.components.get(entry.target)?.model.shape ?? null;
      if (kind !== "decoration" && shape === null) {
        this.sink.error(
          at,
          `A tone colours shapes and text. "${entry.target}" is ${kind === "component" ? "an icon component" : `a ${kind}`}, so it's ignored.`,
        );
        delete kept.tone;
      }
    }
    if (entry.place !== undefined) {
      const place = this.validatePlace(where, entry.target, entry.place, at);
      if (place === null) delete kept.place;
      else kept.place = place;
    }
    const says =
      kept.place !== undefined ||
      kept.state !== null ||
      kept.flow !== null ||
      kept.motion !== null ||
      kept.capacity !== undefined ||
      kept.show !== undefined ||
      kept.label !== undefined ||
      kept.tone !== undefined ||
      kept.mark !== undefined;
    return says ? kept : null;
  }

  /** Whether a layout places it (D-87): it's in a container that arranges it, or rides on something. */
  private placedByLayout(name: string): boolean {
    const component = this.components.get(name)?.model;
    if (component !== undefined) {
      if (component.on !== null) return true;
      const parent = component.parent === null ? null : this.containers.get(component.parent);
      return parent?.model.layout != null;
    }
    return this.decorations.get(name)?.model.on != null;
  }

  /**
   * Where a set puts something (D-87). Only what a layout places can go somewhere else; `in`
   * names a container that arranges its contents, `on` an element or a connection.
   */
  private validatePlace(where: string, target: string, place: Place, at: Position): Place | null {
    if (!this.placedByLayout(target)) {
      this.sink.error(
        at,
        `In ${where}, "${target}" is given a place, but it's placed freely on the canvas, so it stays where it is. Only something in a container with a layout, or riding on something ("on:"), can move.`,
      );
      return null;
    }
    const kept: { -readonly [K in keyof Place]: Place[K] } = { ...place };
    if (place.in !== undefined) {
      const into = this.containers.get(place.in)?.model;
      if (into?.layout == null || this.decorations.has(target)) {
        this.sink.error(
          at,
          this.decorations.has(target)
            ? `In ${where}, "${target}" is text: it can ride on something else ("on:"), but not go in a container.`
            : into === undefined
              ? `In ${where}, "${target}" goes in "${place.in}", but there is no such container.${didYouMean(place.in, this.containers.keys())}`
              : `In ${where}, "${target}" goes in "${place.in}", which doesn't arrange what's in it. Give it "layout: row", "column" or "grid".`,
        );
        delete kept.in;
      }
    }
    if (place.on !== undefined) {
      const kind = this.owners.get(place.on)?.kind;
      if (
        place.on === target ||
        (kind !== "component" && kind !== "container" && kind !== "connection")
      ) {
        this.sink.error(
          at,
          kind === undefined
            ? `In ${where}, "${target}" goes on "${place.on}", but there is no such element.${didYouMean(place.on, [...this.placeableNames(), ...this.connections.keys()])}`
            : `In ${where}, "${target}" can't go on "${place.on}". Things ride on components, containers and connections.`,
        );
        delete kept.on;
      }
    }
    if (place.cell !== undefined) {
      const home = kept.in ?? this.components.get(target)?.model.parent ?? null;
      const grid = home === null ? null : this.containers.get(home)?.model.layout;
      if (grid?.kind !== "grid") {
        this.sink.warning(
          at,
          `In ${where}, "${target}" is given a cell, which is for something in a grid, so it is ignored.`,
        );
        delete kept.cell;
      }
    }
    return Object.keys(kept).length === 0 ? null : kept;
  }

  /** Capacity in a scene line, kept only where it means something (D-82). */
  private validateSceneCapacity(where: string, entry: SceneEntry, at: Position): SceneEntry {
    const capacity = entry.capacity;
    if (capacity === undefined || entry.target.includes(".")) return entry;
    const kind = this.owners.get(entry.target)?.kind;
    const component = this.components.get(entry.target)?.model;
    const dropped = new Set<keyof typeof capacity>();
    const drop = (key: keyof typeof capacity, message: string) => {
      this.sink.warning(at, `In ${where}, ${message}`);
      dropped.add(key);
    };
    const kept = capacity;
    if (kind !== "connection") {
      if (kept.traffic !== undefined)
        drop("traffic", `traffic is set on connections, not on "${entry.target}".`);
      if (kept.share !== undefined)
        drop("share", `a share is set on connections, not on "${entry.target}".`);
    }
    if (kind !== "component" && kept.hit !== undefined)
      drop("hit", `a hit rate is set on components, not on "${entry.target}".`);
    if (kept.copies !== undefined && component?.scale?.kind !== "out")
      drop(
        "copies",
        `"${entry.target}" doesn't scale out (\`scale: { min, max }\`), so its copies are ignored.`,
      );
    if (kept.size !== undefined) {
      const sizes =
        component?.scale?.kind === "up" ? component.scale.sizes.map((s) => s.name) : null;
      if (sizes === null)
        drop(
          "size",
          `"${entry.target}" doesn't scale up (\`scale: { sizes }\`), so its size is ignored.`,
        );
      else if (!sizes.includes(kept.size))
        drop(
          "size",
          `"${entry.target}" has no size "${kept.size}".${didYouMean(kept.size, sizes)} Its sizes: ${sizes.join(", ")}.`,
        );
    }
    const left = Object.fromEntries(
      Object.entries(capacity).filter(([key]) => !dropped.has(key as keyof typeof capacity)),
    ) as typeof capacity;
    if (Object.keys(left).length > 0) return { ...entry, capacity: left };
    const rest: { -readonly [K in keyof SceneEntry]: SceneEntry[K] } = { ...entry };
    delete rest.capacity;
    return rest;
  }

  private validateTours(sceneNames: ReadonlySet<string>): Tour[] {
    const tours: Tour[] = [];
    const knownTarget = (target: string): boolean =>
      target.includes(".")
        ? this.knownTarget(target)
        : this.components.has(target) || this.containers.has(target);
    const checkScene = (scene: string | null, at: Position | null, tour: string): void => {
      if (scene === null || scene === "normal" || sceneNames.has(scene)) return;
      this.sink.error(
        at ?? { file: "", line: 1, column: 1 },
        `Tour "${tour}" switches to scene "${scene}", but there is no such scene.${didYouMean(scene, sceneNames)}`,
      );
    };
    for (const raw of this.tours.values()) {
      const tour = raw.model;
      for (const [target, step] of tour.steps) {
        const positions = raw.stepPositions.get(target);
        if (!knownTarget(target)) {
          this.sink.error(
            positions?.target ?? raw.at,
            `Tour "${tour.name}" visits "${target}", but there is no such element.${didYouMean(target, this.placeableNames())}`,
          );
        }
        if (step.next !== null && !knownTarget(step.next)) {
          this.sink.error(
            positions?.next ?? raw.at,
            `In tour "${tour.name}", "${target}" goes next to "${step.next}", but there is no such element.${didYouMean(step.next, this.placeableNames())}`,
          );
        }
        checkScene(step.scene, positions?.scene ?? null, tour.name);
        step.choices.forEach((choice, index) => {
          const choiceAt = positions?.choices[index];
          if (choice.next !== null && !knownTarget(choice.next)) {
            this.sink.error(
              choiceAt?.next ?? raw.at,
              `In tour "${tour.name}", choice "${choice.label}" goes to "${choice.next}", but there is no such element.`,
            );
          }
          checkScene(choice.scene, choiceAt?.scene ?? null, tour.name);
        });
      }
      if (tour.start !== null && !knownTarget(tour.start)) {
        this.sink.error(
          raw.startAt ?? raw.at,
          `Tour "${tour.name}" starts at "${tour.start}", but there is no such element.${didYouMean(tour.start, this.placeableNames())}`,
        );
      }
      if (tour.start === null && tour.steps.size === 0) {
        this.sink.warning(raw.at, `Tour "${tour.name}" has no steps yet.`);
      }
      tours.push(tour);
    }
    return tours;
  }
}

function duplicateMessage(subject: string, first: Position, second: Position): string {
  const where =
    first.file === second.file
      ? `twice in ${first.file} (lines ${first.line} and ${second.line})`
      : `in ${first.file} (line ${first.line}) and in ${second.file} (line ${second.line})`;
  return `${subject} is defined ${where}. Names must be unique across all files of a diagram.`;
}

function mapValues<K, V, R>(source: ReadonlyMap<K, V>, project: (value: V) => R): Map<K, R> {
  const out = new Map<K, R>();
  for (const [key, value] of source) out.set(key, project(value));
  return out;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
