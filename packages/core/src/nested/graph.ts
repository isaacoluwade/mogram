import type { Diagnostic, Diagram, ProjectFiles, SceneEntry } from "../model/types";
import { parseDiagram, type ParseResult } from "../format/parse";
import { diagramFileSet } from "../format/project";
import type { StatePreset } from "../presets/names";
import { resolveState, worstState, type ResolvedState } from "../state/resolve";

/**
 * Nested diagrams (NE-1 … NE-14). A component's `opens:` points at another folder in the project;
 * that folder is a blueprint shared by every component that opens it, while state belongs to each
 * use (an instance) and scenes belong to the diagram telling the story.
 */

/** Parses diagrams on demand and keeps them (NE-10: nested diagrams load only when needed). */
export class DiagramLoader {
  private readonly cache = new Map<string, ParseResult>();

  constructor(private readonly files: ProjectFiles) {}

  has(folder: string): boolean {
    return diagramFileSet(this.files, folder) !== null;
  }

  load(folder: string): ParseResult {
    let result = this.cache.get(folder);
    if (result === undefined) {
      result = parseDiagram(this.files, folder);
      this.cache.set(folder, result);
    }
    return result;
  }
}

/**
 * Loops between folders that open each other (NE-2). Each loop is reported once, at the
 * `opens:` line that closes it, naming every folder involved.
 */
export function findNestingLoops(loader: DiagramLoader, root = ""): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const reported = new Set<string>();
  const visit = (folder: string, path: readonly string[]): void => {
    if (!loader.has(folder)) return;
    const { diagram } = loader.load(folder);
    for (const component of diagram.components.values()) {
      if (component.opens === null) continue;
      const index = path.indexOf(component.opens);
      if (index !== -1 || component.opens === folder) {
        const cycle = [...path.slice(index === -1 ? path.length : index), folder, component.opens];
        const key = [...new Set(cycle)].sort().join("|");
        if (!reported.has(key)) {
          reported.add(key);
          diagnostics.push({
            severity: "error",
            file: component.source.file,
            line: component.source.line,
            column: 1,
            message: `Nested diagrams open each other in a loop: ${cycle.map(display).join(" opens ")}. "${component.name}" can't open "${display(component.opens)}" until the loop is broken.`,
          });
        }
        continue;
      }
      visit(component.opens, [...path, folder]);
    }
  };
  visit(root, []);
  return diagnostics;
}

function display(folder: string): string {
  return folder.length === 0 ? "the top-level diagram" : folder;
}

/** Ports and missing folders for every `opens:` in a diagram (NE-1, NE-4). */
export function checkNestedReferences(loader: DiagramLoader, diagram: Diagram): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const component of diagram.components.values()) {
    if (component.opens === null) continue;
    if (!loader.has(component.opens)) {
      diagnostics.push({
        severity: "error",
        file: component.source.file,
        line: component.source.line,
        column: 1,
        message: `"${component.name}" opens "${component.opens}", but that folder has no mogram.yaml yet.`,
      });
    }
  }
  for (const connection of diagram.connections.values()) {
    for (const endpoint of [connection.from, connection.to]) {
      if (endpoint.port === null) continue;
      const owner = diagram.components.get(endpoint.element);
      if (owner?.opens == null || !loader.has(owner.opens)) continue;
      const nested = loader.load(owner.opens).diagram;
      if (!nested.settings.ports.has(endpoint.port)) {
        const known = [...nested.settings.ports.keys()];
        diagnostics.push({
          severity: "error",
          file: connection.source.file,
          line: connection.source.line,
          column: 1,
          message: `Connection "${connection.name}" uses port "${endpoint.port}" on "${owner.name}", but ${display(owner.opens)} only declares ${known.length === 0 ? "no ports" : known.map((p) => `"${p}"`).join(", ")}.`,
        });
      }
    }
  }
  return diagnostics;
}

