import { isMap, parseDocument, type Document, type Node } from "yaml";
import { parseDiagram } from "../format/parse";
import { YAML_PARSE_OPTIONS } from "../format/yaml-read";
import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditContext, type EditResult } from "./context";
import { EditError } from "./session";

/**
 * Bring back named elements and scenes from another version of the project (version history,
 * "Bring back"), leaving everything else as it is now. An element that still exists gets its
 * old definition and place; one that's gone comes back, with any of its children and the
 * connections to it that are gone too. Each comes back as it was written, so nothing is
 * renamed or reformatted.
 */
export function restoreElements(
  files: ProjectFiles,
  diagram: Diagram,
  args: {
    /** The other version's files (same project). */
    readonly from: ProjectFiles;
    readonly names: readonly string[];
    readonly scenes?: readonly string[];
  },
): EditResult {
  const old = parseDiagram(args.from, diagram.folder).diagram;
  const docs = new Map<string, Document.Parsed>();
  const docOf = (path: string): Document.Parsed | null => {
    const text = args.from[path];
    if (text === undefined) return null;
    let doc = docs.get(path);
    if (doc === undefined) {
      doc = parseDocument(text, YAML_PARSE_OPTIONS);
      docs.set(path, doc);
    }
    return doc;
  };
  /** A node from the old version, cloned so it can go into this one. */
  const oldNode = (path: string, keys: readonly string[]): Node | null => {
    let node: unknown = docOf(path)?.contents ?? null;
    for (const key of keys) {
      if (!isMap(node)) return null;
      node = node.get(key, true);
    }
    return node !== null && node !== undefined && typeof node === "object" && "clone" in node
      ? ((node as Node).clone() as Node)
      : null;
  };

  const kindOf = (name: string) =>
    old.components.has(name)
      ? old.components.get(name)?.shape == null
        ? ("components" as const)
        : ("shapes" as const)
      : old.containers.has(name)
        ? ("containers" as const)
        : old.groups.has(name)
          ? ("groups" as const)
          : old.connections.has(name)
            ? ("connections" as const)
            : old.decorations.has(name)
              ? ("decorations" as const)
              : null;

  const missing = args.names.filter((name) => kindOf(name) === null);
  if (missing.length > 0)
    throw new EditError(`${missing.map((n) => `"${n}"`).join(", ")} isn't in that version.`);

  const exists = (name: string): boolean =>
    diagram.components.has(name) ||
    diagram.containers.has(name) ||
    diagram.groups.has(name) ||
    diagram.connections.has(name) ||
    diagram.decorations.has(name);

  // What comes back: what was asked for, its children that are gone, and the connections to it
  // that are gone and whose other end is here (or coming back).
  const restoring = new Set(args.names);
  const addChildren = (name: string) => {
    for (const child of [...old.containers.values(), ...old.components.values()]) {
      if (child.parent === name && !exists(child.name) && !restoring.has(child.name)) {
        restoring.add(child.name);
        addChildren(child.name);
      }
    }
  };
  for (const name of args.names) if (old.containers.has(name)) addChildren(name);
  for (const connection of old.connections.values()) {
    if (exists(connection.name) || restoring.has(connection.name)) continue;
    const ends = [connection.from.element, connection.to.element];
    const touches = ends.some((end) => restoring.has(end));
    const reachable = ends.every((end) => restoring.has(end) || exists(end));
    if (touches && reachable) restoring.add(connection.name);
  }

  // Parents before children, so a container is in place before what goes in it.
  const depth = (name: string): number => {
    const parent = old.containers.get(name)?.parent ?? old.components.get(name)?.parent ?? null;
    return parent === null ? 0 : depth(parent) + 1;
  };
  const order = [...restoring].sort((a, b) => depth(a) - depth(b));

  return edit(files, diagram, (ctx) => {
    for (const name of order) restoreOne(ctx, name);
    for (const scene of args.scenes ?? []) restoreScene(ctx, scene);
    return order.filter((name) => kindOf(name) !== "connections");
  });

  function restoreOne(ctx: EditContext, name: string): void {
    const section = kindOf(name);
    if (section === null) return;
    const model =
      old.components.get(name) ??
      old.containers.get(name) ??
      old.groups.get(name) ??
      old.connections.get(name) ??
      old.decorations.get(name);
    if (model === undefined) return;
    const node =
      section === "decorations"
        ? oldNode(model.source.file, ["layout", "decorations", name])
        : oldNode(model.source.file, [section, name]);
    if (node === null) throw new EditError(`"${name}" couldn't be read from that version.`);

    // Its container must be here (or coming back); otherwise it comes back at the top level.
    const parent = "parent" in model ? model.parent : null;
    const parentHere = parent !== null && (diagram.containers.has(parent) || restoring.has(parent));
    if (parent !== null && !parentHere && isMap(node)) node.delete("in");

    if (exists(name)) ctx.removeDefinition(name);
    if (section === "decorations") {
      ctx.decorationsMap(ctx.layoutFileOf(name)).set(name, node);
    } else {
      const home = exists(name)
        ? ctx.fileOf(name)
        : ctx.homeFor(parentHere && diagram.containers.has(parent) ? parent : null);
      ctx.session.section(home, section).set(name, node);
    }

    // Its place: as it was, or (if it had none) wherever automatic placement puts it.
    if (section === "decorations") return;
    const entry = old.layout.get(name);
    const placed = entry === undefined ? null : oldNode(entry.source.file, ["layout", name]);
    if (placed === null) ctx.removeLayout(name);
    else ctx.layoutSection(ctx.layoutFileOf(name)).set(name, placed);
  }

  function restoreScene(ctx: EditContext, name: string): void {
    const scene = old.scenes.find((s) => s.name === name);
    if (scene === undefined) throw new EditError(`Scene "${name}" isn't in that version.`);
    const node = oldNode(scene.source.file, ["scenes", name]);
    if (node === null) throw new EditError(`Scene "${name}" couldn't be read from that version.`);
    ctx.session.section(ctx.storyFile("scenes"), "scenes").set(name, node);
  }
}
