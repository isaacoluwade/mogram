import type {
  Concept,
  ConceptRole,
  Diagnostic,
  Diagram,
  DiagramSettings,
  LayoutEntry,
  ProjectFiles,
  Scene,
  SceneEntry,
  Tour,
} from "../model/types";
import { displayNameForPath } from "../model/paths";
import { DiagnosticSink, sortDiagnostics, type Position } from "./diagnostics";
import { diagramFileSet, layoutFileFor } from "./project";
import {
  readFile,
  type FileContribution,
  type RawComponent,
  type RawConnection,
  type RawContainer,
  type RawDecoration,
  type RawGroup,
  type RawScene,
  type RawTour,
  type Ref,
} from "./read";
import { didYouMean } from "./suggest";
import { readStyles } from "./styles";
import { parseYamlFile } from "./yaml-read";

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
  // Named styles first, so an element in any file can take a style from any other.
  const styles = readStyles(parsedFiles, sink);
  const contributions: FileContribution[] = parsedFiles.map((parsed) =>
    readFile(parsed, folder, sink, styles),
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
  return { diagram, diagnostics: sortDiagnostics(sink.items), brokenFiles };
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
      theme: "midnight",
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
    this.validateGroups();
    this.validateConnections();
    this.validateLayout();
    const scenes = this.validateScenes();
    const tours = this.validateTours(new Set(scenes.map((scene) => scene.name)));
    this.validateLinks(
      new Set(scenes.map((scene) => scene.name)),
      new Set(tours.map((tour) => tour.name)),
    );

    const settings: DiagramSettings = {
      name: this.settings?.name ?? info.defaultName,
      description: this.settings?.description ?? null,
      concept: this.validateConcept(),
      theme: this.settings?.theme ?? "midnight",
      background: this.settings?.background ?? null,
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
      tours,
    };
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
    for (const raw of this.decorations.values())
      raw.model.parent = parentOf(raw.parentRef, raw.model.name);

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
      for (const [endpoint, at, side] of [
        [model.from, raw.fromAt, "starts at"],
        [model.to, raw.toAt, "goes to"],
      ] as const) {
        const component = this.components.get(endpoint.element);
        if (component === undefined && !this.containers.has(endpoint.element)) {
          this.sink.error(
            at,
            `Connection "${model.name}" ${side} "${endpoint.element}", but there is no such element.${didYouMean(endpoint.element, this.placeableNames())}`,
          );
        } else if (
          endpoint.port !== null &&
          (component === undefined || component.model.opens === null)
        ) {
          this.sink.error(
            at,
            `Connection "${model.name}" uses port "${endpoint.port}" on "${endpoint.element}", but only components that open a nested diagram have ports.`,
          );
        }
      }
      if (model.from.element === model.to.element && model.from.port === model.to.port) {
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
      raw.model.entries.forEach((entry, index) => {
        const at = raw.entryPositions[index] ?? raw.at;
        if (this.validateSceneEntry(raw.model.name, entry, at))
          entries.push(this.validateSceneCapacity(raw.model.name, entry, at));
      });
      scenes.push({ ...raw.model, entries });
    }
    return scenes;
  }

  private validateSceneEntry(scene: string, entry: SceneEntry, at: Position): boolean {
    const dot = entry.target.indexOf(".");
    if (dot !== -1) {
      // Nested path (SC-10): the first segment must open a nested diagram. Deeper checks happen
      // in @mogram/core/nested once the nested diagram is loaded.
      const owner = entry.target.slice(0, dot);
      const component = this.components.get(owner);
      if (component?.model.opens == null) {
        this.sink.error(
          at,
          `In scene "${scene}", "${entry.target}" points inside "${owner}", but "${owner}" doesn't open a nested diagram.`,
        );
        return false;
      }
      return true;
    }
    const kind = this.owners.get(entry.target)?.kind;
    if (kind === undefined) {
      this.sink.error(
        at,
        `Scene "${scene}" changes "${entry.target}", but there is no such element.${didYouMean(entry.target, this.owners.keys())}`,
      );
      return false;
    }
    if (kind === "connection" && (entry.state !== null || entry.motion !== null)) {
      this.sink.error(
        at,
        `"${entry.target}" is a connection, so it takes a flow preset (traffic, slow, blocked, rerouted or idle).`,
      );
      return false;
    }
    if ((kind === "component" || kind === "container") && entry.flow !== null) {
      this.sink.error(
        at,
        `"${entry.target}" is a ${kind}, so it takes a state preset (healthy, active, scaling, degraded, overloaded or down).`,
      );
      return false;
    }
    if (kind === "container" && entry.motion !== null) {
      this.sink.error(at, `Motion applies to components, not containers like "${entry.target}".`);
      return false;
    }
    if (kind === "group" || kind === "decoration") {
      this.sink.error(at, `"${entry.target}" is a ${kind}, which has no state.`);
      return false;
    }
    return true;
  }

  /** Capacity in a scene line, kept only where it means something (D-82). */
  private validateSceneCapacity(scene: string, entry: SceneEntry, at: Position): SceneEntry {
    const capacity = entry.capacity;
    if (capacity === undefined || entry.target.includes(".")) return entry;
    const kind = this.owners.get(entry.target)?.kind;
    const component = this.components.get(entry.target)?.model;
    const dropped = new Set<keyof typeof capacity>();
    const drop = (key: keyof typeof capacity, message: string) => {
      this.sink.warning(at, `In scene "${scene}", ${message}`);
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
    return Object.keys(left).length === 0
      ? {
          target: entry.target,
          state: entry.state,
          flow: entry.flow,
          motion: entry.motion,
          source: entry.source,
        }
      : { ...entry, capacity: left };
  }

  private validateTours(sceneNames: ReadonlySet<string>): Tour[] {
    const tours: Tour[] = [];
    const knownTarget = (target: string): boolean => {
      const dot = target.indexOf(".");
      if (dot === -1) return this.components.has(target) || this.containers.has(target);
      return this.components.get(target.slice(0, dot))?.model.opens != null;
    };
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
