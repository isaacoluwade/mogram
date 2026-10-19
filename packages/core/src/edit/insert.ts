import { isMap, isScalar, parseDocument, type Node, type Pair, type YAMLMap } from "yaml";
import { YAML_PARSE_OPTIONS } from "../format/yaml-read";
import { isValidName } from "../model/names";
import type { Diagram, ProjectFiles } from "../model/types";
import { edit, type EditResult } from "./context";
import { EditError } from "./session";

/** Sections that define canvas elements, in the order they're added. */
const ELEMENT_SECTIONS = ["containers", "components", "shapes", "groups", "connections"] as const;
/** Everything a snippet may hold. */
const SECTIONS = new Set<string>([...ELEMENT_SECTIONS, "layout", "scenes", "tours", "styles"]);

const keyOf = (pair: Pair): string => {
  const key = pair.key;
  if (typeof key === "string") return key;
  if (key !== null && typeof key === "object" && "value" in key) return String(key.value);
  return String(key);
};

const clone = (value: unknown): unknown =>
  value !== null && typeof value === "object" && "clone" in value ? (value as Node).clone() : value;

/**
 * Adds what a YAML snippet defines, kept as written (the assistant's `add_elements`):
 * containers, components, shapes, groups, connections, layout entries and decorations, scenes,
 * tours and named styles. Every name is kept, and one that's already taken is refused, so
 * connections in the snippet can name existing elements and the result is predictable.
 * Elements without a layout entry are placed automatically. Layout entries may also move
 * existing elements. Whether the result makes sense (a parent that exists, an icon that does) is
 * left to the caller, which parses the result.
 */
export function insertYaml(
  files: ProjectFiles,
  diagram: Diagram,
  args: { readonly text: string },
): EditResult {
  const doc = parseDocument(args.text, YAML_PARSE_OPTIONS);
  const problem = doc.errors[0];
  if (problem !== undefined)
    throw new EditError(`The YAML doesn't read: ${problem.message.split("\n")[0] ?? ""}`);
  const root = doc.contents;
  if (!isMap(root)) throw new EditError("Give the YAML as sections, like `components:`.");
  const unknown = root.items.map(keyOf).filter((key) => !SECTIONS.has(key));
  if (unknown.length > 0)
    throw new EditError(
      `${unknown.map((k) => `"${k}"`).join(", ")} can't be added this way: a snippet holds ${[...SECTIONS].join(", ")}.`,
    );
  const section = (name: string): YAMLMap | null => {
    const node = root.get(name, true) as Node | null | undefined;
    // `components:` with nothing under it.
    if (node == null || (isScalar(node) && node.value === null)) return null;
    if (!isMap(node)) throw new EditError(`"${name}" should be a map of names.`);
    return node;
  };

  return edit(files, diagram, (ctx) => {
    const added: string[] = [];
    const claim = (name: string) => {
      if (!isValidName(name))
        throw new EditError(
          `"${name}" isn't a valid name: start with a letter, then letters, digits, _ or -.`,
        );
      if (ctx.isTaken(name))
        throw new EditError(
          `"${name}" already exists. Change it with update_elements, or pick another name.`,
        );
      ctx.claimName(name);
      added.push(name);
    };
    const parentOf = (node: unknown): string | null => {
      if (!isMap(node)) return null;
      const parent = node.get("in");
      return typeof parent === "string" ? parent : null;
    };

    for (const name of ELEMENT_SECTIONS) {
      const map = section(name);
      if (map === null) continue;
      for (const pair of map.items) {
        const key = keyOf(pair);
        claim(key);
        const home = ctx.homeFor(parentOf(pair.value));
        ctx.session.section(home, name).set(key, clone(pair.value));
      }
    }

    const layout = section("layout");
    if (layout !== null) {
      for (const pair of layout.items) {
        const key = keyOf(pair);
        if (key === "decorations") {
          if (!isMap(pair.value)) throw new EditError("`layout.decorations` should be a map.");
          for (const item of pair.value.items) {
            const name = keyOf(item);
            claim(name);
            ctx.decorationsMap().set(name, clone(item.value));
          }
          continue;
        }
        if (!added.includes(key) && ctx.kindOf(key) === null)
          throw new EditError(`The layout names "${key}", which isn't in the diagram.`);
        ctx
          .layoutSection(ctx.kindOf(key) === null ? undefined : ctx.layoutFileOf(key))
          .set(key, clone(pair.value));
      }
    }

    const story = (kind: "scenes" | "tours") => {
      const map = section(kind);
      if (map === null) return;
      const taken = new Set(
        (kind === "scenes" ? diagram.scenes : diagram.tours).map((s) => s.name),
      );
      const target = ctx.session.section(ctx.sectionFile(kind), kind);
      for (const pair of map.items) {
        const key = keyOf(pair);
        if (taken.has(key) || target.has(key))
          throw new EditError(
            `There's already a ${kind === "scenes" ? "scene" : "tour"} "${key}".`,
          );
        target.set(key, clone(pair.value));
      }
    };
    story("scenes");
    story("tours");

    const styles = section("styles");
    if (styles !== null) {
      const target = ctx.session.section(diagram.settingsFile, "styles");
      for (const pair of styles.items) {
        const key = keyOf(pair);
        if (diagram.styles.has(key) || target.has(key))
          throw new EditError(`There's already a style "${key}".`);
        target.set(key, clone(pair.value));
      }
    }

    if (
      added.length === 0 &&
      section("scenes") === null &&
      section("tours") === null &&
      styles === null &&
      layout === null
    )
      throw new EditError("The snippet doesn't define anything.");
    return added;
  });
}
