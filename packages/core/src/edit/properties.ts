import { isNode, parseDocument, stringify, type Node } from "yaml";
import {
  COMPONENT_KEYS,
  CONNECTION_KEYS,
  CONTAINER_KEYS,
  GROUP_KEYS,
  SHAPE_KEYS,
} from "../format/read";
import { DECORATION_KEYS } from "../format/read-layout";
import { YAML_PARSE_OPTIONS } from "../format/yaml-read";
import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditResult, type ElementKind } from "./context";
import { EditError } from "./session";

/**
 * The "All properties" grid (04-format-panel §16.7, draw.io's property grid): every key an
 * element can take, from the same lists the reader checks, with what the file says for each, as
 * YAML text. Editing one writes that text back as the key's value; empty removes the key.
 */

/** Keys that live elsewhere in the inspector (position, nesting in a container) or the layout. */
const HIDDEN = new Set(["at", "size", "z", "in", "members"]);

/** Keys a shape takes (it's a component drawn as an outline, written under `shapes:`). */
export const SHAPE_PROPERTY_KEYS: readonly string[] = SHAPE_KEYS.filter((key) => !HIDDEN.has(key));

export const ELEMENT_KEYS: Readonly<Record<ElementKind, readonly string[]>> = {
  component: COMPONENT_KEYS.filter((key) => !HIDDEN.has(key)),
  container: CONTAINER_KEYS.filter((key) => !HIDDEN.has(key)),
  group: GROUP_KEYS.filter((key) => !HIDDEN.has(key)),
  connection: CONNECTION_KEYS.filter((key) => !HIDDEN.has(key)),
  decoration: DECORATION_KEYS.filter((key) => !HIDDEN.has(key) && key !== "locked"),
};

export interface PropertyRow {
  readonly key: string;
  /** The value as written, in YAML (flow style); null when the key isn't written. */
  readonly value: string | null;
}

export function readProperties(files: ProjectFiles, diagram: Diagram, name: string): PropertyRow[] {
  let rows: PropertyRow[] = [];
  edit(files, diagram, (ctx) => {
    const kind = ctx.kindOf(name);
    if (kind === null) return;
    const map = ctx.definition(name);
    rows = (ctx.isShape(name) ? SHAPE_PROPERTY_KEYS : ELEMENT_KEYS[kind]).map((key) => {
      const node: unknown = map.get(key, true);
      return { key, value: isNode(node) ? yamlText(node) : null };
    });
  });
  return rows;
}

function yamlText(node: Node): string {
  return stringify(node, { flowCollectionPadding: true, lineWidth: 0 }).trimEnd();
}

export function setProperty(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly name: string; readonly key: string; readonly text: string },
): EditResult {
  return edit(files, diagram, (ctx) => {
    const kind = ctx.requireKind(args.name);
    const keys = ctx.isShape(args.name) ? SHAPE_PROPERTY_KEYS : ELEMENT_KEYS[kind];
    if (!keys.includes(args.key))
      throw new EditError(`"${args.key}" isn't a property a ${kind} takes.`);
    const map = ctx.definition(args.name);
    if (args.text.trim().length === 0) {
      map.delete(args.key);
      return [args.name];
    }
    const doc = parseDocument(args.text, YAML_PARSE_OPTIONS);
    if (doc.errors.length > 0 || !isNode(doc.contents))
      throw new EditError(`That isn't a YAML value: ${doc.errors[0]?.message ?? args.text}`);
    const node = doc.contents;
    // Lists and maps stay on one line, as Mogram writes them.
    if ("flow" in node) (node as { flow: boolean }).flow = true;
    map.set(args.key, node);
    return [args.name];
  });
}
