import { YAMLMap, YAMLSeq, isMap, isSeq, type Node } from "yaml";
import type { Diagram, GridPoint, GridSize, ProjectFiles } from "../model/types";
import { elementNames, isValidName, uniqueName } from "../model/names";
import { EditError, EditSession, flowMap, pointNode, sizeNode, scalarString } from "./session";

export interface EditResult {
  /** The complete new file map. */
  readonly files: Record<string, string>;
  /** Canvas elements to select after the edit (e.g. a newly added element). */
  readonly select?: readonly string[];
  /** The name a created or renamed scene or tour ended up with (after de-duplication). */
  readonly named?: string;
}

export type ElementKind = "component" | "container" | "group" | "connection" | "decoration";

export const SECTION_OF: Readonly<Record<Exclude<ElementKind, "decoration">, string>> = {
  component: "components",
  container: "containers",
  group: "groups",
  connection: "connections",
};

/** Shared helpers for one edit. */
export class EditContext {
  readonly session: EditSession;
  private readonly taken: Set<string>;

  constructor(
    readonly files: ProjectFiles,
    readonly diagram: Diagram,
  ) {
    this.session = new EditSession(files, diagram);
    this.taken = elementNames(diagram);
  }

  kindOf(name: string): ElementKind | null {
    if (this.diagram.components.has(name)) return "component";
    if (this.diagram.containers.has(name)) return "container";
    if (this.diagram.groups.has(name)) return "group";
    if (this.diagram.connections.has(name)) return "connection";
    if (this.diagram.decorations.has(name)) return "decoration";
    return null;
  }

  requireKind(name: string): ElementKind {
    const kind = this.kindOf(name);
    if (kind === null) throw new EditError(`There is no element called "${name}".`);
    return kind;
  }

  isTaken(name: string): boolean {
    return this.taken.has(name);
  }

  /** Reserves a unique name derived from `base` (FI-1). */
  claimName(base: string): string {
    const name = uniqueName(isValidName(base) ? base : "element", this.taken);
    this.taken.add(name);
    return name;
  }

  release(name: string): void {
    this.taken.delete(name);
  }

  /** The file an element is defined in (FI-13). */
  fileOf(name: string): string {
    const element =
      this.diagram.components.get(name) ??
      this.diagram.containers.get(name) ??
      this.diagram.groups.get(name) ??
      this.diagram.connections.get(name) ??
      this.diagram.decorations.get(name);
    if (element === undefined) throw new EditError(`There is no element called "${name}".`);
    return element.source.file;
  }

  /** The definition map of a component, container, group or connection. */
  definition(name: string): YAMLMap {
    const kind = this.requireKind(name);
    if (kind === "decoration") return this.decoration(name);
    const section = this.session.section(this.fileOf(name), SECTION_OF[kind]);
    const node = section.get(name, true) as Node | undefined;
    if (isMap(node)) return node;
    const map = new YAMLMap();
    const shorthand = scalarString(node);
    if (kind === "component" && shorthand !== null) map.set("type", shorthand);
    section.set(name, map);
    return map;
  }

  /** Removes a definition, wherever it lives. */
  removeDefinition(name: string): void {
    const kind = this.requireKind(name);
    if (kind === "decoration") {
      this.decorationsMap(this.fileOf(name)).delete(name);
      return;
    }
    this.session.section(this.fileOf(name), SECTION_OF[kind]).delete(name);
  }

  /** File for new architecture next to a container (FI-12): its file, else the settings file. */
  homeFor(parent: string | null): string {
    if (parent !== null) {
      const container = this.diagram.containers.get(parent);
      if (container !== undefined) return container.source.file;
    }
    return this.diagram.settingsFile;
  }

  /** File where scenes (or tours) already live, else the settings file. */
  storyFile(kind: "scenes" | "tours"): string {
    const first = kind === "scenes" ? this.diagram.scenes[0] : this.diagram.tours[0];
    return first?.source.file ?? this.diagram.settingsFile;
  }

  // ---------------------------------------------------------------------------------------------
  // Layout (FI-4, FI-10)

  layoutFileOf(name: string): string {
    return this.diagram.layout.get(name)?.source.file ?? this.diagram.layoutFile;
  }

  layoutSection(file = this.diagram.layoutFile): YAMLMap {
    return this.session.section(file, "layout");
  }

  decorationsMap(file = this.diagram.layoutFile): YAMLMap {
    const layout = this.layoutSection(file);
    const node = layout.get("decorations", true) as Node | undefined;
    if (isMap(node)) return node;
    const map = new YAMLMap();
    layout.set("decorations", map);
    return map;
  }

  decoration(name: string): YAMLMap {
    const map = this.decorationsMap(this.fileOf(name));
    const node = map.get(name, true) as Node | undefined;
    if (!isMap(node)) throw new EditError(`Decoration "${name}" can't be edited.`);
    return node;
  }

  /** Sets a position, keeping the short `[x, y]` form when nothing else is stored. */
  setAt(name: string, at: GridPoint): void {
    const layout = this.layoutSection(this.layoutFileOf(name));
    const node = layout.get(name, true) as Node | undefined;
    if (isMap(node)) {
      node.set("at", pointNode(at));
      return;
    }
    layout.set(name, pointNode(at));
  }

  /** Sets or clears a layout field, switching between short and long forms as needed. */
  setLayoutField(
    name: string,
    field: "at" | "size" | "z" | "via",
    value: Node | number | undefined,
  ): void {
    const layout = this.layoutSection(this.layoutFileOf(name));
    const node = layout.get(name, true) as Node | undefined;
    let map: YAMLMap;
    if (isMap(node)) {
      map = node;
    } else if (value === undefined) {
      if (field === "at") layout.delete(name);
      return;
    } else {
      map = isSeq(node) ? flowMap([["at", node]]) : flowMap([]);
      layout.set(name, map);
    }
    if (value === undefined) map.delete(field);
    else map.set(field, value);
    if (map.items.length === 0) layout.delete(name);
  }

  removeLayout(name: string): void {
    const entry = this.diagram.layout.get(name);
    if (entry === undefined) return;
    this.layoutSection(entry.source.file).delete(name);
  }

  setSize(name: string, size: GridSize | null): void {
    this.setLayoutField(name, "size", size === null ? undefined : sizeNode(size));
  }

  setVia(name: string, via: readonly GridPoint[] | null): void {
    if (via === null || via.length === 0) {
      this.setLayoutField(name, "via", undefined);
      return;
    }
    const seq = new YAMLSeq();
    seq.flow = true;
    for (const point of via) seq.items.push(pointNode(point));
    this.setLayoutField(name, "via", seq);
  }

  private named: string | undefined;

  /** Records the name a scene or tour command gave (reported as `EditResult.named`). */
  setNamed(name: string): void {
    this.named = name;
  }

  result(select?: readonly string[]): EditResult {
    const files = this.session.commit();
    return {
      files,
      ...(select === undefined ? {} : { select }),
      ...(this.named === undefined ? {} : { named: this.named }),
    };
  }
}

/** Runs an edit and returns the new files. */
export function edit(
  files: ProjectFiles,
  diagram: Diagram,
  // `void` lets commands that select nothing simply not return.
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  apply: (context: EditContext) => readonly string[] | void,
): EditResult {
  const context = new EditContext(files, diagram);
  const select = apply(context);
  return context.result(select ?? undefined);
}