/** A parent neighbour shown as a faded stub at the edge of a nested diagram (NE-5). */
export interface Stub {
  readonly connection: string;
  /** The element outside, in the parent diagram. */
  readonly neighbour: string;
  readonly neighbourLabel: string;
  /** "in" when traffic arrives from the neighbour. */
  readonly direction: "in" | "out";
  readonly port: string | null;
  /** Element inside the nested diagram the port leads to. */
  readonly inner: string | null;
}

export function stubsFor(parent: Diagram, owner: string, nested: Diagram): Stub[] {
  const stubs: Stub[] = [];
  for (const connection of parent.connections.values()) {
    const into = connection.to.element === owner;
    const outOf = connection.from.element === owner;
    if (!into && !outOf) continue;
    const ownEnd = into ? connection.to : connection.from;
    const other = into ? connection.from : connection.to;
    const neighbour = parent.components.get(other.element) ?? parent.containers.get(other.element);
    stubs.push({
      connection: connection.name,
      neighbour: other.element,
      neighbourLabel: neighbour?.label ?? other.element,
      direction: into ? "in" : "out",
      port: ownEnd.port,
      inner: ownEnd.port === null ? null : (nested.settings.ports.get(ownEnd.port) ?? null),
    });
  }
  return stubs;
}

/** A level in the nesting, for breadcrumbs and deep links (NE-8, NE-9). */
export interface Level {
  /** Component path from the top, e.g. ["aks"] or ["aks", "ingress"]. */
  readonly path: readonly string[];
  readonly folder: string;
  readonly label: string;
}

/** Where nested diagrams are read from: a `DiagramLoader`, or an app's own parse cache. */
export interface LevelSource {
  has(folder: string): boolean;
  load(folder: string): ParseResult;
}

const MAX_DEPTH = 32;

/**
 * Follows a level path like `aks/ingress` as far as it leads: the top level first, then one level
 * per component that opens a diagram. Stops at the first step that doesn't (an element renamed or
 * deleted since), so the result always has at least the top level.
 */
export function followLevels(source: LevelSource, path: readonly string[], root = ""): Level[] {
  const levels: Level[] = [
    { path: [], folder: root, label: source.load(root).diagram.settings.name },
  ];
  let folder = root;
  for (let i = 0; i < path.length && i < MAX_DEPTH; i++) {
    const name = path[i];
    if (name === undefined) break;
    const component = source.load(folder).diagram.components.get(name);
    if (component?.opens == null || !source.has(component.opens)) break;
    folder = component.opens;
    levels.push({ path: path.slice(0, i + 1), folder, label: component.label });
  }
  return levels;
}

/** Resolves a level path into the chain of folders, or null if any step is broken. */
export function resolveLevels(
  source: LevelSource,
  path: readonly string[],
  root = "",
): Level[] | null {
  const levels = followLevels(source, path, root);
  return levels.length === path.length + 1 ? levels : null;
}

export interface InstanceInput {
  readonly folder: string;
  readonly scene: readonly SceneEntry[];
  readonly viewer: readonly SceneEntry[];
  readonly ownerDown: boolean;
}

/**
 * Resolves the state of one instance of a diagram, recursing into nested instances for roll-up
 * (NE-11 … NE-14). Depth is bounded so a loop can never hang the app.
 */
export function resolveInstance(
  loader: DiagramLoader,
  input: InstanceInput,
  depth = 0,
): ResolvedState {
  const { diagram } = loader.load(input.folder);
  return resolveState({
    diagram,
    scene: input.scene,
    viewer: input.viewer,
    ownerDown: input.ownerDown,
    nestedWorst: (component, entries): StatePreset | null => {
      const opens = diagram.components.get(component)?.opens ?? null;
      if (opens === null || depth >= 16 || !loader.has(opens)) return null;
      return worstState(
        resolveInstance(
          loader,
          { folder: opens, scene: entries.scene, viewer: entries.viewer, ownerDown: false },
          depth + 1,
        ),
      );
    },
  });
}
